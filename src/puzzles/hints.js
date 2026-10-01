// Hints for the puzzles that are not plain fill-the-gaps squares.
//
// Same three tiers as the original hints: 1 points at an area, 2 explains the
// relationship, 3 gives the next step. Every hint is worked out from the
// board in front of the player, with the puzzle kit, never read from a stored
// answer. If a stone has been placed that cannot belong to any solution, the
// hint says so first.

import { solve } from './kit.js';

const TRIANGLE_NAMES = [
  'top corner', 'bottom right corner', 'bottom left corner',
  'right side, upper', 'right side, lower', 'bottom, right', 'bottom, left', 'left side, lower', 'left side, upper',
];
const RING_NAMES = ['top', 'top right', 'right', 'bottom right', 'bottom', 'bottom left', 'left', 'top left'];

export function nodeName(def, node) {
  if (def.geometry.kind === 'triangle') return TRIANGLE_NAMES[node];
  if (def.geometry.kind === 'ring') return RING_NAMES[node];
  return `place ${node + 1}`;
}

const tier = (t) => ({ cells: [], lines: [], tiles: [], ghost: null, ...t });

// The stones the player has put on the board, { node: value }, not counting
// locked ones.
function placedByPlayer(def, vals) {
  const out = {};
  for (const n of def.nodes) if (vals[n] && def.givens[n] === undefined) out[n] = vals[n];
  return out;
}

// Which empty node is forced, or has the fewest options, given what is placed.
function nextPlacement(def, placed) {
  const sols = solve(def, { limit: 400, fixed: placed });
  if (!sols.length) return null;
  const taken = new Set([...Object.keys(def.givens), ...Object.keys(placed)].map(Number));
  let best = null;
  for (const n of def.nodes) {
    if (taken.has(n)) continue;
    const options = [...new Set(sols.map((s) => s[n]))];
    if (!best || options.length < best.options.length) best = { node: n, options };
  }
  return best && { node: best.node, value: Math.min(...best.options), forced: best.options.length === 1 };
}

// A placed stone that belongs to no solution. Returns the one whose removal
// brings a solution back, or null if the board is fine.
function misplaced(def, placed) {
  if (solve(def, { limit: 1, fixed: placed }).length) return null;
  for (const n of Object.keys(placed).map(Number)) {
    const rest = { ...placed };
    delete rest[n];
    if (solve(def, { limit: 1, fixed: rest }).length) return n;
  }
  return Object.keys(placed).map(Number)[0] ?? null;
}

function misplacedPlan(def, placed, bad) {
  const v = placed[bad];
  const where = nodeName(def, bad);
  return {
    tiers: [
      tier({ text: 'One of the stones you placed cannot stay.', lines: def.show ? sideIdsThrough(def, bad) : [] }),
      tier({ text: `Look at the ${where}.`, cells: [bad] }),
      tier({ text: `The ${v} at the ${where} does not belong there. Move it.`, cells: [bad], tiles: [v] }),
    ],
  };
}

function sideIdsThrough(def, node) {
  const groups = def.constraints.find((c) => c.id === def.show).groups;
  return groups.map((g, i) => (g.includes(node) ? `s${i}` : null)).filter(Boolean);
}

// -------------------------------------------------------------- triangle

function triangleHint(def, vals) {
  const placed = placedByPlayer(def, vals);
  const bad = misplaced(def, placed);
  if (bad !== null) return misplacedPlan(def, placed, bad);
  const next = nextPlacement(def, placed);
  if (!next) return null;
  const where = nodeName(def, next.node);
  return {
    tiers: [
      tier({ text: 'A corner belongs to two sides. A middle stone belongs to one.', cells: [0, 1, 2] }),
      tier({ text: 'All nine stones add to 45. The corners count twice, so 45 plus the corners must split into three equal sides.', cells: [0, 1, 2] }),
      tier({
        text: next.forced ? `Only one stone fits the ${where}: the ${next.value}.` : `Try the ${next.value} at the ${where}.`,
        cells: [next.node], tiles: [next.value], ghost: { cell: next.node, value: next.value },
      }),
    ],
  };
}

// ------------------------------------------------------------------ ring

function ringHint(def, vals) {
  const placed = placedByPlayer(def, vals);
  const bad = misplaced(def, placed);
  if (bad !== null) return misplacedPlan(def, placed, bad);
  const sol = solve(def, { limit: 1, fixed: placed })[0];
  const pairs = def.constraints.find((c) => c.id === 'opposites').groups;
  const mateOf = (n) => pairs.find((g) => g.includes(n)).find((m) => m !== n);
  const empties = def.nodes.filter((n) => !vals[n]);
  if (!sol || !empties.length) return null;
  // Start with a place whose partner across the ring is already on the board,
  // so the hint can point at something the player can see.
  const node = empties.find((n) => vals[mateOf(n)]) ?? empties[0];
  const mate = mateOf(node);
  const total = sol[node] + sol[mate];
  return {
    tiers: [
      tier({ text: 'Look at the three rings. Something is the same in all of them.' }),
      tier({ text: 'Look at the stones that sit directly across from each other.' }),
      tier({
        text: `Across from this place sits the ${sol[mate]}. In every ring, stones across from each other make ${total}. So the ${sol[node]} goes here.`,
        cells: [node, mate], tiles: [sol[node]], ghost: { cell: node, value: sol[node] },
      }),
    ],
  };
}

export function planNodeHint(def, vals) {
  if (def.type === 'magic-triangle') return triangleHint(def, vals);
  if (def.type === 'hidden-rule') return ringHint(def, vals);
  return null;
}

// ------------------------------------------------------- broken square

// For a finished-looking square with one wrong stone. The lines that are off
// all pass through the wrong stone, and each is off by the same amount, so
// the engine can name the stone and the number it should be. Returns null
// when the board is not in that simple state (the general hint takes over).
export function diagnoseSquare(spec, evalLines, values, cellName, trayValues) {
  const wrong = evalLines.filter((l) => l.status === 'wrong');
  if (!wrong.length) return null;
  const cells = new Map();
  for (const l of wrong) for (const c of spec.shape.lines.find((L) => L.id === l.id).cells) cells.set(c, (cells.get(c) ?? 0) + 1);
  const shared = [...cells].filter(([, k]) => k === wrong.length).map(([c]) => c);
  const gaps = new Set(wrong.map((l) => l.total - spec.target));
  if (shared.length !== 1 || gaps.size !== 1) return null;
  const cell = shared[0];
  const gap = [...gaps][0];
  const should = values[cell] - gap;
  if (!trayValues.includes(should)) return null; // the right stone must be waiting in the tray
  const word = gap > 0 ? 'high' : 'low';
  const n = wrong.length;
  return {
    tiers: [
      tier({ text: `${n === 1 ? 'A line is' : `${n} lines are`} off. ${n === 1 ? 'Which stone is the wrong one?' : 'Which stone do they all share?'}`, lines: wrong.map((l) => l.id) }),
      tier({ text: `They cross at the ${cellName(cell)}. Each is ${Math.abs(gap)} too ${word}, so that stone is ${Math.abs(gap)} too ${word}.`, lines: wrong.map((l) => l.id), cells: [cell] }),
      tier({ text: `The ${values[cell]} should be ${should}. There is ${/^(8|11|18)$/.test(String(should)) ? 'an' : 'a'} ${should} in the tray.`, cells: [cell], tiles: [values[cell], should] }),
    ],
  };
}
