import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magicConstant, LO_SHU, rotate, reflect, symmetries, complement, canonicalKey,
  isNormalMagic, isPanmagic, isAssociative, siamese, doublyEven, strachey, construct, lineSums,
} from '../src/core/magic.js';
import { lineCells, standardLineIds, makeShape } from '../src/core/shape.js';
import { canSumTo } from '../src/core/constraints.js';
import { allMagicSquares, randomMagicSquare } from '../src/core/generator.js';
import { createRng } from '../src/core/rng.js';

test('magic constant M(n) = n(n^2+1)/2', () => {
  assert.deepEqual([3, 4, 5, 6].map(magicConstant), [15, 34, 65, 111]);
  for (let n = 1; n <= 12; n++) {
    let total = 0;
    for (let v = 1; v <= n * n; v++) total += v;
    assert.equal(magicConstant(n) * n, total, `n=${n}: n rows share the sum 1..n^2`);
  }
});

test('the Lo Shu is magic, associative, not panmagic', () => {
  assert.ok(isNormalMagic(LO_SHU, 3));
  assert.ok(isAssociative(LO_SHU, 3));
  assert.ok(!isPanmagic(LO_SHU, 3));
  assert.equal(LO_SHU[4], 5);
});

test('rotation and reflection are permutations and generate 8 distinct forms', () => {
  const g = Array.from({ length: 16 }, (_, i) => i + 1);
  assert.deepEqual(rotate(rotate(rotate(rotate(g, 4), 4), 4), 4), g);
  assert.deepEqual(reflect(reflect(g, 4), 4), g);
  const forms = new Set(symmetries(g, 4).map((x) => x.join()));
  assert.equal(forms.size, 8);
});

test('every symmetry and the complement of a magic square stay magic', () => {
  for (const [n, sq] of [[3, LO_SHU], [4, doublyEven(4)], [5, siamese(5)], [6, strachey(6)]]) {
    for (const s of symmetries(sq, n)) assert.ok(isNormalMagic(s, n), `symmetry, n=${n}`);
    assert.ok(isNormalMagic(complement(sq, n), n), `complement, n=${n}`);
  }
});

test('classic constructions produce normal magic squares, n = 3..12', () => {
  for (let n = 3; n <= 12; n++) {
    const g = construct(n);
    assert.ok(isNormalMagic(g, n), `construct(${n})`);
    assert.ok(lineSums(g, n).every((s) => s === magicConstant(n)));
  }
  assert.throws(() => construct(2));
});

test('Siamese squares of odd order are associative', () => {
  for (const n of [3, 5, 7, 9]) assert.ok(isAssociative(siamese(n), n));
});

test('exactly 8 normal 3x3 squares, all forms of the Lo Shu (OEIS A006052: 1)', () => {
  const all = allMagicSquares(3);
  assert.equal(all.length, 8);
  const keys = new Set(all.map((g) => canonicalKey(g, 3)));
  assert.equal(keys.size, 1);
  assert.equal(canonicalKey(LO_SHU, 3), [...keys][0]);
  for (const g of all) assert.equal(g[4], 5, 'centre is always 5');
});

test('exactly 7,040 normal 4x4 squares, 880 up to symmetry (OEIS A006052: 880)', () => {
  const all = allMagicSquares(4);
  assert.equal(all.length, 7040);
  for (const g of all) assert.ok(isNormalMagic(g, 4));
  const keys = new Set(all.map((g) => canonicalKey(g, 4)));
  assert.equal(keys.size, 880);
});

test('line cells: rows, columns, diagonals, broken diagonals', () => {
  assert.deepEqual(lineCells(3, 'r1'), [3, 4, 5]);
  assert.deepEqual(lineCells(3, 'c2'), [2, 5, 8]);
  assert.deepEqual(lineCells(3, 'd'), [0, 4, 8]);
  assert.deepEqual(lineCells(3, 'a'), [2, 4, 6]);
  assert.deepEqual(lineCells(4, 'p0'), lineCells(4, 'd'));
  assert.deepEqual(lineCells(4, 'q3'), lineCells(4, 'a'));
  assert.equal(standardLineIds(3).length, 8);
  assert.equal(standardLineIds(4, { pandiagonal: true }).length, 10 + 6);
  assert.throws(() => makeShape(3, { cells: [0, 1], lines: ['r0'] }));
});

test('a known 4x4 panmagic square passes the panmagic check', () => {
  const g = [1, 8, 13, 12, 14, 11, 2, 7, 4, 5, 16, 9, 15, 10, 3, 6];
  assert.ok(isPanmagic(g, 4));
  assert.ok(!isPanmagic(doublyEven(4), 4));
});

test('canSumTo: distinct values reaching a total', () => {
  assert.ok(canSumTo(9, 2, [1, 2, 3, 4, 5, 6, 7, 8, 9]));
  assert.ok(!canSumTo(3, 2, [1, 3, 5]));
  assert.ok(!canSumTo(2, 2, [1, 2, 3]), 'needs distinct values');
  assert.ok(canSumTo(0, 0, []));
  assert.ok(!canSumTo(5, 0, [5]));
});

test('random squares are valid and seeded generation is deterministic', () => {
  for (const n of [3, 4, 5, 6]) {
    for (let s = 0; s < 20; s++) {
      const g = randomMagicSquare(n, createRng(`t-${n}-${s}`));
      assert.ok(isNormalMagic(g, n));
    }
    assert.deepEqual(randomMagicSquare(n, createRng('same')), randomMagicSquare(n, createRng('same')));
  }
});
