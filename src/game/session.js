// One puzzle being played. Pure state: no DOM, so it can be tested and saved.
//
// Every tile has an id ("t" + value; values are unique within a puzzle) and a
// position: a cell index, or "tray". Locked tiles never move.

import { hydrate, serialize } from '../core/puzzle.js';
import { evaluateBoard } from '../core/constraints.js';

export const TRAY = 'tray';

export class Session {
  constructor(spec, saved = null) {
    this.spec = spec;
    this.p = hydrate(spec);
    this.tiles = [];
    for (const [c, v] of Object.entries(this.p.givens)) this.tiles.push({ id: 't' + v, value: v, locked: true, home: +c });
    for (const v of this.p.pool) this.tiles.push({ id: 't' + v, value: v, locked: false });
    this.pos = new Map();
    for (const t of this.tiles) this.pos.set(t.id, t.locked ? t.home : TRAY);
    if (this.p.kind === 'restore') {
      for (const [c, v] of Object.entries(this.p.start)) this.pos.set('t' + v, +c);
    }
    this.history = [];
    this.moves = 0;
    this.mistakes = 0;
    this.hints = 0;
    this.elapsed = 0;
    this.solved = false;
    if (saved) this.load(saved);
  }

  tile(id) {
    return this.tiles.find((t) => t.id === id);
  }

  tileAt(cell) {
    for (const [id, where] of this.pos) if (where === cell) return this.tile(id);
    return null;
  }

  trayTiles() {
    return this.tiles.filter((t) => this.pos.get(t.id) === TRAY);
  }

  values() {
    const v = new Array(this.p.n * this.p.n).fill(0);
    for (const t of this.tiles) {
      const where = this.pos.get(t.id);
      if (where !== TRAY) v[where] = t.value;
    }
    return v;
  }

  evaluate() {
    return evaluateBoard(this.p, this.values());
  }

  // Can this tile go there? Returns false, or a description of the move.
  canMove(tileId, dest) {
    const t = this.tile(tileId);
    if (!t || t.locked || this.solved) return false;
    const from = this.pos.get(tileId);
    if (from === dest) return false;
    if (dest === TRAY) return this.p.kind !== 'restore' && from !== TRAY;
    if (!this.p.shape.cells.includes(dest)) return false;
    const other = this.tileAt(dest);
    if (other && other.locked) return false;
    if (this.p.kind === 'restore' && !other) return false; // restore is swaps only
    return { tile: t, from, dest, other };
  }

  move(tileId, dest) {
    const m = this.canMove(tileId, dest);
    if (!m) return null;
    const before = this.evaluate();
    this.history.push(new Map(this.pos));
    this.pos.set(tileId, dest);
    if (m.other) this.pos.set(m.other.id, m.from);
    this.moves++;
    const after = this.evaluate();
    // A misstep: a line that could still work now cannot. Counted quietly,
    // only ever shown in the Daily Square summary.
    const brokeNow = after.lines.filter((l, i) => isBroken(l) && !isBroken(before.lines[i]));
    if (brokeNow.length) this.mistakes++;
    this.solved = after.solved;
    return { ...m, before, after };
  }

  undo() {
    if (!this.history.length || this.solved) return false;
    this.pos = this.history.pop();
    this.moves = Math.max(0, this.moves - 1);
    return true;
  }

  toJSON() {
    return {
      spec: serialize(this.p),
      pos: Object.fromEntries(this.pos),
      moves: this.moves,
      mistakes: this.mistakes,
      hints: this.hints,
      elapsed: this.elapsed,
      solved: this.solved,
    };
  }

  load(saved) {
    const restore = this.p.kind === 'restore';
    for (const [id, where] of Object.entries(saved.pos ?? {})) {
      const t = this.tile(id);
      if (!t || t.locked) continue;
      if (where === TRAY) {
        if (restore) throw new Error('Corrupt save: a restore stone in the tray');
        this.pos.set(id, TRAY);
        continue;
      }
      const c = Number(where);
      if (!this.p.shape.cells.includes(c) || this.p.givens[c] !== undefined) throw new Error(`Corrupt save: no space ${where}`);
      this.pos.set(id, c);
    }
    // Two tiles in one cell means a corrupt save. Fall back to the start.
    const placed = [...this.pos.values()].filter((w) => w !== TRAY);
    if (new Set(placed).size !== placed.length) throw new Error('Corrupt save: two tiles in one cell');
    this.moves = saved.moves ?? 0;
    this.mistakes = saved.mistakes ?? 0;
    this.hints = saved.hints ?? 0;
    this.elapsed = saved.elapsed ?? 0;
    this.solved = this.evaluate().solved;
  }

  static fromJSON(saved) {
    return new Session(saved.spec, saved);
  }
}

const isBroken = (l) => l.status === 'wrong' || l.status === 'strained';
