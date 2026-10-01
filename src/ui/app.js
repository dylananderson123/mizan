// App shell: screens, settings, saving, the play loop.

import { h, s, clear } from './dom.js';
import { BoardView } from './board.js';
import { emblem, field, starOutline } from './pattern.js';
import { unlockAudio, configureSound, setAudioHidden, sfx, sceneAmbience, TAP_GAP } from './sound.js';
import { sheikhSvg } from './sheikh.js';
import { celebrate, sealStar } from './reward.js';
import { NodeBoardView } from './nodeboard.js';
import { coinChip, coinGlyph, setCoins, settleCoins, payReward, rewardBadge, claimedNote } from './coins.js';
import { Session, TRAY } from '../game/session.js';
import { NodeSession } from '../game/nodesession.js';
import { CHAPTERS, findLevel, nextLevel, chapterOpen, levelOpen, chapterById, DAILY_AFTER, FOUR_AT } from '../game/levels.js';
import { loadSave, writeSave, freshSave, SAVE_KEY } from '../game/storage.js';
import { recordCompletion } from '../game/progress.js';
import { award, balance, STONE_SETS, stoneSet, ownsStones, buyStones, useStones } from '../game/economy.js';
import { dailyPuzzle, recordDaily, localDateKey, endlessPuzzle, ENDLESS_KINDS, streakAlive } from '../game/daily.js';
import { planHint, cellName } from '../core/hints.js';
import { planNodeHint, diagnoseSquare } from '../puzzles/hints.js';
import { restoreDistance, startValues, restoreTargets } from '../core/carver.js';

// The name on screen. One constant, so it is a one-line change.
export const TITLE = 'Mizan';

// What he says when a square is finished. Chosen by the puzzle, not at
// random, so the same puzzle always gets the same words.
const PRAISE = ['Well done.', 'Good. Every line agrees.', 'Clean.', 'The square is whole.'];

// A puzzle is played on the node board (triangle, ring) when its definition has a type.
const isNode = (spec) => typeof spec.type === 'string';

// The goal sentence, fitted to the puzzle. The star beside it holds the
// number to reach, or a sign where there is no number: "=" for a triangle
// whose sides need only agree, "?" for a rule still to be found.
function goalLead(p) {
  if (p.type === 'magic-triangle') return 'Make every side the same';
  if (p.type === 'hidden-rule') return 'Discover the rule';
  if (p.kind === 'restore') return 'Swap stones so every line makes';
  const n = p.shape.lines.length;
  if (n === 1) return 'This line must make';
  if (n === 2) return 'Both lines must make';
  return 'Every line must make';
}
const goalMark = (p) => (p.type === 'magic-triangle' ? '=' : p.type === 'hidden-rule' ? '?' : String(p.target));

// The word on the finished panel, by what the level asked of the player.
const DONE_WORD = { CALCULATE: 'Whole.', DETECT: 'Repaired.', OPTIMIZE: 'Restored.', GENERALIZE: 'Balanced.', DISCOVER: 'Discovered.' };

// What he says, and what the panel shows, once the engine has accepted the
// board. All worked out from the finished board, never stored.
function finishText(session, ctx) {
  const p = session.p;
  const v = session.values();
  if (p.type === 'magic-triangle') {
    const side = p.shape.lines[0].cells.reduce((a, c) => a + v[c], 0);
    return { praise: `Three sides. One total: ${side}.`, lines: [`Every side makes ${side}.`, 'Balance does not need a square.'] };
  }
  if (p.type === 'hidden-rule') {
    const pairs = p.constraints.find((c) => c.id === 'opposites').groups;
    const total = v[pairs[0][0]] + v[pairs[0][1]];
    return {
      praise: `Across the ring, every pair makes ${total}.`,
      lines: [pairs.map(([a, b]) => `${v[a]} + ${v[b]} = ${total}`).join('  ·  ')],
    };
  }
  if (ctx.skill === 'DETECT') return { praise: 'You read the totals and found it.', lines: [] };
  if (ctx.skill === 'OPTIMIZE') return { praise: 'The square is whole again.', lines: [] };
  const seed = [...(ctx.levelId ?? ctx.date ?? ctx.seed ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { praise: PRAISE[seed % PRAISE.length], lines: [] };
}

const storage = (() => {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
})();
let save = loadSave(storage);

// One-off fresh start, asked for by Dylan on 1 Oct 2026: each device wipes its
// old progress (keeping its settings) the first time it loads this version,
// then never again. Safe to delete this block once every device has loaded it.
const FRESH_START = 'fresh-2026-10-01';
try {
  if (storage.getItem('mizan.fresh') !== FRESH_START) {
    const keep = save.settings;
    save = freshSave();
    save.settings = keep;
    writeSave(storage, save);
    storage.setItem('mizan.fresh', FRESH_START);
  }
} catch { /* storage blocked: nothing saved anyway */ }
const root = document.getElementById('app');
const live = document.getElementById('sr');
let current = null; // { session, board, ctx, timer }

const persist = () => writeSave(storage, save);

// Another tab saved. Take its record so this tab never writes an older copy
// over it (a level finished there would be lost here). Only the record
// changes; a puzzle on screen keeps playing, and the Journey redraws.
window.addEventListener('storage', (e) => {
  if (e.key !== SAVE_KEY || e.storageArea !== storage || !e.newValue) return;
  const next = loadSave(storage);
  Object.assign(save, { completed: next.completed, unlocked: next.unlocked, best: next.best, wallet: next.wallet, owned: next.owned, stones: next.stones, daily: next.daily });
  document.documentElement.dataset.stones = save.stones;
  settleCoins(balance(save));
  if (!current && root.querySelector('.chapters')) journey();
});
const announce = (text) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };

function unlock() {
  unlockAudio();
}
document.addEventListener('pointerdown', unlock, { once: true });
document.addEventListener('keydown', unlock, { once: true });

function applySettings() {
  const st = save.settings;
  const html = document.documentElement;
  html.classList.toggle('hc', st.highContrast);
  html.classList.toggle('rm', st.reducedMotion);
  html.classList.toggle('lh', st.leftHanded);
  html.style.setProperty('--text-scale', st.textScale);
  html.dataset.stones = save.stones;
  configureSound({ sound: st.sound, ambience: st.ambience });
}

// ------------------------------------------------------------------ icons

const icon = {
  back: () => s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M15 5l-7 7 7 7' })),
  gear: () => s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    s('path', { d: 'M12 3l2.2 1.6 2.7-.4.9 2.6 2.4 1.3-.6 2.7 1.4 2.4-2 1.8v2.7l-2.6.7-1.3 2.4-2.7-.6L12 21l-2.2-1.6-2.7.4-.9-2.6-2.4-1.3.6-2.7L3 10.8l2-1.8V6.3l2.6-.7L8.9 3.2l2.7.6z' }),
    s('circle', { cx: 12, cy: 12, r: 3.2 })),
  undo: () => s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M9 7L4.5 11.5 9 16' }), s('path', { d: 'M5 11.5h9a5 5 0 010 10h-3' })),
  hint: () => s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M12 2.5l2.4 5.8 5.8 2.4-5.8 2.4L12 19l-2.4-5.9-5.8-2.4 5.8-2.4z' })),
};

function screen(cls, ...children) {
  if (current) stopPlay();
  document.body.classList.remove('sunlit');
  clear(root);
  const el = h('div', { class: `screen ${cls}` }, ...children);
  root.append(el);
  // A reward still in flight lands at once. After the append, so the new
  // screen's counter is in the page and takes the true balance too.
  settleCoins(balance(save));
  return el;
}

function bar(title, onBack) {
  return h('header', { class: 'bar' },
    h('button', { class: 'icon', 'aria-label': 'Back', onclick: onBack }, icon.back()),
    h('h2', { class: 'bar-title' }, title),
    h('div', { class: 'bar-right' }, coinChip(balance(save)),
      h('button', { class: 'icon', 'aria-label': 'Settings', onclick: openSettings }, icon.gear())));
}

// ------------------------------------------------------------------- menu

// The four start buttons. The menu screen and the opening film's last frame
// both use them; `wrap` lets the opening close itself before the click runs.
function menuButtons(wrap = (fn) => fn) {
  const resume = save.current && !save.current.solved ? save.current : null;
  const dailyOpen = chapterById(DAILY_AFTER).puzzles.every((p) => save.completed[p.id]);
  const today = localDateKey();
  const dailyDone = Boolean(save.daily.records[today]);
  return [
    resume ? h('button', { class: 'btn primary', onclick: wrap(() => resumeCurrent()) }, 'Continue') : null,
    h('button', { class: `btn${resume ? '' : ' primary'}`, onclick: wrap(journey) }, 'Journey'),
    h('button', { class: 'btn', disabled: !dailyOpen, onclick: wrap(playDaily) },
      'Daily square',
      h('span', { class: 'btn-note' }, !dailyOpen ? `Opens after Level ${chapterById(DAILY_AFTER).num}` : dailyDone ? `Done today · ${save.daily.streak} in a row` : streakAlive(save.daily, today) ? `${save.daily.streak} in a row` : '')),
    h('button', { class: 'btn', onclick: wrap(endless) }, 'Endless'),
  ];
}

function menu() {
  screen('menu',
    h('div', { class: 'menu-field', 'aria-hidden': 'true' },
      s('svg', { viewBox: '0 0 120 120', preserveAspectRatio: 'xMidYMid slice' }, s('path', { d: field(45, 12, 12, 10) }))),
    h('div', { class: 'menu-body' },
      h('h1', { class: 'title' }, TITLE),
      h('p', { class: 'sub' }, 'Every line, the same total.'),
      h('nav', { class: 'menu-nav' }, ...menuButtons()),
    ),
    h('div', { class: 'corner' }, coinChip(balance(save)),
      h('button', { class: 'icon', 'aria-label': 'Settings', onclick: openSettings }, icon.gear())));
}

// ---------------------------------------------------------------- journey

const SKILL_WORD = { CALCULATE: 'Calculate', DETECT: 'Detect', OPTIMIZE: 'Optimize', GENERALIZE: 'Generalize', DISCOVER: 'Discover' };

// "2:14 · 5 moves · no hints": what the best finish looked like.
function bestLine(b) {
  if (!b) return '';
  return `${fmtTime(b.time * 1)} · ${b.moves} move${b.moves === 1 ? '' : 's'} · ${b.hints ? `${b.hints} hint${b.hints === 1 ? '' : 's'}` : 'no hints'}`;
}

function journey() {
  const list = h('div', { class: 'chapters' });
  // Sealed levels stay in the data but are not shown: a card for a level that
  // does not exist reads as unfinished.
  for (const ch of CHAPTERS.filter((c) => !c.sealed)) {
    const open = chapterOpen(ch, save.completed, save.unlocked);
    const doneCount = ch.puzzles.filter((p) => save.completed[p.id]).length;
    const complete = ch.puzzles.length && doneCount === ch.puzzles.length;
    const pieces = ch.sealed ? emblem(60, 1, 3) : emblem(ch.theta, ch.puzzles.length, 3);
    const art = s('svg', { class: 'emblem', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('rect', { class: 'emblem-bg', x: 1, y: 1, width: 98, height: 98, rx: 3 }),
      ...pieces.map((d, i) => s('path', { d, class: i < doneCount ? 'lit' : '' })));
    // A level with one puzzle gets one button that says what it will do.
    const single = ch.puzzles.length === 1 ? ch.puzzles[0] : null;
    const dots = single
      ? h('button', { class: `btn go${complete ? '' : ' primary'}`, onclick: () => playLevel(single.id) }, complete ? 'Play again' : save.current?.levelId === single.id ? 'Continue' : 'Begin')
      : h('div', { class: 'levels' },
        ...ch.puzzles.map((p, i) => {
          const done = Boolean(save.completed[p.id]);
          const can = levelOpen(p.id, save.completed, save.unlocked);
          return h('button', {
            class: `lvl${done ? ' done' : ''}${can && !done ? ' next' : ''}`,
            disabled: !can, 'aria-label': `Puzzle ${i + 1}${done ? ', complete' : can ? '' : ', locked'}`,
            onclick: () => playLevel(p.id),
          }, h('span', {}, String(i + 1)));
        }));
    const claimed = single && save.wallet.claimed[`level:${single.id}`] !== undefined;
    const meta = single && ch.reward
      ? h('p', { class: 'ch-meta' }, claimed ? h('span', { class: 'ch-done' }, 'Reward collected') : h('span', { class: 'ch-reward' }, coinGlyph(), `+${ch.reward}`),
        single && save.best[single.id] ? h('span', { class: 'ch-best' }, bestLine(save.best[single.id])) : null)
      : null;
    list.append(h('section', { class: `chapter${open ? ' open' : ''}${ch.sealed ? ' sealed' : ''}${complete ? ' complete' : ''}` },
      art,
      h('div', { class: 'ch-text' },
        h('p', { class: 'numeral' }, `Level ${ch.num}${ch.skill ? ` · ${SKILL_WORD[ch.skill]}` : ''}`),
        h('h3', {}, ch.title),
        ch.def?.blurb ? h('p', { class: 'ch-blurb' }, ch.def.blurb) : null,
        ch.sealed ? h('p', { class: 'sealed-note' }, 'Sealed. More forms of balance will open here.') : open ? [meta, dots] : h('p', { class: 'sealed-note' }, 'Opens when the level before is complete'))));
  }
  // When all five are done, one quiet closing card says what they were.
  if (CHAPTERS.filter((c) => !c.sealed).every((c) => c.puzzles.every((p) => save.completed[p.id]))) {
    list.append(h('section', { class: 'journey-end' },
      h('p', { class: 'numeral' }, 'The Journey so far'),
      h('h3', {}, 'Five ways to see balance'),
      h('p', { class: 'ch-blurb' }, 'A total. A fault. A swap. A side. A rule.')));
  }
  screen('journey', bar('Journey', menu), stonesRow(), list);
}

// ----------------------------------------------------------------- stones

// The one thing coins buy. A slim row at the top of the Journey says what is
// in use and what the next set costs; it opens the stones dialog.
function stonesRow() {
  const next = STONE_SETS.find((x) => !ownsStones(save, x.id));
  const now = stoneSet(save.stones);
  const note = !next ? `${now.name} in use` : balance(save) >= next.cost ? `${next.name} stones: ready to buy` : `${next.name} stones for ${next.cost} coins`;
  return h('button', { class: 'stones-row', onclick: openStones, 'aria-label': `Stones. ${note}.` },
    h('span', { class: 'swatch', 'data-set': save.stones, 'aria-hidden': 'true' }, '7'),
    h('span', { class: 'stones-text' }, h('b', {}, 'Stones'), h('small', {}, note)),
    coinGlyph('small'));
}

function openStones() {
  const list = h('div', { class: 'stone-list' });
  const note = h('p', { class: 'stone-note', 'aria-live': 'polite' }, 'Stones change how the game looks. They do not make it easier.');
  const draw = () => {
    clear(list);
    for (const set of STONE_SETS) {
      const owned = ownsStones(save, set.id);
      const inUse = save.stones === set.id;
      const short = !owned && balance(save) < set.cost;
      const label = inUse ? 'In use' : owned ? 'Use' : `${set.cost} coins`;
      list.append(h('div', { class: `stone-opt${inUse ? ' on' : ''}` },
        h('span', { class: 'swatch big', 'data-set': set.id, 'aria-hidden': 'true' }, '7'),
        h('span', { class: 'stones-text' }, h('b', {}, set.name), short ? h('small', {}, `${set.cost - balance(save)} more coins`) : null),
        h('button', {
          class: `btn small${inUse ? '' : ' primary'}`, disabled: inUse || short,
          'aria-label': inUse ? `${set.name}, in use` : owned ? `Use ${set.name}` : `Buy ${set.name} for ${set.cost} coins`,
          onclick: () => {
            if (owned) { useStones(save, set.id); note.textContent = `${set.name} stones in use.`; }
            else {
              const r = buyStones(save, set.id);
              if (!r.ok) { note.textContent = 'Not enough coins yet.'; return; }
              setCoins(balance(save));
              sfx.coin(0);
              note.textContent = `${set.name} stones are yours.`;
            }
            persist(); applySettings(); draw();
          },
        }, label)));
    }
  };
  draw();
  const dlg = h('dialog', { class: 'settings stones', 'aria-label': 'Stones' },
    h('h2', {}, 'Stones'),
    h('p', { class: 'stone-balance' }, coinGlyph('small'), h('span', {}, `${balance(save)} coins`)),
    list, note,
    h('div', { class: 'dlg-actions' }, h('button', { class: 'btn primary', onclick: () => dlg.close() }, 'Done')));
  dlg.addEventListener('close', () => { dlg.remove(); if (document.querySelector('.chapters')) journey(); });
  document.body.append(dlg);
  dlg.showModal();
}

// ---------------------------------------------------------------- endless

function endless() {
  const fourOpen = chapterOpen(chapterById(FOUR_AT), save.completed, save.unlocked);
  let kind = 'fill3';
  let band = 2;
  const kinds = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Puzzle' });
  const depth = h('div', { class: 'seg depth', role: 'radiogroup', 'aria-label': 'Depth' });
  const draw = () => {
    clear(kinds);
    for (const k of ENDLESS_KINDS) {
      const locked = k.needs === FOUR_AT && !fourOpen;
      kinds.append(h('button', {
        role: 'radio', 'aria-checked': String(kind === k.id), class: kind === k.id ? 'on' : '', disabled: locked,
        onclick: () => { kind = k.id; band = Math.min(band, Math.max(...k.bands)); draw(); },
      }, k.label, locked ? h('span', { class: 'btn-note' }, `Opens at Level ${chapterById(FOUR_AT).num}`) : null));
    }
    clear(depth);
    const k = ENDLESS_KINDS.find((x) => x.id === kind);
    for (const b of k.bands) {
      depth.append(h('button', {
        role: 'radio', 'aria-checked': String(band === b), class: band === b ? 'on' : '',
        'aria-label': k.kind === 'restore' ? `${b} swap${b > 1 ? 's' : ''}` : `Depth ${b} of ${k.bands.length}`,
        onclick: () => { band = b; draw(); },
      }, h('span', { class: 'pip' }, ...Array.from({ length: b }, () => h('i')))));
    }
  };
  draw();
  screen('endless', bar('Endless', menu),
    h('div', { class: 'endless-body' },
      h('p', { class: 'label' }, 'Square'), kinds,
      h('p', { class: 'label' }, 'Depth'), depth,
      h('button', { class: 'btn primary', onclick: () => playEndless(kind, band) }, 'Begin')));
}

// ------------------------------------------------------------------- play

function playLevel(id) {
  // Same level, unfinished: pick it up where it was left.
  if (save.current?.mode === 'journey' && save.current.levelId === id && !save.current.solved) return resumeCurrent();
  const at = findLevel(id);
  start(isNode(at.spec) ? new NodeSession(at.spec) : new Session(at.spec), { mode: 'journey', levelId: id, theta: at.chapter.theta, chapter: at.chapter, skill: at.chapter.skill, teach: at.chapter.def?.teach });
}

function playDaily() {
  const date = localDateKey();
  if (save.current?.mode === 'daily' && save.current.date === date && !save.current.solved) return resumeCurrent();
  start(new Session(dailyPuzzle(date)), { mode: 'daily', date, theta: 54 });
}

function playEndless(kind, band) {
  const seed = String(Date.now());
  const spec = endlessPuzzle(kind, band, seed);
  if (!spec) return;
  start(new Session(spec), { mode: 'endless', kind, band, seed, theta: kind === 'fill4' ? 50 : 45 });
}

function resumeCurrent() {
  try {
    const c = save.current;
    const sess = isNode(c.spec) ? NodeSession.fromJSON(c) : Session.fromJSON(c);
    if (sess.p.kind === 'restore' && restoreTargets(sess.p).length === 0) throw new Error('Unsolvable saved puzzle');
    const at = c.levelId ? findLevel(c.levelId) : null;
    start(sess, { mode: c.mode, levelId: c.levelId, date: c.date, kind: c.kind, band: c.band, seed: c.seed, theta: c.theta, chapter: at?.chapter, skill: at?.chapter.skill, teach: at?.chapter.def?.teach });
  } catch {
    save.current = null;
    persist();
    menu();
  }
}

function stopPlay({ store = true } = {}) {
  if (!current) return;
  clearInterval(current.timer);
  clearTimeout(current.doneTimer);
  clearTimeout(current.payTimer);
  current.board.destroy();
  if (store) storeCurrent();
  current = null;
}

function storeCurrent() {
  if (!current) return;
  const { session, ctx } = current;
  save.current = session.solved ? null : { ...session.toJSON(), mode: ctx.mode, levelId: ctx.levelId, date: ctx.date, kind: ctx.kind, band: ctx.band, seed: ctx.seed, theta: ctx.theta };
  persist();
}

const fmtTime = (ms) => {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function start(session, ctx) {
  const p = session.p;
  const inscription = p.meta?.inscription ?? '';
  const teachText = ctx.teach ?? '';
  // The sheikh's words: the teaching line first, then hints, then praise.
  const hintLine = h('p', { class: `say-text${teachText ? ' teach' : ''}`, 'aria-live': 'polite' }, teachText);
  const sheikhEl = h('figure', { class: 'sheikh', 'aria-hidden': 'true' }, sheikhSvg());
  const speak = (text, { cls = '', mood = 'speaking' } = {}) => {
    hintLine.className = `say-text${cls ? ` ${cls}` : ''}`;
    hintLine.textContent = text;
    sheikhEl.classList.remove('speaking', 'pleased');
    void sheikhEl.offsetWidth; // restart the nod
    if (text) sheikhEl.classList.add(mood);
  };
  const timerEl = h('span', { class: `timer${save.settings.showTimer ? '' : ' hidden'}`, 'aria-hidden': 'true' }, fmtTime(session.elapsed));
  const doneEl = h('div', { class: 'done hidden', role: 'status' });
  let hintPlan = null;
  let hintTier = 0;
  // This puzzle's own timers. Never read the module-level `current` from
  // callbacks: by the time they fire, another puzzle may have started.
  const own = { session, board: null, ctx, timer: null, doneTimer: null, payTimer: null };

  const View = isNode(session.p) ? NodeBoardView : BoardView;
  const board = new View({
    session, theta: ctx.theta ?? 45, settings: save.settings, announce,
    onBlocked: () => speak('That was your one swap. Undo it and look again.'),
    onMove: () => {
      hintPlan = null;
      hintTier = 0;
      paintHint();
      // After the very first stone of Level 1, say what the marks mean, once.
      if (ctx.levelId === 'm1' && session.tries === 1 && !session.solved) speak('Each mark shows its line\'s total so far. A star means the line is exact.', { cls: 'teach' });
      else if (hintLine.textContent) speak('');
      paintSwaps();
      // The last stone settles progress and coins right now, not after the
      // 0.4 s flourish: a reload in that moment must not lose the finish.
      if (session.solved) settle();
      storeCurrent();
    },
    onSolved: () => finish(),
  });
  board.app = { unlock };

  const hintDots = h('span', { class: 'tier-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  const hintBtn = h('button', { class: 'act', onclick: () => showHint() }, icon.hint(), h('span', {}, 'Hint'), hintDots);
  const undoBtn = h('button', {
    class: 'act', onclick: () => {
      const before = board.captureRects();
      if (session.undo()) {
        board.hint = null;
        board.selected = null;
        board.render();
        board.playFlip(before);
        hintPlan = null; hintTier = 0; paintHint(); paintSwaps(); storeCurrent();
      }
    },
  }, icon.undo(), h('span', {}, 'Undo'));

  let fewest = null;
  const swapsEl = h('div', { class: 'swaps', 'aria-live': 'polite' });
  function paintSwaps() {
    if (p.kind !== 'restore') return;
    if (fewest === null) fewest = restoreDistance(p, startValues(p)).distance;
    if (!Number.isFinite(fewest)) return;
    clear(swapsEl);
    const used = session.moves;
    if (p.limit) {
      // A swap limit is spent: show every swap allowed, filled as they go.
      for (let i = 0; i < p.limit; i++) swapsEl.append(h('i', { class: i < used ? 'used' : '' }));
      const left = Math.max(0, p.limit - used);
      swapsEl.append(h('span', { class: 'swap-label' }, left ? `${left} swap${left === 1 ? '' : 's'} left` : 'No swaps left'));
    } else {
      // No limit: only count what has been made. No target shown.
      for (let i = 0; i < used; i++) swapsEl.append(h('i', { class: 'used' }));
      swapsEl.append(h('span', { class: 'swap-label' }, `${used} swap${used === 1 ? '' : 's'}`));
    }
    swapsEl.append(h('span', { class: 'sr-only' }, `${used} swap${used === 1 ? '' : 's'} made.${p.limit ? ` You may make ${p.limit}.` : ` The square can be restored in ${fewest}.`}`));
  }
  paintSwaps();

  // Which planner reads this board. The broken square has its own, because its
  // lines point at one stone and the engine can say which and what it should be.
  function planFor() {
    const vals = session.values();
    if (isNode(p)) return planNodeHint(session.def, vals);
    if (p.meta?.skill === 'DETECT') {
      const tray = session.trayTiles().map((t) => t.value);
      const d = diagnoseSquare(p, session.evaluate().lines, vals, (c) => cellName(p.n, c), tray);
      if (d) return d;
    }
    return planHint(p, vals);
  }

  function paintHint() {
    [...hintDots.children].forEach((d, i) => d.classList.toggle('on', i < hintTier));
  }
  function showHint() {
    if (session.solved) return;
    unlock();
    if (!hintPlan) {
      hintPlan = planFor();
      hintTier = 0;
    }
    if (!hintPlan) return;
    if (hintTier < 3) {
      hintTier++;
      session.hints++;
    }
    const tier = hintPlan.tiers[hintTier - 1];
    board.setHint(tier);
    speak(tier.text);
    paintHint();
    storeCurrent();
  }

  // Progress and coins are settled in one place, once, the moment the puzzle
  // is solved and before anything is drawn: the save is true even if the
  // player closes the page right now. Calling it again changes nothing.
  function settle() {
    if (own.settled) return own.settled;
    clearInterval(own.timer);
    const st = { time: session.elapsed, moves: session.moves, hints: session.hints, mistakes: session.mistakes };
    let result = null;
    if (ctx.mode === 'journey') result = recordCompletion(save, ctx.levelId, st);
    if (ctx.mode === 'daily') recordDaily(save, ctx.date, st);
    save.current = null;
    persist();
    own.settled = { result };
    return own.settled;
  }

  function finish() {
    const { result } = settle();

    const text = finishText(session, ctx);
    const word = DONE_WORD[ctx.skill] ?? (p.kind === 'restore' ? 'Restored.' : 'Whole.');
    const lines = [];
    const chapterDone = ctx.mode === 'journey' && ctx.chapter && ctx.chapter.puzzles.every((x) => save.completed[x.id]);
    const multi = chapterDone && ctx.chapter.puzzles.length > 1;
    if (chapterDone && !multi) lines.push(`Level ${ctx.chapter.num} complete.`);
    if (p.kind === 'restore') lines.push(session.moves <= fewest ? `${session.moves} swap${session.moves === 1 ? '' : 's'}. The fewest possible.` : `${session.moves} swaps. It can be done in ${fewest}.`);
    lines.push(...text.lines);
    if (ctx.mode === 'daily') {
      const rec = save.daily.records[ctx.date];
      lines.push(`${fmtTime(rec.time)} · ${rec.mistakes} misstep${rec.mistakes === 1 ? '' : 's'} · ${rec.hints} hint${rec.hints === 1 ? '' : 's'}`);
      lines.push(`${save.daily.streak} day${save.daily.streak === 1 ? '' : 's'} in a row`);
    }
    const next = ctx.mode === 'journey' ? nextLevel(ctx.levelId) : null;
    const chapterIndex = chapterDone ? CHAPTERS.indexOf(ctx.chapter) : -1;
    const reduced = save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    celebrate(board.el, { theta: ctx.theta ?? 45, n: isNode(p) ? 3 : p.n, big: chapterDone, reduced });
    if (chapterDone) sfx.level();
    setTimeout(() => speak(multi ? `Level ${ctx.chapter.num} is complete.` : text.praise, { cls: 'praise', mood: 'pleased' }),
      save.settings.reducedMotion ? 0 : 700);
    const doneWord = multi ? `Level ${ctx.chapter.num} complete.` : word;
    // The reward: a coin and an amount on the panel, paid to the counter a
    // moment after the panel is up. A level already paid shows a quiet note.
    const badge = result?.coins > 0 ? rewardBadge(result.coins) : null;
    clear(doneEl);
    doneEl.append(
      sealStar(),
      h('p', { class: 'done-word' }, doneWord),
      ...lines.map((l) => h('p', { class: 'done-line' }, l)),
      badge ?? (result && result.coins === 0 ? claimedNote() : null),
      h('div', { class: 'done-actions' },
        ctx.mode === 'journey' && chapterDone
          ? h('button', { class: 'btn primary', onclick: () => interlude(chapterIndex, next?.id) }, 'Continue')
          : ctx.mode === 'journey' && next ? h('button', { class: 'btn primary', onclick: () => playLevel(next.id) }, 'Next') : null,
        ctx.mode === 'endless' ? h('button', { class: 'btn primary', onclick: () => playEndless(ctx.kind, ctx.band) }, 'Another') : null,
        h('button', { class: 'btn', onclick: ctx.mode === 'journey' ? journey : menu }, ctx.mode === 'journey' ? 'Journey' : 'Back')));
    own.doneTimer = setTimeout(() => {
      doneEl.classList.remove('hidden');
      document.body.classList.add('sunlit');
      (doneEl.querySelector('.btn.primary') ?? doneEl.querySelector('.btn'))?.focus({ preventScroll: true });
      announce(`${doneWord} ${lines.join(' ')}${badge ? ` You earned ${result.coins} coins. You now have ${result.balance}.` : ''}`);
      if (badge) {
        badge.classList.add('in');
        if (!reduced) sfx.reward();
        own.payTimer = setTimeout(() => payReward({ anchor: badge._glyph, amount: result.coins, balance: result.balance, reduced }), reduced ? 0 : 1000);
      }
    }, save.settings.reducedMotion ? 200 : 1500);
  }

  const back = () => (ctx.mode === 'journey' ? journey() : menu());
  // The guide, upper right: the goal number sits inside his instruction, in
  // an eight-point star, so the eye finds it before it finds the stones.
  const goal = h('span', { class: 'goal' },
    s('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' }, s('path', { d: starOutline(20, 20, 19, 0.78) })),
    h('b', {}, goalMark(p)));
  const guide = h('div', { class: 'guide' },
    h('div', { class: 'speech' },
      inscription ? h('p', { class: 'inscription' }, inscription) : null,
      h('p', { class: 'say-goal', 'aria-label': `${goalLead(p)}${isNode(p) ? '' : ` ${p.target}`}.` }, h('span', { class: 'say-lead' }, goalLead(p)), goal),
      hintLine),
    sheikhEl);

  const el = screen(`play${isNode(p) ? ` ${p.type}` : ''}`,
    h('header', { class: 'bar' },
      h('button', { class: 'icon', 'aria-label': 'Back', onclick: back }, icon.back()),
      timerEl,
      h('div', { class: 'bar-right' }, coinChip(balance(save)),
        h('button', { class: 'icon', 'aria-label': 'Settings', onclick: openSettings }, icon.gear()))),
    guide,
    h('div', { class: 'stage' }, board.extras ?? null, board.el),
    p.kind === 'restore' ? swapsEl : board.tray,
    h('div', { class: 'actions' }, undoBtn, hintBtn),
    doneEl);
  document.body.classList.remove('sunlit');
  if (ctx.mode === 'journey') mountBackdrop(el, ctx.chapter, save.settings.reducedMotion);

  own.board = board;
  current = own;
  own.timer = setInterval(() => {
    if (document.hidden || session.solved || document.querySelector('dialog[open]')) return;
    session.elapsed += 1000;
    timerEl.textContent = fmtTime(session.elapsed);
    if (session.elapsed % 10000 === 0) storeCurrent();
  }, 1000);
  storeCurrent();
  board.sizeTray();
  el.querySelector('.tile:not(.locked)')?.focus({ preventScroll: true });
}

// ------------------------------------------------------------ interlude

// The scene a level is set in: the one that played just before it. Level 1
// has none. Plain deterministic maths, so the same level always has the same
// setting, whether it is reached through the film or from the Journey.
const sceneFor = (num) => (num >= 2 ? (num - 2) % 6 : -1);

function mountBackdrop(el, chapter, reduced) {
  const i = chapter ? sceneFor(chapter.num) : -1;
  if (i < 0) return;
  const box = h('div', { class: 'backdrop', 'aria-hidden': 'true' });
  el.prepend(box);
  (SCENE_LIST ? Promise.resolve(SCENE_LIST) : import('./scenes.js').then((m) => (SCENE_LIST = m)))
    .then((m) => {
      if (!box.isConnected) return;
      m.mountScene(box, m.SCENES[i % m.SCENES.length].id, { reduced, still: true });
      requestAnimationFrame(() => box.classList.add('in'));
    })
    .catch(() => {});
}

// Between levels: a scenic film that introduces the next level. The scene
// plays and rests on its last frame, under a card with the level's number and
// name, a short introduction, and a Proceed button. Proceed goes straight into
// the level: no title card after it. The scenes module is loaded on demand; if
// it fails, the card still shows, on plain limestone.
let SCENE_LIST = null;
function interlude(chapterIndex, nextId) {
  const nextChapter = nextId ? findLevel(nextId).chapter : null;
  const goOn = () => (nextId ? playLevel(nextId) : journey());
  const reduced = save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = h('div', { class: 'il-scene' });
  const go = h('button', { class: 'btn primary il-go', onclick: () => end() }, nextChapter ? 'Proceed' : 'Back to the Journey');
  const card = h('div', { class: 'il-card' },
    nextChapter ? h('p', { class: 'numeral' }, `Level ${nextChapter.num}`) : null,
    h('h2', { class: 'il-title' }, nextChapter ? nextChapter.title : 'The Journey so far'),
    h('p', { class: 'il-intro' }, nextChapter
      ? nextChapter.intro
      : 'You have finished every open level. More are still being built.'),
    go);
  const el = h('div', { class: 'interlude', role: 'dialog', 'aria-label': nextChapter ? `Level ${nextChapter.num}, ${nextChapter.title}` : 'The Journey so far' },
    box, card);
  document.body.append(el);
  go.focus({ preventScroll: true });
  // The picture gets its time first. The card then comes in slowly.
  setTimeout(() => el.classList.add('ready'), reduced ? 0 : 5200);
  let handle = null;
  let stopSound = () => {};
  let ended = false;
  const onKey = (e) => { if (e.key === 'Escape') end(); };
  document.addEventListener('keydown', onKey);
  function end() {
    if (ended) return;
    ended = true;
    document.removeEventListener('keydown', onKey);
    handle?.stop();
    stopSound();
    goOn();
    el.classList.add('leaving');
    setTimeout(() => el.remove(), reduced ? 100 : 500);
  }
  announce(nextChapter ? `Level ${nextChapter.num}. ${nextChapter.title}. ${nextChapter.intro}` : 'The Journey so far.');
  (SCENE_LIST ? Promise.resolve(SCENE_LIST) : import('./scenes.js').then((m) => (SCENE_LIST = m)))
    .then((m) => {
      if (ended) return;
      const scene = m.SCENES[Math.max(0, chapterIndex) % m.SCENES.length];
      stopSound = sceneAmbience(scene.id);
      handle = m.mountScene(box, scene.id, { reduced, hold: true, duration: 9000 });
    })
    .catch(() => {});
}

// ---------------------------------------------------------------- opening

// The opening film (assets/film): a stormy sea, the sun, a dhow that settles
// level, the word Mizan. It plays once per launch. When it ends it holds on
// its last frame and the four start buttons appear over it. The menu screen
// is only ever reached by a button: a pressed start button goes to its own
// screen, and Back goes to the menu. Skip, or Escape, jumps to the buttons.
// With reduced motion, or ?noopening in the URL, the film is not played and
// the menu screen shows as it is. If the browser blocks sound, a "Tap to
// begin" button starts it with sound.
function opening() {
  const reduced = save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || new URLSearchParams(location.search).has('noopening')) return;
  const video = h('video', { class: 'op-video', playsinline: '', preload: 'auto', 'aria-hidden': 'true' });
  const mp4 = video.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"');
  video.src = mp4 ? 'assets/film/opening.mp4' : 'assets/film/opening.webm';
  video.muted = !save.settings.sound;
  const tap = h('button', { class: 'op-tap', hidden: true, onclick: () => begin() }, 'Tap to begin');
  const skip = h('button', { class: 'op-skip', onclick: () => toButtons() }, 'Skip');
  const el = h('div', { class: 'opening', role: 'dialog', 'aria-label': 'Opening film' }, video, tap, skip);
  document.body.append(el);
  skip.focus({ preventScroll: true });
  announce('Mizan. A stormy sea clears, the sun comes out and a ship settles level.');

  let shown = false; // the buttons are up
  let gone = false; // the overlay has been removed
  const onKey = (e) => { if (e.key === 'Escape') toButtons(); };
  document.addEventListener('keydown', onKey);

  // Hold on the last frame and lay the real buttons over it.
  function toButtons() {
    if (shown || gone) return;
    shown = true;
    clearTimeout(watchdog);
    document.removeEventListener('keydown', onKey);
    skip.remove();
    tap.hidden = true;
    const nav = h('nav', { class: 'menu-nav op-nav', 'aria-label': 'Start' }, ...menuButtons((fn) => () => { leave(); fn(); }));
    el.append(nav);
    if (!video.ended) {
      // skipped: let the sound fall away, then rest on the final frame
      const v0 = video.volume;
      let k = 0;
      const fade = setInterval(() => {
        k += 1;
        video.volume = Math.max(0, v0 * (1 - k / 6));
        if (k >= 6) { clearInterval(fade); video.pause(); }
      }, 60);
      if (video.duration) video.currentTime = Math.max(0, video.duration - 0.04);
    }
    // Each button arrives on its own tap, a quarter second apart.
    [...nav.children].forEach((b, i) => b.style.setProperty('--at', `${(i * TAP_GAP).toFixed(2)}s`));
    unlockAudio();
    if (save.settings.sound) sfx.menu(nav.children.length);
    announce('Mizan. Start: ' + [...nav.children].map((b) => b.firstChild?.textContent).join(', ') + '.');
    (nav.querySelector('.btn.primary') ?? nav.querySelector('.btn:not(:disabled)'))?.focus({ preventScroll: true });
  }
  // A start button was pressed: fade the film away to the screen it chose.
  function leave() {
    if (gone) return;
    gone = true;
    video.pause();
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 900);
  }
  // The film cannot play at all: drop it and show the menu underneath.
  function giveUp() {
    if (shown || gone) return;
    gone = true;
    clearTimeout(watchdog);
    document.removeEventListener('keydown', onKey);
    el.remove();
  }
  function begin() {
    video.play().then(() => { tap.hidden = true; }).catch(() => { tap.hidden = false; tap.focus({ preventScroll: true }); });
  }
  video.addEventListener('canplay', () => { clearTimeout(watchdog); begin(); }, { once: true });
  video.addEventListener('ended', toButtons);
  video.addEventListener('error', giveUp);
  // never hold the player behind a film that will not load
  const watchdog = setTimeout(() => { if (video.readyState < 2) giveUp(); }, 8000);
}

document.addEventListener('visibilitychange', () => { setAudioHidden(document.hidden); if (document.hidden) storeCurrent(); });
window.addEventListener('pagehide', storeCurrent);

// --------------------------------------------------------------- settings

// ------------------------------------------------------------- developer

// Open the game with ?dev in the address to get the testing tools: erase
// everything, open every level, add coins. They are also on `window.mizanDev`
// for the console. Players never see them.
const DEV = new URLSearchParams(location.search).has('dev');

function resetProgress() {
  stopPlay({ store: false }); // do not write the old puzzle into the new save
  const keep = save.settings;
  save = freshSave();
  save.settings = keep; // progress and coins go; the player's settings stay
  persist();
  applySettings();
  settleCoins(0);
  menu();
}

function unlockAll() {
  save.unlocked = CHAPTERS.filter((c) => !c.sealed).map((c) => c.id);
  persist();
}

function addCoins(n) {
  award(save, `dev:${Date.now()}:${Math.random()}`, n);
  persist();
  setCoins(balance(save));
}

function devRows() {
  const run = (fn) => () => { document.querySelector('dialog.settings')?.close(); fn(); };
  return h('div', { class: 'dev' },
    h('p', { class: 'label' }, 'Developer'),
    h('div', { class: 'dev-btns' },
      h('button', { class: 'btn small', onclick: run(resetProgress) }, 'Reset progress'),
      h('button', { class: 'btn small', onclick: run(() => { unlockAll(); journey(); }) }, 'Open all levels'),
      h('button', { class: 'btn small', onclick: () => addCoins(50) }, '+50 coins')));
}

if (DEV) window.mizanDev = { reset: resetProgress, unlockAll, addCoins, save: () => save, balance: () => balance(save) };

function openSettings() {
  const st = save.settings;
  const canVibrate = 'vibrate' in navigator;
  const toggle = (key, label, note = '', disabled = false) => {
    const id = `set-${key}`;
    return h('label', { class: 'row', for: id },
      h('span', { class: 'row-text' }, label, note ? h('small', {}, note) : null),
      h('input', {
        type: 'checkbox', role: 'switch', id, checked: st[key], disabled,
        onchange: (e) => { st[key] = e.target.checked; persist(); applySettings(); afterSettings(); },
      }));
  };
  const scale = h('div', { class: 'row' },
    h('span', { class: 'row-text' }, 'Text size'),
    h('div', { class: 'seg small', role: 'radiogroup', 'aria-label': 'Text size' },
      ...[[1, 'A'], [1.15, 'A+'], [1.3, 'A++']].map(([v, l]) => h('button', {
        role: 'radio', 'aria-checked': String(st.textScale === v), class: st.textScale === v ? 'on' : '',
        onclick: (e) => {
          st.textScale = v; persist(); applySettings();
          [...e.currentTarget.parentNode.children].forEach((b) => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); });
          afterSettings();
        },
      }, l))));
  const dlg = h('dialog', { class: 'settings', 'aria-label': 'Settings' },
    h('h2', {}, 'Settings'),
    toggle('sound', 'Sound'),
    toggle('ambience', 'Wind'),
    toggle('haptics', 'Vibration', canVibrate ? '' : 'Not available on this device', !canVibrate),
    toggle('reducedMotion', 'Reduce motion'),
    toggle('highContrast', 'High contrast'),
    scale,
    toggle('leftHanded', 'Controls on the left'),
    toggle('showTimer', 'Show timer'),
    DEV ? devRows() : null,
    h('div', { class: 'dlg-actions' },
      h('button', {
        class: 'btn quiet', onclick: () => {
          if (window.confirm('Erase all progress and coins?')) {
            dlg.close();
            resetProgress();
          }
        },
      }, 'Erase progress'),
      h('button', { class: 'btn primary', onclick: () => dlg.close() }, 'Done')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

function afterSettings() {
  if (!current) return;
  current.board.settings = save.settings;
  document.querySelector('.timer')?.classList.toggle('hidden', !save.settings.showTimer);
  current.board.render();
}

document.addEventListener('keydown', (e) => {
  if (!current || document.querySelector('dialog[open]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    document.querySelector('.actions .act')?.click();
  }
});

try {
  applySettings();
  menu();
  opening();
} catch {
  // A save the checks did not foresee: start clean rather than show nothing.
  save = freshSave();
  persist();
  applySettings();
  menu();
}
