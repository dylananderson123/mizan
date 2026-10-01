// Progression layer. Decides when each mechanic appears.
// A "level" is a short group of three puzzles, so the player climbs quickly.
// Levels 1 to 3 are handcrafted. 4 to 9 come from fixed seeds
// (tools/build-levels.mjs). 10 to 12 are named so the architecture has a
// place for them; they are sealed.
//
// The array is still called CHAPTERS inside the code: one level here is what
// the first build called a chapter.

import { CHAPTER_1 } from './chapter1.js';
import { GENERATED } from './levels.data.js';

const pick = (...ids) => ids.map((id) => CHAPTER_1.find((p) => p.id === id));

export const CHAPTERS = [
  { id: 'l1', num: 1, title: 'Fifteen', theta: 45, puzzles: pick('c1-01', 'c1-02', 'c1-03') },
  { id: 'l2', num: 2, title: 'Crossing Lines', theta: 54, puzzles: pick('c1-04', 'c1-05', 'c1-07') },
  { id: 'l3', num: 3, title: 'The First Square', theta: 60, puzzles: pick('c1-08', 'c1-09', 'c1-10') },
  { id: 'l4', num: 4, title: 'Other Numbers', theta: 50, puzzles: GENERATED.l4 },
  { id: 'l5', num: 5, title: 'Thirty Four', theta: 58, puzzles: GENERATED.l5 },
  { id: 'l6', num: 6, title: 'The Broken Square', theta: 48, puzzles: GENERATED.l6 },
  { id: 'l7', num: 7, title: 'Spare Stones', theta: 62, puzzles: GENERATED.l7 },
  { id: 'l8', num: 8, title: 'Sixteen Stones', theta: 52, puzzles: GENERATED.l8 },
  { id: 'l9', num: 9, title: 'The Deep Square', theta: 56, puzzles: GENERATED.l9 },
  { id: 'l10', num: 10, title: 'Other Rules', sealed: true, puzzles: [] },
  { id: 'l11', num: 11, title: 'Beyond the Edge', sealed: true, puzzles: [] },
  { id: 'l12', num: 12, title: 'New Forms', sealed: true, puzzles: [] },
];

// The first level that uses 1..9 in full. Daily Square opens after it.
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

// A level opens when the one before it is complete.
export function chapterOpen(chapter, completed) {
  const i = CHAPTERS.indexOf(chapter);
  if (chapter.sealed) return false;
  if (i === 0) return true;
  return CHAPTERS[i - 1].puzzles.every((p) => completed[p.id]);
}

// Inside an open level, a puzzle opens when the one before it is done.
export function levelOpen(id, completed) {
  const at = findLevel(id);
  if (!at || !chapterOpen(at.chapter, completed)) return false;
  return at.index === 0 || Boolean(completed[at.chapter.puzzles[at.index - 1].id]);
}

export function firstUnfinished(completed) {
  for (const ch of CHAPTERS) {
    if (ch.sealed) break;
    for (const p of ch.puzzles) if (!completed[p.id]) return p;
  }
  return null;
}
