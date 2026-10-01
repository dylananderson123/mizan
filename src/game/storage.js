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

export function migrate(save) {
  if (!save || typeof save !== 'object' || save.v !== SAVE_VERSION) return freshSave();
  const base = freshSave();
  return {
    ...base,
    ...save,
    settings: { ...base.settings, ...save.settings },
    daily: { ...base.daily, ...save.daily },
    completed: { ...save.completed },
  };
}
