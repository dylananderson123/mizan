# Review log

Each pass: what was found, what was done. Newest last.

## Pass 1. Mathematics (tests)

- All 7,040 normal 4x4 squares found; exactly 880 up to symmetry, matching OEIS A006052. One 3x3 class, the Lo Shu. Constructions checked to n = 12.
- **Found:** every unique 3x3 puzzle cut from the Lo Shu tops out at band 3. With only eight 3x3 squares, a player who learns the Lo Shu stops reasoning. **Done:** Chapter II, Daily and Endless use Lucas's form on fresh numbers; the band ceiling is now a test, not a surprise.
- **Found:** a test expected 4, 8 to be "strained" with a 3 still in the tray. The test was wrong, the engine right. Fixed the test.

## Pass 2. First playtest (headless Chrome, 390 x 844)

- **Found:** dragging did nothing. Each redraw re-inserted the tray stones, and moving a DOM node drops its pointer capture mid-drag. **Done:** the tray is reordered only when its order changes.
- **Found:** on tutorial boards, unused cells looked like empty recesses, so a player would think six gaps needed filling. **Done:** unused cells are sealed flush with a small engraved star; real recesses got a darker shaded fill.
- **Found:** the frame pattern spilled outside the stone. **Done:** clipped to the stone.
- **Found:** the solved-line star was drawn as a crossing star, so its lines ran through the number. **Done:** a sixteen-point outline star, nothing through the middle.

## Pass 3. Second playtest (all screens, phone and desktop)

- **Found:** after a win, an empty tray faded to a large grey block. **Done:** an empty tray disappears; a tray with spare stones fades.
- **Found:** diagonal markers sat in the bottom corners in line with the column markers and read as columns. **Done:** a short cut runs from each grid corner to its diagonal marker.
- **Found:** at a 67.5 degree contact angle the lit pattern read as scattered spiky stars. Six angles were rendered side by side (`shots/variants.png`). **Done:** 45 degrees for Chapter I, which gives clean eight-point stars; other chapters 54, 60 and 50.
- **Found:** on a 1280 x 820 laptop screen, Undo and Hint fell below the fold. **Done:** the board is smaller on wide screens.
- **Checked and sound:** drag, tap-tap, keyboard (including two-digit numbers), three-tier hints followed to a full solve, restore by the hinted swap, save and resume after a reload, high contrast and larger text, Daily, Endless. No console errors on any screen.

## Pass 4. Independent code audit (fresh reviewer, read-only)

The reviewer fuzzed the solver and hints against the exhaustive solver: 86 puzzles, every solving trace, 1,493 random part-filled boards. **No wrong placement, elimination, contradiction or hint value.** Fifteen other defects, all fixed:

| # | Defect | Fix |
|---|---|---|
| 1 | Crossing into a new space during a drag reset the stone to its start | The drag offset is re-applied after every redraw |
| 2 | On deep 4x4 puzzles the hint could only ever say "the 2 cannot go here", forever | Hints run past elimination steps and always end in a placement |
| 3 | Back, then reopening the same level, threw away its progress | Reopening an unfinished level resumes it |
| 4 | A save with one bad field blanked the game on every visit | Every save field is checked by type; boot falls back to a clean save |
| 5 | A saved stone in a space that does not exist vanished for good | Such a save is rejected and the level restarts |
| 6 | Choosing a stone by keyboard was silent; Escape did nothing | Announced, `aria-pressed` set, Escape clears it |
| 7 | Move announcements missed the swapped stone's lines and read empty lines | Only lines through changed spaces, never empty ones |
| 8 | Line totals and swap count were not reachable by screen reader | Each space's label carries its lines' totals; swap count is real text |
| 9 | Focus fell to the page after some moves; arrows could not cross sealed cells | Focus returns to the space; arrows skip sealed cells |
| 10 | Timers from a finished puzzle could act on the next screen | Each puzzle owns and clears its timers |
| 11 | Erasing progress mid-puzzle wrote the puzzle back into the new save | The puzzle is dropped, not stored |
| 12 | A second finger left the first stone stuck mid-air | A second touch is ignored during a drag |
| 13 | A hint blamed one stone when the clash was between two | The hint names the pair |
| 14 | An impossible saved restore puzzle could hang the tab | Rejected on resume; the swap counter guards against it |
| 15 | Unknown solver cap ran uncapped; a broken streak still showed | The solver throws; a streak shows only if the last finish was today or yesterday |

`tests/regressions.test.js` holds one test per data-layer fix. The browser fixes were checked in headless Chrome.

Still open: starting the Daily or Endless while a Journey level is unfinished replaces that level's saved state. There is one "current puzzle" slot. Levels are short, so this was left.

## Known limits, not fixed

- Not yet touched by a finger. Haptics, audio and touch drag are untested on a real phone.
- The "only one space for this stone" hint now tells the player how to check it (try it in each space), but it still does not name the line that rules out each space.
- 4x4 Endless runs on the main thread. Measured at under 0.3 s per puzzle on this Mac at depth 5; a slow phone will be slower. A web worker would remove the risk.
