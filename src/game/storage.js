// Save state. One versioned JSON blob in localStorage. The storage object is
// passed in so tests can use a fake one.

export const SAVE_KEY = 'magic-square-game.save';
export const SAVE_VERSION = 1;

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

export function freshSave() {
  return {
    v: SAVE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    completed: {}, // levelId -> { moves, hints, at }
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
  if (!isObj(save) || save.v !== SAVE_VERSION) return freshSave();
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
  if (isObj(save.completed)) for (const [k, v] of Object.entries(save.completed)) if (isObj(v)) completed[k] = v;
  const d = isObj(save.daily) ? save.daily : {};
  const records = {};
  if (isObj(d.records)) for (const [k, v] of Object.entries(d.records)) if (isObj(v)) records[k] = v;
  const daily = {
    streak: Number.isInteger(d.streak) && d.streak >= 0 ? d.streak : 0,
    lastDate: typeof d.lastDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.lastDate) ? d.lastDate : null,
    records,
  };
  const current = isObj(save.current) && isObj(save.current.spec) && isObj(save.current.pos) ? save.current : null;
  return { v: SAVE_VERSION, settings, completed, daily, current };
}
