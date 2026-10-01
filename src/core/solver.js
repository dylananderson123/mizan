// Two solvers.
//
// 1. findSolutions: a fast exhaustive search. Used to prove uniqueness and to
//    enumerate squares. It reasons with cheap bounds, not like a person.
//
// 2. solveLogically: a step-by-step solver that only uses deductions a person
//    could make, and records each one. Its record drives the difficulty
//    rating and the hint system.

import { canSumTo } from './constraints.js';
import { givenValues } from './puzzle.js';

// ---------------------------------------------------------------------------
// Exhaustive search
// ---------------------------------------------------------------------------

// extra: further placements to treat as fixed, { cell: value }.
export function findSolutions(puzzle, { limit = Infinity, rng = null, extra = null } = {}) {
  const N = puzzle.n * puzzle.n;
  const target = puzzle.target;
  const grid = givenValues(puzzle);
  let pool = [...puzzle.pool];
  if (extra) {
    for (const [c, v] of Object.entries(extra)) {
      grid[+c] = v;
      pool = pool.filter((x) => x !== v);
    }
  }
  const values = pool.sort((a, b) => a - b);
  const avail = new Uint8Array(values.length).fill(1);
  const valueIndex = new Map(values.map((v, i) => [v, i]));

  const L = puzzle.shape.lines.map((l) => ({ cells: l.cells, sum: 0, empty: 0 }));
  const cellLines = Array.from({ length: N }, () => []);
  L.forEach((l, i) => {
    for (const c of l.cells) {
      cellLines[c].push(i);
      if (grid[c]) l.sum += grid[c];
      else l.empty++;
    }
  });
  for (const l of L) if (l.empty === 0 && l.sum !== target) return [];

  const emptyCells = puzzle.shape.cells.filter((c) => !grid[c]);
  const results = [];

  function candidates(c, al, pre) {
    const out = [];
    const m = al.length;
    for (let ai = 0; ai < m; ai++) {
      const v = al[ai];
      let ok = true;
      for (const li of cellLines[c]) {
        const l = L[li];
        const k = l.empty - 1;
        const need = target - l.sum - v;
        if (k === 0) {
          if (need !== 0) { ok = false; break; }
          continue;
        }
        if (m - 1 < k) { ok = false; break; }
        const min = ai < k ? pre[k + 1] - v : pre[k];
        const max = ai >= m - k ? pre[m] - pre[m - k - 1] - v : pre[m] - pre[m - k];
        if (need < min || need > max) { ok = false; break; }
      }
      if (ok) out.push(v);
    }
    return out;
  }

  function place(c, v, sign) {
    grid[c] = sign > 0 ? v : 0;
    avail[valueIndex.get(v)] = sign > 0 ? 0 : 1;
    for (const li of cellLines[c]) {
      L[li].sum += sign * v;
      L[li].empty -= sign;
    }
  }

  function rec(remaining) {
    if (remaining === 0) {
      results.push(grid.slice());
      return;
    }
    const al = [];
    for (let i = 0; i < values.length; i++) if (avail[i]) al.push(values[i]);
    const pre = [0];
    for (const v of al) pre.push(pre[pre.length - 1] + v);

    let bestC = -1;
    let best = null;
    for (const c of emptyCells) {
      if (grid[c]) continue;
      const cands = candidates(c, al, pre);
      if (cands.length === 0) return;
      if (!best || cands.length < best.length) {
        bestC = c;
        best = cands;
        if (cands.length === 1) break;
      }
    }
    const order = rng ? rng.shuffle(best) : best;
    for (const v of order) {
      place(bestC, v, 1);
      rec(remaining - 1);
      place(bestC, v, -1);
      if (results.length >= limit) return;
    }
  }

  rec(emptyCells.length);
  return results;
}

export function countSolutions(puzzle, limit = Infinity, extra = null) {
  return findSolutions(puzzle, { limit, extra }).length;
}

// ---------------------------------------------------------------------------
// Logical solver
// ---------------------------------------------------------------------------

// Rank orders techniques by how hard they are for a person.
export const RANK = { line: 1, single: 2, place: 2, narrow: 3, crossing: 3, trial: 4 };
export const WEIGHT = { line: 1, single: 2, place: 2, narrow: 3, crossing: 4, trial: 6 };

const cellLinesCache = new WeakMap();
function cellLinesOf(p) {
  let cl = cellLinesCache.get(p);
  if (!cl) {
    cl = Array.from({ length: p.n * p.n }, () => []);
    for (const L of p.shape.lines) for (const c of L.cells) cl[c].push(L);
    cellLinesCache.set(p, cl);
  }
  return cl;
}

export function initState(puzzle, values) {
  const v = (values ?? givenValues(puzzle)).slice();
  const used = new Set(puzzle.shape.cells.map((c) => v[c]).filter(Boolean));
  const avail = puzzle.pool.filter((x) => !used.has(x)).sort((a, b) => a - b);
  return { p: puzzle, values: v, avail, elim: new Set() };
}

function cloneState(st) {
  return { p: st.p, values: st.values.slice(), avail: st.avail.slice(), elim: new Set(st.elim) };
}

const ekey = (c, v) => c * 1024 + v;

function emptyCellsOf(st) {
  return st.p.shape.cells.filter((c) => !st.values[c]);
}

// Candidates a person could keep after line arithmetic alone: v may go in c
// if every line through c can still reach the target using tiles that remain.
export function candidates(st, c) {
  const out = [];
  for (const v of st.avail) {
    if (st.elim.has(ekey(c, v))) continue;
    let ok = true;
    for (const L of cellLinesOf(st.p)[c]) {
      let sum = v;
      let k = 0;
      for (const x of L.cells) {
        if (x === c) continue;
        if (st.values[x]) sum += st.values[x];
        else k++;
      }
      const spare = st.avail.filter((w) => w !== v);
      if (!canSumTo(st.p.target - sum, k, spare)) { ok = false; break; }
    }
    if (ok) out.push(v);
  }
  return out;
}

// Can every line through c be finished at the same time, with v in c and all
// tiles different? A small local search over the cells those lines touch.
function jointFeasible(st, c, v) {
  const lines = cellLinesOf(st.p)[c];
  const vars = [...new Set(lines.flatMap((L) => L.cells))].filter((x) => x !== c && !st.values[x]);
  const vals = st.values.slice();
  vals[c] = v;
  const pool = st.avail.filter((w) => w !== v);
  const used = new Set();
  const target = st.p.target;

  function linesOk() {
    for (const L of lines) {
      let sum = 0;
      let k = 0;
      for (const x of L.cells) {
        if (vals[x]) sum += vals[x];
        else k++;
      }
      if (k === 0 ? sum !== target : sum >= target) return false;
    }
    return true;
  }
  function rec(i) {
    if (!linesOk()) return false;
    if (i === vars.length) return true;
    for (const w of pool) {
      if (used.has(w) || st.elim.has(ekey(vars[i], w))) continue;
      used.add(w);
      vals[vars[i]] = w;
      const ok = rec(i + 1);
      vals[vars[i]] = 0;
      used.delete(w);
      if (ok) return true;
    }
    return false;
  }
  return rec(0);
}

function lineIdsThrough(st, c) {
  return cellLinesOf(st.p)[c].map((L) => L.id);
}

// The next deduction from this state, cheapest technique first.
// Returns a step, { contradiction: true, .. }, or null when stuck.
export function nextStep(st, maxRank = RANK.trial) {
  const { p, values } = st;

  // Any full line that misses is a contradiction.
  for (const L of p.shape.lines) {
    let sum = 0;
    let k = 0;
    for (const x of L.cells) {
      if (values[x]) sum += values[x];
      else k++;
    }
    if (k === 0 && sum !== p.target) return { contradiction: true, line: L.id };
    if (k > 0 && sum >= p.target) return { contradiction: true, line: L.id };
  }

  // 1. Last space in a line.
  for (const L of p.shape.lines) {
    const empties = L.cells.filter((x) => !values[x]);
    if (empties.length !== 1) continue;
    const sum = L.cells.reduce((s, x) => s + (values[x] || 0), 0);
    const need = p.target - sum;
    const c = empties[0];
    if (!st.avail.includes(need) || st.elim.has(ekey(c, need))) return { contradiction: true, line: L.id };
    return { t: 'line', cell: c, value: need, lines: [L.id], total: sum, need };
  }
  if (maxRank < RANK.single) return null;

  // 2. A space with one candidate left, and 3. a tile with one space left.
  const empties = emptyCellsOf(st);
  const cands = new Map();
  for (const c of empties) {
    const cs = candidates(st, c);
    if (cs.length === 0) return { contradiction: true, cell: c };
    cands.set(c, cs);
  }
  for (const c of empties) {
    const cs = cands.get(c);
    if (cs.length === 1) return { t: 'single', cell: c, value: cs[0], lines: lineIdsThrough(st, c) };
  }
  if (p.useAll) {
    for (const v of st.avail) {
      const where = empties.filter((c) => cands.get(c).includes(v));
      if (where.length === 0) return { contradiction: true, value: v };
      if (where.length === 1) return { t: 'place', cell: where[0], value: v, lines: lineIdsThrough(st, where[0]) };
    }
  }
  if (maxRank < RANK.crossing) return null;

  // 4. Crossing lines: a value that lets each line alone work, but not all
  //    the lines through this space together.
  const byFew = [...empties].sort((a, b) => cands.get(a).length - cands.get(b).length);
  for (const c of byFew) {
    const cs = cands.get(c);
    const keep = cs.filter((v) => jointFeasible(st, c, v));
    if (keep.length === cs.length) continue;
    const eliminated = cs.filter((v) => !keep.includes(v));
    if (keep.length === 0) return { contradiction: true, cell: c };
    if (keep.length === 1) return { t: 'crossing', cell: c, value: keep[0], lines: lineIdsThrough(st, c), eliminated };
    return { t: 'narrow', cell: c, eliminated, lines: lineIdsThrough(st, c) };
  }
  if (maxRank < RANK.trial) return null;

  // 5. Trial: suppose a value, follow the simpler deductions, and see if it
  //    breaks. Only on spaces with two or three candidates.
  for (const c of byFew) {
    const cs = cands.get(c);
    if (cs.length < 2 || cs.length > 3) continue;
    const eliminated = [];
    for (const v of cs) {
      const trial = cloneState(st);
      applyStep(trial, { cell: c, value: v });
      if (propagate(trial, RANK.crossing) === 'contradiction') eliminated.push(v);
    }
    if (eliminated.length === 0) continue;
    const keep = cs.filter((v) => !eliminated.includes(v));
    if (keep.length === 0) return { contradiction: true, cell: c };
    if (keep.length === 1) return { t: 'trial', cell: c, value: keep[0], lines: lineIdsThrough(st, c), eliminated };
  }
  return null;
}

export function applyStep(st, step) {
  if (step.value !== undefined && step.cell !== undefined) {
    st.values[step.cell] = step.value;
    st.avail = st.avail.filter((v) => v !== step.value);
  }
  if (step.t === 'narrow') for (const v of step.eliminated) st.elim.add(ekey(step.cell, v));
}

function isFilled(st) {
  return st.p.shape.cells.every((c) => st.values[c]);
}

function propagate(st, maxRank, limit = 100) {
  for (let i = 0; i < limit; i++) {
    if (isFilled(st)) {
      const s = nextStep(st, RANK.line);
      return s && s.contradiction ? 'contradiction' : 'solved';
    }
    const step = nextStep(st, maxRank);
    if (!step) return 'stuck';
    if (step.contradiction) return 'contradiction';
    applyStep(st, step);
  }
  return 'stuck';
}

const TECH_RANK = { line: RANK.line, single: RANK.single, crossing: RANK.crossing, trial: RANK.trial };

// Solve using human deductions only. maxTechnique caps the hardest one used.
export function solveLogically(puzzle, { values = null, maxTechnique = 'trial', maxSteps = 400 } = {}) {
  const st = initState(puzzle, values);
  const maxRank = TECH_RANK[maxTechnique];
  const steps = [];
  for (let i = 0; i < maxSteps; i++) {
    if (isFilled(st)) {
      const s = nextStep(st, RANK.line);
      const ok = !(s && s.contradiction);
      return { solved: ok, contradiction: !ok, steps, values: st.values };
    }
    const step = nextStep(st, maxRank);
    if (!step) return { solved: false, stuck: true, steps, values: st.values };
    if (step.contradiction) return { solved: false, contradiction: true, steps, values: st.values, at: step };
    applyStep(st, step);
    steps.push(step);
  }
  return { solved: false, stuck: true, steps, values: st.values };
}
