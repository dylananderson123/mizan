// One puzzle being played, for any geometry that is not the carved square:
// the triangle and the ring. The same shape as Session (tiles, positions,
// move, undo, save) so the same board code can drive either, but the rules
// come from the puzzle kit instead of the square-only engine.

import { evaluate } from '../puzzles/kit.js';
import { levelDefIsValid } from '../puzzles/validate.js';

export const TRAY = 'tray';

export class NodeSession {
  constructor(def, saved = null) {
    levelDefIsValid(def);
    this.def = def;
    // `p` is what the board reads. It is the definition plus the one thing the
    // board wants for every geometry: its lines, as { id, cells }.
    const groups = def.show ? def.constraints.find((c) => c.id === def.show).groups : [];
    this.p = {
      ...def,
      kind: 'fill',
      n: def.nodes.length,
      shape: { n: def.nodes.length, cells: [...def.nodes], lines: groups.map((cells, i) => ({ id: `s${i}`, cells: [...cells] })) },
    };
    this.tiles = [];
    const given = new Set(Object.values(def.givens));
    for (const [c, v] of Object.entries(def.givens)) this.tiles.push({ id: 't' + v, value: v, locked: true, home: +c });
    for (const v of def.stones) if (!given.has(v)) this.tiles.push({ id: 't' + v, value: v, locked: false });
    this.pos = new Map();
    for (const t of this.tiles) this.pos.set(t.id, t.locked ? t.home : TRAY);
    for (const [c, v] of Object.entries(def.initial ?? {})) this.pos.set('t' + v, +c);
    this.history = [];
    this.moves = 0;
    this.tries = 0;
    this.mistakes = 0;
    this.hints = 0;
    this.elapsed = 0;
    this.solved = false;
    if (saved) this.load(saved);
  }

  tile(id) {
    return this.tiles.find((t) => t.id === id);
  }

  tileAt(node) {
    for (const [id, where] of this.pos) if (where === node) return this.tile(id);
    return null;
  }

  trayTiles() {
    return this.tiles.filter((t) => this.pos.get(t.id) === TRAY);
  }

  // Node id -> number, 0 where empty. An array indexed by node id.
  values() {
    const v = new Array(this.def.nodes.length).fill(0);
    for (const t of this.tiles) {
      const where = this.pos.get(t.id);
      if (where !== TRAY) v[where] = t.value;
    }
    return v;
  }

  // The kit's verdict, plus `lines`: one entry per side of the board, in the
  // shape the board's markers read (id, total, filled, empty, status).
  evaluate() {
    const vals = this.values();
    const ev = evaluate(this.def, vals);
    const lines = this.p.shape.lines.map((L) => {
      const placed = L.cells.filter((c) => vals[c]);
      const total = placed.reduce((a, c) => a + vals[c], 0);
      const full = placed.length === L.cells.length;
      let status = 'empty';
      if (placed.length) status = 'partial';
      if (full) {
        const rivals = this.p.shape.lines.filter((M) => M !== L && M.cells.every((c) => vals[c]));
        const clash = rivals.some((M) => M.cells.reduce((a, c) => a + vals[c], 0) !== total);
        status = clash ? 'wrong' : ev.solved ? 'exact' : 'partial';
      }
      return { id: L.id, total, filled: placed.length, empty: L.cells.length - placed.length, status };
    });
    return { ...ev, lines };
  }

  canMove(tileId, dest) {
    const t = this.tile(tileId);
    if (!t || t.locked || this.solved) return false;
    const from = this.pos.get(tileId);
    if (from === dest) return false;
    if (dest === TRAY) return from !== TRAY;
    if (!this.def.nodes.includes(dest)) return false;
    const other = this.tileAt(dest);
    if (other && other.locked) return false;
    return { tile: t, from, dest, other };
  }

  atLimit() {
    return false;
  }

  move(tileId, dest) {
    const m = this.canMove(tileId, dest);
    if (!m) return null;
    const before = this.evaluate();
    this.history.push(new Map(this.pos));
    this.pos.set(tileId, dest);
    if (m.other) this.pos.set(m.other.id, m.from);
    this.moves++;
    this.tries++;
    const after = this.evaluate();
    // A misstep: a full arrangement that does not satisfy the rules, or a
    // side that now clashes with another. Counted quietly.
    const filledBad = after.complete && !after.solved && !(before.complete && !before.solved);
    const clashed = after.lines.some((l, i) => l.status === 'wrong' && before.lines[i].status !== 'wrong');
    if (filledBad || clashed) this.mistakes++;
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
      spec: this.def,
      pos: Object.fromEntries(this.pos),
      moves: this.moves,
      tries: this.tries,
      mistakes: this.mistakes,
      hints: this.hints,
      elapsed: this.elapsed,
      solved: this.solved,
    };
  }

  load(saved) {
    for (const [id, where] of Object.entries(saved.pos ?? {})) {
      const t = this.tile(id);
      if (!t || t.locked) continue;
      if (where === TRAY) { this.pos.set(id, TRAY); continue; }
      const c = Number(where);
      if (!this.def.nodes.includes(c) || this.def.givens[c] !== undefined) throw new Error(`Corrupt save: no place ${where}`);
      this.pos.set(id, c);
    }
    const placed = [...this.pos.values()].filter((w) => w !== TRAY);
    if (new Set(placed).size !== placed.length) throw new Error('Corrupt save: two stones in one place');
    this.moves = saved.moves ?? 0;
    this.tries = Math.max(saved.tries ?? 0, this.moves);
    this.mistakes = saved.mistakes ?? 0;
    this.hints = saved.hints ?? 0;
    this.elapsed = saved.elapsed ?? 0;
    this.solved = this.evaluate().solved;
  }

  static fromJSON(saved) {
    return new NodeSession(saved.spec, saved);
  }
}
