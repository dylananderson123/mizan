// Magic-square mathematics: constants, classic constructions, symmetries.
// Grids are flat arrays, row-major, length n*n.

export const magicConstant = (n) => (n * (n * n + 1)) / 2;

// The Lo Shu, in its traditional orientation.
export const LO_SHU = Object.freeze([4, 9, 2, 3, 5, 7, 8, 1, 6]);

// Rotate 90 degrees clockwise.
export function rotate(grid, n) {
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) out[c * n + (n - 1 - r)] = grid[r * n + c];
  }
  return out;
}

// Mirror left to right.
export function reflect(grid, n) {
  const out = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) out[r * n + (n - 1 - c)] = grid[r * n + c];
  }
  return out;
}

// The eight symmetries of the square (the dihedral group D4).
export function symmetries(grid, n) {
  const out = [];
  let g = grid.slice();
  for (let i = 0; i < 4; i++) {
    out.push(g, reflect(g, n));
    g = rotate(g, n);
  }
  return out;
}

// Replace every x by n*n + 1 - x. A magic square stays magic.
export function complement(grid, n) {
  const top = n * n + 1;
  return grid.map((v) => top - v);
}

// Smallest of the eight symmetric forms, as a string. Two squares are
// "essentially the same" exactly when their canonical keys match.
export function canonicalKey(grid, n) {
  let best = null;
  for (const g of symmetries(grid, n)) {
    const key = g.join(',');
    if (best === null || compareKeys(g, best.g) < 0) best = { g, key };
  }
  return best.key;
}

function compareKeys(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function lineSums(grid, n, { diagonals = true } = {}) {
  const sums = [];
  for (let r = 0; r < n; r++) {
    let s = 0;
    for (let c = 0; c < n; c++) s += grid[r * n + c];
    sums.push(s);
  }
  for (let c = 0; c < n; c++) {
    let s = 0;
    for (let r = 0; r < n; r++) s += grid[r * n + c];
    sums.push(s);
  }
  if (diagonals) {
    let d = 0;
    let a = 0;
    for (let i = 0; i < n; i++) {
      d += grid[i * n + i];
      a += grid[i * n + (n - 1 - i)];
    }
    sums.push(d, a);
  }
  return sums;
}

// Normal magic: uses 1..n^2 once each, and every row, column and main
// diagonal totals M(n). With diagonals false this checks semimagic.
export function isNormalMagic(grid, n, { diagonals = true } = {}) {
  if (grid.length !== n * n) return false;
  const seen = new Set(grid);
  if (seen.size !== n * n) return false;
  for (let v = 1; v <= n * n; v++) if (!seen.has(v)) return false;
  const M = magicConstant(n);
  return lineSums(grid, n, { diagonals }).every((s) => s === M);
}

// Magic with any distinct numbers (not only 1..n^2): all lines share one total.
export function isMagic(grid, n, { diagonals = true } = {}) {
  if (grid.length !== n * n || new Set(grid).size !== n * n) return false;
  const sums = lineSums(grid, n, { diagonals });
  return sums.every((s) => s === sums[0]);
}

// Lucas's form of every 3x3 magic square: centre c, offsets a and b.
//   c-b    c+a+b  c-a
//   c-a+b  c      c+a-b
//   c+a    c-a-b  c+b
// Every line totals 3c. a = 3, b = 1, c = 5 gives the Lo Shu.
export function lucasSquare(c, a, b) {
  return [c - b, c + a + b, c - a, c - a + b, c, c + a - b, c + a, c - a - b, c + b];
}

// Panmagic: every broken diagonal also totals M(n).
export function isPanmagic(grid, n) {
  if (!isNormalMagic(grid, n)) return false;
  const M = magicConstant(n);
  for (let k = 0; k < n; k++) {
    let p = 0;
    let q = 0;
    for (let i = 0; i < n; i++) {
      p += grid[i * n + ((i + k) % n)];
      q += grid[i * n + (((k - i) % n) + n) % n];
    }
    if (p !== M || q !== M) return false;
  }
  return true;
}

// Associative: every pair of cells symmetric through the centre totals n*n + 1.
export function isAssociative(grid, n) {
  const N = n * n;
  for (let i = 0; i < N; i++) if (grid[i] + grid[N - 1 - i] !== N + 1) return false;
  return true;
}

// De la Loubere's Siamese method, odd n. Start top middle, move up-right,
// drop down one when the target is taken.
export function siamese(n) {
  if (n % 2 === 0) throw new Error('Siamese method needs odd n');
  const g = new Array(n * n).fill(0);
  let r = 0;
  let c = (n - 1) / 2;
  for (let v = 1; v <= n * n; v++) {
    g[r * n + c] = v;
    const nr = (r - 1 + n) % n;
    const nc = (c + 1) % n;
    if (g[nr * n + nc]) r = (r + 1) % n;
    else { r = nr; c = nc; }
  }
  return g;
}

// Doubly even n (multiple of 4): write 1..n^2 in order, then complement the
// cells on the diagonals of each 4x4 block.
export function doublyEven(n) {
  if (n % 4 !== 0) throw new Error('doublyEven needs n divisible by 4');
  const g = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = r * n + c + 1;
      const onDiag = r % 4 === c % 4 || (r % 4) + (c % 4) === 3;
      g[r * n + c] = onDiag ? n * n + 1 - v : v;
    }
  }
  return g;
}

// Singly even n (n = 4k + 2): Strachey's method. Four Siamese quarters,
// then column swaps between the left quarters and between the right ones.
export function strachey(n) {
  if (n % 4 !== 2 || n < 6) throw new Error('strachey needs n = 4k + 2, n >= 6');
  const m = n / 2;
  const base = siamese(m);
  const m2 = m * m;
  const g = new Array(n * n);
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < m; c++) {
      const a = base[r * m + c];
      g[r * n + c] = a; // A, top left
      g[(r + m) * n + (c + m)] = a + m2; // B, bottom right
      g[r * n + (c + m)] = a + 2 * m2; // C, top right
      g[(r + m) * n + c] = a + 3 * m2; // D, bottom left
    }
  }
  const k = (n - 2) / 4;
  const swap = (r, c) => {
    const i = r * n + c;
    const j = (r + m) * n + c;
    [g[i], g[j]] = [g[j], g[i]];
  };
  const mid = (m - 1) / 2;
  for (let r = 0; r < m; r++) {
    for (let j = 0; j < k; j++) swap(r, r === mid ? j + 1 : j);
    for (let c = n - k + 1; c < n; c++) swap(r, c);
  }
  return g;
}

export function construct(n) {
  if (n < 1 || n === 2) throw new Error(`No normal magic square of order ${n}`);
  if (n % 2 === 1) return siamese(n);
  if (n % 4 === 0) return doublyEven(n);
  return strachey(n);
}
