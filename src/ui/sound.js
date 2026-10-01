// Sound, made in code with Web Audio. No sample files, so nothing to load
// and nothing borrowed. Quiet on purpose: stone, wood, a low resonance.

let ctx = null;
let master = null;
let windGain = null;
let settings = { sound: true, ambience: true };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

// Browsers only allow audio after a gesture. Call this from one.
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
  syncAmbience();
}

// Silence while the page is out of sight (another tab, a locked phone), and
// back when it returns. Without this the wind plays on in a hidden tab.
export function setAudioHidden(hidden) {
  if (!ctx) return;
  if (hidden) { if (ctx.state === 'running') ctx.suspend(); } else if (ctx.state === 'suspended') ctx.resume();
}

export function configureSound(s) {
  settings = { ...settings, ...s };
  syncAmbience();
}

function noiseBuffer(seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  return buf;
}

function burst({ freq, q = 1, dur = 0.05, gain = 0.1, type = 'bandpass', delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.02);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function tone(freq, { dur = 1, gain = 0.05, attack = 0.005, type = 'sine', delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// D, E-flat, F-sharp, G, A: a hijaz colour, kept very soft.
const LOCK_NOTES = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 554.37, 587.33];

// seconds between one start-button tap and the next
export const TAP_GAP = 0.25;

export const sfx = {
  pick() {
    if (!settings.sound || !ensure()) return;
    burst({ freq: 2400, q: 2.5, dur: 0.03, gain: 0.07 });
  },
  place() {
    if (!settings.sound || !ensure()) return;
    tone(150, { dur: 0.09, gain: 0.12 });
    burst({ freq: 900, q: 1.2, dur: 0.06, gain: 0.08 });
  },
  lock(i = 0) {
    if (!settings.sound || !ensure()) return;
    const f = LOCK_NOTES[i % LOCK_NOTES.length];
    tone(f, { dur: 1.4, gain: 0.035, attack: 0.01 });
    tone(f * 2.76, { dur: 0.5, gain: 0.008, attack: 0.005 }); // a small inharmonic shimmer, like brass
  },
  // The start buttons arrive on a rising bell fanfare, D major: D4, A4, D5 and
  // F#5, one strike per button, 0.25 s apart (the buttons come in on the same
  // beat, `.op-nav` in the CSS). Each strike is a struck bell: a fundamental
  // with inharmonic partials (about 2, 2.76, 4.1 and 5.4 times it) that die
  // away at different speeds, and a short metallic click on the hit. The last
  // strike is the grandest: a low gong underneath and a long ring, so it reads
  // as "we are beginning". Changed 2 Oct 2026 `[Dylan]`: the old version was
  // four thin 0.3 s sine taps.
  menu(count = 3) {
    if (!settings.sound || !ensure()) return;
    // Without a tap or key press the browser keeps sound shut; stay silent
    // then, rather than let the strikes fire late on the first click.
    if (ctx.state !== 'running' && !navigator.userActivation?.hasBeenActive) return;
    if (ctx.state !== 'running') { ctx.resume().then(() => sfx.menu(count)).catch(() => {}); return; }
    const NOTES = [293.66, 440.0, 587.33, 739.99];
    const PARTIALS = [[1, 1, 3.2], [2.0, 0.55, 2.2], [2.76, 0.38, 1.5], [4.1, 0.2, 0.9], [5.4, 0.12, 0.6]];
    const strike = (f, t, level, ring) => {
      for (const [ratio, amp, life] of PARTIALS) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f * ratio, t);
        const g = ctx.createGain();
        const d = life * ring;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level * amp, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + d + 0.05);
      }
      burst({ freq: 3200, q: 1.4, dur: 0.06, gain: level * 0.5, delay: t - ctx.currentTime });
    };
    const notes = NOTES.slice(0, count);
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      strike(f, ctx.currentTime + i * TAP_GAP, last ? 0.16 : 0.12, last ? 1.5 : 0.7);
    });
    // the gong under the last strike: a low D with a fifth above it, slow to fade
    const tg = ctx.currentTime + (notes.length - 1) * TAP_GAP;
    strike(73.42, tg, 0.2, 2.4);
    strike(110.0, tg, 0.1, 2.0);
  },
  // A coin lands in the counter: a small brass tick, a touch higher each time.
  coin(i = 0) {
    if (!settings.sound || !ensure()) return;
    const f = 880 * 1.122 ** (i % 5);
    tone(f, { dur: 0.35, gain: 0.04, attack: 0.002, type: 'triangle' });
    tone(f * 2.76, { dur: 0.12, gain: 0.01, attack: 0.002 });
    burst({ freq: 3000, q: 2, dur: 0.02, gain: 0.03 });
  },
  // The coin appears over the finished puzzle: one soft low tap.
  reward() {
    if (!settings.sound || !ensure()) return;
    tone(587.33, { dur: 0.9, gain: 0.035, attack: 0.004, type: 'triangle' });
    tone(1174.66, { dur: 0.4, gain: 0.012, attack: 0.004 });
  },
  strain() {
    if (!settings.sound || !ensure()) return;
    tone(110, { dur: 0.12, gain: 0.05, type: 'triangle' });
  },
  complete() {
    if (!settings.sound || !ensure()) return;
    burst({ freq: 3200, q: 4, dur: 0.025, gain: 0.09 }); // the click
    tone(73.42, { dur: 4.2, gain: 0.09, attack: 0.04, delay: 0.05 });
    tone(110.0, { dur: 3.6, gain: 0.05, attack: 0.06, delay: 0.08 });
    tone(146.83, { dur: 3.2, gain: 0.035, attack: 0.08, delay: 0.1 });
    tone(220.0, { dur: 2.4, gain: 0.012, attack: 0.1, delay: 0.12 });
    // the breath of air: a swell of wind that opens upward
    breath({ delay: 0.15, dur: 2.4, from: 380, to: 1900, gain: 0.05 });
    // and a plucked phrase rising through the hijaz set on D
    [293.66, 369.99, 440.0, 587.33].forEach((f, i) => pluck(f, { delay: 0.35 + i * 0.13, gain: 0.05 - i * 0.006 }));
  },
  // A whole level: the same, then a reed-flute line, then a fuller chord.
  level() {
    if (!settings.sound || !ensure()) return;
    const line = [[440.0, 0.5], [392.0, 0.35], [369.99, 0.35], [392.0, 0.5], [293.66, 1.6]];
    let t = 1.3;
    for (const [f, d] of line) { ney(f, { delay: t, dur: d + 0.25 }); t += d; }
    tone(73.42, { dur: 4.5, gain: 0.07, attack: 0.3, delay: t - 1.2 });
    tone(146.83, { dur: 4, gain: 0.03, attack: 0.4, delay: t - 1.1 });
    tone(220.0, { dur: 3.6, gain: 0.018, attack: 0.5, delay: t - 1 });
  },
};

// A plucked string: a bright attack that dulls as it rings. Upper partials
// die faster than the fundamental, which is what makes it read as a string.
function pluck(freq, { delay = 0, gain = 0.05 } = {}) {
  tone(freq, { dur: 1.6, gain, attack: 0.003, type: 'triangle', delay });
  tone(freq * 2, { dur: 0.6, gain: gain * 0.35, attack: 0.003, delay });
  tone(freq * 3.01, { dur: 0.25, gain: gain * 0.18, attack: 0.002, delay });
}

// A reed flute: a breathy sine with a slow vibrato and a little noise.
function ney(freq, { delay = 0, dur = 0.8, gain = 0.03 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vg = ctx.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(freq * 0.008, t + dur * 0.6);
  vib.connect(vg).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.12);
  g.gain.setValueAtTime(gain, t + Math.max(0.13, dur - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.1);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq * 2; f.Q.value = 6;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(gain * 0.5, t + 0.08);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(ng).connect(master);
  for (const n of [o, vib, src]) { n.start(t); n.stop(t + dur + 0.1); }
}

// Moving air: filtered noise whose band sweeps from `from` to `to`.
function breath({ delay = 0, dur = 2, from = 400, to = 1600, gain = 0.04 } = {}) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.1, true);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// The sound under a scenic interlude. Water for the coast, wind for inland,
// a low drone on D under both. Returns a function that fades it out.
const WATER = new Set(['sea', 'dhow', 'zanzibar']);
export function sceneAmbience(id) {
  if (!settings.sound || !ensure()) return () => {};
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 1.2);
  out.connect(master);
  const nodes = [];
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(8, true);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lg = ctx.createGain();
  if (WATER.has(id)) {
    // swells: brown noise, lowpassed, its level rising and falling like waves
    f.type = 'lowpass'; f.frequency.value = 650;
    g.gain.value = 0.05;
    lfo.frequency.value = 0.13; lg.gain.value = 0.04;
  } else {
    f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.7;
    g.gain.value = 0.035;
    lfo.frequency.value = 0.09; lg.gain.value = 0.025;
  }
  lfo.connect(lg).connect(g.gain);
  src.connect(f).connect(g).connect(out);
  nodes.push(src, lfo);
  for (const [freq, gain] of [[73.42, 0.03], [110.0, 0.014], [146.83, 0.008]]) {
    const o = ctx.createOscillator();
    o.frequency.value = freq;
    const og = ctx.createGain();
    og.gain.value = gain;
    o.connect(og).connect(out);
    nodes.push(o);
  }
  for (const n of nodes) n.start(t);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value || 0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    for (const n of nodes) n.stop(now + 1);
  };
}

let windSrc = null;
function syncAmbience() {
  if (!ctx) return;
  const want = settings.ambience;
  if (want && !windSrc) {
    windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer(6, true);
    windSrc.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    windGain = ctx.createGain();
    windGain.gain.value = 0.0001;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain).connect(windGain.gain);
    windSrc.connect(f).connect(windGain).connect(master);
    windSrc.start();
    lfo.start();
    windGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 3);
  } else if (!want && windSrc) {
    const src = windSrc;
    windGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    setTimeout(() => src.stop(), 900);
    windSrc = null;
  }
}

export function haptic(pattern, enabled) {
  if (enabled && navigator.vibrate) navigator.vibrate(pattern);
}
