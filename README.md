# Mizan

A calm puzzle game about balance, which begins with magic squares. Built 1 Oct 2026. Five-level demo added 1 Oct 2026: calculate, detect, optimize, generalize, discover.

## Run it

It uses JavaScript modules, so it must be served, not opened as a file.

```bash
cd ~/code/mizan && python3 tools/serve.py 8963
```

Then open http://127.0.0.1:8963 in Chrome. For a phone on the same Wi-Fi, open `http://<this Mac's address>:8963` (`ipconfig getifaddr en0`). `tools/serve.py` is used instead of `http.server` because iPhone needs byte-range support to play the opening film.

## Test it

```bash
cd ~/code/mizan && npm test
```

88 tests. One enumerates all 7,040 normal 4x4 magic squares, another all 864 magic triangles, so the suite takes a few seconds.

Full playthrough in a real (muted) Chrome, by tap and drag, all five levels, coins, reload, reset, console errors. Needs the game served and Google Chrome:

```bash
cd ~/code/mizan && node tools/playthrough.mjs mobile
```

Also `small` (375x667) and `desktop` (1280x800). Screenshots go to `shots/five/`. Add `?dev` to the address for developer tools (reset progress, open all levels, +50 coins; also `window.mizanDev`).

Other checks, all real Chrome, none needing anything installed:

```bash
cd ~/code/mizan
node tools/verify-math.mjs      # all five levels, brute force, independent of the puzzle kit
node tools/breakit.mjs          # hostile player: reload mid-finish, spam, bad saves, two tabs, ten screen sizes, stone sets
node tools/breakit.mjs kbd      # one section; also layout | reload | spam | saves | tabs | keys | stones | kbd | stable
node tools/shots.mjs 667x375 1,5 done   # screenshots to shots/look/, to look at a layout
node tools/perf.mjs             # load, frame pacing and memory with the CPU slowed 4x
node tools/opening-check.mjs    # the real first launch, as a stranger sees it
```

## Rebuild the seeded levels

```bash
cd ~/code/mizan && npm run levels
```

Writes `src/game/levels.data.js`. Only needed after changing `tools/build-levels.mjs` or the core.

## Where things are

- `docs/DESIGN.md`: research, mechanics, progression, architecture, art direction, MVP, plan
- `docs/REVIEW.md`: what the self-review and the code audit found, and what was fixed
- `src/puzzles/`: the puzzle kit (`kit.js`: SUM, EQUAL_SUM, ALL_DIFFERENT, a solver), the five definitions (`definitions.js`), hints, layouts
- `src/core/`: the square engine, no DOM
- `src/game/`: levels, play state, saves, coins (`economy.js`), progress (`progress.js`); the old nine-level path is in `archive.js`
- `src/ui/`: board, pattern, sound, screens
- `shots/`: headless playtest screenshots (not committed)

## Credits

Font: Readex Pro by Thomas Jockin and Nadine Chahine, SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
No code was copied from any reference repository.

## Opening film

A 9 s film plays once on every launch. When it ends it holds on its last frame and four real start buttons (Continue if there is a save, Journey, Daily square, Endless) appear over it. The menu screen is only reached by a button, never automatically `[Dylan]` 1 Oct 2026. The film has no buttons drawn in it. The three soft taps that used to play as the drawn options arrived (F#5, A5, C#6) are played by the game (`sfx.menu` in `src/ui/sound.js`), restored 1 Oct 2026 `[Dylan]`. Each button rises in on its own tap, 0.25 s apart (a fourth note if Continue is showing), so sound and sight line up. They stay silent if the browser has not yet allowed sound (`opening()` in `src/ui/app.js`, styles under `/* opening */` in `css/style.css`).

- Files: `assets/film/opening.mp4` (1080x1920, H.264/AAC) and `assets/film/opening.webm` (720x1280, VP9/Opus, fallback). Source project, with the code that draws and scores it: `~/code/mizan-opening`.
- Skip button or Escape jumps to the buttons. Add `?noopening` to the URL to skip it (useful for screenshots and tests).
- It does not play when Reduce motion is on (setting or system). Its sound follows the Sound setting.
- If the browser blocks sound, a "Tap to begin" button starts it. If the file will not load within 8 s, the film is dropped and the menu shows.
- To change it: edit the source project, run `node tools/render.cjs`, then re-encode both files with ffmpeg (used on 1 Oct 2026: mp4 `-vf scale=1080:1920 -crf 25 -preset slow -movflags +faststart`, webm `-vf scale=720:1280 -c:v libvpx-vp9 -crf 34 -b:v 0 -c:a libopus -b:a 96k`).

## Fresh start and phone layout (1 Oct 2026, `[Dylan]`)

- Each device wipes its old progress once, the first time it loads this version (`FRESH_START` in `src/ui/app.js`, settings kept). Delete that block once both devices have loaded it. Settings, then Erase progress, still works any time.
- On phones the board size leaves room for the guide, tray and buttons, and the finished panel (Next, Journey) is compact and stays at the bottom of the screen, so it never needs a scroll. Checked at 360x600, 360x640, 393x740, 412x800. Not tested on a real phone.
