// One test per defect found in the code audit of 1 Oct 2026 (docs/REVIEW.md, pass 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrate } from '../src/core/puzzle.js';
import { planHint } from '../src/core/hints.js';
import { solveLogically, findSolutions } from '../src/core/solver.js';
import { givenValues } from '../src/core/puzzle.js';
import { migrate, freshSave } from '../src/game/storage.js';
import { Session, TRAY } from '../src/game/session.js';
import { CHAPTERS } from '../src/game/levels.js';
import { endlessPuzzle, streakAlive } from '../src/game/daily.js';

test('hints on deep 4x4 puzzles always end in a placement, and the placement is right', () => {
  let checked = 0;
  for (const band of [4, 5]) {
    for (const seed of ['r1', 'r2', 'r3', 'r4']) {
      const spec = endlessPuzzle('fill4', band, seed);
      const p = hydrate(spec);
      const sol = findSolutions(p, { limit: 2 });
      assert.equal(sol.length, 1);
      const h = planHint(p, givenValues(p));
      const g = h.tiers[2].ghost;
      assert.ok(g, `band ${band} ${seed}: tier 3 places a stone`);
      assert.equal(g.value, sol[0][g.cell]);
      checked++;
    }
  }
  assert.equal(checked, 8);
});

test('a clash between two stones blames the pair, not one innocent stone', () => {
  const p = hydrate(CHAPTERS[0].puzzles[5]); // c1-06: the cross around a fixed 5
  const v = givenValues(p);
  v[1] = 1; // top middle
  v[3] = 9; // middle left
  const h = planHint(p, v);
  assert.match(h.tiers[0].text, /Two of your stones cannot both stay/);
});

test('the solver refuses an unknown technique cap', () => {
  const p = hydrate(CHAPTERS[0].puzzles[0]);
  assert.throws(() => solveLogically(p, { maxTechnique: 'place' }));
});

test('saves with bad fields fall back field by field', () => {
  const m = migrate({ v: 1, daily: { records: null, streak: 'x', lastDate: 5 }, settings: { sound: 'yes', textScale: 9, haptics: false }, completed: 'nope', current: { spec: 1 } });
  assert.deepEqual(m.daily, freshSave().daily);
  assert.equal(m.settings.sound, true);
  assert.equal(m.settings.textScale, 1);
  assert.equal(m.settings.haptics, false, 'good values survive');
  assert.deepEqual(m.completed, {});
  assert.equal(m.current, null);
});

test('a saved stone in a space that does not exist is a corrupt save', () => {
  const spec = CHAPTERS[0].puzzles[6];
  const s = new Session(spec);
  const bad = { ...s.toJSON(), pos: { t9: 99 } };
  assert.throws(() => Session.fromJSON(bad));
  const nan = { ...s.toJSON(), pos: { t9: 'abc' } };
  assert.throws(() => Session.fromJSON(nan));
  const r = new Session(CHAPTERS[2].puzzles[0]);
  const tray = { ...r.toJSON(), pos: { ...r.toJSON().pos, [r.tiles.find((t) => !t.locked).id]: TRAY } };
  assert.throws(() => Session.fromJSON(tray), 'restore stones never sit in the tray');
});

test('a streak shows only while it is unbroken', () => {
  assert.ok(streakAlive({ streak: 3, lastDate: '2026-10-01' }, '2026-10-01'));
  assert.ok(streakAlive({ streak: 3, lastDate: '2026-09-30' }, '2026-10-01'));
  assert.ok(!streakAlive({ streak: 3, lastDate: '2026-09-28' }, '2026-10-01'));
});
