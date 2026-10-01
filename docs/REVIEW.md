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

## Known limits, not fixed

- Not yet touched by a finger. Haptics, audio and touch drag are untested on a real phone.
- The hidden-single hint ("the 6 fits in only one space") is true but hard for a person to check. A better explanation would name the lines that rule out each other space.
- 4x4 Endless runs on the main thread. Measured at under 0.3 s per puzzle on this Mac at depth 5; a slow phone will be slower. A web worker would remove the risk.
