// The reward when a square is finished. The pattern in the board's frame
// carries on across the whole wall, drawn in fine lines, and then its own
// shapes are coloured in, ring by ring, outward from the board. Nothing new
// is added: every colour sits inside a shape the pattern already has (the
// stars in the tiles, and the shapes that gather round each corner). It
// holds, then fades. The stones lift one after another and a breeze of dust
// crosses the screen. A finished level gets a longer hold and more dust.
//
// Rewritten 1 Oct 2026 [Dylan]: the first versions popped hundreds of new
// hexagons and circles onto the wall. He wanted one underlying pattern that
// gets coloured in.

import { h, s } from './dom.js';
import { starOutline, tiling488, hankin, regions, toPath } from './pattern.js';

// The colours the frame's own lines already take when a square is whole:
// rows red, columns blue, the rest orange, in a navy ink.
const INK = '#1d2733';
const FILL = { red: '#b8423a', blue: '#3f7fc0', orange: '#e59a47', green: '#6e9b78', navy: '#2e3f66', cream: '#f1e7cd' };

const poly = (pts) => `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L')}Z`;

export function celebrate(boardEl, { theta = 45, n = 3, big = false, reduced = false } = {}) {
  waveStones(boardEl, reduced);
  const screen = boardEl.closest('.screen');
  if (!screen) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const r = boardEl.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  // The board's frame pattern is built from tiles half a cell wide. Use the
  // same tile here and line the wall's tiles up with the frame's, so the
  // pattern runs straight on from the frame onto the wall.
  const u = Math.max(26, r.width / (2 * (n + 1)));
  const x0 = r.left + u / 2 - Math.ceil((r.left + u / 2) / u) * u - u;
  const y0 = r.top + u / 2 - Math.ceil((r.top + u / 2) / u) * u - u;
  const cols = Math.ceil((W - x0) / u) + 2;
  const rows = Math.ceil((H - y0) / u) + 2;
  const tiles = tiling488(x0, y0, cols, rows, u);

  const reach = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
  const ringW = u * 1.4;
  const rings = new Map(); // ring number -> the fills that belong to it
  const put = (x, y, d, fill) => {
    const k = Math.floor(Math.hypot(x - cx, y - cy) / ringW);
    if (!rings.has(k)) rings.set(k, []);
    rings.get(k).push(s('path', { d, fill, stroke: fill, 'stroke-width': 0.6, 'stroke-linejoin': 'round' }));
  };

  const hubs = new Map(); // a corner of the tiling -> the kites that meet there
  const segs = [];
  for (const t of tiles) {
    if (t.cx < -2 * u || t.cx > W + 2 * u || t.cy < -2 * u || t.cy > H + 2 * u) continue;
    segs.push(...hankin(t, theta));
    const g = regions(t, theta);
    if (!g) continue;
    const i = Math.round((t.cx - x0) / u);
    const j = Math.round((t.cy - y0) / u);
    const parity = (((Math.floor(i) + Math.floor(j)) % 2) + 2) % 2;
    put(t.cx, t.cy, poly(g.star), t.kind === 'oct' ? (parity ? FILL.blue : FILL.red) : FILL.orange);
    for (const k of g.kites) {
      const key = `${k.corner[0].toFixed(1)},${k.corner[1].toFixed(1)}`;
      if (!hubs.has(key)) hubs.set(key, { x: k.corner[0], y: k.corner[1], d: '' });
      hubs.get(key).d += poly(k.pts);
    }
  }
  let hubN = 0;
  for (const hub of hubs.values()) {
    put(hub.x, hub.y, hub.d, hubN++ % 3 === 0 ? FILL.green : FILL.cream);
  }

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, preserveAspectRatio: 'xMidYMid slice' });
  const step = reduced ? 0 : big ? 0.17 : 0.13;
  [...rings.keys()].sort((a, b) => a - b).forEach((k) => {
    const g = s('g', { class: 'ring' }, ...rings.get(k));
    g.style.setProperty('--d', `${(0.35 + k * step).toFixed(2)}s`);
    svg.append(g);
  });
  svg.append(s('path', { class: 'weave', d: toPath(segs), fill: 'none', stroke: INK, 'stroke-width': Math.max(0.8, u * 0.035).toFixed(2), 'stroke-linecap': 'round' }));

  const life = reduced ? 3200 : big ? 8200 : 6000;
  const burst = h('div', { class: `burst${reduced ? ' still' : ''}`, 'aria-hidden': 'true' }, svg);
  burst.style.setProperty('--life', `${life}ms`);
  screen.append(burst);
  const parts = [burst];
  if (!reduced) {
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
    parts.push(breeze);
  }
  setTimeout(() => parts.forEach((p) => p.remove()), life + 200);
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
