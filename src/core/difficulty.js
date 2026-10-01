// Difficulty evaluator. Difficulty comes from the reasoning a puzzle needs,
// read off the logical solver's record. Grid size alone is not difficulty.
//
// Bands (internal, never shown as labels):
//   1 Introductory  only "last space in a line", three spaces or fewer
//   2 Easy          only "last space in a line"
//   3 Moderate      needs "one candidate left" or "one space left"
//   4 Difficult     needs crossing lines
//   5 Expert        needs a trial (suppose, follow, contradict)
// null: cannot be solved by deduction alone (needs a guess, or not unique).

import { solveLogically, WEIGHT, RANK } from './solver.js';

export const BAND_NAMES = ['', 'Introductory', 'Easy', 'Moderate', 'Difficult', 'Expert'];

// The hardest technique each band may use. The carver respects this.
export const BAND_MAX_TECHNIQUE = { 1: 'line', 2: 'line', 3: 'single', 4: 'crossing', 5: 'trial' };

export function rateSteps(steps) {
  let hardest = 0;
  let score = 0;
  let placements = 0;
  for (const s of steps) {
    hardest = Math.max(hardest, RANK[s.t]);
    score += WEIGHT[s.t];
    if (s.value !== undefined) placements++;
  }
  let band;
  if (hardest <= RANK.line) band = placements <= 3 ? 1 : 2;
  else if (hardest === RANK.single) band = 3;
  else if (hardest === RANK.crossing) band = 4;
  else band = 5;
  return { band, score, hardest, placements };
}

export function rateDifficulty(puzzle) {
  const r = solveLogically(puzzle);
  if (!r.solved) return { band: null, logical: false, steps: r.steps };
  return { ...rateSteps(r.steps), logical: true, steps: r.steps };
}
