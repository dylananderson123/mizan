// The reward when a square is finished. It stays inside the game's own
// language: the frame pattern spreads out across the whole wall from the
// board as a travelling band of brass light, the stones lift one after
// another like a breath, and a light breeze of dust crosses the screen.
// A finished level gets a second, indigo band and a longer breeze.

import { h, s } from './dom.js';
import { field, starOutline } from './pattern.js';

export function celebrate(boardEl, { theta = 45, big = false, reduced = false } = {}) {
  waveStones(boardEl, reduced);
  if (reduced) return;
  const r = boardEl.getBoundingClientRect();
  const cx = `${r.left + r.width / 2}px`;
  const cy = `${r.top + r.height / 2}px`;
  const rings = big ? ['brass', 'indigo'] : ['brass'];
  const layers = rings.map((tone, i) => {
    const el = h('div', { class: `bloom ${tone}`, 'aria-hidden': 'true' },
      s('svg', { viewBox: '0 0 120 120', preserveAspectRatio: 'xMidYMid slice' }, s('path', { d: field(theta, 12, 12, 10) })));
    // custom properties need setProperty; Object.assign on style drops them
    el.style.setProperty('--cx', cx);
    el.style.setProperty('--cy', cy);
    el.style.animationDelay = `${i * 0.7}s`;
    document.body.append(el);
    return el;
  });
  const breeze = h('div', { class: 'breeze', 'aria-hidden': 'true' });
  const count = big ? 40 : 22;
  for (let i = 0; i < count; i++) {
    const d = h('span');
    d.style.top = `${8 + Math.random() * 84}%`;
    d.style.left = `${-10 + Math.random() * 40}%`;
    d.style.animationDelay = `${0.3 + Math.random() * (big ? 1.6 : 0.9)}s`;
    d.style.animationDuration = `${3 + Math.random() * 2.4}s`;
    d.style.setProperty('--rise', `${-20 - Math.random() * 60}px`);
    d.style.setProperty('--size', `${2 + Math.random() * 2.5}px`);
    breeze.append(d);
  }
  document.body.append(breeze);
  const life = big ? 7000 : 5200;
  setTimeout(() => { layers.forEach((l) => l.remove()); breeze.remove(); }, life);
}

// The stones lift one after another along the diagonal, then settle.
function waveStones(boardEl, reduced) {
  if (reduced) return;
  const tiles = [...boardEl.querySelectorAll('.tiles .tile')];
  if (!tiles.length) return;
  const rects = tiles.map((t) => t.getBoundingClientRect());
  const min = Math.min(...rects.map((r) => r.left + r.top));
  tiles.forEach((t, i) => {
    t.style.setProperty('--wave-delay', `${((rects[i].left + rects[i].top - min) / 900).toFixed(3)}s`);
    t.classList.remove('wave');
    void t.offsetWidth; // restart the animation
    t.classList.add('wave');
  });
}

// A small eight-point star that draws itself above the finishing word.
export function sealStar() {
  return s('svg', { class: 'seal', viewBox: '0 0 40 40', 'aria-hidden': 'true' },
    s('path', { class: 'seal-outer', d: starOutline(20, 20, 17, 0.72), pathLength: 1 }),
    s('path', { class: 'seal-inner', d: starOutline(20, 20, 9, 0.72), pathLength: 1 }));
}
