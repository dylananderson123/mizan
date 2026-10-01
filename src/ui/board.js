// Presentation layer for one puzzle: the carved board, its tiles, the tray.
// Reads a Session, never changes the rules. Drag, tap-tap and keyboard all
// end in the same call: tryMove(tileId, destination).

import { h, s, clear } from './dom.js';
import { boardLayout, framePattern, starPath, starOutline } from './pattern.js';
import { TRAY } from '../game/session.js';
import { sfx, haptic } from './sound.js';
import { describeLine } from '../core/shape.js';
import { cellName } from '../core/hints.js';

const isBroken = (l) => l.status === 'wrong' || l.status === 'strained';

export class BoardView {
  constructor({ session, theta = 45, settings, onMove, onSolved, announce }) {
    this.s = session;
    this.p = session.p;
    this.n = this.p.n;
    this.theta = theta;
    this.settings = settings;
    this.onMove = onMove;
    this.onSolved = onSolved;
    this.announce = announce;
    this.L = boardLayout(this.n);
    this.present = new Set(this.p.shape.cells);
    this.lineIds = this.p.shape.lines.map((l) => l.id);
    this.selected = null;
    this.hint = null;
    this.related = { cells: [], lines: [] };
    this.dragOver = null;
    this.tileEls = new Map();
    this.drag = null;
    this.keyBuffer = '';
    this.build();
    this.render();
  }

  get reduced() {
    return this.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------------------------------------------------------------- build

  build() {
    const { n, s: cs, F } = this.L;
    this.el = h('div', { class: `board n${n}`, role: 'group', 'aria-label': `Magic square board, ${n} by ${n}. Every line must total ${this.p.target}.` });
    if (this.p.kind === 'restore') this.el.classList.add('restore');

    // The carved frame and its pattern.
    const groups = framePattern(n, this.theta);
    const allPattern = Object.values(groups).join('');
    const clipId = `clip-${Math.random().toString(36).slice(2, 8)}`;
    this.svg = s('svg', { class: 'frame', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      s('clipPath', { id: clipId }, s('rect', { x: 0.4, y: 0.4, width: 99.2, height: 99.2, rx: 2.2 })),
      s('rect', { class: 'stone', x: 0.4, y: 0.4, width: 99.2, height: 99.2, rx: 2.2 }),
      s('g', { 'clip-path': `url(#${clipId})` },
        s('path', { class: 'pat-ghost', d: allPattern }),
        ...Object.entries(groups).map(([id, d]) => s('path', { class: 'pat-line', 'data-line': id, d, pathLength: 1 }))),
      s('rect', { class: 'border outer', x: 1.6, y: 1.6, width: 96.8, height: 96.8, rx: 1.6, pathLength: 1 }),
      s('rect', { class: 'panel', x: F - 1, y: F - 1, width: 100 - 2 * F + 2, height: 100 - 2 * F + 2, rx: 1.4 }),
      s('rect', { class: 'border inner', x: F - 1.9, y: F - 1.9, width: 100 - 2 * F + 3.8, height: 100 - 2 * F + 3.8, rx: 1.8, pathLength: 1 }),
    );
    this.svg.prepend(s('defs', {},
      s('linearGradient', { id: 'recess', x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0', style: 'stop-color: var(--recess-top)' }),
        s('stop', { offset: '0.35', style: 'stop-color: var(--recess-mid)' }),
        s('stop', { offset: '1', style: 'stop-color: var(--recess-bottom)' }))));
    for (let c = 0; c < n * n; c++) {
      const x = this.L.cellX(c);
      const y = this.L.cellY(c);
      const pad = cs * 0.045;
      if (this.present.has(c)) {
        this.svg.append(s('rect', {
          class: 'socket', 'data-cell': c,
          x: x + pad, y: y + pad, width: cs - 2 * pad, height: cs - 2 * pad, rx: cs * 0.1,
        }));
      } else {
        // A sealed cell: flush stone, a small star cut into it. Not a place for a tile.
        this.svg.append(s('path', { class: 'sealed', d: starPath(x + cs / 2, y + cs / 2, cs * 0.12) }));
      }
    }
    this.guides = new Map();
    this.markers = new Map();
    const rm = F * 0.4;
    for (const id of this.lineIds) {
      const g = this.guideCoords(id, rm);
      const line = s('line', { class: 'guide', 'data-line': id, x1: g[0], y1: g[1], x2: g[2], y2: g[3] });
      this.guides.set(id, line);
      this.svg.append(line);
    }
    // Diagonal markers sit in the corners, beside column markers. A short
    // cut from the grid's corner says which line they belong to.
    for (const id of this.lineIds.filter((x) => x === 'd' || x === 'a')) {
      const [mx, my] = this.markerPos(id);
      const gx = id === 'd' ? 100 - F + 0.6 : F - 0.6;
      const gy = 100 - F + 0.6;
      const k = rm * 0.78;
      this.svg.append(s('line', { class: 'diag-tick', x1: gx, y1: gy, x2: mx + (id === 'd' ? -k : k) * 0.7071, y2: my - k * 0.7071 }));
    }
    for (const id of this.lineIds) {
      const [mx, my] = this.markerPos(id);
      const ring = s('circle', { class: 'm-arc', cx: mx, cy: my, r: rm * 0.82, pathLength: 100, transform: `rotate(-90 ${mx} ${my})` });
      const broken = s('circle', { class: 'm-broken', cx: mx, cy: my, r: rm * 0.82 });
      const star = s('path', { class: 'm-star', d: starOutline(mx, my, rm * 1.08) });
      const text = s('text', { class: 'm-num', x: mx, y: my + F * 0.012, 'font-size': (F * (this.n > 3 ? 0.31 : 0.34)).toFixed(2) });
      const marker = s('g', { class: 'marker m-empty', 'data-line': id },
        s('circle', { class: 'm-bg', cx: mx, cy: my, r: rm }),
        s('circle', { class: 'm-dot', cx: mx, cy: my, r: 0.7 }),
        star, ring, broken, text);
      this.markers.set(id, { g: marker, ring, text });
      this.svg.append(marker);
    }

    // Sockets for input and screen readers, tiles above them.
    this.socketLayer = h('div', { class: 'sockets' });
    this.socketEls = new Map();
    for (const c of this.p.shape.cells) {
      const b = h('button', { class: 'socket-hit', 'data-cell': c, style: this.cellStyle(c) });
      b.addEventListener('click', () => this.onSocketTap(c));
      b.addEventListener('pointerenter', () => this.setRelated(c));
      b.addEventListener('pointerleave', () => this.setRelated(null));
      b.addEventListener('keydown', (e) => this.onSocketKey(e, c));
      this.socketEls.set(c, b);
      this.socketLayer.append(b);
    }
    this.ghostEl = h('div', { class: 'ghost', 'aria-hidden': 'true' });
    this.tileLayer = h('div', { class: 'tiles' });
    this.dust = h('div', { class: 'dust', 'aria-hidden': 'true' });
    this.el.append(this.svg, this.socketLayer, this.ghostEl, this.tileLayer, this.dust);

    this.tray = h('div', { class: 'tray', role: 'group', 'aria-label': 'Stones to place' });
    this.tray.addEventListener('click', (e) => {
      if (e.target === this.tray && this.selected && this.s.pos.get(this.selected) !== TRAY) this.tryMove(this.selected, TRAY);
    });
    if (this.p.kind === 'restore') this.tray.classList.add('hidden');

    for (const t of this.s.tiles) this.tileEls.set(t.id, this.makeTile(t));

    this.resizeObs = new ResizeObserver(() => this.sizeTray());
    this.resizeObs.observe(this.el);
  }

  destroy() {
    this.resizeObs.disconnect();
    clearTimeout(this.keyTimer);
    clearTimeout(this.resolveTimer);
    for (const t of this.lockTimers ?? []) clearTimeout(t);
    this.destroyed = true;
  }

  cellStyle(c) {
    const { s: cs } = this.L;
    const pad = cs * 0.075;
    return `left:${this.L.cellX(c) + pad}%;top:${this.L.cellY(c) + pad}%;width:${cs - 2 * pad}%;height:${cs - 2 * pad}%`;
  }

  markerPos(id) {
    const { n, s: cs, F } = this.L;
    const k = id.length > 1 ? Number(id.slice(1)) : 0;
    switch (id[0]) {
      case 'r': return [100 - F / 2, F + (k + 0.5) * cs];
      case 'c': return [F + (k + 0.5) * cs, 100 - F / 2];
      case 'd': return [100 - F / 2, 100 - F / 2];
      case 'a': return [F / 2, 100 - F / 2];
      default: return [50, 50 + n];
    }
  }

  guideCoords(id, rm) {
    const { s: cs, F } = this.L;
    const k = id.length > 1 ? Number(id.slice(1)) : 0;
    const inset = cs * 0.18;
    const [mx, my] = this.markerPos(id);
    switch (id[0]) {
      case 'r': { const y = F + (k + 0.5) * cs; return [F + inset, y, mx - rm, y]; }
      case 'c': { const x = F + (k + 0.5) * cs; return [x, F + inset, x, my - rm]; }
      case 'd': return [F + inset, F + inset, mx - rm * 0.72, my - rm * 0.72];
      case 'a': return [100 - F - inset, F + inset, mx + rm * 0.72, my - rm * 0.72];
      default: return [0, 0, 0, 0];
    }
  }

  makeTile(t) {
    const el = h('button', {
      class: `tile${t.locked ? ' locked' : ''}`, 'data-tile': t.id, 'data-value': t.value,
      tabindex: t.locked ? '-1' : '0',
    }, h('span', { class: 'face' }, h('span', { class: 'num' }, String(t.value))));
    if (!t.locked) {
      el.addEventListener('pointerdown', (e) => this.onTileDown(e, t.id));
      el.addEventListener('pointermove', (e) => this.onTileMove(e));
      el.addEventListener('pointerup', (e) => this.onTileUp(e));
      el.addEventListener('pointercancel', () => this.cancelDrag());
      el.addEventListener('keydown', (e) => this.onTileKey(e, t.id));
    } else {
      el.setAttribute('aria-disabled', 'true');
    }
    return el;
  }

  sizeTray() {
    const w = this.el.getBoundingClientRect().width;
    if (!w) return;
    const cellPx = (w * this.L.s * 0.85) / 100;
    const count = this.s.tiles.filter((t) => !t.locked).length;
    const perRow = count > 5 ? Math.ceil(count / 2) : Math.max(count, 1);
    const gap = Math.max(6, w * 0.018);
    const fit = (w - gap * (perRow - 1)) / perRow;
    const size = Math.min(cellPx, fit, 76);
    this.tray.style.setProperty('--tray-tile', `${size}px`);
    this.tray.style.setProperty('--tray-gap', `${gap}px`);
    this.tray.style.minHeight = `${(count > 5 ? 2 : 1) * size + (count > 5 ? gap : 0) + 4}px`;
    this.el.style.setProperty('--board-px', `${w}px`);
  }

  // --------------------------------------------------------------- render

  render() {
    const sess = this.s;
    const trayList = [];
    for (const t of sess.tiles) {
      const el = this.tileEls.get(t.id);
      const where = sess.pos.get(t.id);
      if (where === TRAY) {
        el.removeAttribute('style');
        if (this.drag?.el === el && this.drag.tx) el.style.transform = this.drag.tx;
        el.classList.add('in-tray');
        trayList.push([t.value, el]);
        el.setAttribute('aria-label', `Stone ${t.value}, not placed`);
      } else {
        el.setAttribute('style', this.cellStyle(where));
        el.classList.remove('in-tray');
        if (this.drag?.el === el && this.drag.tx) el.style.transform = this.drag.tx;
        if (el.parentNode !== this.tileLayer) this.tileLayer.append(el);
        el.setAttribute('aria-label', `Stone ${t.value}, ${this.n === 3 ? cellName(3, where) : cellName(this.n, where)}${t.locked ? ', fixed' : ''}`);
      }
      el.classList.toggle('selected', this.selected === t.id);
      if (!t.locked) el.setAttribute('aria-pressed', String(this.selected === t.id));
      const named = this.hint?.tiles?.includes(t.value);
      const pointedAt = where !== TRAY && this.hint?.cells?.includes(where) && !t.locked;
      el.classList.toggle('hinted', Boolean(named || pointedAt));
    }
    // Reorder the tray only when it changed: moving a node in the DOM drops
    // its pointer capture, which would kill a drag in progress.
    const want = trayList.sort((a, b) => a[0] - b[0]).map(([, el]) => el);
    const have = [...this.tray.children];
    if (want.length !== have.length || want.some((el, i) => el !== have[i])) for (const el of want) this.tray.append(el);
    this.tray.classList.toggle('empty', trayList.length === 0);

    const ev = sess.evaluate();
    this.lastEval = ev;
    for (const l of ev.lines) {
      const m = this.markers.get(l.id);
      m.g.setAttribute('class', `marker m-${l.status}`);
      const pct = Math.max(0, Math.min(100, (l.total / this.p.target) * 100));
      m.ring.style.strokeDasharray = `${pct} 100`;
      m.text.textContent = l.filled ? String(l.total) : '';
      const pat = this.svg.querySelector(`.pat-line[data-line="${l.id}"]`);
      if (pat) pat.classList.toggle('lit', l.status === 'exact');
    }
    this.svg.classList.toggle('whole', ev.solved);

    // Sockets: labels and highlight classes.
    const vals = sess.values();
    const hl = new Set([...(this.related.cells || []), ...(this.hint?.cells || [])]);
    for (const [c, b] of this.socketEls) {
      const t = sess.tileAt(c);
      const through = ev.lines.filter((l) => this.p.shape.lines.find((L) => L.id === l.id).cells.includes(c))
        .map((l) => `${describeLine(this.n, l.id)} ${l.total} of ${this.p.target}${l.status === 'exact' ? ', complete' : ''}`);
      b.setAttribute('aria-label', `${cellName(this.n, c)}, ${vals[c] ? `holds ${vals[c]}${t?.locked ? ', fixed' : ''}` : 'empty'}. ${through.join('. ')}.`);
      b.classList.toggle('over', this.dragOver === c);
      b.classList.toggle('hl', hl.has(c));
    }
    for (const r of this.svg.querySelectorAll('rect.socket')) {
      const c = Number(r.dataset.cell);
      r.classList.toggle('over', this.dragOver === c);
      r.classList.toggle('hl', hl.has(c));
    }
    const lines = new Set([...(this.related.lines || []), ...(this.hint?.lines || [])]);
    for (const [id, g] of this.guides) g.classList.toggle('on', lines.has(id));
    for (const [id, m] of this.markers) m.g.classList.toggle('hl', lines.has(id));

    const ghost = this.hint?.ghost;
    if (ghost && !vals[ghost.cell]) {
      this.ghostEl.setAttribute('style', this.cellStyle(ghost.cell));
      this.ghostEl.textContent = String(ghost.value);
      this.ghostEl.classList.add('on');
    } else {
      this.ghostEl.classList.remove('on');
    }
    this.sizeTray();
  }

  setHint(tier) {
    this.hint = tier;
    this.render();
  }

  setRelated(cell) {
    if (this.drag?.moved) return;
    this.related = cell === null || cell === undefined ? { cells: [], lines: [] }
      : { cells: [cell], lines: this.p.shape.lines.filter((L) => L.cells.includes(cell)).map((L) => L.id) };
    this.render();
  }

  // ---------------------------------------------------------------- input

  select(id) {
    this.selected = id;
    if (id) this.announce(`Stone ${this.s.tile(id).value} chosen. Choose a space.`);
    const where = id ? this.s.pos.get(id) : null;
    if (where !== null && where !== undefined && where !== TRAY) this.setRelated(where);
    else this.render();
  }

  onTileDown(e, id) {
    if (this.s.solved || e.button > 0 || this.drag) return;
    e.preventDefault();
    this.app?.unlock();
    const el = this.tileEls.get(id);
    el.setPointerCapture(e.pointerId);
    this.drag = { id, el, x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId, touch: e.pointerType === 'touch' };
    el.classList.add('lifted');
    sfx.pick();
    haptic(8, this.settings.haptics);
  }

  onTileMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      d.el.classList.add('dragging');
      this.selected = null;
    }
    const lift = d.touch ? -22 : 0; // keep the stone visible above a fingertip
    d.tx = `translate(${dx}px, ${dy + lift}px)`;
    d.el.style.transform = d.tx;
    const target = this.dropTargetFor(d.el);
    if (target !== this.dragOver) {
      this.dragOver = target;
      this.related = typeof target === 'number'
        ? { cells: [target], lines: this.p.shape.lines.filter((L) => L.cells.includes(target)).map((L) => L.id) }
        : { cells: [], lines: [] };
      this.render();
      d.el.classList.add('lifted', 'dragging');
    }
  }

  onTileUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    this.drag = null;
    d.el.classList.remove('lifted', 'dragging');
    if (d.moved) {
      const target = this.dropTargetFor(d.el);
      this.dragOver = null;
      this.related = { cells: [], lines: [] };
      if (target !== null && this.tryMove(d.id, target)) return;
      this.snapBack(d.el);
      this.render();
    } else {
      this.onTileTap(d.id);
    }
  }

  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    d.el.classList.remove('lifted', 'dragging');
    this.dragOver = null;
    this.snapBack(d.el);
    this.render();
  }

  snapBack(el) {
    if (this.reduced) { el.style.transform = ''; return; }
    el.classList.add('returning');
    el.style.transform = '';
    setTimeout(() => el.classList.remove('returning'), 300);
  }

  dropTargetFor(el) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let best = null;
    let bestD = Infinity;
    for (const [c, b] of this.socketEls) {
      const sr = b.getBoundingClientRect();
      const cx = sr.left + sr.width / 2;
      const cy = sr.top + sr.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < sr.width * 0.75 && dist < bestD) { best = c; bestD = dist; }
    }
    if (best !== null) return best;
    const tr = this.tray.getBoundingClientRect();
    if (this.p.kind !== 'restore' && y > tr.top - 20 && y < tr.bottom + 40 && x > tr.left - 20 && x < tr.right + 20) return TRAY;
    return null;
  }

  onTileTap(id) {
    const where = this.s.pos.get(id);
    if (this.selected && this.selected !== id && where !== TRAY) {
      if (this.tryMove(this.selected, where)) return;
    }
    if (this.selected === id) {
      if (where !== TRAY && this.p.kind !== 'restore') { this.tryMove(id, TRAY); return; }
      this.select(null);
      return;
    }
    this.select(id);
  }

  onSocketTap(c) {
    if (this.selected) this.tryMove(this.selected, c);
  }

  onTileKey(e, id) {
    if (e.key === 'Escape' && this.selected) {
      this.select(null);
      this.announce('Choice cleared.');
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.app?.unlock();
      this.onTileTap(id);
      if (this.selected === id) {
        const firstEmpty = this.p.shape.cells.find((c) => !this.s.tileAt(c));
        this.socketEls.get(firstEmpty ?? this.p.shape.cells[0])?.focus();
      }
    }
  }

  onSocketKey(e, c) {
    const { n } = this;
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -n, ArrowDown: n }[e.key];
    if (move) {
      e.preventDefault();
      const cells = this.p.shape.cells;
      // Step in that direction, past sealed cells, until a real space or the edge.
      let next = c;
      for (;;) {
        const atEdge = (e.key === 'ArrowLeft' && next % n === 0) || (e.key === 'ArrowRight' && next % n === n - 1);
        next += move;
        if (atEdge || next < 0 || next >= n * n) { next = -1; break; }
        if (cells.includes(next)) break;
      }
      if (next >= 0) this.socketEls.get(next).focus();
      return;
    }
    if (e.key === 'Escape' && this.selected) {
      this.select(null);
      this.announce('Choice cleared.');
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (this.selected) this.tryMove(this.selected, c);
      else {
        const t = this.s.tileAt(c);
        if (t && !t.locked) this.select(t.id);
      }
      return;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && this.p.kind !== 'restore') {
      const t = this.s.tileAt(c);
      if (t && !t.locked) this.tryMove(t.id, TRAY);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      this.keyBuffer += e.key;
      clearTimeout(this.keyTimer);
      const values = this.s.tiles.filter((t) => !t.locked).map((t) => String(t.value));
      const exact = values.includes(this.keyBuffer);
      const longer = values.some((v) => v.startsWith(this.keyBuffer) && v !== this.keyBuffer);
      const act = () => {
        const t = this.s.tiles.find((x) => String(x.value) === this.keyBuffer && !x.locked);
        this.keyBuffer = '';
        if (t && !this.destroyed) this.tryMove(t.id, c);
      };
      if (exact && !longer) act();
      else if (!exact && !longer) this.keyBuffer = '';
      else this.keyTimer = setTimeout(act, 700);
    }
  }

  // ------------------------------------------------------------ the move

  captureRects() {
    const m = new Map();
    for (const [id, el] of this.tileEls) m.set(id, el.getBoundingClientRect());
    return m;
  }

  playFlip(before) {
    if (this.reduced) return;
    for (const [id, el] of this.tileEls) {
      const a = before.get(id);
      if (!a || !a.width) continue;
      const b = el.getBoundingClientRect();
      if (!b.width) continue;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      const sc = a.width / b.width;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sc - 1) < 0.01) continue;
      el.classList.remove('settling');
      el.style.transition = 'none';
      el.style.transformOrigin = '0 0';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sc})`;
      el.getBoundingClientRect();
      el.style.transition = '';
      el.style.transform = '';
      el.classList.add('settling');
      setTimeout(() => el.classList.remove('settling'), 420);
    }
  }

  tryMove(id, dest) {
    const before = this.captureRects();
    const res = this.s.move(id, dest);
    if (!res) return false;
    for (const el of this.tileEls.values()) el.style.transform = '';
    this.selected = null;
    this.hint = null;
    this.related = { cells: [], lines: [] };
    this.render();
    this.playFlip(before);
    sfx.place();
    haptic(12, this.settings.haptics);

    if (document.activeElement === document.body || !document.activeElement) {
      const c = typeof res.dest === 'number' ? res.dest : res.from;
      if (typeof c === 'number') this.socketEls.get(c)?.focus({ preventScroll: true });
    }
    const locked = res.after.lines.filter((l, i) => l.status === 'exact' && res.before.lines[i].status !== 'exact');
    this.lockTimers = locked.map((l, k) => setTimeout(() => {
      sfx.lock(this.lineIds.indexOf(l.id));
      const m = this.markers.get(l.id);
      m.g.classList.add('locking');
      setTimeout(() => m.g.classList.remove('locking'), 900);
    }, 180 + k * 140));
    if (locked.length) haptic([6, 40, 6], this.settings.haptics);
    const broke = res.after.lines.some((l, i) => isBroken(l) && !isBroken(res.before.lines[i]));
    if (broke) setTimeout(() => sfx.strain(), 160);

    this.announce(this.describeMove(res));
    this.onMove?.(res);
    if (this.s.solved) this.resolve();
    return true;
  }

  describeMove(res) {
    const where = res.dest === TRAY ? 'returned to the tray' : `placed in ${cellName(this.n, res.dest)}`;
    const parts = [res.other ? `${res.tile.value} swapped with ${res.other.value}.` : `${res.tile.value} ${where}.`];
    const changed = [res.from, res.dest].filter((x) => typeof x === 'number');
    for (const l of res.after.lines) {
      const L = this.p.shape.lines.find((x) => x.id === l.id);
      if (l.status === 'empty' || !changed.some((c) => L.cells.includes(c))) continue;
      const word = { exact: 'complete', wrong: 'does not make the target', strained: 'cannot reach the target', partial: 'so far', empty: '' }[l.status];
      parts.push(`The ${describeLine(this.n, l.id)} totals ${l.total} of ${this.p.target}, ${word}.`);
    }
    return parts.join(' ');
  }

  // The square is whole. The pattern resolves, the light shifts, dust moves.
  resolve() {
    this.el.classList.add('resolved');
    this.resolveTimer = setTimeout(() => {
      this.svg.classList.add('resolving');
      sfx.complete();
      haptic([10, 60, 30], this.settings.haptics);
      if (!this.reduced) this.raiseDust();
      this.onSolved?.();
    }, this.reduced ? 0 : 420);
  }

  raiseDust() {
    clear(this.dust);
    for (let i = 0; i < 16; i++) {
      const d = h('span');
      d.style.left = `${10 + Math.random() * 80}%`;
      d.style.top = `${20 + Math.random() * 70}%`;
      d.style.animationDelay = `${Math.random() * 0.6}s`;
      d.style.animationDuration = `${2.4 + Math.random() * 1.8}s`;
      d.style.setProperty('--dx', `${(Math.random() - 0.3) * 40}px`);
      this.dust.append(d);
    }
  }
}
