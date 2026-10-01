// Progression layer. Decides when each mechanic appears.
// Chapters I is handcrafted. II to IV come from fixed seeds (tools/build-levels.mjs).
// V to VII are named so the architecture has a place for them; they are sealed.

import { CHAPTER_1 } from './chapter1.js';
import { GENERATED } from './levels.data.js';

export const CHAPTERS = [
  { id: 'c1', numeral: 'I', title: 'The First Square', theta: 45, puzzles: CHAPTER_1 },
  { id: 'c2', numeral: 'II', title: 'The Missing Tile', theta: 54, puzzles: GENERATED.c2 },
  { id: 'c3', numeral: 'III', title: 'The Broken Square', theta: 60, puzzles: GENERATED.c3 },
  { id: 'c4', numeral: 'IV', title: 'Thirty Four', theta: 50, puzzles: GENERATED.c4 },
  { id: 'c5', numeral: 'V', title: 'Other Rules', sealed: true, puzzles: [] },
  { id: 'c6', numeral: 'VI', title: 'Beyond the Edge', sealed: true, puzzles: [] },
  { id: 'c7', numeral: 'VII', title: 'New Forms', sealed: true, puzzles: [] },
];

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

// A chapter opens when the one before it is complete.
export function chapterOpen(chapter, completed) {
  const i = CHAPTERS.indexOf(chapter);
  if (chapter.sealed) return false;
  if (i === 0) return true;
  return CHAPTERS[i - 1].puzzles.every((p) => completed[p.id]);
}

// Inside an open chapter, a level opens when the one before it is done.
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
