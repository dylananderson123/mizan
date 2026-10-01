# House of Zairajah (working title)

A calm puzzle game that begins with magic squares. Vertical slice, built 1 Oct 2026.

## Run it

It uses JavaScript modules, so it must be served, not opened as a file.

```bash
cd ~/code/magic-square-game && python3 -m http.server 8963
```

Then open http://127.0.0.1:8963 in Chrome.

## Test it

```bash
cd ~/code/magic-square-game && npm test
```

36 tests. One of them enumerates all 7,040 normal 4x4 magic squares, so the suite takes a few seconds.

## Rebuild the seeded levels

```bash
cd ~/code/magic-square-game && npm run levels
```

Writes `src/game/levels.data.js`. Only needed after changing `tools/build-levels.mjs` or the core.

## Where things are

- `docs/DESIGN.md`: research, mechanics, progression, architecture, art direction, MVP, plan
- `docs/REVIEW.md`: what the self-review and the code audit found, and what was fixed
- `src/core/`: the mathematics, no DOM
- `src/game/`: levels, play state, saves
- `src/ui/`: board, pattern, sound, screens
- `shots/`: headless playtest screenshots (not committed)

## Credits

Font: Readex Pro by Thomas Jockin and Nadine Chahine, SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
No code was copied from any reference repository.
