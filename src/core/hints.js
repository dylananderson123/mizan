// Hints that teach. Each hint is a plan with three tiers:
//   1 points at an area, 2 explains the relationship, 3 reveals the deduction.
// The plan is read from the logical solver, so a hint is always the next
// thing a person could actually work out from this exact board.

import { evaluateBoard } from './constraints.js';
import { describeLine } from './shape.js';
import { findSolutions, initState, nextStep, applyStep } from './solver.js';
import { restoreDistance } from './carver.js';

const NAMES3 = ['top left', 'top middle', 'top right', 'middle left', 'centre', 'middle right', 'bottom left', 'bottom middle', 'bottom right'];

export function cellName(n, c) {
  if (n === 3) return NAMES3[c];
  return `row ${Math.floor(c / n) + 1}, column ${(c % n) + 1}`;
}

const theCell = (n, c) => (n === 3 ? `the ${cellName(n, c)}` : cellName(n, c));

function placedMovable(puzzle, values) {
  const out = {};
  for (const c of puzzle.shape.cells) {
    if (values[c] && puzzle.givens[c] === undefined) out[c] = values[c];
  }
  return out;
}

function nearestSolution(puzzle, placed) {
  const sols = findSolutions(puzzle, { limit: 200 });
  let best = null;
  let bestScore = -1;
  for (const g of sols) {
    let score = 0;
    for (const [c, v] of Object.entries(placed)) if (g[+c] === v) score++;
    if (score > bestScore) { bestScore = score; best = g; }
  }
  return best;
}

function plan(tiers, focus = {}) {
  return { tiers: tiers.map((t) => ({ cells: [], lines: [], tiles: [], ghost: null, ...t })), ...focus };
}

export function planHint(puzzle, values) {
  return puzzle.kind === 'restore' ? planRestoreHint(puzzle, values) : planFillHint(puzzle, values);
}

function planFillHint(puzzle, values) {
  const { n, target } = puzzle;
  const ev = evaluateBoard(puzzle, values);
  if (ev.solved) return null;
  const placed = placedMovable(puzzle, values);

  // A line that can no longer work.
  const bad = ev.lines.find((l) => l.status === 'wrong' || l.status === 'strained');
  if (bad) {
    const desc = describeLine(n, bad.id);
    const sol = nearestSolution(puzzle, placed);
    const line = puzzle.shape.lines.find((L) => L.id === bad.id);
    const culprit = sol && line.cells.find((c) => placed[c] !== undefined && sol[c] !== placed[c]);
    const second = bad.status === 'wrong'
      ? `The ${desc} totals ${bad.total}. It must total ${target}.`
      : `The ${desc} totals ${bad.total}. No tiles that remain can bring it to ${target}.`;
    const third = culprit !== undefined && culprit !== null
      ? { text: `The ${placed[culprit]} belongs somewhere else.`, cells: [culprit], lines: [bad.id] }
      : { text: second, lines: [bad.id] };
    return plan([
      { text: `Something in the ${desc} does not fit.`, lines: [bad.id] },
      { text: second, lines: [bad.id] },
      third,
    ]);
  }

  // Every line can still work, but the tiles placed so far cannot all stay.
  if (Object.keys(placed).length && findSolutions(puzzle, { limit: 1, extra: placed }).length === 0) {
    const sol = nearestSolution(puzzle, placed);
    const cells = Object.keys(placed).map(Number);
    const fails = (extra) => findSolutions(puzzle, { limit: 1, extra }).length === 0;
    // Blame one stone only if that stone alone is impossible where it sits.
    const alone = cells.find((c) => fails({ [c]: placed[c] }));
    if (alone !== undefined) {
      const v = placed[alone];
      const home = sol.indexOf(v);
      return plan([
        { text: 'One of your stones cannot stay where it is.', lines: puzzle.shape.lines.filter((L) => L.cells.includes(alone)).map((L) => L.id) },
        { text: `With the ${v} where it is, the square can never be finished.`, cells: [alone] },
        home >= 0
          ? { text: `The ${v} belongs in ${theCell(n, home)}.`, cells: [alone, home], ghost: { cell: home, value: v } }
          : { text: `The ${v} is not part of this square.`, cells: [alone] },
      ]);
    }
    // Otherwise the clash is between stones. Name a pair if one clashes.
    let pair = null;
    for (let i = 0; i < cells.length && !pair; i++) {
      for (let j = i + 1; j < cells.length && !pair; j++) {
        if (fails({ [cells[i]]: placed[cells[i]], [cells[j]]: placed[cells[j]] })) pair = [cells[i], cells[j]];
      }
    }
    const moveMe = (pair ?? cells).find((c) => sol[c] !== placed[c]) ?? cells[0];
    const home = sol.indexOf(placed[moveMe]);
    const third = { text: `Move the ${placed[moveMe]}${home >= 0 ? ` to ${theCell(n, home)}` : ''}.`, cells: [moveMe], ghost: home >= 0 ? { cell: home, value: placed[moveMe] } : null };
    return plan(pair
      ? [
        { text: 'Two of your stones cannot both stay.', cells: pair },
        { text: `The ${placed[pair[0]]} and the ${placed[pair[1]]} each fit alone, but not together.`, cells: pair },
        third,
      ]
      : [
        { text: 'Your stones cannot all stay where they are.', cells },
        { text: 'Each could work alone. Together they leave no way to finish.', cells },
        third,
      ]);
  }

  // The next deduction a person could make from here.
  // Elimination-only steps place nothing, so the player cannot act on them.
  // Run through them on scratch state and hint the first placement.
  const st = initState(puzzle, values);
  let step = nextStep(st);
  const ruledOut = [];
  for (let i = 0; i < 40 && step && !step.contradiction && step.value === undefined; i++) {
    ruledOut.push(step);
    applyStep(st, step);
    step = nextStep(st);
  }
  if (ruledOut.length && step && !step.contradiction && step.value !== undefined) {
    const first = ruledOut[0];
    const why = `First rule out the ${listWords(first.eliminated)} in ${theCell(n, first.cell)}: the lines through it cannot all reach ${target} with ${first.eliminated.length > 1 ? 'those' : 'it'}.`;
    const ghost = { cell: step.cell, value: step.value };
    return plan([
      { text: 'Look at the lines that cross here.', cells: [first.cell], lines: first.lines },
      { text: why, cells: [first.cell], lines: first.lines },
      { text: `Ruling stones out ${ruledOut.length > 1 ? `${ruledOut.length} times ` : ''}leaves only the ${step.value} for ${theCell(n, step.cell)}.`, cells: [step.cell], ghost },
    ]);
  }
  if (step && !step.contradiction) {
    const c = step.cell;
    const v = step.value;
    const where = theCell(n, c);
    const ghost = v !== undefined ? { cell: c, value: v } : null;
    switch (step.t) {
      case 'line': {
        const desc = describeLine(n, step.lines[0]);
        return plan([
          { text: `Look at the ${desc}.`, lines: step.lines },
          { text: `The ${desc} totals ${step.total}. It needs ${step.need} more.`, lines: step.lines, cells: [c] },
          { text: `So ${where} takes the ${v}.`, lines: step.lines, cells: [c], ghost },
        ]);
      }
      case 'single':
        return plan([
          { text: 'Look at this space.', cells: [c] },
          { text: `Every line through it must reach ${target}. Only one tile lets them all.`, cells: [c], lines: step.lines },
          { text: `Only the ${v} fits in ${where}.`, cells: [c], lines: step.lines, ghost },
        ]);
      case 'place':
        return plan([
          { text: `Look at the ${v}.`, tiles: [v] },
          { text: `Try the ${v} in each empty space. In all but one, a line through it can no longer reach ${target}.`, tiles: [v] },
          { text: `The ${v} goes in ${where}.`, tiles: [v], cells: [c], ghost },
        ]);
      case 'crossing':
      case 'narrow': {
        const k = step.lines.length;
        const third = step.t === 'crossing'
          ? { text: `Only the ${v} lets all ${k} lines work at once.`, cells: [c], lines: step.lines, ghost }
          : { text: `The ${listWords(step.eliminated)} cannot go in ${where}.`, cells: [c], lines: step.lines };
        return plan([
          { text: 'Look at the lines that cross here.', cells: [c], lines: step.lines },
          { text: `This space sits on ${k} lines. Each must reach ${target}, and no tile can be used twice.`, cells: [c], lines: step.lines },
          third,
        ]);
      }
      case 'trial':
        return plan([
          { text: 'Look at this space.', cells: [c] },
          { text: 'Try each tile that could go here, in your head. All but one break a line.', cells: [c], lines: step.lines },
          { text: `Only the ${v} survives in ${where}.`, cells: [c], lines: step.lines, ghost },
        ]);
      default:
        break;
    }
  }

  // No forced move: more than one square can grow from here.
  const sol = findSolutions(puzzle, { limit: 1, extra: placed })[0];
  if (!sol) return null;
  const empty = puzzle.shape.cells.filter((x) => !values[x]);
  const centre = (n * n - 1) / 2;
  const c = empty.includes(centre) ? centre : empty[0];
  return plan([
    { text: 'More than one answer can grow from here. Any good start works.', cells: [c] },
    { text: `Try the ${sol[c]} in ${theCell(n, c)}, and follow the lines.`, cells: [c] },
    { text: `The ${sol[c]} in ${theCell(n, c)} leads to a whole square.`, cells: [c], ghost: { cell: c, value: sol[c] } },
  ]);
}

function planRestoreHint(puzzle, values) {
  const { n, target } = puzzle;
  const ev = evaluateBoard(puzzle, values);
  if (ev.solved) return null;
  const { nearest } = restoreDistance(puzzle, values);
  if (!nearest) return null;
  const wrong = puzzle.shape.cells.filter((c) => values[c] !== nearest[c]);
  let pair = null;
  for (const i of wrong) {
    for (const j of wrong) {
      if (i < j && values[i] === nearest[j] && values[j] === nearest[i]) { pair = [i, j]; break; }
    }
    if (pair) break;
  }
  if (!pair) {
    const i = wrong[0];
    pair = [i, values.indexOf(nearest[i])];
  }
  const [i, j] = pair;
  const badLine = ev.lines.find((l) => l.status === 'wrong' && puzzle.shape.lines.find((L) => L.id === l.id).cells.includes(i))
    ?? ev.lines.find((l) => l.status === 'wrong');
  const desc = describeLine(n, badLine.id);
  return plan([
    { text: `The ${desc} is broken.`, lines: [badLine.id] },
    { text: `The ${desc} totals ${badLine.total}. It must total ${target}.`, lines: [badLine.id] },
    { text: `Swap the ${values[i]} and the ${values[j]}.`, cells: [i, j], lines: [badLine.id] },
  ]);
}

function listWords(vals) {
  if (vals.length === 1) return `${vals[0]}`;
  return `${vals.slice(0, -1).join(', ')} and ${vals[vals.length - 1]}`;
}
