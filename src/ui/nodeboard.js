// The board for puzzles that are not a square grid: the magic triangle and the
// hidden-rule ring. It is the carved board again (same stone, same frame
// pattern, same stones, same tray, same drag, tap and keyboard play), so it
// extends BoardView and overrides only what a grid assumed: where a node is,
// what it is called, and which markers the frame carries.
//
// A triangle shows one marker per side, in the frame band. A ring shows none:
// its rule is the thing the player has to find, so nothing may name it. The
// ring also brings three finished example rings (`this.extras`).

import { h, s } from './dom.js';
import { BoardView } from './board.js';
import { starOutline } from './pattern.js';
import { layoutFor, SIDE_MARKERS, ringLayout } from '../puzzles/geometry.js';
import { nodeName } from '../puzzles/hints.js';

const SIDE_NAMES = ['right side', 'bottom side', 'left side'];

export class NodeBoardView extends BoardView {
  constructor(opts) {
    super(opts);
    if (this.p.type === 'hidden-rule') this.extras = this.buildExamples();
  }

  layout() {
    const lay = layoutFor(this.p);
    // F stays 12.5: the frame pattern is the 3x3 one, so the whole family of
    // boards shares one carved border.
    return { n: this.p.n, s: lay.size, F: 12.5, points: lay.points, size: lay.size };
  }

  boardLabel() {
    return this.p.type === 'magic-triangle'
      ? 'Triangle board. Nine places. The three sides must make the same total.'
      : 'Ring board. Eight places. Finish the ring by the rule the three example rings follow.';
  }

  nodeName(c) { return nodeName(this.p, c); }
  lineName(id) { return SIDE_NAMES[Number(id.slice(1))]; }
  arcPct(l) { return (l.filled / (l.filled + l.empty)) * 100; }
  trayTileMax() { return (this.el.getBoundingClientRect().width * this.L.size * 0.95) / 100; }

  cellStyle(c) {
    const { points, size } = this.L;
    const q = points[c];
    return `left:${q.x - size / 2}%;top:${q.y - size / 2}%;width:${size}%;height:${size}%`;
  }

  buildFrame() {
    const { F, points, size } = this.L;
    this.drawStone();
    const tri = this.p.type === 'magic-triangle';
    // The shape the stones sit on, drawn fine, under the sockets.
    if (tri) {
      const [a, b, c] = [0, 1, 2].map((i) => points[i]);
      this.svg.append(s('path', { class: 'decor', d: `M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}Z` }));
    } else {
      this.svg.append(s('circle', { class: 'decor', cx: 50, cy: 50, r: 29.5 }));
      this.svg.append(s('path', { class: 'decor hub', d: starOutline(50, 50, 7.5, 0.72) }));
    }
    for (const node of this.p.shape.cells) {
      const q = points[node];
      const pad = size * 0.03;
      this.svg.append(s('rect', {
        class: 'socket', 'data-cell': node,
        x: q.x - size / 2 + pad, y: q.y - size / 2 + pad, width: size - 2 * pad, height: size - 2 * pad, rx: size * 0.1,
      }));
    }
    this.guides = new Map();
    this.markers = new Map();
    const rm = F * 0.4;
    this.p.shape.lines.forEach((L, k) => {
      const [mx, my] = [SIDE_MARKERS[k].x, SIDE_MARKERS[k].y];
      // A dotted guide from the marker to the middle of its side, shown on hover and in hints.
      const mid = L.cells.slice(1, -1).map((c) => points[c]);
      const gx = (mid[0].x + mid[1].x) / 2;
      const gy = (mid[0].y + mid[1].y) / 2;
      const d = Math.hypot(gx - mx, gy - my);
      const line = s('line', { class: 'guide', 'data-line': L.id, x1: gx, y1: gy, x2: mx + ((gx - mx) / d) * rm, y2: my + ((gy - my) / d) * rm });
      this.guides.set(L.id, line);
      this.svg.append(line);
    });
    this.p.shape.lines.forEach((L, k) => {
      const [mx, my] = [SIDE_MARKERS[k].x, SIDE_MARKERS[k].y];
      const ring = s('circle', { class: 'm-arc', cx: mx, cy: my, r: rm * 0.82, pathLength: 100, transform: `rotate(-90 ${mx} ${my})` });
      const broken = s('circle', { class: 'm-broken', cx: mx, cy: my, r: rm * 0.82 });
      const star = s('path', { class: 'm-star', d: starOutline(mx, my, rm * 1.08) });
      const text = s('text', { class: 'm-num', x: mx, y: my + F * 0.012, 'font-size': (F * 0.34).toFixed(2) });
      const marker = s('g', { class: 'marker m-empty', 'data-line': L.id },
        s('circle', { class: 'm-bg', cx: mx, cy: my, r: rm }),
        s('circle', { class: 'm-dot', cx: mx, cy: my, r: 0.7 }),
        star, ring, broken, text);
      this.markers.set(L.id, { g: marker, ring, text });
      this.svg.append(marker);
    });
    this.el.classList.add('nodes', tri ? 'triangle' : 'ring');
  }

  // Arrow keys step through the places in order; the rest is the base board's.
  onSocketKey(e, c) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (step) {
      e.preventDefault();
      const nodes = this.p.shape.cells;
      const next = nodes[(nodes.indexOf(c) + step + nodes.length) % nodes.length];
      this.socketEls.get(next)?.focus();
      return;
    }
    super.onSocketKey(e, c);
  }

  // ---------------------------------------------------------- the examples

  // Three finished rings above the board. Each draws its own chords when the
  // rule is revealed, so the player sees it held in every one.
  buildExamples() {
    const lay = ringLayout(this.p.geometry.n, 33, 23);
    const pairs = this.p.constraints.find((c) => c.id === 'opposites').groups;
    const wrap = h('div', { class: 'examples', role: 'group', 'aria-label': 'Three finished rings that follow the rule' });
    this.p.examples.forEach((vals, i) => {
      const chords = pairs.map(([a, b], k) => s('line', {
        class: 'ex-chord', style: `--i:${k}`,
        x1: lay.points[a].x, y1: lay.points[a].y, x2: lay.points[b].x, y2: lay.points[b].y, pathLength: 1,
      }));
      const art = s('svg', { class: 'ex-svg', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        s('rect', { class: 'ex-bg', x: 0.5, y: 0.5, width: 99, height: 99, rx: 6 }),
        s('circle', { class: 'ex-ring', cx: 50, cy: 50, r: 33 }),
        ...chords);
      const tiles = vals.map((v, n) => h('span', {
        class: 'ex-tile', style: `left:${lay.points[n].x - 11.5}%;top:${lay.points[n].y - 11.5}%`,
      }, h('span', { class: 'ex-num' }, String(v))));
      wrap.append(h('figure', { class: 'ex', 'aria-label': `Example ring ${i + 1}, clockwise from the top: ${vals.join(', ')}` }, art, ...tiles));
    });
    return wrap;
  }

  // ------------------------------------------------------------- the reveal

  resolve() {
    super.resolve();
    this.reveal();
  }

  // The relationships that were there all along draw themselves.
  reveal() {
    const { points } = this.L;
    if (this.p.type === 'hidden-rule') {
      const pairs = this.p.constraints.find((c) => c.id === 'opposites').groups;
      pairs.forEach(([a, b], k) => {
        this.svg.append(s('line', {
          class: 'chord', style: `--i:${k}`, x1: points[a].x, y1: points[a].y, x2: points[b].x, y2: points[b].y, pathLength: 1,
        }));
      });
      this.extras?.classList.add('revealed');
    } else {
      // Each side lights along its length, one after another.
      this.p.shape.lines.forEach((L, k) => {
        const [a, b] = [points[L.cells[0]], points[L.cells.at(-1)]];
        this.svg.append(s('line', { class: 'chord side', style: `--i:${k}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, pathLength: 1 }));
      });
    }
  }
}
