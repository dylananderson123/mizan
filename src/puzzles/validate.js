// Refuses a puzzle definition that cannot be played. Used when a definition
// loads and when a saved game brings its own copy back, so a damaged save can
// never reach the board.

import { RULES } from './kit.js';

const isInt = Number.isInteger;

export function levelDefIsValid(def) {
  const fail = (why) => { throw new Error(`${def?.id ?? 'puzzle'}: ${why}`); };
  if (!def || typeof def !== 'object') fail('not a definition');
  if (typeof def.id !== 'string' || typeof def.type !== 'string') fail('missing id or type');
  if (!Array.isArray(def.nodes) || !def.nodes.length || !def.nodes.every(isInt)) fail('bad nodes');
  if (!Array.isArray(def.stones) || !def.stones.every((v) => isInt(v) && v > 0)) fail('bad stones');
  if (new Set(def.stones).size !== def.stones.length) fail('duplicate stones');
  const nodes = new Set(def.nodes);
  const stones = new Set(def.stones);
  for (const [c, v] of Object.entries({ ...def.givens, ...def.initial })) {
    if (!nodes.has(+c)) fail(`stone on missing node ${c}`);
    if (!stones.has(v)) fail(`stone ${v} is not in the stone list`);
  }
  const placed = [...Object.values(def.givens ?? {}), ...Object.values(def.initial ?? {})];
  if (new Set(placed).size !== placed.length) fail('one stone placed twice');
  if (Object.keys(def.initial ?? {}).some((c) => def.givens?.[c] !== undefined)) fail('initial stone on a given');
  if (!Array.isArray(def.constraints) || !def.constraints.length) fail('no constraints');
  for (const c of def.constraints) {
    if (!RULES[c.type]) fail(`unknown constraint type ${c.type}`);
    for (const n of RULES[c.type].cells(c)) if (!nodes.has(n)) fail(`constraint ${c.id} uses missing node ${n}`);
  }
  if (!def.geometry || typeof def.geometry.kind !== 'string') fail('no geometry');
  return true;
}
