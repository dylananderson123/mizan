// Puzzle carver. Takes a completed square and removes information, or
// breaks it, while keeping the intended solvability. Every puzzle it returns
// has been checked by the exhaustive solver and the logical solver.

import { hydrate } from './puzzle.js';
import { findSolutions, countSolutions, solveLogically } from './solver.js';
import { rateDifficulty, BAND_MAX_TECHNIQUE } from './difficulty.js';

const rowTotal = (g, n) => g.slice(0, n).reduce((a, b) => a + b, 0);

function fillSpec(id, n, solution, givenCells, meta) {
  const givens = {};
  const pool = [];
  const gset = new Set(givenCells);
  for (let c = 0; c < n * n; c++) {
    if (gset.has(c)) givens[c] = solution[c];
    else pool.push(solution[c]);
  }
  return { v: 1, id, kind: 'fill', n, target: rowTotal(solution, n), givens, pool: pool.sort((a, b) => a - b), meta };
}

// Remove givens one at a time in random order. Keep a removal only if the
// puzzle stays unique and solvable within the band's hardest technique.
// Retries with fresh orders until the rated band matches.
export function carveFill(solution, n, rng, { band, id = 'gen', tries = 60, meta = {}, distractors = 0, gaps } = {}) {
  const maxTechnique = BAND_MAX_TECHNIQUE[band];
  // `gaps` caps how many stones are taken out, for a gentle step up in size.
  const maxRemoved = gaps ?? (band === 1 ? 3 : Infinity);
  for (let t = 0; t < tries; t++) {
    let givenCells = Array.from({ length: n * n }, (_, i) => i);
    let removed = 0;
    for (const c of rng.shuffle(givenCells)) {
      if (removed >= maxRemoved) break;
      const trial = givenCells.filter((x) => x !== c);
      const p = hydrate(fillSpec(id, n, solution, trial, meta));
      if (countSolutions(p, 2) !== 1) continue;
      if (!solveLogically(p, { maxTechnique }).solved) continue;
      givenCells = trial;
      removed++;
    }
    const spec = fillSpec(id, n, solution, givenCells, meta);
    if (distractors && !addDistractors(spec, solution, rng, distractors, maxTechnique)) continue;
    const rating = rateDifficulty(hydrate(spec));
    if (rating.band === band) {
      spec.meta = { ...meta, band, score: rating.score };
      return spec;
    }
  }
  return null;
}

// Spare tiles that belong to no line. The square stays unique and the
// solver must still finish without guessing.
function addDistractors(spec, solution, rng, k, maxTechnique) {
  const inSquare = new Set(solution);
  const lo = Math.max(1, Math.min(...solution) - 2);
  const hi = Math.max(...solution) + 2;
  const options = [];
  for (let v = lo; v <= hi; v++) if (!inSquare.has(v)) options.push(v);
  for (let attempt = 0; attempt < 20; attempt++) {
    const extra = rng.shuffle(options).slice(0, k);
    const pool = [...spec.pool, ...extra].sort((a, b) => a - b);
    const p = hydrate({ ...spec, pool });
    if (countSolutions(p, 2) !== 1) continue;
    if (!solveLogically(p, { maxTechnique }).solved) continue;
    spec.pool = pool;
    return true;
  }
  return false;
}

// Fewest swaps that turn `from` into `to`, over the given cells.
export function swapDistance(from, to, cells) {
  const pos = new Map();
  for (const c of cells) pos.set(from[c], c);
  const seen = new Set();
  let mismatched = 0;
  let cycles = 0;
  for (const c of cells) {
    if (from[c] === to[c] || seen.has(c)) continue;
    cycles++;
    let x = c;
    while (!seen.has(x)) {
      seen.add(x);
      mismatched++;
      x = pos.get(to[x]);
    }
  }
  return mismatched - cycles;
}

// Every completed arrangement of this restore puzzle's tiles that is valid.
// (An unlocked 4x4 would mean all 7,040 squares: the carver always locks some.)
export function restoreTargets(puzzle) {
  return findSolutions(puzzle);
}

export function restoreDistance(puzzle, values) {
  const movable = puzzle.shape.cells.filter((c) => puzzle.givens[c] === undefined);
  let best = Infinity;
  let nearest = null;
  for (const g of restoreTargets(puzzle)) {
    const d = swapDistance(values, g, movable);
    if (d < best) { best = d; nearest = g; }
  }
  return { distance: best, nearest };
}

// Lock some tiles, then make `swaps` random swaps among the rest, so the
// fewest swaps back to any valid square is exactly `swaps`.
export function carveRestore(solution, n, rng, { swaps = 1, locked = 0, id = 'gen', tries = 200, meta = {} } = {}) {
  for (let t = 0; t < tries; t++) {
    const cells = rng.shuffle(Array.from({ length: n * n }, (_, i) => i));
    const lockedCells = cells.slice(0, locked);
    const movable = cells.slice(locked);
    const values = solution.slice();
    for (let s = 0; s < swaps; s++) {
      const i = rng.pick(movable);
      let j = rng.pick(movable);
      while (j === i) j = rng.pick(movable);
      [values[i], values[j]] = [values[j], values[i]];
    }
    const givens = {};
    for (const c of lockedCells) givens[c] = solution[c];
    const start = {};
    for (const c of movable) start[c] = values[c];
    const spec = {
      v: 1, id, kind: 'restore', n, target: rowTotal(solution, n), givens,
      pool: movable.map((c) => solution[c]).sort((a, b) => a - b), start, meta,
    };
    const p = hydrate(spec);
    const { distance } = restoreDistance(p, values);
    if (distance === swaps) {
      spec.meta = { ...meta, swaps };
      return spec;
    }
  }
  return null;
}

// The board values a restore puzzle starts from.
export function startValues(puzzle) {
  const values = new Array(puzzle.n * puzzle.n).fill(0);
  for (const [c, v] of Object.entries(puzzle.givens)) values[+c] = v;
  for (const [c, v] of Object.entries(puzzle.start ?? {})) values[+c] = v;
  return values;
}
