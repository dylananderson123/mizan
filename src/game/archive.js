// The nine-level path (27 puzzles) that was the Journey until 1 Oct 2026.
// It was five versions of one idea, so the Journey now runs the five-level
// demo (levels.js). The puzzles are kept, and the tests still check them:
// the generated ones feed the Endless-style puzzle mix and the regression
// tests, and none of the work is thrown away.

import { CHAPTER_1 } from './chapter1.js';
import { GENERATED } from './levels.data.js';

const pick = (...ids) => ids.map((id) => CHAPTER_1.find((p) => p.id === id));

export const ARCHIVE = [
  { id: 'a1', num: 1, title: 'Fifteen', puzzles: pick('c1-01', 'c1-02', 'c1-03') },
  { id: 'a2', num: 2, title: 'Crossing Lines', puzzles: pick('c1-04', 'c1-05', 'c1-07') },
  { id: 'a3', num: 3, title: 'Fewer Marks', puzzles: pick('c1-08', 'c1-09', 'c1-10') },
  { id: 'a4', num: 4, title: 'Other Numbers', puzzles: GENERATED.l4 },
  { id: 'a5', num: 5, title: 'Thirty Four', puzzles: GENERATED.l5 },
  { id: 'a6', num: 6, title: 'The Broken Square', puzzles: GENERATED.l6 },
  { id: 'a7', num: 7, title: 'Spare Stones', puzzles: GENERATED.l7 },
  { id: 'a8', num: 8, title: 'Sixteen Stones', puzzles: GENERATED.l8 },
  { id: 'a9', num: 9, title: 'The Deep Square', puzzles: GENERATED.l9 },
];

export const archiveFind = (id) => {
  for (const ch of ARCHIVE) {
    const spec = ch.puzzles.find((p) => p.id === id);
    if (spec) return spec;
  }
  return null;
};
