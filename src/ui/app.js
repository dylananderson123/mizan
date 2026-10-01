// App shell: screens, settings, saving, the play loop.

import { h, s, clear } from './dom.js';
import { BoardView } from './board.js';
import { emblem, field } from './pattern.js';
import { unlockAudio, configureSound } from './sound.js';
import { Session, TRAY } from '../game/session.js';
import { CHAPTERS, findLevel, nextLevel, chapterOpen, levelOpen, firstUnfinished } from '../game/levels.js';
import { loadSave, writeSave, freshSave } from '../game/storage.js';
import { dailyPuzzle, recordDaily, localDateKey, endlessPuzzle, ENDLESS_KINDS } from '../game/daily.js';
import { planHint } from '../core/hints.js';
import { restoreDistance, startValues } from '../core/carver.js';

// The name on screen. One constant, so it is a one-line change.
export const TITLE = 'House of Zairajah';

// A short line under the board until the first move. Teaching by doing:
// one sentence at most, and only where a new idea appears.
const TEACH = {
  'c1-01': 'Move a stone into the gap. The line must make 15.',
  'c1-02': 'Columns count too.',
  'c1-03': 'One stone can serve two lines.',
  'c1-04': 'Where lines cross, both must agree.',
  'c1-05': 'Diagonals count.',
  'c1-06': 'More than one answer is right here.',
  'c1-07': 'Every row, every column, both diagonals.',
  'c2-01': 'New numbers. Look at the target.',
  'c2-05': 'Not every stone belongs.',
  'c3-01': 'Drag one stone onto another to swap them.',
  'c4-01': 'Four by four. Every line makes 34.',
};

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
  const dailyOpen = CHAPTERS[0].puzzles.every((p) => save.completed[p.id]);
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
          h('span', { class: 'btn-note' }, !dailyOpen ? 'Opens after Chapter I' : dailyDone ? `Done today · ${save.daily.streak} in a row` : save.daily.streak ? `${save.daily.streak} in a row` : '')),
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
    const pieces = ch.sealed ? emblem(60, 1, 3) : emblem(ch.theta, ch.puzzles.length, 4);
    const art = s('svg', { class: 'emblem', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('rect', { class: 'emblem-bg', x: 1, y: 1, width: 98, height: 98, rx: 3 }),
      ...pieces.map((d, i) => s('path', { d, class: i < doneCount ? 'lit' : '' })));
    const dots = h('div', { class: 'levels' },
      ...ch.puzzles.map((p, i) => {
        const done = Boolean(save.completed[p.id]);
        const can = levelOpen(p.id, save.completed);
        return h('button', {
          class: `lvl${done ? ' done' : ''}${can && !done ? ' next' : ''}`,
          disabled: !can, 'aria-label': `Level ${i + 1}${done ? ', complete' : can ? '' : ', locked'}`,
          onclick: () => playLevel(p.id),
        }, h('span', {}, String(i + 1)));
      }));
    list.append(h('section', { class: `chapter${open ? ' open' : ''}${ch.sealed ? ' sealed' : ''}${complete ? ' complete' : ''}` },
      art,
      h('div', { class: 'ch-text' },
        h('p', { class: 'numeral' }, `Chapter ${ch.numeral}`),
        h('h3', {}, ch.title),
        ch.sealed ? h('p', { class: 'sealed-note' }, 'Sealed') : open ? dots : h('p', { class: 'sealed-note' }, 'Opens when the chapter before is whole'))));
  }
  screen('journey', bar('Journey', menu), list);
}

// ---------------------------------------------------------------- endless

function endless() {
  const fourOpen = chapterOpen(CHAPTERS[3], save.completed);
  let kind = 'fill3';
  let band = 2;
  const kinds = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Puzzle' });
  const depth = h('div', { class: 'seg depth', role: 'radiogroup', 'aria-label': 'Depth' });
  const draw = () => {
    clear(kinds);
    for (const k of ENDLESS_KINDS) {
      const locked = k.needs === 'c4' && !fourOpen;
      kinds.append(h('button', {
        role: 'radio', 'aria-checked': String(kind === k.id), class: kind === k.id ? 'on' : '', disabled: locked,
        onclick: () => { kind = k.id; band = Math.min(band, Math.max(...k.bands)); draw(); },
      }, k.label, locked ? h('span', { class: 'btn-note' }, 'After Chapter IV') : null));
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
    const at = c.levelId ? findLevel(c.levelId) : null;
    start(sess, { mode: c.mode, levelId: c.levelId, date: c.date, kind: c.kind, band: c.band, seed: c.seed, theta: c.theta, chapter: at?.chapter });
  } catch {
    save.current = null;
    persist();
    menu();
  }
}

function stopPlay() {
  if (!current) return;
  clearInterval(current.timer);
  current.board.destroy();
  storeCurrent();
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
  const hintLine = h('p', { class: `hint-line${teachText ? ' teach' : ''}`, 'aria-live': 'polite' }, teachText);
  const timerEl = h('span', { class: `timer${save.settings.showTimer ? '' : ' hidden'}`, 'aria-hidden': 'true' }, fmtTime(session.elapsed));
  const doneEl = h('div', { class: 'done hidden', role: 'status' });
  let hintPlan = null;
  let hintTier = 0;

  const board = new BoardView({
    session, theta: ctx.theta ?? 45, settings: save.settings, announce,
    onMove: () => {
      hintPlan = null;
      hintTier = 0;
      paintHint();
      hintLine.textContent = '';
      hintLine.classList.remove('teach');
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
    clear(swapsEl);
    const used = session.moves;
    const total = Math.max(fewest, used);
    for (let i = 0; i < total; i++) swapsEl.append(h('i', { class: i < used ? (i < fewest ? 'used' : 'extra') : '' }));
    swapsEl.setAttribute('aria-label', `${used} swap${used === 1 ? '' : 's'} made. The square can be restored in ${fewest}.`);
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
    hintLine.classList.remove('teach');
    hintLine.textContent = tier.text;
    paintHint();
    storeCurrent();
  }

  function finish() {
    clearInterval(current?.timer);
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
    clear(doneEl);
    doneEl.append(
      h('p', { class: 'done-word' }, chapterDone ? `Chapter ${ctx.chapter.numeral} is whole.` : word),
      ...lines.map((l) => h('p', { class: 'done-line' }, l)),
      h('div', { class: 'done-actions' },
        ctx.mode === 'journey' && next ? h('button', { class: 'btn primary', onclick: () => playLevel(next.id) }, 'Next') : null,
        ctx.mode === 'endless' ? h('button', { class: 'btn primary', onclick: () => playEndless(ctx.kind, ctx.band) }, 'Another') : null,
        h('button', { class: 'btn', onclick: ctx.mode === 'journey' ? journey : menu }, ctx.mode === 'journey' ? 'Journey' : 'Back')));
    setTimeout(() => {
      doneEl.classList.remove('hidden');
      document.body.classList.add('sunlit');
      (doneEl.querySelector('.btn.primary') ?? doneEl.querySelector('.btn'))?.focus({ preventScroll: true });
      announce(`${chapterDone ? `Chapter ${ctx.chapter.numeral} is whole.` : word} ${lines.join(' ')}`);
    }, save.settings.reducedMotion ? 200 : 1500);
  }

  const back = () => (ctx.mode === 'journey' ? journey() : menu());
  const targetBlock = h('div', { class: 'target' },
    h('p', { class: 'inscription' }, inscription),
    h('p', { class: 'target-value', 'aria-label': `Every line totals ${p.target}` }, String(p.target)),
    h('p', { class: 'target-label' }, p.kind === 'restore' ? 'every line, once restored' : 'every line'));

  const el = screen('play',
    h('header', { class: 'bar' },
      h('button', { class: 'icon', 'aria-label': 'Back', onclick: back }, icon.back()),
      timerEl,
      h('button', { class: 'icon', 'aria-label': 'Settings', onclick: openSettings }, icon.gear())),
    targetBlock,
    h('div', { class: 'stage' }, board.el),
    hintLine,
    p.kind === 'restore' ? swapsEl : board.tray,
    h('div', { class: 'actions' }, undoBtn, hintBtn),
    doneEl);
  document.body.classList.remove('sunlit');

  current = { session, board, ctx, timer: null };
  current.timer = setInterval(() => {
    if (document.hidden || session.solved || document.querySelector('dialog[open]')) return;
    session.elapsed += 1000;
    timerEl.textContent = fmtTime(session.elapsed);
    if (session.elapsed % 10000 === 0) storeCurrent();
  }, 1000);
  storeCurrent();
  board.sizeTray();
  el.querySelector('.tile:not(.locked)')?.focus({ preventScroll: true });
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
          if (window.confirm('Erase all progress?')) { save = freshSave(); persist(); applySettings(); dlg.close(); menu(); }
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

applySettings();
menu();
