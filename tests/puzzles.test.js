// The mathematics of the five-level demo, proved by the engine, not by eye.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelDef, TRIANGLE_SIDES, RING_PAIRS } from '../src/puzzles/definitions.js';
import { solve, evaluate, countSolutions, swapsBetween, sum, equalSum, allDifferent } from '../src/puzzles/kit.js';
import { levelDefIsValid } from '../src/puzzles/validate.js';
import { toLegacySpec } from '../src/puzzles/legacy.js';
import { layoutFor, PANEL } from '../src/puzzles/geometry.js';
import { planNodeHint, diagnoseSquare } from '../src/puzzles/hints.js';
import { hydrate } from '../src/core/puzzle.js';
import { findSolutions, countSolutions as legacyCount, solveLogically } from '../src/core/solver.js';
import { rateDifficulty } from '../src/core/difficulty.js';
import { restoreDistance, startValues, restoreTargets } from '../src/core/carver.js';
import { evaluateBoard } from '../src/core/constraints.js';
import { cellName } from '../src/core/hints.js';
import { Session, TRAY } from '../src/game/session.js';
import { NodeSession } from '../src/game/nodesession.js';

const [m1, m2, m3, m4, m5] = LEVELS;
const board = (def, over = {}) => ({ ...def.givens, ...def.initial, ...over });

test('five levels, five kinds of thinking, in order', () => {
  assert.deepEqual(LEVELS.map((d) => d.skill), ['CALCULATE', 'DETECT', 'OPTIMIZE', 'GENERALIZE', 'DISCOVER']);
  assert.equal(new Set(LEVELS.map((d) => d.id)).size, 5);
  for (const d of LEVELS) assert.ok(levelDefIsValid(d), d.id);
  const rewards = LEVELS.map((d) => d.reward);
  assert.deepEqual(rewards, [10, 15, 20, 25, 30]);
  assert.deepEqual(new Set(LEVELS.map((d) => d.geometry.kind)), new Set(['grid', 'triangle', 'ring']));
});

test('the validator refuses a definition that cannot be played', () => {
  const bad = (patch) => assert.throws(() => levelDefIsValid({ ...m1, ...patch }));
  bad({ nodes: [] });
  bad({ stones: [1, 1, 2] });
  bad({ givens: { 99: 4 } });
  bad({ givens: { 0: 77 } });
  bad({ constraints: [{ type: 'MYSTERY', id: 'x', cells: [0] }] });
  bad({ constraints: [sum('r', [0, 1, 99], 15)] });
  bad({ initial: { 0: 4 } }); // a movable stone on a given
});

// ------------------------------------------------------------ level 1

test('level 1: the square has one answer, a person can reach it, and both engines agree', () => {
  assert.equal(countSolutions(m1), 1);
  const [sol] = solve(m1);
  const p = hydrate(toLegacySpec(m1));
  const legacy = findSolutions(p, { limit: 5 });
  assert.equal(legacy.length, 1);
  assert.deepEqual(legacy[0], m1.nodes.map((n) => sol[n]), 'the kit and the original solver find the same square');
  assert.ok(solveLogically(p).solved, 'solvable without guessing');
  assert.ok(rateDifficulty(p).band <= 2, 'an introduction, not a trial');
  // every row, column and the main diagonal makes 15, and 1 to 9 are used once
  const g = m1.nodes.map((n) => sol[n]);
  assert.deepEqual([...g].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const [a, b, c] of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) assert.equal(g[a] + g[b] + g[c], 15);
});

test('the target is the one the maths gives: M = n(n^2+1)/2', () => {
  assert.equal((3 * (9 + 1)) / 2, 15);
  assert.equal(m1.target, 15);
});

// ------------------------------------------------------------ level 2

test('level 2: the engine finds the violated lines, and they cross at the one wrong stone', () => {
  const ev = evaluate(m2, board(m2));
  assert.equal(ev.complete, true, 'it looks finished');
  assert.equal(ev.solved, false);
  const wrong = ev.results.filter((r) => r.status === 'wrong').map((r) => r.id).sort();
  assert.deepEqual(wrong, ['a', 'c0', 'r2']);
  // each violated line is 2 high, and the cell they all share is the bad one
  for (const r of ev.results.filter((x) => x.status === 'wrong' && x.type === 'SUM')) assert.equal(r.total - 15, 2);
  const lines = m2.constraints.filter((c) => wrong.includes(c.id));
  const shared = m2.nodes.filter((n) => lines.every((c) => c.cells.includes(n)));
  assert.deepEqual(shared, [6]);
  assert.equal(m2.initial[6], 10);
});

test('level 2: exactly one single-stone change repairs it, and every solution is the same square', () => {
  const fixes = [];
  const onBoard = new Set(Object.values(m2.initial));
  const tray = m2.stones.filter((v) => !onBoard.has(v));
  assert.equal(tray.length, 2);
  for (const n of m2.nodes) {
    for (const v of tray) {
      if (evaluate(m2, { ...m2.initial, [n]: v }).solved) fixes.push([n, v]);
    }
  }
  assert.deepEqual(fixes, [[6, 8]]);
  const sols = solve(m2);
  assert.equal(sols.length, 8, 'the square and its seven turnings and reflections');
  const real = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const s of sols) assert.deepEqual(new Set(Object.values(s)), real, 'no solution uses the wrong stone or a spare');
  assert.equal(15, 3 * 5, 'the total is three times the centre');
});

test('level 2: the hint is worked out from the board, and names the stone and its number', () => {
  const spec = toLegacySpec(m2);
  const p = hydrate(spec);
  const sess = new Session(spec);
  const lines = sess.evaluate().lines;
  const d = diagnoseSquare(p, lines, sess.values(), (c) => cellName(3, c), sess.trayTiles().map((t) => t.value));
  assert.ok(d);
  assert.deepEqual(d.tiers[1].cells, [6]);
  assert.match(d.tiers[1].text, /bottom left/);
  assert.match(d.tiers[2].text, /10 should be 8/);
  assert.deepEqual(d.tiers[2].tiles.sort((a, b) => a - b), [8, 10]);
});

test('level 2: played through the board, one swap of the tray stone solves it', () => {
  const s = new Session(toLegacySpec(m2));
  assert.equal(s.solved, false);
  assert.ok(s.move('t8', 6), 'drop the 8 on the 10');
  assert.equal(s.pos.get('t10'), TRAY, 'the 10 goes to the tray');
  assert.ok(s.solved);
});

// ------------------------------------------------------------ level 3

test('level 3: all of 1 to 9 are present once, and exactly one swap restores the square', () => {
  const v = m3.nodes.map((n) => m3.initial[n]);
  assert.deepEqual([...v].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(evaluate(m3, board(m3)).solved, false);
  const fixes = [];
  for (let a = 0; a < 9; a++) {
    for (let b = a + 1; b < 9; b++) {
      const t = { ...m3.initial };
      [t[a], t[b]] = [t[b], t[a]];
      if (evaluate(m3, t).solved) fixes.push([a, b]);
    }
  }
  assert.deepEqual(fixes, [[3, 5]], 'one swap, and only one, works');
  // the swap distance to the nearest valid square is 1, and 7 others are further
  const sols = solve(m3).map((s) => m3.nodes.map((n) => s[n]));
  const dist = sols.map((t) => swapsBetween(m3, v, t)).sort();
  assert.equal(dist[0], 1);
  assert.ok(dist.slice(1).every((d) => d >= 2), `the other squares are further: ${dist}`);
  // the original engine agrees on the distance
  const p = hydrate(toLegacySpec(m3));
  assert.equal(restoreDistance(p, startValues(p)).distance, 1);
  assert.equal(restoreTargets(p).length, 8);
});

test('level 3: no swap limit, any number of swaps, the right one solves it', () => {
  const s = new Session(toLegacySpec(m3));
  assert.equal(s.p.limit, undefined);
  assert.ok(s.move('t5', 3), 'a wrong swap');
  assert.ok(s.move('t4', 4), 'a second swap is allowed');
  assert.ok(s.move('t9', 0), 'and a third');
  assert.equal(s.atLimit(), false);
  assert.equal(s.moves, 3);
  while (s.undo());
  assert.equal(s.moves, 0);
  assert.ok(s.move('t7', 5), 'the right swap: 7 into the 3\'s place');
  assert.ok(s.solved);
});

test('engine: a puzzle that does set a swap limit still enforces it and undo gives it back', () => {
  const s = new Session({ ...toLegacySpec(m3), limit: 1 });
  assert.equal(s.p.limit, 1);
  assert.ok(s.move('t5', 4 - 1), 'a wrong swap uses the one swap');
  assert.equal(s.atLimit(), true);
  assert.equal(s.move('t4', 4), null, 'no second swap');
  assert.ok(s.undo());
  assert.equal(s.atLimit(), false);
  assert.equal(s.tries, 1, 'tries count what was attempted');
  assert.ok(s.move('t7', 5), 'the right swap: 7 into the 3\'s place');
  assert.ok(s.solved);
  assert.equal(s.moves, 1);
  const back = Session.fromJSON(JSON.parse(JSON.stringify(new Session(toLegacySpec(m3)).toJSON())));
  const withLimit = Session.fromJSON(JSON.parse(JSON.stringify(new Session({ ...toLegacySpec(m3), limit: 1 }).toJSON())));
  assert.equal(withLimit.p.limit, 1, 'the limit survives a save');
  assert.equal(back.p.limit, undefined, 'and no limit stays no limit');
});

// ------------------------------------------------------------ level 4

test('level 4: the triangle matches the NRICH problem: 864 arrangements, totals 17 to 23', () => {
  const open = { ...m4, givens: {} };
  const all = solve(open);
  assert.equal(all.length, 864);
  const totals = {};
  for (const s of all) {
    const t = TRIANGLE_SIDES[0].reduce((a, n) => a + s[n], 0);
    totals[t] = (totals[t] ?? 0) + 1;
  }
  assert.deepEqual(totals, { 17: 96, 19: 192, 20: 288, 21: 192, 23: 96 }, 'no triangle makes 18 or 22');
  // the corners count twice: 3 x total = 45 + corners
  for (const s of all) assert.equal(3 * TRIANGLE_SIDES[0].reduce((a, n) => a + s[n], 0), 45 + s[0] + s[1] + s[2]);
});

test('level 4: as built, two arrangements remain and both balance', () => {
  const sols = solve(m4);
  assert.equal(sols.length, 2);
  const [a, b] = sols;
  const differ = m4.nodes.filter((n) => a[n] !== b[n]);
  assert.deepEqual(differ, [7, 8], 'they differ only in the two middle stones of one side');
  for (const s of sols) {
    const totals = TRIANGLE_SIDES.map((side) => side.reduce((x, n) => x + s[n], 0));
    assert.equal(new Set(totals).size, 1);
    assert.equal(totals[0], 20);
    assert.equal(new Set(Object.values(s)).size, 9);
  }
  assert.equal(evaluate(m4, board(m4)).solved, false);
});

test('level 4: the engine reads a half-built triangle', () => {
  const half = board(m4, { 4: 8 }); // side A: 1 + 6 + 8 + 5 = 20
  const ev = evaluate(m4, half);
  assert.equal(ev.results[0].status, 'partial');
  assert.deepEqual(ev.results[0].totals, [20, 20, 10], 'sides A and B full at 20; C holds the 9 and the apex 1');
  const clash = evaluate(m4, board(m4, { 4: 9 })); // side A makes 21 while B is full at 20
  assert.equal(clash.results[0].status, 'strained', 'two full sides that disagree');
});

// ------------------------------------------------------------ level 5

test('level 5: the three examples follow the rule and are whole rings of 1 to 8', () => {
  assert.equal(m5.examples.length, 3);
  for (const ring of m5.examples) {
    assert.deepEqual([...ring].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
    const vals = Object.fromEntries(ring.map((v, i) => [i, v]));
    assert.equal(evaluate(m5, vals).solved, true, `the engine accepts ${ring}`);
    for (const [a, b] of RING_PAIRS) assert.equal(ring[a] + ring[b], 9);
  }
  assert.equal(new Set(m5.examples.map((r) => r.join())).size, 3, 'three different rings');
});

test('level 5: the examples admit only one simple rule, so the discovery is fair', () => {
  const at = (r, i) => r[(i + 8) % 8];
  const pairsAt = (k) => (k === 4 ? [0, 1, 2, 3].map((i) => [i, i + 4]) : Array.from({ length: 8 }, (_, i) => [i, (i + k) % 8]));
  const allEqual = (xs) => xs.every((x) => x === xs[0]);
  const hyps = [];
  for (let k = 1; k <= 4; k++) {
    hyps.push({ name: `step ${k}: pairs have equal sums`, ok: (r) => allEqual(pairsAt(k).map(([i, j]) => r[i] + r[j])) });
    hyps.push({ name: `step ${k}: pairs have equal differences`, ok: (r) => allEqual(pairsAt(k).map(([i, j]) => Math.abs(r[i] - r[j]))) });
    hyps.push({ name: `step ${k}: pairs have equal products`, ok: (r) => allEqual(pairsAt(k).map(([i, j]) => r[i] * r[j])) });
  }
  hyps.push({ name: 'each stone is 1 more than the last, round the ring', ok: (r) => r.every((v, i) => (at(r, i + 1) - v + 8) % 8 === 1) });
  hyps.push({ name: 'each step round the ring is the same size', ok: (r) => allEqual(r.map((v, i) => (at(r, i + 1) - v + 8) % 8)) });
  hyps.push({ name: 'odd and even alternate round the ring', ok: (r) => r.every((v, i) => v % 2 !== at(r, i + 1) % 2) });
  hyps.push({ name: 'opposite stones differ by 4', ok: (r) => [0, 1, 2, 3].every((i) => Math.abs(r[i] - r[i + 4]) === 4) });
  hyps.push({ name: 'the biggest is next to the smallest', ok: (r) => { const i = r.indexOf(8); return at(r, i + 1) === 1 || at(r, i - 1) === 1; } });
  const fits = hyps.filter((h) => m5.examples.every((r) => h.ok(r)));
  assert.deepEqual(fits.map((h) => h.name), ['step 4: pairs have equal sums'], 'one rule fits all three');
  // and the unfinished ring, once solved, obeys it too
  const [sol] = solve(m5);
  assert.ok(fits[0].ok(m5.nodes.map((n) => sol[n])));
});

test('level 5: the unfinished ring has exactly one completion', () => {
  assert.equal(countSolutions(m5, 5), 1);
  const [sol] = solve(m5);
  assert.deepEqual(m5.nodes.map((n) => sol[n]), [4, 1, 6, 2, 5, 8, 3, 7]);
  // every empty place has its partner across the ring already on the board
  for (const [a, b] of RING_PAIRS) assert.ok(m5.givens[a] !== undefined || m5.givens[b] !== undefined, `pair ${a},${b} has a stone on it`);
  const empties = m5.nodes.filter((n) => m5.givens[n] === undefined);
  assert.deepEqual(empties, [3, 6]);
  // the tray holds exactly the two stones that are missing
  const given = new Set(Object.values(m5.givens));
  assert.deepEqual(m5.stones.filter((v) => !given.has(v)), [2, 3]);
});

test('level 5: the rule is only judged once the ring is full', () => {
  const s = new NodeSession(m5);
  assert.equal(s.p.shape.lines.length, 0, 'no markers: nothing may name the rule');
  assert.ok(s.move('t3', 3));
  assert.equal(s.solved, false);
  assert.ok(s.move('t2', 6));
  assert.equal(s.solved, false, 'a full ring that breaks the rule is not accepted');
  assert.ok(s.undo());
  assert.ok(s.undo());
  assert.ok(s.move('t2', 3));
  assert.ok(s.move('t3', 6));
  assert.equal(s.solved, true);
});

// ------------------------------------------------------------ the kit

test('the kit: constraint types read partial boards honestly', () => {
  const def = { nodes: [0, 1, 2, 3], stones: [1, 2, 3, 4], givens: {}, constraints: [sum('s', [0, 1], 5), allDifferent('d', [0, 1, 2, 3]), equalSum('e', [[0, 1], [2, 3]])] };
  assert.equal(evaluate(def, [0, 0, 0, 0]).results[0].status, 'empty');
  assert.equal(evaluate(def, [2, 0, 0, 0]).results[0].status, 'partial');
  assert.equal(evaluate(def, [5, 0, 0, 0]).results[0].status, 'strained');
  assert.equal(evaluate(def, [2, 3, 0, 0]).results[0].status, 'exact');
  assert.equal(evaluate(def, [2, 2, 0, 0]).results[1].status, 'wrong', 'a repeat breaks ALL_DIFFERENT');
  assert.equal(evaluate(def, [1, 4, 2, 3]).results[2].status, 'exact', '5 and 5');
  assert.equal(evaluate(def, [1, 2, 3, 4]).results[2].status, 'wrong');
  const found = solve(def);
  assert.equal(found.length, 8, 'four stones on four places, both pairs making 5');
  assert.equal(solve(def, { limit: 3 }).length, 3);
});

test('a new kind of puzzle needs only a list of constraints: a magic hexagon row, as a trial', () => {
  // Three rows of a hexagon-like shape written with nothing but the kit.
  const def = { id: 'try', type: 'x', nodes: [0, 1, 2, 3, 4, 5, 6], stones: [1, 2, 3, 4, 5, 6, 7], givens: {}, constraints: [sum('a', [0, 1, 2], 12), sum('b', [2, 3, 4], 12), sum('c', [4, 5, 6], 12), allDifferent('d', [0, 1, 2, 3, 4, 5, 6])], geometry: { kind: 'x' } };
  assert.ok(levelDefIsValid(def));
  const s = solve(def, { limit: 1 });
  assert.equal(s.length, 1);
  assert.equal(evaluate(def, s[0]).solved, true);
});

// ---------------------------------------------------------- geometry

test('node layouts keep every stone inside the carved panel and apart from each other', () => {
  for (const d of [m4, m5]) {
    const { points, size } = layoutFor(d);
    const ids = Object.keys(points).map(Number);
    assert.equal(ids.length, d.nodes.length);
    for (const id of ids) {
      const q = points[id];
      assert.ok(q.x - size / 2 >= PANEL.min && q.x + size / 2 <= PANEL.max, `${d.id} node ${id} x ${q.x}`);
      assert.ok(q.y - size / 2 >= PANEL.min && q.y + size / 2 <= PANEL.max, `${d.id} node ${id} y ${q.y}`);
    }
    for (const a of ids) for (const b of ids) if (a < b) assert.ok(Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y) >= size * 1.05, `${d.id} ${a},${b} overlap`);
  }
});

// -------------------------------------------------------------- hints

test('hints for the triangle and the ring come from the engine and end in a real placement', () => {
  for (const d of [m4, m5]) {
    const plan = planNodeHint(d, board(d));
    assert.equal(plan.tiers.length, 3);
    const g = plan.tiers[2].ghost;
    assert.ok(g, `${d.id} tier 3 places a stone`);
    assert.ok(solve(d, { fixed: { [g.cell]: g.value }, limit: 1 }).length === 1, `${d.id}: the ghost belongs to a solution`);
  }
  // the ring's tier 3 names the partner across the ring that is on the board
  const ring = planNodeHint(m5, board(m5));
  assert.match(ring.tiers[2].text, /across from each other make 9/);
  assert.ok(m5.givens[ring.tiers[2].cells[1]] !== undefined, 'the partner it points at is visible');
});

test('a misplaced stone is named before anything else', () => {
  const wrong = board(m5, { 3: 3 }); // the partner of the 7 must be 2
  const plan = planNodeHint(m5, wrong);
  assert.match(plan.tiers[0].text, /cannot stay/);
  assert.deepEqual(plan.tiers[1].cells, [3]);
  const tri = planNodeHint(m4, board(m4, { 4: 7 }));
  assert.match(tri.tiers[0].text, /cannot stay/);
});

test('node sessions: place, swap, undo, save, and refuse a corrupt save', () => {
  const s = new NodeSession(m4);
  assert.equal(s.move('t1', 4), null, 'the 1 is carved in');
  assert.equal(s.move('t5', 7), null, 'the 5 is carved in too');
  assert.ok(s.move('t3', 7));
  assert.ok(s.move('t8', 4));
  assert.ok(s.move('t7', 4), 'a stone dropped on a stone swaps');
  assert.equal(s.pos.get('t8'), TRAY);
  assert.ok(s.undo());
  const back = NodeSession.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  assert.deepEqual(back.values(), s.values());
  const bad = s.toJSON();
  bad.pos.t3 = 77;
  assert.throws(() => NodeSession.fromJSON(bad));
  const dup = s.toJSON();
  dup.pos.t3 = 4;
  assert.throws(() => NodeSession.fromJSON(dup), 'two stones in one place');
  // finish it
  const fin = new NodeSession(m4);
  const [sol] = solve(m4);
  for (const n of m4.nodes) if (m4.givens[n] === undefined) assert.ok(fin.move('t' + sol[n], n));
  assert.equal(fin.solved, true);
  assert.ok(fin.evaluate().lines.every((l) => l.status === 'exact'));
});

test('definitions play identically on both engines for every square', () => {
  for (const d of [m1, m2, m3]) {
    const p = hydrate(toLegacySpec(d));
    const sols = solve(d).map((s) => d.nodes.map((n) => s[n]));
    const legacy = findSolutions(p, { limit: 50 });
    assert.equal(legacy.length, sols.length, d.id);
    for (const g of sols) assert.equal(evaluateBoard(p, g).solved, true, `${d.id}: legacy accepts the kit's answer`);
  }
});
