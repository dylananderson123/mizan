import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrate, serialize } from '../src/core/puzzle.js';
import { findSolutions, countSolutions, solveLogically } from '../src/core/solver.js';
import { evaluateBoard, isSolution } from '../src/core/constraints.js';
import { rateDifficulty, rateSteps } from '../src/core/difficulty.js';
import { carveFill, carveRestore, swapDistance, restoreDistance, startValues } from '../src/core/carver.js';
import { planHint } from '../src/core/hints.js';
import { LO_SHU, isMagic, lucasSquare, symmetries } from '../src/core/magic.js';
import { randomLucasSquare, randomMagicSquare } from '../src/core/generator.js';
import { createRng } from '../src/core/rng.js';

const full3 = (givens, pool, extra = {}) => hydrate({ v: 1, id: 't', kind: 'fill', n: 3, givens, pool, ...extra });

test('Lucas form: every 3x3 magic square, target three times the centre', () => {
  assert.deepEqual(lucasSquare(5, 3, 1), [...LO_SHU]);
  const rng = createRng('lucas');
  for (let i = 0; i < 200; i++) {
    const g = randomLucasSquare(rng);
    assert.ok(isMagic(g, 3));
    assert.equal(g[0] + g[1] + g[2], 3 * g[4]);
    assert.ok(g.every((v) => v >= 1 && v <= 24));
  }
});

test('evaluateBoard reports every line status correctly', () => {
  const p = full3({ 0: 4, 1: 9 }, [1, 2, 3, 5, 6, 7, 8]);
  const v = [4, 9, 2, 3, 5, 7, 8, 1, 6];
  assert.ok(evaluateBoard(p, v).solved);
  assert.ok(isSolution(p, v));
  const wrong = [4, 9, 6, 3, 5, 7, 8, 1, 2];
  const ev = evaluateBoard(p, wrong);
  assert.equal(ev.solved, false);
  assert.equal(ev.lines.find((l) => l.id === 'r0').status, 'wrong');
  assert.equal(ev.lines.find((l) => l.id === 'r1').status, 'exact');
  const partial = [4, 9, 0, 0, 0, 0, 0, 0, 0];
  const ev2 = evaluateBoard(p, partial);
  assert.equal(ev2.lines.find((l) => l.id === 'r0').status, 'partial');
  assert.equal(ev2.lines.find((l) => l.id === 'r2').status, 'empty');
  // 4 + 9 + 8 is over 15 with nothing left: strained before full
  // 4 + 9 needs a 2, and there is no 2 among the tiles
  const p2 = full3({ 0: 4 }, [1, 3, 5, 6, 7, 8, 9]);
  const strained = [4, 9, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(evaluateBoard(p2, strained).lines.find((l) => l.id === 'r0').status, 'strained');
});

test('isSolution rejects repeats, foreign values and moved givens', () => {
  const p = full3({ 4: 5 }, [1, 2, 3, 4, 6, 7, 8, 9]);
  assert.ok(isSolution(p, [...LO_SHU]));
  assert.ok(!isSolution(p, [4, 9, 2, 3, 5, 7, 8, 1, 7]));
  const rot = symmetries(LO_SHU, 3)[2];
  assert.ok(isSolution(p, rot), 'any valid square is accepted, not one stored answer');
});

test('uniqueness: two non-opposite givens fix the 3x3 square', () => {
  assert.equal(countSolutions(full3({}, [1, 2, 3, 4, 5, 6, 7, 8, 9])), 8);
  assert.equal(countSolutions(full3({ 0: 4 }, [1, 2, 3, 5, 6, 7, 8, 9])), 2);
  assert.equal(countSolutions(full3({ 0: 4, 1: 9 }, [1, 2, 3, 5, 6, 7, 8])), 1);
  assert.equal(countSolutions(full3({ 0: 4, 8: 6 }, [1, 2, 3, 5, 7, 8, 9])), 2, 'opposite corners leave a mirror');
});

test('logical solver finds the centre and records its reasoning', () => {
  const p = full3({ 1: 9, 3: 3 }, [1, 2, 4, 5, 6, 7, 8]);
  const r = solveLogically(p);
  assert.ok(r.solved);
  assert.deepEqual(r.values, [...LO_SHU]);
  assert.ok(r.steps.every((s) => s.t && s.cell !== undefined));
  const lineOnly = solveLogically(p, { maxTechnique: 'line' });
  assert.equal(lineOnly.solved, false, 'line arithmetic alone cannot start this one');
});

test('logical solver never contradicts the exhaustive solver', () => {
  const rng = createRng('agree');
  for (let i = 0; i < 60; i++) {
    const sq = i % 2 ? randomLucasSquare(rng) : symmetries(LO_SHU, 3)[i % 8];
    const givens = {};
    const pool = [];
    for (let c = 0; c < 9; c++) (rng.next() < 0.35 ? (givens[c] = sq[c]) : pool.push(sq[c]));
    const p = full3(givens, pool, { target: sq[0] + sq[1] + sq[2] });
    const sols = findSolutions(p);
    const r = solveLogically(p);
    if (r.solved) {
      assert.equal(sols.length, 1, 'a logical solve implies a unique answer');
      assert.deepEqual(r.values, sols[0]);
    }
    assert.ok(sols.length >= 1);
  }
});

test('difficulty bands follow the hardest technique', () => {
  assert.equal(rateSteps([{ t: 'line', value: 1 }]).band, 1);
  assert.equal(rateSteps(Array(5).fill({ t: 'line', value: 1 })).band, 2);
  assert.equal(rateSteps([{ t: 'single', value: 1 }]).band, 3);
  assert.equal(rateSteps([{ t: 'crossing', value: 1 }]).band, 4);
  assert.equal(rateSteps([{ t: 'trial', value: 1 }]).band, 5);
  const easy = rateDifficulty(full3({ 0: 4, 1: 9, 2: 2, 3: 3, 4: 5, 5: 7 }, [1, 6, 8]));
  const hard = rateDifficulty(full3({ 1: 9, 3: 3 }, [1, 2, 4, 5, 6, 7, 8]));
  assert.ok(hard.score > easy.score);
  assert.ok(hard.band > easy.band);
  assert.equal(rateDifficulty(full3({ 0: 4 }, [1, 2, 3, 5, 6, 7, 8, 9])).band, null, 'not unique: no band');
});

test('the 3x3 difficulty space: unique puzzles from the Lo Shu reach band 3 at most', () => {
  const bands = new Set();
  for (let mask = 0; mask < 512; mask++) {
    const givens = {};
    const pool = [];
    for (let c = 0; c < 9; c++) ((mask >> c) & 1 ? (givens[c] = LO_SHU[c]) : pool.push(LO_SHU[c]));
    const p = full3(givens, pool);
    if (countSolutions(p, 2) !== 1) continue;
    const r = rateDifficulty(p);
    assert.ok(r.logical, `every unique 3x3 is solvable by deduction (${JSON.stringify(givens)})`);
    bands.add(r.band);
  }
  assert.deepEqual([...bands].sort(), [1, 2, 3]);
});

test('carveFill: unique, logical, in band, deterministic', () => {
  for (const band of [1, 2, 3]) {
    const a = carveFill(randomLucasSquare(createRng('cf' + band)), 3, createRng('cf' + band), { band, id: 'x' });
    const b = carveFill(randomLucasSquare(createRng('cf' + band)), 3, createRng('cf' + band), { band, id: 'x' });
    assert.ok(a, `band ${band} carved`);
    assert.deepEqual(a, b);
    const p = hydrate(a);
    assert.equal(countSolutions(p, 2), 1);
    assert.equal(rateDifficulty(p).band, band);
  }
  const four = carveFill(randomMagicSquare(4, createRng('c4')), 4, createRng('c4'), { band: 3, id: 'y' });
  assert.ok(four);
  assert.equal(countSolutions(hydrate(four), 2), 1);
});

test('swap distance is the fewest swaps', () => {
  const cells = [0, 1, 2, 3, 4];
  assert.equal(swapDistance([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], cells), 0);
  assert.equal(swapDistance([2, 1, 3, 4, 5], [1, 2, 3, 4, 5], cells), 1);
  assert.equal(swapDistance([2, 3, 1, 4, 5], [1, 2, 3, 4, 5], cells), 2, 'a 3-cycle takes two swaps');
  assert.equal(swapDistance([2, 1, 4, 3, 5], [1, 2, 3, 4, 5], cells), 2);
});

test('carveRestore: broken by exactly k swaps, nearest square is k away', () => {
  for (const swaps of [1, 2, 3]) {
    const rng = createRng('cr' + swaps);
    const spec = carveRestore(randomLucasSquare(rng), 3, rng, { swaps, locked: 1, id: 'r' });
    assert.ok(spec);
    const p = hydrate(spec);
    const v = startValues(p);
    assert.equal(evaluateBoard(p, v).solved, false);
    assert.equal(restoreDistance(p, v).distance, swaps);
  }
});

test('serialize and hydrate round-trip', () => {
  const spec = carveRestore([...LO_SHU], 3, createRng('ser'), { swaps: 2, locked: 2, id: 'z', meta: { inscription: 'x' } });
  const p = hydrate(spec);
  const again = hydrate(JSON.parse(JSON.stringify(serialize(p))));
  assert.deepEqual(serialize(again), serialize(p));
  assert.throws(() => hydrate({ ...spec, v: 99 }));
  assert.throws(() => hydrate({ ...spec, pool: [...spec.pool, spec.pool[0]] }));
});

test('hints teach in three tiers and point at the right place', () => {
  const p = full3({ 0: 4, 1: 9, 3: 3, 4: 5 }, [1, 2, 6, 7, 8]);
  const h = planHint(p, [4, 9, 0, 3, 5, 0, 0, 0, 0]);
  assert.equal(h.tiers.length, 3);
  assert.equal(h.tiers[0].lines.length + h.tiers[0].cells.length > 0, true);
  assert.match(h.tiers[1].text, /totals \d+\. It needs \d+ more\./);
  assert.ok(h.tiers[2].ghost);
  const sol = [...LO_SHU];
  assert.equal(h.tiers[2].ghost.value, sol[h.tiers[2].ghost.cell], 'the revealed tile is correct');

  const bad = planHint(p, [4, 9, 8, 3, 5, 0, 0, 0, 0]);
  assert.match(bad.tiers[0].text, /does not fit/);
  assert.match(bad.tiers[1].text, /totals 21\. It must total 15\./);

  const r = hydrate(carveRestore([...LO_SHU], 3, createRng('h'), { swaps: 1, id: 'h' }));
  const rh = planHint(r, startValues(r));
  assert.match(rh.tiers[2].text, /^Swap the \d+ and the \d+\.$/);
});

test('hint text has no em dashes', () => {
  const p = full3({ 1: 9, 3: 3 }, [1, 2, 4, 5, 6, 7, 8]);
  const h = planHint(p, [0, 9, 0, 3, 0, 0, 0, 0, 0]);
  for (const t of h.tiers) assert.ok(!t.text.includes('—'));
});
