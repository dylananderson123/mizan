// Islamic geometric pattern, built the way a craftsman would: Hankin's
// "polygons in contact" method (E. H. Hankin, 1925).
//
// 1. Lay down a tiling. Here: the 4.8.8 tiling, octagons with square gaps.
// 2. From the midpoint of every edge, send two rays into the tile, each at
//    the contact angle theta to the edge.
// 3. Stop each ray where it meets the ray from the neighbouring edge.
// The rays drawn this way give eight-point stars in the octagons and small
// four-point stars in the squares. Changing theta gives a different pattern
// from the same tiling, which is how each chapter gets its own.

const D2R = Math.PI / 180;

export function octagon(cx, cy, u) {
  const R = u / (2 * Math.cos(22.5 * D2R));
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = (22.5 + 45 * k) * D2R;
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return pts;
}

export function diamond(cx, cy, u) {
  const a = u / (1 + Math.SQRT2); // octagon edge length
  const r = a / Math.SQRT2;
  return [[cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]];
}

// The 4.8.8 tiling over a lattice of n x m octagons, unit u, first centre at (x0, y0).
export function tiling488(x0, y0, cols, rows, u) {
  const polys = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = x0 + i * u;
      const cy = y0 + j * u;
      polys.push({ kind: 'oct', cx, cy, pts: octagon(cx, cy, u) });
    }
  }
  for (let j = -1; j < rows; j++) {
    for (let i = -1; i < cols; i++) {
      const cx = x0 + (i + 0.5) * u;
      const cy = y0 + (j + 0.5) * u;
      polys.push({ kind: 'sq', cx, cy, pts: diamond(cx, cy, u) });
    }
  }
  return polys;
}

function intersect(p, r, q, s) {
  const cross = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(cross) < 1e-9) return null;
  const qp = [q[0] - p[0], q[1] - p[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / cross;
  const u = (qp[0] * r[1] - qp[1] * r[0]) / cross;
  if (t <= 0 || u <= 0) return null;
  return [p[0] + t * r[0], p[1] + t * r[1]];
}

// Hankin rays for one polygon. Returns segments [x1, y1, x2, y2].
export function hankin(poly, thetaDeg) {
  const pts = poly.pts;
  const n = pts.length;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const th = thetaDeg * D2R;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let nrm = [-d[1], d[0]];
    if (nrm[0] * (cx - m[0]) + nrm[1] * (cy - m[1]) < 0) nrm = [-nrm[0], -nrm[1]];
    const fwd = [Math.cos(th) * d[0] + Math.sin(th) * nrm[0], Math.cos(th) * d[1] + Math.sin(th) * nrm[1]];
    const back = [-Math.cos(th) * d[0] + Math.sin(th) * nrm[0], -Math.cos(th) * d[1] + Math.sin(th) * nrm[1]];
    edges.push({ m, fwd, back });
  }
  const segs = [];
  for (let i = 0; i < n; i++) {
    const e1 = edges[i];
    const e2 = edges[(i + 1) % n];
    const p = intersect(e1.m, e1.fwd, e2.m, e2.back);
    if (!p) continue;
    segs.push([e1.m[0], e1.m[1], p[0], p[1]], [e2.m[0], e2.m[1], p[0], p[1]]);
  }
  return segs;
}

// The coloured regions of one tile's Hankin pattern. Each tile splits into
// one star (edge midpoints alternating with the ray meeting points) and one
// kite at every corner. Returned as polygons; a kite also names its corner,
// so the kites from the tiles that share a corner can be coloured as one.
export function regions(poly, thetaDeg) {
  const pts = poly.pts;
  const n = pts.length;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n;
  const cy = pts.reduce((a, p) => a + p[1], 0) / n;
  const th = thetaDeg * D2R;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let nrm = [-d[1], d[0]];
    if (nrm[0] * (cx - m[0]) + nrm[1] * (cy - m[1]) < 0) nrm = [-nrm[0], -nrm[1]];
    edges.push({
      m,
      fwd: [Math.cos(th) * d[0] + Math.sin(th) * nrm[0], Math.cos(th) * d[1] + Math.sin(th) * nrm[1]],
      back: [-Math.cos(th) * d[0] + Math.sin(th) * nrm[0], -Math.cos(th) * d[1] + Math.sin(th) * nrm[1]],
    });
  }
  const meet = [];
  for (let i = 0; i < n; i++) meet.push(intersect(edges[i].m, edges[i].fwd, edges[(i + 1) % n].m, edges[(i + 1) % n].back));
  if (meet.some((m) => !m)) return null;
  const star = [];
  const kites = [];
  for (let i = 0; i < n; i++) {
    star.push(edges[i].m, meet[i]);
    kites.push({ corner: pts[(i + 1) % n], pts: [pts[(i + 1) % n], edges[i].m, meet[i], edges[(i + 1) % n].m] });
  }
  return { star, kites };
}

export function toPath(segs) {
  let d = '';
  for (const [a, b, c, e] of segs) d += `M${a.toFixed(2)} ${b.toFixed(2)}L${c.toFixed(2)} ${e.toFixed(2)}`;
  return d;
}

// Board geometry, in a 0..100 viewBox. The frame band is half a cell wide.
export function boardLayout(n) {
  const s = 100 / (n + 1);
  const F = s / 2;
  return { n, s, F, cellX: (c) => F + (c % n) * s, cellY: (c) => F + Math.floor(c / n) * s };
}

// The pattern in the frame, split so each constraint line owns the part of
// the frame where it ends. Rows own the side bands, columns the top and
// bottom, diagonals the corners they run into. The small connectors between
// those parts belong to no line: they appear only when the square is whole.
export function framePattern(n, theta = 67.5) {
  const { s, F } = boardLayout(n);
  const u = F;
  const count = Math.round(100 / u);
  const polys = tiling488(u / 2, u / 2, count, count, u);
  const eps = 0.01;
  const inBand = (v) => v <= F + eps || v >= 100 - F - eps;
  const groups = {};
  const add = (key, segs) => (groups[key] ??= []).push(...segs);

  for (const poly of polys) {
    const { cx, cy } = poly;
    if (!inBand(cx) && !inBand(cy)) continue; // under the grid
    if (cx < -eps || cy < -eps || cx > 100 + eps || cy > 100 + eps) continue;
    const segs = hankin(poly, theta);
    const left = cx <= F + eps;
    const right = cx >= 100 - F - eps;
    const top = cy <= F + eps;
    const bottom = cy >= 100 - F - eps;
    if ((left || right) && (top || bottom)) {
      add((left && top) || (right && bottom) ? 'd' : 'a', segs);
      continue;
    }
    if (left || right) {
      const k = (cy - F) / s;
      if (Math.abs(k - Math.round(k)) < 1e-6) add('final', segs);
      else add('r' + Math.min(n - 1, Math.max(0, Math.floor(k))), segs);
      continue;
    }
    const k = (cx - F) / s;
    if (Math.abs(k - Math.round(k)) < 1e-6) add('final', segs);
    else add('c' + Math.min(n - 1, Math.max(0, Math.floor(k))), segs);
  }
  const out = {};
  for (const [k, segs] of Object.entries(groups)) out[k] = toPath(segs);
  return out;
}

// A square emblem of the pattern, split into `parts` pieces that light up
// one by one (one per finished level). Used on the Journey screen.
export function emblem(theta, parts, cells = 4) {
  const u = 100 / cells;
  const polys = tiling488(u / 2, u / 2, cells, cells, u);
  const pieces = Array.from({ length: Math.max(1, parts) }, () => []);
  // order polygons by distance from the centre, so the emblem grows outward
  const order = polys
    .filter((p) => p.cx >= -1 && p.cy >= -1 && p.cx <= 101 && p.cy <= 101)
    .sort((a, b) => Math.hypot(a.cx - 50, a.cy - 50) - Math.hypot(b.cx - 50, b.cy - 50));
  order.forEach((poly, i) => {
    const k = Math.min(pieces.length - 1, Math.floor((i / order.length) * pieces.length));
    pieces[k].push(...hankin(poly, theta));
  });
  return pieces.map(toPath);
}

// A field of pattern for a background, w x h units of u.
export function field(theta, cols, rows, u = 10) {
  const polys = tiling488(u / 2, u / 2, cols, rows, u);
  return toPath(polys.flatMap((p) => hankin(p, theta)));
}

// The outline of an eight-point star: sixteen points, alternating radius.
// Nothing crosses the middle, so a number can sit inside it.
export function starOutline(cx, cy, r, inner = 0.72) {
  const pts = [];
  for (let k = 0; k < 16; k++) {
    const a = (-90 + k * 22.5) * D2R;
    const rr = k % 2 ? r * inner : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

// An eight-point star {8/3}, lines crossing, for engraved marks.
export function starPath(cx, cy, r) {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = (-90 + k * 135) * D2R;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}
