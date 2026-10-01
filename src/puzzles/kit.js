// The puzzle kit. One small vocabulary that every Mizan puzzle is written in.
//
// A puzzle is a set of NODES (places that can hold a number), a set of STONES
// (the numbers available) and a list of CONSTRAINTS (relationships that must
// hold between nodes). Nothing here knows about squares, triangles or rings.
// A square's rows, a triangle's sides and a ring's opposite pairs are all just
// constraints over node ids, so a new geometry is a new list, not a new engine.
//
// Constraint types:
//   SUM            { type, id, cells, target }       these nodes add up to target
//   EQUAL_SUM      { type, id, groups, target? }     every group adds up to the
//                                                    same total (target optional)
//   ALL_DIFFERENT  { type, id, cells }               no number repeats
//
// Adding a type means adding one entry to RULES below. Nothing else changes.

export const sum = (id, cells, target) => ({ type: 'SUM', id, cells, target });
export const equalSum = (id, groups, target) => ({ type: 'EQUAL_SUM', id, groups, ...(target === undefined ? {} : { target }) });
export const allDifferent = (id, cells) => ({ type: 'ALL_DIFFERENT', id, cells });

const total = (cells, vals) => cells.reduce((a, c) => a + (vals[c] || 0), 0);
const filled = (cells, vals) => cells.filter((c) => vals[c]).length;

// Each rule answers three questions about a partly filled board:
//   status(c, vals)  what to show: empty, partial, strained, exact or wrong
//   cells(c)         which nodes the constraint touches
//   viable(c, vals)  false when no way of finishing the board can satisfy it
// `strained` means the constraint cannot hold any more but is not full yet.
export const RULES = {
  SUM: {
    cells: (c) => c.cells,
    status(c, vals) {
      const f = filled(c.cells, vals);
      const t = total(c.cells, vals);
      if (f === 0) return { status: 'empty', total: 0 };
      if (f === c.cells.length) return { status: t === c.target ? 'exact' : 'wrong', total: t };
      return { status: t >= c.target ? 'strained' : 'partial', total: t };
    },
    viable(c, vals) {
      const f = filled(c.cells, vals);
      const t = total(c.cells, vals);
      return f === c.cells.length ? t === c.target : t < c.target || f === 0;
    },
  },
  EQUAL_SUM: {
    cells: (c) => c.groups.flat(),
    status(c, vals) {
      const parts = c.groups.map((g) => ({ f: filled(g, vals), t: total(g, vals), n: g.length }));
      const fullTotals = parts.filter((p) => p.f === p.n).map((p) => p.t);
      const totals = parts.map((p) => p.t);
      if (parts.every((p) => p.f === 0)) return { status: 'empty', totals };
      const clash = new Set(fullTotals).size > 1 || (c.target !== undefined && fullTotals.some((t) => t !== c.target));
      if (parts.every((p) => p.f === p.n)) return { status: clash ? 'wrong' : 'exact', totals };
      return { status: clash ? 'strained' : 'partial', totals };
    },
    viable(c, vals) {
      const full = c.groups.filter((g) => filled(g, vals) === g.length).map((g) => total(g, vals));
      if (new Set(full).size > 1) return false;
      return c.target === undefined || full.every((t) => t === c.target);
    },
  },
  ALL_DIFFERENT: {
    cells: (c) => c.cells,
    status(c, vals) {
      const have = c.cells.map((n) => vals[n]).filter(Boolean);
      if (have.length === 0) return { status: 'empty' };
      const dup = new Set(have).size !== have.length;
      if (dup) return { status: 'wrong' };
      return { status: have.length === c.cells.length ? 'exact' : 'partial' };
    },
    viable(c, vals) {
      const have = c.cells.map((n) => vals[n]).filter(Boolean);
      return new Set(have).size === have.length;
    },
  },
};

// Where every node stands. `vals` maps node id to a number, 0 or undefined
// when empty. Works on arrays and plain objects alike.
export function evaluate(def, vals) {
  const results = def.constraints.map((c) => ({ id: c.id, type: c.type, ...RULES[c.type].status(c, vals) }));
  const complete = def.nodes.every((n) => vals[n]);
  return { results, complete, solved: complete && results.every((r) => r.status === 'exact') };
}

// Every way of filling the board that satisfies every constraint.
//   def.nodes     all node ids
//   def.stones    every number on offer, placed or spare
//   def.givens    { node: number } locked in place
//   fixed         more placements to treat as given: { node: number }
// Each stone is used at most once. A board with spare stones leaves some out.
export function solve(def, { limit = Infinity, fixed = null } = {}) {
  const vals = {};
  const pinned = { ...def.givens, ...(fixed ?? {}) };
  for (const [n, v] of Object.entries(pinned)) vals[+n] = v;
  const free = def.nodes.filter((n) => !vals[n]);
  const taken = new Set(Object.values(pinned));
  const stones = def.stones.filter((v) => !taken.has(v)).sort((a, b) => a - b);
  const used = new Array(stones.length).fill(false);
  // Only the constraints that touch a node need re-checking when it is set.
  const touching = new Map(def.nodes.map((n) => [n, []]));
  def.constraints.forEach((c) => { for (const n of new Set(RULES[c.type].cells(c))) touching.get(n).push(c); });
  const ok = (n) => touching.get(n).every((c) => RULES[c.type].viable(c, vals));
  const out = [];
  if (!def.constraints.every((c) => RULES[c.type].viable(c, vals))) return out;

  const step = (i) => {
    if (out.length >= limit) return;
    if (i === free.length) {
      if (evaluate(def, vals).solved) out.push({ ...vals });
      return;
    }
    const n = free[i];
    for (let k = 0; k < stones.length; k++) {
      if (used[k]) continue;
      used[k] = true;
      vals[n] = stones[k];
      if (ok(n)) step(i + 1);
      vals[n] = 0;
      used[k] = false;
      if (out.length >= limit) return;
    }
  };
  step(0);
  return out;
}

export const countSolutions = (def, limit = Infinity, fixed = null) => solve(def, { limit, fixed }).length;

// The values of a board as an array indexed by node id, from a solve() result.
export const asArray = (def, vals) => def.nodes.map((n) => vals[n] ?? 0);

// How many stones differ between two boards, ignoring locked ones.
export function swapsBetween(def, from, to) {
  const free = def.nodes.filter((n) => def.givens[n] === undefined);
  const where = new Map(free.map((n) => [from[n], n]));
  const seen = new Set();
  let mismatched = 0;
  let cycles = 0;
  for (const n of free) {
    if (from[n] === to[n] || seen.has(n)) continue;
    cycles++;
    let x = n;
    while (!seen.has(x)) {
      seen.add(x);
      mismatched++;
      x = where.get(to[x]);
    }
  }
  return mismatched - cycles;
}
