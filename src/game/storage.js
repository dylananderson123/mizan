// Save state. One versioned JSON blob in localStorage. The storage object is
// passed in so tests can use a fake one.

import { STONE_SETS } from './economy.js';

export const SAVE_KEY = 'mizan.save';
export const SAVE_VERSION = 2;

export const DEFAULT_SETTINGS = {
  sound: true,
  ambience: true,
  haptics: true,
  reducedMotion: false,
  highContrast: false,
  textScale: 1,
  leftHanded: false,
  showTimer: false,
};

// The coin ledger. `coins` is the balance. `claimed` holds every reward key
// already paid, so a reward is only ever paid once per key. `log` is the last
// stretch of earnings and spendings, newest last. Spending is not used by any
// screen yet; the wallet is built to take it (see economy.js).
export function freshWallet() {
  return { coins: 0, claimed: {}, log: [] };
}

export function freshSave() {
  return {
    v: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    completed: {}, // puzzleId -> { moves, hints, at }: the first finish
    unlocked: ['l1'], // level ids that are open. A level never locks again
    best: {}, // puzzleId -> { moves, hints, time }: the best finish so far
    wallet: freshWallet(),
    owned: ['ivory'], // stone sets bought with coins (economy.js)
    stones: 'ivory', // the set in use
    daily: { streak: 0, lastDate: null, records: {} },
    current: null, // a Session.toJSON() plus { mode, levelId?, date?, seed? }
  };
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    return migrate(JSON.parse(raw));
  } catch {
    return freshSave();
  }
}

export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false; // private mode or full storage: play on, unsaved
  }
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const TEXT_SCALES = [1, 1.15, 1.3];

// Every field is checked by type. Anything wrong falls back to its default,
// so one bad value never blanks the game.
export function migrate(save) {
  if (!isObj(save)) return freshSave();
  // A version 1 save (nine levels of 3x3 puzzles) keeps its settings and its
  // Daily Square record. Its level progress belonged to puzzles that no
  // longer exist, so it starts again.
  const fromV1 = save.v === 1;
  if (save.v !== SAVE_VERSION && !fromV1) return freshSave();
  const base = freshSave();
  const settings = { ...base.settings };
  if (isObj(save.settings)) {
    for (const [k, def] of Object.entries(base.settings)) {
      const v = save.settings[k];
      if (k === 'textScale') settings[k] = TEXT_SCALES.includes(v) ? v : def;
      else settings[k] = typeof v === 'boolean' ? v : def;
    }
  }
  const completed = {};
  if (!fromV1 && isObj(save.completed)) for (const [k, v] of Object.entries(save.completed)) if (isObj(v)) completed[k] = v;
  const d = isObj(save.daily) ? save.daily : {};
  const records = {};
  if (isObj(d.records)) for (const [k, v] of Object.entries(d.records)) if (isObj(v)) records[k] = v;
  const daily = {
    streak: Number.isInteger(d.streak) && d.streak >= 0 ? d.streak : 0,
    lastDate: typeof d.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.lastDate) ? d.lastDate : null,
    records,
  };
  const current = !fromV1 && isObj(save.current) && isObj(save.current.spec) && isObj(save.current.pos) ? save.current : null;
  const wallet = cleanWallet(save, fromV1);
  const known = new Set(STONE_SETS.map((x) => x.id));
  const owned = new Set(['ivory']);
  if (!fromV1 && Array.isArray(save.owned)) for (const id of save.owned) if (known.has(id)) owned.add(id);
  const stones = owned.has(save.stones) ? save.stones : 'ivory';
  return { v: SAVE_VERSION, settings, completed, unlocked: cleanUnlocked(save, fromV1), best: cleanBest(save, fromV1), wallet, owned: [...owned], stones, daily, current };
}

// Safe integers only: a coin count that JavaScript cannot add to is a damaged save.
const isCount = (x) => Number.isSafeInteger(x) && x >= 0;

function cleanUnlocked(save, fromV1) {
  const ids = new Set(['l1']); // the first level is always open
  if (!fromV1 && Array.isArray(save.unlocked)) for (const id of save.unlocked) if (typeof id === 'string' && /^l\d+$/.test(id)) ids.add(id);
  return [...ids];
}

function cleanBest(save, fromV1) {
  const out = {};
  if (fromV1 || !isObj(save.best)) return out;
  for (const [k, v] of Object.entries(save.best)) {
    if (isObj(v) && isCount(v.moves) && isCount(v.hints) && isCount(v.time)) out[k] = { moves: v.moves, hints: v.hints, time: v.time };
  }
  return out;
}

function cleanWallet(save, fromV1) {
  const w = freshWallet();
  if (fromV1 || !isObj(save.wallet)) return w;
  if (isCount(save.wallet.coins)) w.coins = save.wallet.coins;
  if (isObj(save.wallet.claimed)) for (const [k, v] of Object.entries(save.wallet.claimed)) if (typeof v === 'number') w.claimed[k] = v;
  if (Array.isArray(save.wallet.log)) {
    for (const e of save.wallet.log.slice(-200)) {
      if (isObj(e) && typeof e.key === 'string' && Number.isInteger(e.delta) && typeof e.at === 'number') w.log.push({ key: e.key, delta: e.delta, at: e.at });
    }
  }
  return w;
}
