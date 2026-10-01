// Levels 1 to 3, the tutorial. Handcrafted. (c1-06 "Opposites" was cut
// on 1 Oct 2026 to make the climb faster.)
// Every level is a piece of the same Lo Shu:
//   4 9 2
//   3 5 7
//   8 1 6
// The board starts as one carved row and opens, level by level, into the
// whole square. Spare tiles that do not fit are there on purpose: trying
// them is how the rule is learned.

const base = { v: 1, kind: 'fill', n: 3, target: 15, rule: 'sum' };

export const CHAPTER_1 = [
  { ...base, id: 'c1-01', cells: [6, 7, 8], lines: ['r2'], givens: { 6: 8, 8: 6 }, pool: [1, 4, 7],
    meta: { inscription: 'Fifteen' } },
  { ...base, id: 'c1-02', cells: [2, 5, 8], lines: ['c2'], givens: { 8: 6 }, pool: [2, 4, 7],
    meta: { inscription: 'Down' } },
  { ...base, id: 'c1-03', cells: [1, 3, 4, 5, 7], lines: ['r1', 'c1'], givens: { 1: 9, 3: 3, 5: 7, 7: 1 }, pool: [4, 5, 6],
    meta: { inscription: 'Crossing' } },
  { ...base, id: 'c1-04', cells: [1, 3, 4, 5, 7], lines: ['r1', 'c1'], givens: { 1: 9, 3: 3, 7: 1 }, pool: [2, 5, 6, 7],
    meta: { inscription: 'One space, two lines' } },
  { ...base, id: 'c1-05', cells: [0, 1, 2, 4, 8], lines: ['r0', 'd'], givens: { 1: 9, 4: 5, 8: 6 }, pool: [2, 3, 4, 8],
    meta: { inscription: 'Slant' } },
  { ...base, id: 'c1-07', givens: { 0: 4, 2: 2, 3: 3, 4: 5, 7: 1, 8: 6 }, pool: [7, 8, 9],
    meta: { inscription: 'The square' } },
  { ...base, id: 'c1-08', givens: { 0: 4, 2: 2, 4: 5, 7: 1 }, pool: [3, 6, 7, 8, 9],
    meta: { inscription: 'Fewer marks' } },
  { ...base, id: 'c1-09', givens: { 0: 4, 1: 9, 8: 6 }, pool: [1, 2, 3, 5, 7, 8],
    meta: { inscription: 'The centre' } },
  { ...base, id: 'c1-10', givens: { 1: 9, 3: 3 }, pool: [1, 2, 4, 5, 6, 7, 8],
    meta: { inscription: 'Two marks' } },
];
