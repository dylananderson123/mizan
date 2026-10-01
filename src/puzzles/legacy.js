// Squares are played on the original carved-stone board. This turns a puzzle
// definition into the spec that board already understands, and refuses if the
// definition is not a plain square (so the two descriptions cannot drift).

import { standardLineIds } from '../core/shape.js';

export const isSquareDef = (def) => def.geometry?.kind === 'grid';

export function toLegacySpec(def) {
  if (!isSquareDef(def)) throw new Error(`${def.id}: not a square`);
  const n = def.geometry.n;
  const lineIds = standardLineIds(n);
  const sums = def.constraints.filter((c) => c.type === 'SUM');
  if (sums.length !== lineIds.length || !lineIds.every((id) => sums.some((c) => c.id === id))) {
    throw new Error(`${def.id}: constraints are not the standard lines of a ${n}x${n} square`);
  }
  const target = sums[0].target;
  if (sums.some((c) => c.target !== target)) throw new Error(`${def.id}: lines disagree on the total`);
  const given = new Set(Object.values(def.givens));
  const spec = {
    v: 1,
    id: def.id,
    kind: def.interaction.kind === 'swap' ? 'restore' : 'fill',
    n,
    target,
    rule: 'sum',
    givens: { ...def.givens },
    pool: def.stones.filter((v) => !given.has(v)).sort((a, b) => a - b),
    meta: { inscription: def.inscription, skill: def.skill },
  };
  if (Object.keys(def.initial).length) spec.start = { ...def.initial };
  if (def.interaction.limit) spec.limit = def.interaction.limit;
  return spec;
}
