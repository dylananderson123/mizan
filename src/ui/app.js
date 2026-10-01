// App shell: screens, settings, saving, the play loop.

import { h, s, clear } from './dom.js';
import { BoardView } from './board.js';
import { emblem, field, starOutline } from './pattern.js';
import { unlockAudio, configureSound, sfx, sceneAmbience } from './sound.js';
import { sheikhSvg } from './sheikh.js';
import { celebrate, sealStar } from './reward.js';
import { Session, TRAY } from '../game/session.js';
import { CHAPTERS, findLevel, nextLevel, chapterOpen, levelOpen, chapterById, DAILY_AFTER, FOUR_AT } from '../game/levels.js';
import { loadSave, writeSave, freshSave } from '../game/storage.js';
import { dailyPuzzle, recordDaily, localDateKey, endlessPuzzle, ENDLESS_KINDS, streakAlive } from '../game/daily.js';
import { planHint } from '../core/hints.js';
import { restoreDistance, startValues, restoreTargets } from '../core/carver.js';

// The name on screen. One constant, so it is a one-line change.
export const TITLE = 'Mizan';

// What the sheikh says under the goal until the first move. Teaching by
// doing: one sentence at most, and only where a new idea appears.
const TEACH = {
  'c1-01': 'Move a stone from the tray into the gap.',
  'c1-02': 'Columns count too.',
  'c1-03': 'One stone can serve two lines.',
  'c1-04': 'Where lines cross, both must agree.',
  'c1-05': 'Diagonals count.',
  'c1-07': 'Every row, every column, both diagonals.',
  'l4-01': 'New numbers, so a new total. Look at it first.',
  'l4-02': 'The total is always three times the centre.',
  'l5-01': 'Four by four. Sixteen stones, one total.',
  'l6-01': 'Drag one stone onto another to swap them.',
  'l7-01': 'Not every stone belongs.',
  'l8-03': 'Where two lines cross, only some stones fit both.',
  'l9-03': 'If you are stuck, suppose a stone and follow it.',
};

// What he says when a square is finished. Chosen by the puzzle, not at
// random, so the same puzzle always gets the same words.
const PRAISE = ["Masha'Allah.", 'Well done.', 'Barak Allahu feek.', 'Good. Every line agrees.'];

// The goal sentence, fitted to how many lines the board has.
function goalLead(p) {
  if (p.kind === 'restore') return 'Swap stones so every line makes';
  const n = p.shape.lines.length;
  if (n === 1) return 'This line must make';
  if (n === 2) return 'Both lines must make';
  return 'Every line must make';
}

const storage = (() => {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; }
})();
let save = loadSave(storage);
const root = document.getElementById('app');
const live = document.getElementById('sr');
let current = null; // { session, board, ctx, timer }

const persist = () => writeSave(storage, save);
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
  return el;
}

function bar(title, onBack) {
  return h('header', { class: 'bar' },
    h('button', { class: 'icon', 'aria-label': 'Back', onclick: onBack }, icon.back()),
    h('h2', { class: 'bar-title' }, title),
    h('button', { class: 'icon', 'aria-label': 'Settings', onclick: openSettings }, icon.gear()));
}

// ------------------------------------------------------------------- menu

function menu() {
  const resume = save.current && !save.current.solved ? save.current : null;
  const dailyOpen = chapterById(DAILY_AFTER).puzzles.every((p) => save.completed[p.id]);
  const today = localDateKey();
  const dailyDone = Boolean(save.daily.records[today]);
  screen('menu',
    h('div', { class: 'menu-field', 'aria-hidden': 'true' },
      s('svg', { viewBox: '0 0 120 120', preserveAspectRatio: 'xMidYMid slice' }, s('path', { d: field(45, 12, 12, 10) }))),
    h('div', { class: 'menu-body' },
      h('h1', { class: 'title' }, TITLE),
      h('p', { class: 'sub' }, 'Every line, the same total.'),
      h('nav', { class: 'menu-nav' },
        resume ? h('button', { class: 'btn primary', onclick: () => resumeCurrent() }, 'Continue') : null,
        h('button', { class: `btn${resume ? '' : ' primary'}`, onclick: journey }, 'Journey'),
        h('button', { class: 'btn', disabled: !dailyOpen, onclick: playDaily },
          'Daily square',
          h('span', { class: 'btn-note' }, !dailyOpen ? `Opens after Level ${chapterById(DAILY_AFTER).num}` : dailyDone ? `Done today · ${save.daily.streak} in a row` : streakAlive(save.daily, today) ? `${save.daily.streak} in a row` : '')),
        h('button', { class: 'btn', onclick: endless }, 'Endless')),
    ),
    h('button', { class: 'icon corner', 'aria-label': 'Settings', onclick: openSettings }, icon.gear()));
}

// ---------------------------------------------------------------- journey

function journey() {
  const list = h('div', { class: 'chapters' });
  for (const ch of CHAPTERS) {
    const open = chapterOpen(ch, save.completed);
    const doneCount = ch.puzzles.filter((p) => save.completed[p.id]).length;
    const complete = ch.puzzles.length && doneCount === ch.puzzles.length;
    const pieces = ch.sealed ? emblem(60, 1, 3) : emblem(ch.theta, ch.puzzles.length, 3);
    const art = s('svg', { class: 'emblem', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('rect', { class: 'emblem-bg', x: 1, y: 1, width: 98, height: 98, rx: 3 }),
      ...pieces.map((d, i) => s('path', { d, class: i < doneCount ? 'lit' : '' })));
    const dots = h('div', { class: 'levels' },
      ...ch.puzzles.map((p, i) => {
        const done = Boolean(save.completed[p.id]);
        const can = levelOpen(p.id, save.completed);
        return h('button', {
          class: `lvl${done ? ' done' : ''}${can && !done ? ' next' : ''}`,
          disabled: !can, 'aria-label': `Puzzle ${i + 1}${done ? ', complete' : can ? '' : ', locked'}`,
          onclick: () => playLevel(p.id),
        }, h('span', {}, String(i + 1)));
      }));
    list.append(h('section', { class: `chapter${open ? ' open' : ''}${ch.sealed ? ' sealed' : ''}${complete ? ' complete' : ''}` },
      art,
      h('div', { class: 'ch-text' },
        h('p', { class: 'numeral' }, `Level ${ch.num}`),
        h('h3', {}, ch.title),
        ch.sealed ? h('p', { class: 'sealed-note' }, 'Sealed') : open ? dots : h('p', { class: 'sealed-note' }, 'Opens when the level before is complete'))));
  }
  screen('journey', bar('Journey', menu), list);
}

// ---------------------------------------------------------------- endless

function endless() {
  const fourOpen = chapterOpen(chapterById(FOUR_AT), save.completed);
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
  start(new Session(at.spec), { mode: 'journey', levelId: id, theta: at.chapter.theta, chapter: at.chapter });
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
    const sess = Session.fromJSON(c);
    if (sess.p.kind === 'restore' && restoreTargets(sess.p).length === 0) throw new Error('Unsolvable saved puzzle');
    const at = c.levelId ? findLevel(c.levelId) : null;
    start(sess, { mode: c.mode, levelId: c.levelId, date: c.date, kind: c.kind, band: c.band, seed: c.seed, theta: c.theta, chapter: at?.chapter });
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
  const teachText = TEACH[ctx.levelId] ?? '';
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
  const own = { session, board: null, ctx, timer: null, doneTimer: null };

  const board = new BoardView({
    session, theta: ctx.theta ?? 45, settings: save.settings, announce,
    onMove: () => {
      hintPlan = null;
      hintTier = 0;
      paintHint();
      if (hintLine.textContent) speak('');
      paintSwaps();
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
    const total = Math.max(fewest, used);
    for (let i = 0; i < total; i++) swapsEl.append(h('i', { class: i < used ? (i < fewest ? 'used' : 'extra') : '' }));
    swapsEl.append(h('span', { class: 'sr-only' }, `${used} swap${used === 1 ? '' : 's'} made. The square can be restored in ${fewest}.`));
  }
  paintSwaps();

  function paintHint() {
    [...hintDots.children].forEach((d, i) => d.classList.toggle('on', i < hintTier));
  }
  function showHint() {
    if (session.solved) return;
    unlock();
    if (!hintPlan) {
      hintPlan = planHint(p, session.values());
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

  function finish() {
    clearInterval(own.timer);
    const st = { time: session.elapsed, moves: session.moves, hints: session.hints, mistakes: session.mistakes };
    if (ctx.mode === 'journey') save.completed[ctx.levelId] = { moves: st.moves, hints: st.hints, at: Date.now() };
    if (ctx.mode === 'daily') recordDaily(save, ctx.date, st);
    save.current = null;
    persist();

    const word = p.kind === 'restore' ? 'Restored.' : 'Whole.';
    const lines = [];
    if (p.kind === 'restore') lines.push(session.moves <= fewest ? `${session.moves} swap${session.moves === 1 ? '' : 's'}. The fewest possible.` : `${session.moves} swaps. It can be done in ${fewest}.`);
    if (ctx.mode === 'daily') {
      const rec = save.daily.records[ctx.date];
      lines.push(`${fmtTime(rec.time)} · ${rec.mistakes} misstep${rec.mistakes === 1 ? '' : 's'} · ${rec.hints} hint${rec.hints === 1 ? '' : 's'}`);
      lines.push(`${save.daily.streak} day${save.daily.streak === 1 ? '' : 's'} in a row`);
    }
    const next = ctx.mode === 'journey' ? nextLevel(ctx.levelId) : null;
    const chapterDone = ctx.mode === 'journey' && ctx.chapter && ctx.chapter.puzzles.every((x) => save.completed[x.id]);
    const chapterIndex = chapterDone ? CHAPTERS.indexOf(ctx.chapter) : -1;
    const reduced = save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    celebrate(board.el, { theta: ctx.theta ?? 45, big: chapterDone, reduced });
    if (chapterDone) sfx.level();
    const seed = [...(ctx.levelId ?? ctx.date ?? ctx.seed ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    const praise = PRAISE[seed % PRAISE.length];
    setTimeout(() => speak(chapterDone ? `Masha'Allah. Level ${ctx.chapter.num} is complete.` : praise, { cls: 'praise', mood: 'pleased' }),
      save.settings.reducedMotion ? 0 : 700);
    const doneWord = chapterDone ? `Level ${ctx.chapter.num} complete.` : word;
    clear(doneEl);
    doneEl.append(
      sealStar(),
      h('p', { class: 'done-word' }, doneWord),
      ...lines.map((l) => h('p', { class: 'done-line' }, l)),
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
      announce(`${doneWord} ${lines.join(' ')}`);
    }, save.settings.reducedMotion ? 200 : 1500);
  }

  const back = () => (ctx.mode === 'journey' ? journey() : menu());
  // The guide, upper right: the goal number sits inside his instruction, in
  // an eight-point star, so the eye finds it before it finds the stones.
  const goal = h('span', { class: 'goal' },
    s('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true' }, s('path', { d: starOutline(20, 20, 19, 0.78) })),
    h('b', {}, String(p.target)));
  const guide = h('div', { class: 'guide' },
    h('div', { class: 'speech' },
      inscription ? h('p', { class: 'inscription' }, inscription) : null,
      h('p', { class: 'say-goal', 'aria-label': `${goalLead(p)} ${p.target}.` }, h('span', { class: 'say-lead' }, goalLead(p)), goal),
      hintLine),
    sheikhEl);

  const el = screen('play',
    h('header', { class: 'bar' },
      h('button', { class: 'icon', 'aria-label': 'Back', onclick: back }, icon.back()),
      timerEl,
      h('button', { class: 'icon', 'aria-label': 'Settings', onclick: openSettings }, icon.gear())),
    guide,
    h('div', { class: 'stage' }, board.el),
    p.kind === 'restore' ? swapsEl : board.tray,
    h('div', { class: 'actions' }, undoBtn, hintBtn),
    doneEl);
  document.body.classList.remove('sunlit');

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

// Between levels: a short scenic film, then the next level's name over the
// first puzzle. The scenes module is loaded on demand; if it fails, the game
// goes straight on.
let SCENE_LIST = null;
function interlude(chapterIndex, nextId) {
  const nextChapter = nextId ? findLevel(nextId).chapter : null;
  const goOn = () => (nextId ? playLevel(nextId) : journey());
  const box = h('div', { class: 'il-scene' });
  const place = h('p', { class: 'il-place' });
  const sub = h('p', { class: 'il-sub' });
  const card = h('div', { class: 'il-card' },
    nextChapter ? h('p', { class: 'numeral' }, `Level ${nextChapter.num}`) : null,
    h('p', { class: 'il-title' }, nextChapter ? nextChapter.title : 'The Journey so far'));
  const skip = h('button', { class: 'il-skip', onclick: () => end() }, 'Skip');
  const el = h('div', { class: 'interlude', role: 'dialog', 'aria-label': 'Interlude' },
    box, h('div', { class: 'il-caption' }, place, sub), skip, card);
  document.body.append(el);
  skip.focus({ preventScroll: true });
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
    el.classList.add('carding');
    announce(nextChapter ? `Level ${nextChapter.num}. ${nextChapter.title}.` : 'Back to the Journey.');
    setTimeout(() => el.classList.add('leaving'), save.settings.reducedMotion ? 600 : 1500);
    setTimeout(() => el.remove(), save.settings.reducedMotion ? 800 : 2400);
  }
  const reduced = save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  (SCENE_LIST ? Promise.resolve(SCENE_LIST) : import('./scenes.js').then((m) => (SCENE_LIST = m)))
    .then((m) => {
      if (ended) return;
      const scene = m.SCENES[Math.max(0, chapterIndex) % m.SCENES.length];
      place.textContent = scene.caption;
      sub.textContent = scene.sub;
      announce(`${scene.caption}. ${scene.sub}.`);
      stopSound = sceneAmbience(scene.id);
      handle = m.mountScene(box, scene.id, { reduced, duration: 7000, onEnd: end });
    })
    .catch(() => end());
}

document.addEventListener('visibilitychange', () => { if (document.hidden) storeCurrent(); });
window.addEventListener('pagehide', storeCurrent);

// --------------------------------------------------------------- settings

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
    h('div', { class: 'dlg-actions' },
      h('button', {
        class: 'btn quiet', onclick: () => {
          if (window.confirm('Erase all progress?')) {
            stopPlay({ store: false }); // do not write the old puzzle into the new save
            save = freshSave(); persist(); applySettings(); dlg.close(); menu();
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
} catch {
  // A save the checks did not foresee: start clean rather than show nothing.
  save = freshSave();
  persist();
  applySettings();
  menu();
}
