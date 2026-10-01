// The constraint engine. Defines what makes a board valid.
//
// A rule decides how a line's numbers combine and how a target is met.
// Only "sum" ships in the slice. The rule object is the seam where product
// squares, antimagic boards and other families plug in later.

export const RULES = {
  sum: {
    id: 'sum',
    symbol: '+',
    combine: (vals) => vals.reduce((a, b) => a + b, 0),
    // Can `k` distinct values from `spare` (sorted ascending) bring a line
    // that currently totals `current` exactly to `target`?
    canComplete: (current, target, k, spare) => canSumTo(target - current, k, spare, 0),
  },
};

// Distinct positive values from sorted `vals`, choose k, summing to need.
export function canSumTo(need, k, vals, start = 0) {
  if (k === 0) return need === 0;
  if (need <= 0) return false;
  const len = vals.length;
  if (len - start < k) return false;
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < k; i++) {
    lo += vals[start + i];
    hi += vals[len - 1 - i];
  }
  if (need < lo || need > hi) return false;
  for (let i = start; i <= len - k; i++) {
    const v = vals[i];
    if (v > need) break;
    if (canSumTo(need - v, k - 1, vals, i + 1)) return true;
  }
  return false;
}

// Line status, in the order a player meets them:
//   empty     no tiles yet
//   partial   some tiles, still reachable with the tiles that remain
//   strained  some tiles, and no remaining tiles can reach the target
//   exact     full and correct
//   wrong     full and incorrect
export function evaluateLine(line, values, target, spareFor, rule = RULES.sum) {
  const vals = [];
  for (const c of line.cells) if (values[c]) vals.push(values[c]);
  const total = rule.combine(vals);
  const filled = vals.length;
  const empty = line.cells.length - filled;
  let status;
  if (filled === 0) status = 'empty';
  else if (empty === 0) status = total === target ? 'exact' : 'wrong';
  else status = rule.canComplete(total, target, empty, spareFor(line)) ? 'partial' : 'strained';
  return { id: line.id, total, filled, empty, status };
}

// values: array of length n*n, 0 where a present cell is empty.
// movable: the values of every movable tile (placed or not).
export function evaluateBoard(puzzle, values) {
  const rule = RULES[puzzle.rule ?? 'sum'];
  const movable = puzzle.pool;
  const spareFor = (line) => {
    const inLine = new Set(line.cells.map((c) => values[c]));
    return movable.filter((v) => !inLine.has(v)).sort((a, b) => a - b);
  };
  const lines = puzzle.shape.lines.map((L) => evaluateLine(L, values, puzzle.target, spareFor, rule));
  const complete = puzzle.shape.cells.every((c) => values[c]);
  const solved = complete && lines.every((l) => l.status === 'exact');
  return { lines, complete, solved };
}

export function isSolution(puzzle, values) {
  for (const [c, v] of Object.entries(puzzle.givens)) if (values[+c] !== v) return false;
  const used = puzzle.shape.cells.map((c) => values[c]);
  if (used.some((v) => !v)) return false;
  if (new Set(used).size !== used.length) return false;
  const allowed = new Set([...Object.values(puzzle.givens), ...puzzle.pool]);
  if (used.some((v) => !allowed.has(v))) return false;
  return evaluateBoard(puzzle, values).solved;
}
