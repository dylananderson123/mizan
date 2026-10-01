// What finishing a level changes in the save: the first-finish record, the
// best finish, the next level opening, and the coins. One function, no DOM,
// so the whole progression can be tested without a screen.

import { CHAPTERS, findLevel } from './levels.js';
import { award, rewardKey } from './economy.js';

// Fewer hints first, then fewer moves, then less time.
export function isBetter(a, b) {
  if (!b) return true;
  return a.hints !== b.hints ? a.hints < b.hints : a.moves !== b.moves ? a.moves < b.moves : a.time < b.time;
}

export function recordCompletion(save, puzzleId, stats, at = Date.now()) {
  const at_ = findLevel(puzzleId);
  if (!at_) return { first: false, coins: 0, improved: false, opened: null, balance: save.wallet.coins };
  const { chapter } = at_;
  const run = { moves: stats.moves, hints: stats.hints, time: Math.round(stats.time ?? 0) };
  const first = !save.completed[puzzleId];
  if (first) save.completed[puzzleId] = { moves: run.moves, hints: run.hints, at };
  const improved = isBetter(run, save.best[puzzleId]);
  if (improved) save.best[puzzleId] = run;

  // A level opens the next one for good.
  let opened = null;
  if (chapter.puzzles.every((p) => save.completed[p.id])) {
    const next = CHAPTERS[CHAPTERS.indexOf(chapter) + 1];
    if (next && !next.sealed && !save.unlocked.includes(next.id)) {
      save.unlocked.push(next.id);
      opened = next.id;
    }
  }
  const paid = award(save, rewardKey('level', puzzleId), chapter.reward ?? 0, at);
  return { first, coins: paid.granted, improved, opened, balance: paid.balance, run };
}
