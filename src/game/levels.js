// Progression layer. Decides which level exists and when it opens.
//
// Rewritten 1 Oct 2026 `[Dylan]`: the first five levels are no longer five
// versions of one square. Each asks for a different kind of thinking:
//
//   1 The Square          CALCULATE   fill a square so every line balances
//   2 The Broken Square   DETECT      find the one wrong stone from the totals
//   3 Restoration         OPTIMIZE    undo a swap, as many swaps as you like
//   4 The Magic Triangle  GENERALIZE  no grid: three sides must agree
//   5 The Hidden Rule     DISCOVER    infer the rule from finished examples
//
// Every level is a puzzle definition (src/puzzles/definitions.js). A square is
// played on the original carved board through `toLegacySpec`; the others
// carry their own definition, which the node board plays.
//
// The array is still called CHAPTERS: a level here is what the first build
// called a chapter. Each has exactly one puzzle for now, and the code already
// handles several.

import { LEVELS } from '../puzzles/definitions.js';
import { toLegacySpec, isSquareDef } from '../puzzles/legacy.js';

const THETA = { m1: 45, m2: 54, m3: 60, m4: 50, m5: 58 }; // contact angle of each frame's pattern

const chapterOf = (def, i) => ({
  id: `l${i + 1}`,
  num: i + 1,
  title: def.title,
  skill: def.skill,
  intro: def.intro ?? def.blurb,
  theta: THETA[def.id] ?? 45,
  reward: def.reward,
  def,
  puzzles: [isSquareDef(def) ? toLegacySpec(def) : def],
});

export const CHAPTERS = [
  ...LEVELS.map(chapterOf),
  { id: 'l6', num: 6, title: 'Further forms', sealed: true, puzzles: [] },
];

// Daily Square opens after this level is complete.
export const DAILY_AFTER = 'l3';
// Endless 4x4 opens when this level opens.
export const FOUR_AT = 'l5';
export const chapterById = (id) => CHAPTERS.find((c) => c.id === id);

export function findLevel(id) {
  for (const ch of CHAPTERS) {
    const i = ch.puzzles.findIndex((p) => p.id === id);
    if (i >= 0) return { chapter: ch, index: i, spec: ch.puzzles[i] };
  }
  return null;
}

export function nextLevel(id) {
  const at = findLevel(id);
  if (!at) return null;
  if (at.index + 1 < at.chapter.puzzles.length) return at.chapter.puzzles[at.index + 1];
  const ci = CHAPTERS.indexOf(at.chapter);
  const next = CHAPTERS[ci + 1];
  return next && !next.sealed ? next.puzzles[0] : null;
}

// A level is open when the save lists it as unlocked, or when the one before
// it is complete. (The save's list is what makes "unlocked" survive on its
// own; the second test is the rule it was written from.)
export function chapterOpen(chapter, completed, unlocked = []) {
  const i = CHAPTERS.indexOf(chapter);
  if (chapter.sealed) return false;
  if (i === 0 || unlocked.includes(chapter.id)) return true;
  return CHAPTERS[i - 1].puzzles.every((p) => completed[p.id]);
}

// Inside an open level, a puzzle opens when the one before it is done.
export function levelOpen(id, completed, unlocked = []) {
  const at = findLevel(id);
  if (!at || !chapterOpen(at.chapter, completed, unlocked)) return false;
  return at.index === 0 || Boolean(completed[at.chapter.puzzles[at.index - 1].id]);
}

export function firstUnfinished(completed) {
  for (const ch of CHAPTERS) {
    if (ch.sealed) break;
    for (const p of ch.puzzles) if (!completed[p.id]) return p;
  }
  return null;
}
