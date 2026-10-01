import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrate } from '../src/core/puzzle.js';
import { countSolutions, findSolutions, solveLogically } from '../src/core/solver.js';
import { rateDifficulty } from '../src/core/difficulty.js';
import { restoreDistance, startValues } from '../src/core/carver.js';
import { evaluateBoard } from '../src/core/constraints.js';
import { ARCHIVE as CHAPTERS, archiveFind as findLevel } from '../src/game/archive.js';
import { Session, TRAY } from '../src/game/session.js';
import { loadSave, writeSave, freshSave, migrate, SAVE_KEY } from '../src/game/storage.js';
import { dailyPuzzle, recordDaily, endlessPuzzle, localDateKey } from '../src/game/daily.js';

const allLevels = CHAPTERS.flatMap((c) => c.puzzles);

test('every archived level passes the validator', () => {
  assert.ok(allLevels.length >= 20);
  const ids = new Set();
  for (const spec of allLevels) {
    assert.ok(!ids.has(spec.id), `duplicate id ${spec.id}`);
    ids.add(spec.id);
    const p = hydrate(spec);
    const sols = findSolutions(p, { limit: 50 });
    assert.ok(sols.length >= 1, `${spec.id} has a solution`);
    if (p.kind === 'restore') {
      const v = startValues(p);
      assert.equal(evaluateBoard(p, v).solved, false, `${spec.id} starts broken`);
      assert.equal(restoreDistance(p, v).distance, spec.meta.swaps, `${spec.id} swap count`);
    }
  }
});

test('every full-square fill level is unique and solvable without guessing', () => {
  for (const spec of allLevels) {
    const p = hydrate(spec);
    if (p.kind !== 'fill' || p.shape.cells.length !== p.n * p.n) continue;
    assert.equal(countSolutions(p, 2), 1, `${spec.id} unique`);
    const r = solveLogically(p);
    assert.ok(r.solved, `${spec.id} logical`);
    if (spec.meta?.band) assert.equal(rateDifficulty(p).band, spec.meta.band, `${spec.id} band`);
  }
});

test('tutorial levels each teach with at least one wrong tile on offer, or a full square', () => {
  for (const spec of CHAPTERS[0].puzzles) {
    const p = hydrate(spec);
    const partial = p.shape.cells.length < 9;
    if (partial) assert.ok(p.pool.length >= p.shape.cells.length - Object.keys(p.givens).length);
  }
});

test('session: place, swap, return, undo, solve', () => {
  const s = new Session(CHAPTERS[0].puzzles[0]); // 8 _ 6, tray 1 4 7
  assert.equal(s.trayTiles().length, 3);
  assert.equal(s.move('t8', 7), null, 'locked tiles never move');
  assert.ok(s.move('t7', 7));
  assert.equal(s.evaluate().lines[0].status, 'wrong');
  assert.equal(s.mistakes, 1);
  assert.ok(s.move('t1', 7), 'dropping on an occupied cell swaps');
  assert.equal(s.pos.get('t7'), TRAY);
  assert.ok(s.solved);
  assert.equal(s.undo(), false, 'a solved square stays solved');
  const t = new Session(CHAPTERS[0].puzzles[0]);
  t.move('t4', 7);
  t.move('t4', TRAY);
  assert.equal(t.pos.get('t4'), TRAY);
  assert.ok(t.undo());
  assert.equal(t.pos.get('t4'), 7);
});

test('session: restore puzzles only swap', () => {
  const spec = findLevel('l6-01');
  const s = new Session(spec);
  const [a, b] = Object.keys(spec.start).map(Number);
  const ta = s.tileAt(a);
  assert.equal(s.move(ta.id, TRAY), null);
  assert.ok(s.move(ta.id, b));
  assert.equal(s.tileAt(b).id, ta.id);
});

test('session save and resume round-trip', () => {
  const s = new Session(findLevel('c1-07'));
  s.move('t9', 1);
  s.hints = 2;
  s.elapsed = 1234;
  const back = Session.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  assert.deepEqual(back.values(), s.values());
  assert.equal(back.hints, 2);
  assert.equal(back.elapsed, 1234);
  const corrupt = s.toJSON();
  corrupt.pos.t7 = 1;
  assert.throws(() => Session.fromJSON(corrupt));
});

test('storage: load, write, migrate, survive garbage', () => {
  const mem = new Map();
  const fake = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const save = loadSave(fake);
  assert.deepEqual(save, freshSave());
  save.completed['c1-01'] = { moves: 2 };
  save.settings.sound = false;
  writeSave(fake, save);
  const back = loadSave(fake);
  assert.equal(back.settings.sound, false);
  assert.equal(back.settings.ambience, true);
  assert.ok(back.completed['c1-01']);
  mem.set(SAVE_KEY, '{not json');
  assert.deepEqual(loadSave(fake), freshSave());
  assert.deepEqual(migrate({ v: 0 }), freshSave());
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  assert.deepEqual(loadSave(throwing), freshSave());
  assert.equal(writeSave(throwing, save), false);
});

test('daily square: same date, same puzzle; streaks count days in a row', () => {
  const a = dailyPuzzle('2026-10-01');
  const b = dailyPuzzle('2026-10-01');
  assert.deepEqual(a, b);
  assert.notDeepEqual(dailyPuzzle('2026-10-02').givens, a.givens);
  const p = hydrate(a);
  assert.equal(countSolutions(p, 2), 1);
  assert.equal(rateDifficulty(p).band, 3);
  const save = freshSave();
  recordDaily(save, '2026-09-30', { time: 1 });
  recordDaily(save, '2026-10-01', { time: 1 });
  assert.equal(save.daily.streak, 2);
  recordDaily(save, '2026-10-01', { time: 9 });
  assert.equal(save.daily.records['2026-10-01'].time, 1, 'first finish counts');
  recordDaily(save, '2026-10-05', { time: 1 });
  assert.equal(save.daily.streak, 1);
  assert.match(localDateKey(new Date(2026, 0, 5)), /^2026-01-05$/);
});

test('endless puzzles generate for every kind and band, quickly', () => {
  for (const [kind, bands] of [['fill3', [1, 2, 3]], ['restore3', [1, 2, 3]], ['fill4', [1, 2, 3, 4, 5]]]) {
    for (const band of bands) {
      const t = Date.now();
      const spec = endlessPuzzle(kind, band, 'seed-1');
      const ms = Date.now() - t;
      assert.ok(spec, `${kind} band ${band}`);
      assert.ok(ms < 4000, `${kind} band ${band} took ${ms} ms`);
      const p = hydrate(spec);
      if (p.kind === 'fill') assert.equal(rateDifficulty(p).band, band);
    }
  }
});

test('the archived path keeps its shape: short levels, 4x4 early', () => {
  assert.equal(CHAPTERS.length, 9);
  for (const c of CHAPTERS) assert.ok(c.puzzles.length >= 3 && c.puzzles.length <= 4, `${c.id} has 3 to 4 puzzles`);
  const flat = CHAPTERS.flatMap((c) => c.puzzles);
  const first4 = flat.findIndex((p) => p.n === 4);
  assert.ok(first4 >= 0 && first4 <= 12, `first 4x4 is puzzle ${first4 + 1}`);
});
