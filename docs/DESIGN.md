# Design

Name: **Mizan**, set by Dylan on 1 Oct 2026 `[Dylan]`. On screen it is one constant, `TITLE` in `src/ui/app.js`.

Written 1 Oct 2026 from the master build brief. Sections follow the order the brief asked for.

---

## 1. Research findings

What was read, and what it changed.

| Source | What was taken | What it changed here |
|---|---|---|
| Wolfram MathWorld, Magic Square | M(n) = n(n²+1)/2; normal, semimagic, associative, panmagic definitions; Siamese, doubly even and LUX/Strachey constructions | `src/core/magic.js` implements all three constructions and checks every one to n = 12 in tests |
| MathWorld, Panmagic / Antimagic / Bimagic / Prime | Wrap-around diagonals; distinct-total boards; squares that stay magic when squared; prime entries | Line ids `p<k>` and `q<k>` already exist for broken diagonals (`shape.js`). Rules sit behind a `RULES` object so antimagic and product rules plug in without touching the solver's callers |
| OEIS A006052 | 1, 0, 1, 880, 275,305,224 squares up to symmetry for n = 1..5 | A test enumerates every 4x4 square (7,040) and checks they fall into exactly 880 classes. A test proves the 3x3 has one class (the Lo Shu) |
| NRICH, Magic Squares and Introduction | Opposite cells through the centre pair to the same total; the centre is a third of the line total; the target can be derived from the numbers used | These became Chapter I's lessons (levels 3, 4, 6, 9, 10) and Chapter II's theme |
| NRICH, Magic Matrix | A grid where picking one number per row and column always gives the same total | Logged as a Chapter VII family. Not built |
| eoinlarkin/magic-square-game | Siamese generation, random removal, a "submit" button, error alerts | **No licence on the repo, so no code was reused.** Its loop (fill, press submit, get told right or wrong) is the thing this game avoids: here every line reports itself live, and nothing is ever "submitted" |
| charleskorn/magic-squares (MIT) | Odd and singly even generators, generator-plus-test layout | Architecture idea only. No code copied, so no notice is needed |

**The most important finding came from our own solver, not a source.** There is only one 3x3 normal magic square, in eight orientations. A player who has done Chapter I knows it by heart, and every later 1-to-9 puzzle collapses into recall. Two fixes are built in:

1. **Lucas's form.** Every 3x3 magic square, on any numbers, is
   `c-b, c+a+b, c-a / c-a+b, c, c+a-b / c+a, c-a-b, c+b` with total 3c.
   Chapter II, the Daily Square and Endless use fresh numbers every time, so the player must reason, not remember. The lesson the chapter teaches, "the target is three times the centre", falls straight out of the form.
2. **Measured ceiling.** `tests/engine.test.js` rates every unique 3x3 puzzle cut from the Lo Shu (all 512 subsets of givens). The hardest needs "one candidate left". No 3x3 needs crossing-line reasoning or trial. Depth beyond that lives in 4x4 and in other rules, which is why Chapter IV exists in the slice.

---

## 2. Mathematical mechanic taxonomy

Families, each a candidate chapter or mode. **Built** means in this slice.

| Family | The rule | Mechanic it gives | Status |
|---|---|---|---|
| Normal magic | 1..n² once; rows, columns, diagonals equal | Fill the gaps | **Built** (3x3, 4x4) |
| Any-number magic (Lucas, 3x3) | Distinct numbers, all lines equal | Same, without memorisation | **Built** |
| Spare stones | Extra tiles that fit no line | Decide what belongs | **Built** (Chapter II) |
| Restore | A correct square, some tiles swapped | Fewest swaps back to order | **Built** (Chapters III, IV) |
| Semimagic | Rows and columns only | Many more solutions; teaches what diagonals add | Engine ready (`diagonals: false`) |
| Associative | Pairs through the centre all total n²+1 | Mirror reasoning | Checker built |
| Panmagic | Every wrapped diagonal also totals M | Lines leave one edge and return at the other | Line ids and checker built |
| Antimagic | Every line total different, and consecutive | Inverts the whole habit | Needs a board-level rule |
| Product magic | Lines multiply to the same product | New arithmetic, same board | Needs a `product` rule |
| Prime magic | Entries all prime | A constrained pool | Pool only, rules unchanged |
| Bimagic, trimagic | Still magic when squared or cubed | A second layer of totals | Needs n ≥ 8: not a mobile puzzle |
| Latin and Euler squares | Each symbol once per row and column | Sudoku's ancestor; a gentle variant | Not started |
| Bordered squares | A magic square inside a magic frame | Strip the border, a smaller square remains | Not started |
| Franklin squares | Bent diagonals | Unusual line shapes | Shape layer supports any line |
| Talisman squares | Neighbouring cells differ by at least k | A local rule, not a line rule | Needs a pair rule |
| Magic hexagon (order 3) | 19 cells, 15 lines of 38; unique | Chapter VII centrepiece | Shape layer supports it; not drawn |
| Magic circles, networks | Numbers on intersecting rings or graphs | Same engine, new geometry | Not started |
| Magic matrices (NRICH) | One per row and column always gives the same total | A selection puzzle, not placement | Not started |

---

## 3. Gameplay loop

1. A carved stone board, some stones already set, some in a timber tray.
2. Pick a stone up (drag, or tap then tap). It lifts and clicks.
3. Put it in a recess. It settles. Every line through it reports at its end:
   - a dot: nothing yet
   - an arc: the running total, as a share of the target
   - a broken ring: this line can no longer work
   - a closed eight-point star: exact
4. When a line becomes exact, the pattern in the frame at that line's end inks itself in.
5. When every line is exact, the connectors that belong to no line appear, the whole pattern turns from brass to indigo, the light shifts, dust lifts, a low chord plays. Done.

No submit button. No "Wrong!". A wrong stone is just a broken ring at the end of a line, and moving it is free.

Hints teach in three presses: where to look, what relationship holds, what follows. They come from the solver's next deduction on the exact board in front of the player.

---

## 4. Progression

| Chapter | Built | Teaches |
|---|---|---|
| I The First Square | 10 handcrafted | One line makes 15; columns; one stone serves two lines; where lines cross both must agree; diagonals; opposites pair up; more than one answer can be right; the full square; the centre; a finale that needs the centre deduction |
| II The Missing Tile | 6 seeded | New numbers, the target changes; three times the centre; locked stones; one candidate left; spare stones that belong nowhere |
| III The Broken Square | 5 seeded | Swaps only; fewest swaps shown as diamonds; locked stones; one to three wrongs |
| IV Thirty Four | 4 seeded | The board expands to 4x4, target 34; a broken sixteen |
| V Other Rules | sealed | Semimagic, associative, prime, product, antimagic |
| VI Beyond the Edge | sealed | Panmagic: lines that wrap |
| VII New Forms | sealed | Hexagon, circles, matrices, networks |

Each chapter has its own emblem on the Journey screen: the same 4.8.8 tiling at a different Hankin angle. One piece of the emblem inks in per level finished. The finished emblems are the "library of patterns" the brief asks for.

Modes: **Journey** (above). **Daily Square** opens after Chapter I: one moderate 3x3 on fresh numbers, the same for everyone on a given local date, with time, missteps, hints and a streak. **Endless**: 3x3, broken 3x3, or 4x4 (after Chapter IV), at a chosen depth. **Zen** is the default: there is no timer on screen unless switched on in settings.

---

## 5. Technical architecture

Plain HTML, CSS and JavaScript modules. No framework, no build step, no network after load, no dependencies. Fonts are local.

```
src/core/       mathematics, no DOM, fully tested
  shape.js        Constraint geometry: cells and lines (rows, columns, diagonals, wrapped diagonals)
  constraints.js  Constraint engine: line status, board status, the RULES seam
  magic.js        Constants, constructions, symmetries, checks
  generator.js    Generator: random squares (Lo Shu forms, 4x4 search, Lucas form, constructions)
  carver.js       Puzzle carver: remove givens or break by swaps, keeping intended solvability
  solver.js       Exhaustive solver (uniqueness, enumeration) and logical solver (recorded steps)
  difficulty.js   Difficulty evaluator: band from the hardest technique the logical solver needed
  hints.js        Three-tier hints from the logical solver's next step
  puzzle.js       Puzzle model, schema version, serialise and hydrate
  rng.js          Seeded random, so the same seed gives the same puzzle everywhere
src/game/       progression and state, no DOM, tested
  chapter1.js     Handcrafted tutorial
  levels.data.js  GENERATED by tools/build-levels.mjs from fixed seeds
  levels.js       Progression layer: chapters, unlocking
  session.js      One puzzle in play: moves, swaps, undo, save
  storage.js      Versioned save in localStorage, survives garbage
  daily.js        Daily Square and Endless generation, streaks
src/ui/         presentation and theme
  board.js        Board, tiles, tray, drag, tap, keyboard, markers, completion
  pattern.js      Hankin's method on the 4.8.8 tiling; frame split per line
  sound.js        Web Audio synthesis, no sample files
  app.js          Screens, settings, the play loop
css/style.css   Theme layer: every colour is a variable; high contrast is a second block of variables
```

**The logical solver's techniques**, cheapest first. Each is a thing a person can do.

| Technique | What the person does | Band it sets |
|---|---|---|
| line | A line has one space left: it takes the target minus the total | 1 or 2 |
| single | A space where only one stone keeps every line through it reachable | 3 |
| place | A stone that fits in only one space | 3 |
| crossing | Each line alone allows a stone, but the lines together do not | 4 |
| trial | Suppose a stone, follow the simpler steps, reach a broken line | 5 |

Anything else (a guess, or more than one answer) gets no band and is never shipped as a rated puzzle.

**Correctness gates.** Nothing reaches the player without passing all of these: hydrate (schema and duplicate check), the exhaustive solver (exactly one answer where required), the logical solver (no guessing), the difficulty evaluator (band as intended), and for restore puzzles the swap distance (exactly k). `tools/build-levels.mjs` runs them when it writes levels; `tests/game.test.js` runs them again on the written file.

---

## 6. Art direction

**Idea.** A worked stone tablet found somewhere between Dhofar and Stone Town. Mathematical order makes visual order: the pattern in the frame is unfinished until the lines are right.

**Palette.** Limestone `#e6dcc8`, bone `#ece3d1`, chalk `#f4efe4`, sand recesses, weathered umber `#5b4733`, dark timber `#3a291d` for the tray (Zanzibar door wood), oxidised brass `#8c6b2f` for a solved line, faded indigo `#34406b` for the whole square. Terracotta `#8f452b` only for a broken line, and never alone: the broken ring shape carries the meaning.

**Materials.** The board is limestone with a faint plaster grain (an SVG noise filter, no image files). Movable stones are glazed ivory ceramic and sit proud with a soft shadow. Fixed stones are carved into the board: darker, flush, inset shadow, umber numerals. Cells that are not part of a tutorial board are sealed flush, with a small engraved star, so no one mistakes them for a gap.

**Geometry.** The frame uses Hankin's polygons-in-contact method (1925) on the 4.8.8 tiling: octagons and squares, rays from each edge midpoint at a contact angle, stopped where they meet. Each chapter uses its own angle (45°, 54°, 60°, 50°), so each has its own pattern from the same construction. The frame is split so each line owns the frame at its own end: rows the side bands, columns the top and bottom, diagonals the corners. The small connectors between those parts belong to no line and appear only when the square is whole.

**What is not here.** No crescents, no domes, no lanterns, no gold leaf, no Arabian Nights type. The culture is in material, proportion and pattern construction, not in pictures of it.

**Type.** Readex Pro (Thomas Jockin and Nadine Chahine, SIL Open Font License, licence file in `assets/fonts/`). It was drawn as a Latin and Arabic family together, so a genuine Arabic localisation can use the same family later. Light weights for headings, medium for numerals, tabular figures everywhere a total can change.

**Sound.** All synthesised in Web Audio. A stone tick on pick-up, a low thock on placing, a soft brass note on each locked line (notes drawn from a hijaz-coloured set on D), a click and a low D chord on completion, an optional quiet wind. Silence is allowed: sound and wind each have a switch.

---

## 7. MVP specification (the vertical slice)

| Brief item | State |
|---|---|
| Main menu | Built: title, Continue, Journey, Daily Square, Endless, settings |
| Tutorial, 5 to 10 tiny puzzles | Built: Chapter I, 10 levels, one short line of text at most per new idea |
| 3x3 puzzle mode, several difficulties | Built: Endless 3x3 at three depths, broken 3x3 at one to three swaps |
| Generator, validated | Built and tested |
| Solver, verifies puzzles and solutions | Built and tested, two solvers |
| Reasoning-aware hints | Built: three tiers from the logical solver |
| Completion sequence | Built: lines ink in, connectors appear, colour turns, light shifts, dust, chord |
| A chapter to complete | Built: four chapters, 25 levels |
| Accessibility | Reduced motion, high contrast, text size, sound and wind switches, vibration switch, controls on either side, keyboard play, screen-reader announcements of every line total |
| Save and resume | Built: versioned, tolerant of corrupt data |

---

## 8. Implementation plan, and what comes next

Done in this pass, in this order: the maths engine and its tests; the generator, carver and solver; the difficulty space mapped; the levels built from seeds and checked; the session and save layers; the board, pattern and sound; a headless playtest of every screen at phone and desktop sizes; a critique pass; fixes.

Next, in order of value:

1. **Play it on a real phone.** Touch, haptics and audio cannot be judged in a headless browser.
2. **Chapter V:** semimagic first (one rule removed is the gentlest new law), then associative, then product.
3. **Chapter VI, panmagic 4x4:** draw wrapped lines leaving one edge and returning through the opposite one.
4. **The order-3 magic hexagon** as the Chapter VII centrepiece. It is unique, which makes it a perfect single milestone.
5. **A web worker for 4x4 generation**, so the deepest Endless puzzles never block a frame.
6. **Arabic localisation** with real RTL and Readex Pro's Arabic glyphs.
