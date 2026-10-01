// Generator: makes valid completed structures. It never trusts itself;
// every square it returns has passed isNormalMagic.

import { LO_SHU, symmetries, complement, construct, isNormalMagic, isMagic, lucasSquare } from './magic.js';
import { hydrate } from './puzzle.js';
import { findSolutions } from './solver.js';

function emptySquarePuzzle(n) {
  return hydrate({
    v: 1,
    id: `empty-${n}`,
    kind: 'fill',
    n,
    givens: {},
    pool: Array.from({ length: n * n }, (_, i) => i + 1),
  });
}

// A random normal magic square of order n.
//   n = 3: one of the eight forms of the Lo Shu (there is no other).
//   n = 4: a randomised search over all 7,040.
//   n >= 5: a classic construction, then a random symmetry and complement.
//           (Not uniform over all squares. Good enough until 5x5 ships.)
export function randomMagicSquare(n, rng) {
  let g;
  if (n === 3) g = LO_SHU.slice();
  else if (n === 4) g = findSolutions(emptySquarePuzzle(4), { limit: 1, rng })[0];
  else g = construct(n);
  g = rng.pick(symmetries(g, n));
  if (n > 3 && rng.next() < 0.5) g = complement(g, n);
  if (!isNormalMagic(g, n)) throw new Error(`Generator produced an invalid square of order ${n}`);
  return g;
}

// A 3x3 magic square on a fresh set of numbers, so a player who has learned
// the Lo Shu by heart still has to reason. Positive, distinct, at most maxValue.
export function randomLucasSquare(rng, { maxValue = 24, minCentre = 6, maxCentre = 12 } = {}) {
  for (;;) {
    const c = minCentre + rng.int(maxCentre - minCentre + 1);
    const a = (1 + rng.int(5)) * (rng.next() < 0.5 ? -1 : 1);
    const b = (1 + rng.int(5)) * (rng.next() < 0.5 ? -1 : 1);
    const g = lucasSquare(c, a, b);
    if (g.some((v) => v < 1 || v > maxValue)) continue;
    if (!isMagic(g, 3)) continue; // rejects repeated numbers
    if (g.slice().sort((x, y) => x - y).every((v, i) => v === i + 1)) continue; // that is the Lo Shu
    return rng.pick(symmetries(g, 3));
  }
}

const allCache = new Map();

// Every normal magic square of order n (n <= 4). 3 -> 8, 4 -> 7,040.
export function allMagicSquares(n) {
  if (n > 4) throw new Error('Enumeration is only practical up to n = 4');
  if (!allCache.has(n)) allCache.set(n, findSolutions(emptySquarePuzzle(n)));
  return allCache.get(n);
}
