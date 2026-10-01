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


## Pass 5. Five-level demo and coins (1 Oct 2026)

Checked by 82 unit tests and `tools/playthrough.mjs` (real Chrome, tap and drag) at 390x844, 375x667 and 1280x800. Faults found by the playthrough and fixed:

| # | Fault | Fix |
|---|---|---|
| 1 | The coin counter never updated: clearing the screen's old counters also dropped the new one | The clean-up runs after the new screen is in the page |
| 2 | After a refused second swap (Level 3) the tapped stone stayed chosen, and a later tap swapped it in unasked | A spent swap drops any stone in hand; undo clears the choice |
| 3 | The Level 5 finished panel covered the bottom of the ring on phones | Smaller board, shorter panel, lines hidden on short phones, panel sticky on tall boards |
| 4 | The Level 2 tray reserved two rows for three stones | The tray is sized for the stones it started with |
| 5 | My test browser played the game's sound out loud on the owner's Mac | Launched with `--mute-audio` |

Known limits: not tried on a real phone (touch, haptics, audio). The font preload warning in the console is old and not an error. Daily and Endless pay no coins. The first scene film after a level still plays (about 7 s); skippable.


## Pass 6. Skill-driven test and polish pass (1 Oct 2026)

Skills read first: the competition's Build Through Play starter (game-jam, game-feel, game-ui-ux, level-design) and, from awesome-gamedev-agent-skills, puzzle, save-systems and performance-optimization. The engine skills (Phaser, PixiJS, Three.js) were not used: Mizan is plain HTML, CSS and JavaScript modules, so nothing was migrated. Playwright MCP was not available in this environment; the repo's own Chrome driver (`tools/cdp.mjs`) played the game instead, by real taps, drags and key presses.

Tools added: `tools/verify-math.mjs` (an independent brute-force check of all five levels that shares no code with the puzzle kit), `tools/breakit.mjs` (hostile player: reload at every moment of a finish, spam, hostile saves, two tabs, keyboard only, ten screen sizes, stone sets), `tools/shots.mjs`, `tools/perf.mjs`, `tools/opening-check.mjs`.

Mathematics, checked by brute force and not by the kit: Level 1 has exactly one solution. Level 2's wrong stone is the 14, where three 31-lines cross; swapping in the 10 makes every line 27. Level 3: exactly one swap (cells 1 and 6) repairs the square, and only one of the eight forms of the Lo Shu is one swap away. Level 4: two solutions, both total 20, differing by the middle pair on one side; with no givens the possible totals are 17, 19, 20, 21 and 23 (an old comment said "17 to 23"; corrected). Level 5: one completion; eleven rival rules a player might guess do not fit all three examples.

| # | Fault | Cause | Fix |
|---|---|---|---|
| 1 | Reloading in the first 0.4 s after the last stone lost the puzzle and paid nothing | Progress and coins were settled only when the finish flourish ended; `storeCurrent` had already cleared the saved puzzle | `settle()` runs the moment the puzzle is solved, once; the flourish only draws. Tested at 0, 30, 120, 400 and 1200 ms |
| 2 | Two tabs: the older tab overwrote the newer tab's progress on its next save | Each tab held its own copy and wrote all of it | A `storage` listener makes the older tab take the other's record; the Journey redraws |
| 3 | A save with 1e300 coins showed "1e+300" | `Number.isInteger` accepts numbers JavaScript cannot add to | Safe integers only |
| 4 | Phone held sideways: no board, the guide squeezed to a sliver | The board was sized as 100svh minus 392 px, which is negative at 375 px tall | A two-column wide layout (guide, stones and buttons left, board right) from aspect ratio 1.1 up. It also fixes a 256 px board on a 1280x720 laptop, now 624 px |
| 5 | 320 px wide and short phones: the goal wrapped one word to a line | The guide was as wide as the shrunken board | The guide keeps its own width; star and sheikh shrink |
| 6 | Five stones wrapped four and one on a phone | Stones were sized to the board, the tray is narrower | Sized to the tray's own room |
| 7 | The back arrow vanished on dark scenes (Level 5's arch) | Transparent button on a dark backdrop | A pale disc behind the bar buttons |
| 8 | The wind played on in a hidden tab | The audio context was never suspended | Suspended while hidden, resumed on return |
| 9 | Brass text was 4.1:1 on paper | One brass for lines and text | `--brass-text` at 5.4:1 for small text |
| 10 | The Level 5 finish line read "4 + 5 · 1 + 8 ..." | The total was left out | "4 + 5 = 9 · 1 + 8 = 9 ..." |
| 11 | A "Level 6, sealed" card promised a level that does not exist | Placeholder from the old plan | Not shown; a closing card appears when the five are done |
| 12 | The board (and, on wide screens, the stones) jumped about 36 px whenever the guide changed its words | The guide box had a minimum height shorter than its own text | Minimum height set from measurement (150 px on phones, 156 on wide screens, 136 on a short landscape phone): the longest hint is 149 px. Tested on five screen sizes, three levels |
| 13 | A console warning on every first launch: two fonts preloaded but not used soon enough | Preload hints for weights the film hid | Removed; fonts load on use |
| 14 | A stranger is not told how to move a stone | Level 1 said only the goal | "Drag a stone into a space, or tap a stone and then a space", then, after the first stone, what the marks mean |

Added: a first-move line on Level 1 (drag or tap) and a one-time explanation of the marks after the first stone; a one-pixel shiver on a line that comes out wrong; hover feedback for a mouse; and the one use of coins (below).

Coins now buy one thing, stone sets: Ivory (free), Lapis 30, Basalt 60. They change how the movable stones look and nothing else (numerals are at least 7:1). The two paid sets cost 90 and the five levels pay 100, so one full play buys both. Prices are Claude's, not agreed with Dylan. Spending cannot go below zero and a set cannot be bought twice; both are tested.

Measured, with the CPU slowed 4x (`tools/perf.mjs`): DOMContentLoaded 75 ms, load 287 ms; 38 requests, all local, 1.98 MB of which the opening film is 1.96 MB (the 0.4 MB webm is only the fallback); 60 fps on the menu, the Journey, both scene backdrops and the finish burst (one 67 ms frame in the burst); JS heap 4 MB; 264 DOM elements on a play screen. Nothing was optimised, because nothing needed it. Not done on purpose: no bundler (35 small modules are fine on one host over HTTP/2), no switch to the webm film (it is lower quality and the film was approved as it is).

Keyboard: all five levels were solved with keys alone (focus a space, type the number; Enter to lift and drop on the swap level). Focus rings show on every control.

Contrast, computed: ink 12.3:1, soft ink 6.4:1, terracotta 5.7:1, locked numerals 5.0:1, new brass text 5.4:1, both new stone sets 6.9:1 and 7.4:1. Line state is never colour alone (arc, broken ring, star).

Known limits after this pass: not tried on a real phone (touch, haptics, audio); the stones on Levels 4 and 5 are 35 to 36 px on a 360 px phone (above the 24 px WCAG 2.2 floor, under the 44 px advice); on a 768 px tablet held upright the Level 5 finish panel covers the lower stones; `?dev` still opens developer tools to anyone who adds it to the address; a player can edit their own save in the browser (it is a single-player offline game, so this was not defended against beyond rejecting damaged values).
