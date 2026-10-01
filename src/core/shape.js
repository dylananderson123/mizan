// Board shapes. A shape says which cells exist and which lines constrain them.
// Nothing here knows about numbers or rules. That lives in constraints.js.
//
// Cells are indexed row-major on an n x n lattice: index = row * n + col.
// A shape may use only some of the lattice (tutorial boards do). Future
// geometries (hexagons, networks) supply their own cells and lines and the
// rest of the engine works unchanged, because everything downstream only
// reads `cells` and `lines[].cells`.

// Line ids:
//   r<k>  row k            c<k>  column k
//   d     main diagonal    a     anti-diagonal
//   p<k>  broken diagonal, down-right, wrapping (panmagic)
//   q<k>  broken diagonal, down-left, wrapping (panmagic)
export function lineCells(n, id) {
  const kind = id[0];
  const k = id.length > 1 ? Number(id.slice(1)) : 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    switch (kind) {
      case 'r': out.push(k * n + i); break;
      case 'c': out.push(i * n + k); break;
      case 'd': out.push(i * n + i); break;
      case 'a': out.push(i * n + (n - 1 - i)); break;
      case 'p': out.push(i * n + ((i + k) % n)); break;
      case 'q': out.push(i * n + (((k - i) % n) + n) % n); break;
      default: throw new Error(`Unknown line id "${id}"`);
    }
  }
  return out;
}

export function standardLineIds(n, { diagonals = true, pandiagonal = false } = {}) {
  const ids = [];
  for (let r = 0; r < n; r++) ids.push('r' + r);
  for (let c = 0; c < n; c++) ids.push('c' + c);
  if (diagonals) ids.push('d', 'a');
  if (pandiagonal) {
    for (let k = 1; k < n; k++) ids.push('p' + k);
    for (let k = 0; k < n - 1; k++) ids.push('q' + k);
  }
  return ids;
}

export function makeShape(n, { cells, lines } = {}) {
  const all = Array.from({ length: n * n }, (_, i) => i);
  const present = cells ? [...cells].sort((a, b) => a - b) : all;
  const presentSet = new Set(present);
  const lineIds = lines ?? standardLineIds(n);
  const lineObjs = lineIds.map((id) => {
    const lc = lineCells(n, id);
    for (const c of lc) {
      if (!presentSet.has(c)) throw new Error(`Line ${id} uses cell ${c}, which is not on the board`);
    }
    return { id, cells: lc };
  });
  return { n, cells: present, lines: lineObjs };
}

const NAMES3 = {
  r: ['top row', 'middle row', 'bottom row'],
  c: ['left column', 'middle column', 'right column'],
};
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

export function describeLine(n, id) {
  const kind = id[0];
  const k = id.length > 1 ? Number(id.slice(1)) : 0;
  if (kind === 'd') return 'diagonal from the top left';
  if (kind === 'a') return 'diagonal from the top right';
  if (kind === 'p' || kind === 'q') return 'wrapped diagonal';
  if (n === 3) return NAMES3[kind][k];
  return `${ORD[k]} ${kind === 'r' ? 'row' : 'column'}`;
}

export function lineKindWord(id) {
  return { r: 'row', c: 'column', d: 'diagonal', a: 'diagonal', p: 'diagonal', q: 'diagonal' }[id[0]];
}
