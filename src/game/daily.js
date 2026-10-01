// Daily Square and Endless. Same seed, same puzzle, for everyone.

import { createRng } from '../core/rng.js';
import { randomMagicSquare, randomLucasSquare } from '../core/generator.js';
import { carveFill, carveRestore } from '../core/carver.js';

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function previousDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d - 1));
}

// One moderate 3x3 on fresh numbers: a two-minute ritual, not a chore.
export function dailyPuzzle(dateKey) {
  for (let k = 0; k < 100; k++) {
    const rng = createRng(`daily:${dateKey}:${k}`);
    const spec = carveFill(randomLucasSquare(rng), 3, rng, { band: 3, id: `daily-${dateKey}`, tries: 8 });
    if (spec) return { ...spec, meta: { ...spec.meta, inscription: 'Daily square' } };
  }
  throw new Error('No daily puzzle');
}

export function recordDaily(save, dateKey, stats) {
  const d = save.daily;
  if (d.records[dateKey]) return save; // first finish of the day counts
  d.records[dateKey] = stats;
  if (d.lastDate === previousDateKey(dateKey)) d.streak += 1;
  else if (d.lastDate !== dateKey) d.streak = 1;
  d.lastDate = dateKey;
  return save;
}

// Endless: what the player picks, carved on the spot from a stored seed.
export const ENDLESS_KINDS = [
  { id: 'fill3', label: 'Three', n: 3, kind: 'fill', bands: [1, 2, 3] },
  { id: 'restore3', label: 'Broken three', n: 3, kind: 'restore', bands: [1, 2, 3] },
  { id: 'fill4', label: 'Four', n: 4, kind: 'fill', bands: [1, 2, 3, 4, 5], needs: 'c4' },
];

export function endlessPuzzle(kindId, band, seed) {
  const kind = ENDLESS_KINDS.find((k) => k.id === kindId);
  for (let k = 0; k < 60; k++) {
    const rng = createRng(`endless:${kindId}:${band}:${seed}:${k}`);
    const id = `endless-${kindId}-${band}-${seed}`;
    const meta = { inscription: '' };
    let spec;
    if (kind.kind === 'restore') {
      // band means swaps here; lock a stone or two on the harder ones
      spec = carveRestore(randomLucasSquare(rng), 3, rng, { swaps: band, locked: band > 1 ? 1 : 0, id, meta, tries: 10 });
    } else {
      const sq = kind.n === 3 ? randomLucasSquare(rng) : randomMagicSquare(kind.n, rng);
      spec = carveFill(sq, kind.n, rng, { band, id, meta, tries: 6 });
    }
    if (spec) return spec;
  }
  return null;
}
