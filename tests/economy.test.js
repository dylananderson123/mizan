// Coins, progress and saves: the rules that must hold for the economy to be
// trusted. No browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { award, spend, canAfford, balance, rewardKey, STONE_SETS, buyStones, useStones, ownsStones } from '../src/game/economy.js';
import { recordCompletion, isBetter } from '../src/game/progress.js';
import { CHAPTERS, chapterOpen, levelOpen, nextLevel, firstUnfinished, findLevel, DAILY_AFTER } from '../src/game/levels.js';
import { loadSave, writeSave, freshSave, migrate, SAVE_KEY } from '../src/game/storage.js';

const fakeStorage = () => {
  const mem = new Map();
  return { mem, getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
};
const run = (moves = 4, hints = 0, time = 60000) => ({ moves, hints, time });

test('a reward is paid once per key and never again', () => {
  const save = freshSave();
  assert.equal(award(save, 'level:m1', 10).granted, 10);
  assert.equal(balance(save), 10);
  const again = award(save, 'level:m1', 10);
  assert.equal(again.granted, 0);
  assert.equal(again.reason, 'already paid');
  assert.equal(balance(save), 10, 'replaying cannot farm coins');
  for (let i = 0; i < 50; i++) award(save, 'level:m1', 10);
  assert.equal(balance(save), 10);
});

test('nonsense amounts pay nothing', () => {
  const save = freshSave();
  for (const bad of [0, -5, 2.5, NaN, '10', null, undefined]) assert.equal(award(save, `k:${bad}`, bad).granted, 0);
  assert.equal(balance(save), 0);
});

test('a key that changes can pay again: the shape a daily reward will use', () => {
  const save = freshSave();
  assert.equal(award(save, 'daily:2026-10-05', 5).granted, 5);
  assert.equal(award(save, 'daily:2026-10-05', 5).granted, 0, 'same day, nothing');
  assert.equal(award(save, 'daily:2026-10-06', 5).granted, 5, 'next day pays');
  assert.equal(balance(save), 10);
});

test('spending is built for later: it never goes below zero and is logged', () => {
  const save = freshSave();
  award(save, 'level:m1', 10);
  assert.equal(canAfford(save, 10), true);
  assert.equal(canAfford(save, 11), false);
  assert.deepEqual(spend(save, 'hint:m3', 11), { ok: false, balance: 10 });
  assert.deepEqual(spend(save, 'hint:m3', 4), { ok: true, balance: 6 });
  assert.equal(spend(save, 'free', 0).ok, false);
  assert.equal(spend(save, 'neg', -3).ok, false);
  assert.equal(balance(save), 6);
  assert.deepEqual(save.wallet.log.map((e) => e.delta), [10, -4]);
});

test('the log is capped so the save stays small', () => {
  const save = freshSave();
  for (let i = 0; i < 300; i++) award(save, `k${i}`, 1);
  assert.equal(save.wallet.log.length, 200);
  assert.equal(balance(save), 300);
});

test('the five levels pay 10, 15, 20, 25 and 30, and finishing in order opens each next level', () => {
  const save = freshSave();
  assert.deepEqual(save.unlocked, ['l1']);
  const paid = [];
  for (const ch of CHAPTERS.filter((c) => !c.sealed)) {
    assert.ok(chapterOpen(ch, save.completed, save.unlocked), `${ch.id} is open when reached`);
    const id = ch.puzzles[0].id;
    const r = recordCompletion(save, id, run());
    assert.equal(r.first, true);
    paid.push(r.coins);
  }
  assert.deepEqual(paid, [10, 15, 20, 25, 30]);
  assert.equal(balance(save), 100);
  assert.deepEqual(save.unlocked, ['l1', 'l2', 'l3', 'l4', 'l5'], 'the sealed level never opens');
  assert.equal(chapterOpen(CHAPTERS.at(-1), save.completed, save.unlocked), false);
  assert.equal(firstUnfinished(save.completed), null);
});

test('replaying a finished level pays nothing and cannot lose the first record', () => {
  const save = freshSave();
  recordCompletion(save, 'm1', run(6, 2, 90000));
  const r = recordCompletion(save, 'm1', run(9, 3, 99000));
  assert.equal(r.coins, 0);
  assert.equal(r.first, false);
  assert.equal(r.improved, false);
  assert.equal(balance(save), 10);
  assert.deepEqual(save.best.m1, { moves: 6, hints: 2, time: 90000 }, 'a worse run does not replace the best');
  assert.equal(save.completed.m1.moves, 6);
  const better = recordCompletion(save, 'm1', run(5, 0, 80000));
  assert.equal(better.improved, true);
  assert.equal(better.coins, 0, 'a better run is recorded but pays nothing');
  assert.deepEqual(save.best.m1, { moves: 5, hints: 0, time: 80000 });
  assert.equal(balance(save), 10);
});

test('best performance: fewer hints, then fewer moves, then less time', () => {
  assert.ok(isBetter(run(9, 0, 9), run(2, 1, 1)));
  assert.ok(isBetter(run(3, 1, 9), run(4, 1, 1)));
  assert.ok(isBetter(run(3, 1, 8), run(3, 1, 9)));
  assert.ok(!isBetter(run(3, 1, 9), run(3, 1, 9)));
  assert.ok(isBetter(run(1, 1, 1), undefined));
});

test('an unknown level pays nothing and changes nothing', () => {
  const save = freshSave();
  const before = JSON.stringify(save);
  const r = recordCompletion(save, 'nope', run());
  assert.equal(r.coins, 0);
  assert.equal(JSON.stringify(save), before);
});

test('progress, coins and unlocks survive a reload', () => {
  const store = fakeStorage();
  const save = loadSave(store);
  recordCompletion(save, 'm1', run(5, 1, 70000));
  recordCompletion(save, 'm2', run(6, 0, 50000));
  save.settings.reducedMotion = true;
  assert.ok(writeSave(store, save));
  const back = loadSave(store);
  assert.equal(balance(back), 25);
  assert.deepEqual(Object.keys(back.completed).sort(), ['m1', 'm2']);
  assert.deepEqual(back.unlocked, ['l1', 'l2', 'l3']);
  assert.deepEqual(back.best.m2, { moves: 6, hints: 0, time: 50000 });
  assert.equal(back.settings.reducedMotion, true);
  // and the farming guard survives too: a reload does not forget what was paid
  assert.equal(recordCompletion(back, 'm1', run()).coins, 0);
  assert.equal(balance(back), 25);
});

test('reset: a fresh save has no coins, no progress, only level 1 open, and keeps settings if asked', () => {
  const store = fakeStorage();
  const save = loadSave(store);
  recordCompletion(save, 'm1', run());
  const keep = save.settings;
  const clean = freshSave();
  clean.settings = keep;
  writeSave(store, clean);
  const back = loadSave(store);
  assert.equal(balance(back), 0);
  assert.deepEqual(back.completed, {});
  assert.deepEqual(back.unlocked, ['l1']);
  assert.deepEqual(back.best, {});
  assert.deepEqual(back.wallet.claimed, {});
});

test('levels open in order: nothing skips ahead', () => {
  const save = freshSave();
  const ids = CHAPTERS.filter((c) => !c.sealed).map((c) => c.puzzles[0].id);
  ids.forEach((id, i) => assert.equal(levelOpen(id, save.completed, save.unlocked), i === 0, id));
  assert.equal(nextLevel('m1').id, 'm2');
  assert.equal(nextLevel('m5'), null);
  assert.equal(findLevel('m4').chapter.skill, 'GENERALIZE');
  assert.equal(DAILY_AFTER, 'l3');
});

test('a damaged wallet or unlock list falls back to safe values', () => {
  const m = migrate({ v: 2, wallet: { coins: -4, claimed: { a: 'x', b: 5 }, log: [{ key: 1 }, { key: 'k', delta: 3, at: 9 }] }, unlocked: ['l3', 'bogus', 7], best: { m1: { moves: 'x' }, m2: { moves: 1, hints: 0, time: 5 } } });
  assert.equal(m.wallet.coins, 0);
  assert.deepEqual(m.wallet.claimed, { b: 5 });
  assert.deepEqual(m.wallet.log, [{ key: 'k', delta: 3, at: 9 }]);
  assert.deepEqual(m.unlocked.sort(), ['l1', 'l3']);
  assert.deepEqual(Object.keys(m.best), ['m2']);
  assert.deepEqual(migrate({ v: 2, wallet: 'junk' }).wallet, freshSave().wallet);
});

test('an old save keeps its settings and Daily record, and starts level progress again', () => {
  const old = { v: 1, settings: { sound: false, haptics: false, textScale: 1.3 }, completed: { 'c1-01': { moves: 3 } }, daily: { streak: 4, lastDate: '2026-09-30', records: { '2026-09-30': { time: 1 } } }, current: { spec: {}, pos: {} } };
  const m = migrate(old);
  assert.equal(m.v, 2);
  assert.equal(m.settings.sound, false);
  assert.equal(m.settings.textScale, 1.3);
  assert.equal(m.daily.streak, 4);
  assert.deepEqual(m.completed, {});
  assert.equal(m.current, null);
  assert.equal(balance(m), 0);
  assert.deepEqual(m.unlocked, ['l1']);
});

test('rewards grow with the challenge, and the reward key names the level', () => {
  const rewards = CHAPTERS.filter((c) => !c.sealed).map((c) => c.reward);
  for (let i = 1; i < rewards.length; i++) assert.ok(rewards[i] > rewards[i - 1]);
  assert.equal(rewardKey('level', 'm3'), 'level:m3');
});

test('storage still survives garbage and a storage that throws', () => {
  const store = fakeStorage();
  store.mem.set(SAVE_KEY, '{not json');
  assert.deepEqual(loadSave(store), freshSave());
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  assert.deepEqual(loadSave(throwing), freshSave());
  assert.equal(writeSave(throwing, freshSave()), false);
});

// ---- stone sets: the one thing coins buy

test('the two paid sets cost no more than the five levels pay', () => {
  const paid = CHAPTERS.filter((c) => !c.sealed).reduce((a, c) => a + (c.reward ?? 0), 0);
  const cost = STONE_SETS.reduce((a, x) => a + x.cost, 0);
  assert.equal(paid, 100);
  assert.ok(cost <= paid, `sets cost ${cost}, the game pays ${paid}`);
  assert.equal(STONE_SETS[0].cost, 0, 'the first set is free');
});

test('a set cannot be bought without the coins, or twice', () => {
  const save = freshSave();
  assert.equal(buyStones(save, 'lapis').reason, 'short');
  assert.equal(buyStones(save, 'lapis').need, 30);
  assert.deepEqual(save.owned, ['ivory']);
  award(save, 'level:m1', 10); award(save, 'level:m2', 15); award(save, 'level:m3', 20);
  const r = buyStones(save, 'lapis');
  assert.ok(r.ok);
  assert.equal(balance(save), 15);
  assert.equal(save.stones, 'lapis');
  assert.equal(buyStones(save, 'lapis').reason, 'owned');
  assert.equal(balance(save), 15, 'a second buy charges nothing');
  assert.equal(buyStones(save, 'nope').reason, 'unknown');
  assert.equal(buyStones(save, 'ivory').reason, 'owned');
});

test('an owned set can be put on and taken off; an unowned one cannot', () => {
  const save = freshSave();
  assert.equal(useStones(save, 'basalt'), false);
  assert.equal(save.stones, 'ivory');
  save.owned.push('lapis');
  assert.ok(useStones(save, 'lapis'));
  assert.ok(useStones(save, 'ivory'));
  assert.ok(ownsStones(save, 'lapis'));
});

test('buying then spending never takes the balance below zero, and a full game affords both sets', () => {
  const save = freshSave();
  for (const [k, v] of [['m1', 10], ['m2', 15], ['m3', 20], ['m4', 25], ['m5', 30]]) award(save, `level:${k}`, v);
  assert.ok(buyStones(save, 'basalt').ok);
  assert.ok(buyStones(save, 'lapis').ok);
  assert.equal(balance(save), 10);
  assert.deepEqual(save.owned.sort(), ['basalt', 'ivory', 'lapis']);
});

test('saves keep owned sets and refuse unknown ones or a set not owned', () => {
  const kept = migrate({ v: 2, owned: ['lapis', 'ghost', 7], stones: 'lapis' });
  assert.deepEqual(kept.owned.sort(), ['ivory', 'lapis']);
  assert.equal(kept.stones, 'lapis');
  const faked = migrate({ v: 2, owned: [], stones: 'basalt' });
  assert.equal(faked.stones, 'ivory', 'a set not owned falls back to ivory');
  assert.deepEqual(migrate({ v: 1, owned: ['lapis'] }).owned, ['ivory']);
});

test('a coin count JavaScript cannot add to is a damaged save', () => {
  for (const coins of [1e300, Infinity, NaN, -3, 2.5, '99', 2 ** 60]) {
    assert.equal(migrate({ v: 2, wallet: { coins, claimed: {}, log: [] } }).wallet.coins, 0, String(coins));
  }
  assert.equal(migrate({ v: 2, wallet: { coins: 70, claimed: {}, log: [] } }).wallet.coins, 70);
});
