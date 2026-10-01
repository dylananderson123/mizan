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

function burst({ freq, q = 1, dur = 0.05, gain = 0.1, type = 'bandpass' }) {
  const t = ctx.currentTime;
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
  },
};

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
