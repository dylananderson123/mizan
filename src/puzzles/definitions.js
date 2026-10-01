// The five puzzles of the demo, written as plain definitions.
//
// CALCULATE -> DETECT -> OPTIMIZE -> GENERALIZE -> DISCOVER
//
// A definition says WHAT the puzzle is (nodes, stones, constraints, what the
// player may do) and never HOW it looks. The same definition feeds the
// verifier (tests/puzzles.test.js), the hint planner and the screen.
//
// Fields every definition has:
//   id, type, skill, title, blurb who it is
//   nodes                         node ids (a node holds one stone)
//   stones                        every number in play, placed or spare
//   givens                        { node: number } carved in, never movable
//   initial                       { node: number } movable stones that start on the board
//   constraints                   see kit.js
//   interaction                   { kind: 'place' | 'swap', limit? }  what the player may do
//   geometry                      { kind: 'grid' | 'triangle' | 'ring', ... } how nodes sit
//   reward                        coins for the first completion
//
// Where a puzzle is a square, `toLegacySpec` (legacy.js) turns it into the
// spec the original board already plays, so the carved stone board, the line
// markers and the frame pattern are kept exactly as they were.

import { lineCells, standardLineIds } from '../core/shape.js';
import { sum, equalSum, allDifferent } from './kit.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ---------------------------------------------------------------- squares

// Every row, column and both diagonals make `target`, and no number repeats.
// MathWorld: a normal n x n square has M = n(n^2 + 1) / 2, so 15 for n = 3.
export function magicSquareConstraints(n, target) {
  const cells = range(0, n * n - 1);
  return [
    ...standardLineIds(n).map((id) => sum(id, lineCells(n, id), target)),
    allDifferent('distinct', cells),
  ];
}

const square = (n) => ({ nodes: range(0, n * n - 1), geometry: { kind: 'grid', n } });

// ---------------------------------------------------------------- triangle

// Nine nodes on a triangle, the NRICH "Magic Triangle" arrangement: three
// corners and two nodes on each side, so each side holds four.
//
//            0
//          8   3
//        7       4
//      2   6   5   1
//
// Side A runs 0 -> 1 (nodes 0, 3, 4, 1), side B 1 -> 2 (1, 5, 6, 2), side C
// 2 -> 0 (2, 7, 8, 0). Corners belong to two sides.
export const TRIANGLE_SIDES = [[0, 3, 4, 1], [1, 5, 6, 2], [2, 7, 8, 0]];

// ------------------------------------------------------------------- ring

// Eight nodes on a ring, numbered clockwise from the top. Node i sits opposite
// node i + 4.
export const RING_PAIRS = [[0, 4], [1, 5], [2, 6], [3, 7]];

export const LEVELS = [
  // 1. THE SQUARE. Calculate. Every row, column and diagonal makes 15.
  {
    id: 'm1',
    blurb: 'Fill the square so every row, column and diagonal makes 15.',
    type: 'magic-square',
    skill: 'CALCULATE',
    title: 'The Square',
    inscription: 'Balance',
    ...square(3),
    stones: range(1, 9),
    givens: { 0: 4, 2: 2, 4: 5, 7: 1 },
    initial: {},
    constraints: magicSquareConstraints(3, 15),
    target: 15,
    interaction: { kind: 'place' },
    reward: 10,
    teach: 'Drag a stone into a space, or tap a stone and then a space.',
  },

  // 2. THE BROKEN SQUARE. Detect. A finished square with one wrong stone.
  // Made easier 1 Oct 2026 `[Dylan]`: the numbers are the small ones, 1 to 9,
  // total 15, the same square the player met in Level 1. The 8 in the bottom
  // left has become a 10. Three lines are 2 too high and they cross at that
  // one stone. Two spare stones wait in the tray: the right one, and one that
  // fits nowhere.
  {
    id: 'm2',
    blurb: 'A finished square with one wrong stone. Read the totals and find it.',
    type: 'magic-square',
    skill: 'DETECT',
    title: 'The Broken Square',
    inscription: 'Look at the totals',
    ...square(3),
    stones: range(1, 11),
    givens: {},
    initial: { 0: 4, 1: 9, 2: 2, 3: 3, 4: 5, 5: 7, 6: 10, 7: 1, 8: 6 },
    constraints: magicSquareConstraints(3, 15),
    target: 15,
    interaction: { kind: 'place' },
    reward: 15,
    teach: 'This square looks finished. It is not. Read the totals.',
    intro: 'This square looks finished, but one stone is wrong. Read the totals around the edge. The lines that miss the goal all cross at the wrong stone. Put the right stone in its place.',
  },

  // 3. RESTORATION. Optimize. All nine numbers are present, two have traded
  // places, and one swap puts them back. The player may swap as often as they
  // like (limit removed 2 Oct 2026 `[Dylan]`). Starting from the Lo Shu
  //   4 9 2 / 3 5 7 / 8 1 6
  // the 3 and the 7 have been exchanged. Made easier 1 Oct 2026 `[Dylan]`:
  // they sit in the middle row, so every row and both diagonals still make 15
  // and only two lines are wrong, the first column (4 high) and the last (4 low).
  {
    id: 'm3',
    blurb: 'Every number is here, but two have traded places. Swap stones until every line makes 15.',
    type: 'magic-square',
    skill: 'OPTIMIZE',
    title: 'Restoration',
    inscription: 'Swap them back',
    ...square(3),
    stones: range(1, 9),
    givens: {},
    initial: { 0: 4, 1: 9, 2: 2, 3: 7, 4: 5, 5: 3, 6: 8, 7: 1, 8: 6 },
    constraints: magicSquareConstraints(3, 15),
    target: 15,
    interaction: { kind: 'swap' },
    reward: 20,
    teach: 'Swap stones as often as you like. Find the two that traded places.',
    intro: 'Every number is here, but two stones have traded places. Swap stones as many times as you like. Find the two that are in each other\'s spaces and swap them back.',
  },

  // 4. THE MAGIC TRIANGLE. Generalize. No grid. Each of the three sides must
  // add to the same total, and nobody says what that total is. (Cambridge
  // NRICH, "Magic Triangle": digits 1 to 9; the possible totals are 17, 19, 20,
  // 21 and 23, checked by tools/verify-math.mjs.)
  // Six stones are carved in (made easier 1 Oct 2026 `[Dylan]`; it was three).
  // The bottom side is already complete, so it shows the total, 20. Three
  // stones are left, and two arrangements remain: they differ only by swapping
  // the two stones in the middle of one side, so the sides balance either way.
  // The engine accepts both.
  {
    id: 'm4',
    blurb: 'No square. Place the stones so all three sides make the same total.',
    type: 'magic-triangle',
    skill: 'GENERALIZE',
    title: 'The Magic Triangle',
    inscription: 'Balance',
    nodes: range(0, 8),
    geometry: { kind: 'triangle' },
    stones: range(1, 9),
    givens: { 0: 1, 1: 5, 2: 9, 3: 6, 5: 4, 6: 2 },
    initial: {},
    constraints: [equalSum('sides', TRIANGLE_SIDES), allDifferent('distinct', range(0, 8))],
    show: 'sides', // the constraint whose groups get a total marker each
    interaction: { kind: 'place' },
    reward: 25,
    teach: 'No square. Three sides, and they must agree.',
    intro: 'There is no square this time. Place the stones so all three sides of the triangle make the same total. One side is already full, so you can read the total from it.',
  },

  // 5. THE HIDDEN RULE. Discover. Three finished rings follow one rule. A
  // fourth is half empty. The rule is never written down: stones directly
  // across the ring from each other make the same total (here 9, because the
  // ring holds 1 to 8). It is the law that makes the Lo Shu what it is, where
  // opposite cells through the centre make 10.
  {
    id: 'm5',
    blurb: 'Three rings follow one rule. Find it, then finish the fourth.',
    type: 'hidden-rule',
    skill: 'DISCOVER',
    title: 'The Hidden Rule',
    inscription: 'Discover the rule',
    nodes: range(0, 7),
    geometry: { kind: 'ring', n: 8 },
    stones: range(1, 8),
    givens: { 0: 4, 1: 1, 2: 6, 4: 5, 5: 8, 7: 7 },
    initial: {},
    constraints: [equalSum('opposites', RING_PAIRS), allDifferent('distinct', range(0, 7))],
    // Finished rings, clockwise from the top. Each must satisfy the
    // constraints above; the tests check that, and that no other simple rule
    // fits all three.
    examples: [
      [3, 7, 1, 5, 6, 2, 8, 4],
      [8, 2, 6, 4, 1, 7, 3, 5],
      [5, 3, 8, 2, 4, 6, 1, 7],
    ],
    interaction: { kind: 'place' },
    reward: 30,
    teach: 'Three rings follow one rule. Find it, then finish the fourth.',
    intro: 'Three finished rings follow one rule, and the rule is never written down. Study the rings and find it. Then use it to finish the fourth.',
  },
];

export const levelDef = (id) => LEVELS.find((d) => d.id === id);
