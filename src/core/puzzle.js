// The puzzle model, and how it is written to and read from storage.
//
// A puzzle spec is plain JSON:
// {
//   v: 1,                       schema version
//   id: 'ch1-01',
//   kind: 'fill' | 'restore',   fill the gaps, or put a broken square right
//   n: 3,                       lattice size
//   cells: [..] | undefined     present cells, all if omitted
//   lines: ['r0', ..] | undefined   constraint lines, standard set if omitted
//   target: 15,
//   rule: 'sum',
//   givens: { '4': 5 },         locked tiles, carved into the board
//   pool: [1, 2, ..],           movable tiles
//   start: { '0': 8 } | undefined   restore only: where movable tiles begin
//   meta: { title, inscription, band }
// }

import { makeShape } from './shape.js';
import { magicConstant } from './magic.js';

export const PUZZLE_VERSION = 1;

export function hydrate(spec) {
  if (spec.v !== PUZZLE_VERSION) throw new Error(`Unsupported puzzle version ${spec.v}`);
  const shape = makeShape(spec.n, { cells: spec.cells, lines: spec.lines });
  const givens = {};
  for (const [k, v] of Object.entries(spec.givens ?? {})) givens[+k] = v;
  const p = {
    ...spec,
    rule: spec.rule ?? 'sum',
    target: spec.target ?? magicConstant(spec.n),
    givens,
    pool: [...spec.pool],
    shape,
  };
  p.useAll = p.pool.length === shape.cells.length - Object.keys(givens).length;
  validateSpec(p);
  return p;
}

function validateSpec(p) {
  const present = new Set(p.shape.cells);
  for (const c of Object.keys(p.givens)) {
    if (!present.has(+c)) throw new Error(`${p.id}: given on missing cell ${c}`);
  }
  const all = [...Object.values(p.givens), ...p.pool];
  if (new Set(all).size !== all.length) throw new Error(`${p.id}: duplicate tile values`);
  if (p.kind === 'restore') {
    const start = p.start ?? {};
    const placed = Object.values(start).sort((a, b) => a - b);
    const pool = [...p.pool].sort((a, b) => a - b);
    if (placed.join() !== pool.join()) throw new Error(`${p.id}: restore start must place every pool tile`);
    for (const c of Object.keys(start)) {
      if (!present.has(+c) || p.givens[+c] !== undefined) throw new Error(`${p.id}: bad start cell ${c}`);
    }
  }
}

export function serialize(p) {
  const out = {
    v: PUZZLE_VERSION,
    id: p.id,
    kind: p.kind,
    n: p.n,
    target: p.target,
    rule: p.rule,
    givens: { ...p.givens },
    pool: [...p.pool],
  };
  if (p.cells) out.cells = [...p.cells];
  if (p.lines) out.lines = [...p.lines];
  if (p.start) out.start = { ...p.start };
  if (p.meta) out.meta = { ...p.meta };
  return JSON.parse(JSON.stringify(out));
}

// A values array for a puzzle with nothing but its givens placed.
export function givenValues(p) {
  const values = new Array(p.n * p.n).fill(0);
  for (const [c, v] of Object.entries(p.givens)) values[+c] = v;
  return values;
}
