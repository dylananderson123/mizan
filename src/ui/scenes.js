// Short procedural film shots for the gaps between levels.
// Each shot is a printed travel plate brought to life: flat layered
// silhouettes, stepped bands of colour, fine hatching, faint grain and slow
// parallax. Static layers are drawn once per size into offscreen canvases;
// only the things that move are drawn every frame. No images, no network.

export const SCENES = [
  { id: 'nizwa', caption: 'Nizwa', sub: 'The fort at dusk' },
  { id: 'sea', caption: 'The Sea of Oman', sub: 'First light' },
  { id: 'dhow', caption: 'A dhow', sub: 'Under sail' },
  { id: 'zanzibar', caption: 'Stone Town', sub: 'Zanzibar' },
  { id: 'sands', caption: 'Wahiba Sands', sub: 'Night' },
  { id: 'jebel', caption: 'Jebel Shams', sub: 'The canyon' },
];

const C = {
  limestone: '#e6dcc8', bone: '#ece3d1', chalk: '#f4efe4', sand: '#cdb995', sandDeep: '#b9a27b',
  ochre: '#a9813f', umber: '#5b4733', timber: '#3a291d', brass: '#8c6b2f', brassLight: '#b99652',
  indigo: '#34406b', ink: '#26253a', turquoise: '#5f8f8b', terracotta: '#8f452b',
};

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const u = clamp((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  t = clamp(t);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function rgba(h, a) { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; }
function ramp(stops, t) {
  const n = stops.length - 1, x = clamp(t) * n, i = Math.min(n - 1, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

// Seeded random (FNV-1a seed, mulberry32 stream): same scene, same picture.
function makeRng(str) {
  let a = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { a ^= str.charCodeAt(i); a = Math.imul(a, 0x01000193); }
  a >>>= 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1D value noise and fractal sums of it, for ridgelines.
function noise(r, n = 64) {
  const v = Array.from({ length: n + 1 }, r);
  v[n] = v[0];
  return (x) => {
    x = ((x % n) + n) % n;
    const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    return v[i] + (v[i + 1] - v[i]) * s;
  };
}
function fbm(r, oct = 4, rough = 0.5, ridged = false) {
  const ns = Array.from({ length: oct }, () => noise(r));
  return (x) => {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (const n of ns) {
      let v = n(x * f);
      if (ridged) v = 1 - Math.abs(2 * v - 1);
      sum += amp * v; norm += amp; amp *= rough; f *= 2.07;
    }
    return sum / norm;
  };
}

// ---------- drawing helpers ----------

// Stepped colour bands, never a smooth web gradient.
function bands(g, x, y, w, h, stops, n, curve = 1, seam = 0) {
  for (let i = 0; i < n; i++) {
    const y0 = y + h * Math.pow(i / n, curve), y1 = y + h * Math.pow((i + 1) / n, curve);
    g.fillStyle = ramp(stops, i / (n - 1));
    g.fillRect(x, Math.floor(y0), w, Math.ceil(y1 - Math.floor(y0)) + 1);
    if (seam && i) { g.fillStyle = rgba(C.chalk, seam); g.fillRect(x, Math.floor(y0), w, 0.6); }
  }
}

function hatchRect(g, x0, y0, x1, y1, gap, ang, col, lw) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  g.beginPath();
  for (let o = -R; o <= R; o += gap) {
    const px = cx - dy * o, py = cy + dx * o;
    g.moveTo(px - dx * R, py - dy * R); g.lineTo(px + dx * R, py + dy * R);
  }
  g.strokeStyle = col; g.lineWidth = lw; g.stroke();
}

// Closed shape between a curve y = fn(x) and a horizontal edge.
function curvePath(x0, x1, fn, edge, step = 2) {
  const p = new Path2D();
  p.moveTo(x0, edge);
  for (let x = x0; x < x1; x += step) p.lineTo(x, fn(x));
  p.lineTo(x1, fn(x1)); p.lineTo(x1, edge); p.closePath();
  return p;
}
function strokeCurve(g, x0, x1, fn, step = 2) {
  g.beginPath(); g.moveTo(x0, fn(x0));
  for (let x = x0 + step; x < x1; x += step) g.lineTo(x, fn(x));
  g.lineTo(x1, fn(x1)); g.stroke();
}

// A mountain mass lit from the left: the shade colour fills the body, and a
// lit sliver sits wherever the ground rises to the right.
function massif(g, S, fn, lit, shade, d, e, hatchCol) {
  const x0 = -S.mx, x1 = S.W + S.mx, bottom = S.H + S.my;
  const body = curvePath(x0, x1, fn, bottom);
  g.fillStyle = shade; g.fill(body);
  g.save(); g.clip(body);
  g.fillStyle = lit; g.fill(curvePath(x0, x1, (x) => fn(x - d) + e, -S.my - 4));
  if (hatchCol) hatchRect(g, x0, 0, x1, bottom, 3.2, -0.9, hatchCol, 0.5);
  g.restore();
  return body;
}

// A flat-bottomed cloud bank, printed in two tones.
function cloud(g, r, x, y, w, k, top, under) {
  const p = new Path2D(), n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, rr = (w / n) * (0.7 + 0.6 * r()) * (1.15 - Math.abs(u - 0.5) * 1.2);
    p.moveTo(x + w * u + rr, y);
    p.ellipse(x + w * u, y, rr, rr * k, 0, 0, Math.PI, true);
    p.closePath();
  }
  g.fillStyle = top; g.fill(p);
  g.save(); g.clip(p);
  g.fillStyle = under; g.fillRect(x - w, y - w * k * 0.09, w * 3, w);
  g.restore();
}

function qpt(a, c, b, u) {
  const v = 1 - u;
  return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]];
}

// Palms keep their frond layout fixed; only the sway changes per frame.
function makePalm(r, x, y, h, kind, len, color, lean = 0) {
  const date = kind === 'date', n = date ? 15 : 12;
  const fronds = Array.from({ length: n }, (_, i) => ({
    a: -Math.PI / 2 + (i / (n - 1) - 0.5) * (date ? 3.5 : 3.9) + (r() - 0.5) * 0.3,
    l: len * (0.72 + 0.38 * r()), ph: r() * TAU,
  }));
  const top = [x + lean * h, y - h], base = [x, y];
  const ctl = [x + lean * h * (date ? 0.4 : 0.05) + (r() - 0.5) * h * 0.06, y - h * 0.5];
  const w0 = h * (date ? 0.05 : 0.035) + 1, w1 = w0 * 0.68, droop = date ? 0.22 : 0.62;
  return {
    top,
    draw(g, t, sway = 1) {
      g.fillStyle = color; g.strokeStyle = color;
      // trunk as a tapered strip along a curve
      const L = [], Rt = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12, p = qpt(base, ctl, top, u), q = qpt(base, ctl, top, Math.min(1, u + 0.01));
        const dx = q[0] - p[0], dy = q[1] - p[1], m = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * u) / 2;
        L.push([p[0] - (dy / m) * w, p[1] + (dx / m) * w]); Rt.push([p[0] + (dy / m) * w, p[1] - (dx / m) * w]);
      }
      g.beginPath(); g.moveTo(...L[0]);
      L.forEach((p) => g.lineTo(...p)); Rt.reverse().forEach((p) => g.lineTo(...p));
      g.fill();
      g.beginPath();
      for (let i = 1; i < 12; i++) { g.moveTo(...L[i]); g.lineTo(...Rt[11 - i]); }
      g.strokeStyle = rgba(C.chalk, 0.12); g.lineWidth = 0.6; g.stroke();
      g.strokeStyle = color;
      const leaf = new Path2D(), rach = new Path2D();
      for (const f of fronds) {
        const a = f.a + sway * (0.04 * Math.sin(t * 0.9 + f.ph) + 0.025 * Math.sin(t * 0.37 + x * 0.01));
        const dx = Math.cos(a), dy = Math.sin(a), up = Math.abs(dy);
        const c = [top[0] + dx * f.l * 0.55, top[1] + dy * f.l * 0.55 - f.l * 0.08 * up];
        const e = [top[0] + dx * f.l, top[1] + dy * f.l * (1 - droop * 0.3) + droop * f.l * (1 - up * 0.6)];
        rach.moveTo(...top); rach.quadraticCurveTo(...c, ...e);
        for (let k = 2; k <= 16; k++) {
          const u = k / 16, p = qpt(top, c, e, u), q = qpt(top, c, e, Math.min(1, u + 0.02));
          let tx = q[0] - p[0], ty = q[1] - p[1]; const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
          const ll = f.l * (date ? 0.14 : 0.2) * (1 - u * 0.55);
          for (const sd of [-1, 1]) {
            let lx = tx * 0.55 - ty * sd, ly = ty * 0.55 + tx * sd;
            if (!date) ly += 0.65;
            const lm = Math.hypot(lx, ly);
            leaf.moveTo(...p); leaf.lineTo(p[0] + (lx / lm) * ll, p[1] + (ly / lm) * ll);
          }
        }
      }
      g.lineWidth = Math.max(0.7, len * 0.012); g.stroke(leaf);
      g.lineWidth = Math.max(1, len * 0.022); g.stroke(rach);
      g.beginPath(); g.arc(top[0], top[1], w1 * 0.9, 0, TAU); g.fill();
    },
  };
}

function drawBirds(g, birds, t, W, color) {
  g.strokeStyle = color; g.lineCap = 'round';
  g.beginPath();
  for (const b of birds) {
    const x = ((b.x + b.v * t) % (W * 1.3)) - W * 0.15, y = b.y + Math.sin(t * 0.7 + b.ph) * b.sz;
    const w = Math.sin(t * b.f + b.ph) * 0.6;
    g.moveTo(x - b.sz, y - b.sz * (0.3 + w)); g.quadraticCurveTo(x - b.sz * 0.4, y - b.sz * 0.35, x, y);
    g.quadraticCurveTo(x + b.sz * 0.4, y - b.sz * 0.35, x + b.sz, y - b.sz * (0.3 + w));
  }
  g.lineWidth = 1.1; g.stroke(); g.lineCap = 'butt';
}
function makeBirds(r, n, W, y0, y1, sz, v) {
  return Array.from({ length: n }, () => ({
    x: r() * W * 1.3, y: y0 + (y1 - y0) * r(), sz: sz * (0.7 + 0.6 * r()), v: v * (0.7 + 0.6 * r()),
    ph: r() * TAU, f: 3 + r() * 2,
  }));
}

// Swell lines that travel toward the viewer, with broken highlights.
function makeSwells(r, n) {
  return Array.from({ length: n }, (_, i) => ({ k: i, ph: r() * TAU, f: 0.8 + r() * 0.6, d: r() }));
}
function drawSwells(g, S, swells, t, hz, speed, amp, yMin, yMax, hi = C.chalk, lo = C.indigo) {
  const { W, mx, s } = S, n = swells.length, depth = S.H + S.my - hz;
  for (const sw of swells) {
    const u = (((sw.k + t * speed) / n) % 1 + 1) % 1, y = hz + depth * Math.pow(u, 2.1);
    if (y < yMin || y >= yMax) continue;
    const a = s * amp * (0.15 + u * u), wl = s * (0.12 + 0.55 * u), alpha = Math.sin(Math.PI * u) ** 0.6;
    const path = new Path2D();
    for (let x = -mx; x <= W + mx; x += 6) {
      const yy = y + a * Math.sin((x / wl) * TAU * sw.f + sw.ph + t * 0.5);
      x === -mx ? path.moveTo(x, yy) : path.lineTo(x, yy);
    }
    g.setLineDash([s * (0.05 + 0.25 * u) * (0.6 + sw.d), s * (0.02 + 0.09 * u)]);
    g.lineDashOffset = sw.ph * 40;
    g.strokeStyle = rgba(hi, 0.55 * alpha); g.lineWidth = 0.5 + 1.6 * u; g.stroke(path);
    g.save(); g.translate(0, 1.5 + 3 * u);
    g.strokeStyle = rgba(lo, 0.22 * alpha); g.lineWidth = 0.6 + 1.2 * u; g.stroke(path);
    g.restore();
  }
  g.setLineDash([]);
}

// Sun glitter: short dashes on the water under a light source.
function makeGlitter(r, n) {
  return Array.from({ length: n }, () => ({ v: r(), o: r() * 2 - 1, ph: r() * TAU, l: r(), w: r() }));
}
function drawGlitter(g, S, list, t, x, hz, spread, strength, col = C.chalk) {
  const depth = S.H + S.my - hz;
  for (const d of list) {
    const y = hz + 1.5 + depth * Math.pow(d.v, 1.7), sp = spread + (y - hz) * 0.42;
    const xx = x + d.o * sp * (0.35 + 0.65 * d.w) + Math.sin(t * 1.3 + d.ph) * 2;
    const a = strength * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4 + d.ph * 3), 2) * (1 - d.v * 0.5);
    if (a < 0.02) continue;
    const len = (3 + 20 * d.v) * (S.s / 420) * (0.5 + d.l);
    g.fillStyle = rgba(col, a); g.fillRect(xx - len / 2, y, len, 0.8 + d.v * 1.4);
  }
}

// A boom dhow, bow to the left, waterline at y = 0. L is the hull length.
function drawDhow(g, L, { belly = 0, furled = false, light = C.chalk } = {}) {
  const P = (x, y) => [x * L, y * L];
  const stern = P(0.47, -0.22), sc = P(0.02, -0.06), bow = P(-0.56, -0.17);
  const hull = new Path2D();
  hull.moveTo(...bow); hull.quadraticCurveTo(...P(-0.46, -0.05), ...P(-0.34, 0.05));
  hull.lineTo(...P(0.36, 0.05)); hull.lineTo(...P(0.41, -0.07)); hull.lineTo(...stern);
  hull.quadraticCurveTo(...sc, ...bow);
  // mast behind the sail
  g.strokeStyle = C.timber; g.lineWidth = L * 0.013;
  g.beginPath(); g.moveTo(...P(-0.07, -0.12)); g.lineTo(...P(-0.13, furled ? -0.7 : -0.66)); g.stroke();
  let A, B;
  if (!furled) {
    A = P(-0.56, -0.24); B = P(0.4, -1.0);
    const Cl = P(0.31, -0.2), lc = P(0.44 + belly, -0.58), fc = P(-0.1, -0.12 + belly);
    const sail = new Path2D();
    sail.moveTo(...A); sail.lineTo(...B); sail.quadraticCurveTo(...lc, ...Cl); sail.quadraticCurveTo(...fc, ...A);
    g.fillStyle = mix(C.bone, C.sandDeep, 0.5); g.fill(sail);
    g.save(); g.clip(sail);
    const Y = (u) => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
    const F = (u) => qpt(A, fc, Cl, u), N = 9;
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      g.fillStyle = mix(light, C.sandDeep, 0.08 + 0.5 * Math.pow(u0, 1.4));
      g.beginPath(); g.moveTo(...Y(u0)); g.lineTo(...Y(u1)); g.lineTo(...F(u1)); g.lineTo(...F(u0)); g.fill();
    }
    g.beginPath();
    for (let i = 1; i < N * 2; i++) { const u = i / (N * 2); g.moveTo(...Y(u)); g.lineTo(...F(u)); }
    g.strokeStyle = rgba(C.umber, 0.18); g.lineWidth = 0.6; g.stroke();
    g.restore();
    g.strokeStyle = rgba(C.umber, 0.55); g.lineWidth = 0.8; g.stroke(sail);
    g.strokeStyle = rgba(C.timber, 0.75); g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(...P(-0.13, -0.62)); g.lineTo(...P(0.45, -0.23));
    g.moveTo(...Cl); g.lineTo(...P(0.43, -0.22));
    g.moveTo(...P(-0.12, -0.58)); g.lineTo(...P(0.0, -0.11));
    g.stroke();
  } else {
    A = P(-0.5, -0.3); B = P(0.36, -0.82);
    g.strokeStyle = mix(light, C.sandDeep, 0.35); g.lineWidth = L * 0.04; g.lineCap = 'round';
    g.beginPath(); g.moveTo(A[0] + (B[0] - A[0]) * 0.08, A[1] + (B[1] - A[1]) * 0.08);
    g.lineTo(A[0] + (B[0] - A[0]) * 0.9, A[1] + (B[1] - A[1]) * 0.9); g.stroke(); g.lineCap = 'butt';
    g.strokeStyle = rgba(C.timber, 0.7); g.lineWidth = 0.7; g.beginPath();
    for (let i = 1; i < 9; i++) {
      const u = 0.08 + i * 0.09, x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u;
      g.moveTo(x - L * 0.01, y - L * 0.02); g.lineTo(x + L * 0.012, y + L * 0.018);
    }
    g.moveTo(...P(-0.13, -0.66)); g.lineTo(...P(0.45, -0.23)); g.stroke();
  }
  // yard
  g.strokeStyle = C.timber; g.lineWidth = L * 0.012; g.beginPath();
  g.moveTo(A[0] - (B[0] - A[0]) * 0.03, A[1] - (B[1] - A[1]) * 0.03); g.lineTo(B[0] + (B[0] - A[0]) * 0.02, B[1] + (B[1] - A[1]) * 0.02);
  g.stroke();
  // hull, planking, wale, poop rail
  g.fillStyle = C.timber; g.fill(hull);
  g.save(); g.clip(hull);
  g.strokeStyle = mix(C.umber, C.ochre, 0.35); g.lineWidth = L * 0.05;
  g.beginPath(); g.moveTo(...stern); g.quadraticCurveTo(...sc, ...bow); g.stroke();
  for (const k of [0.028, 0.055, 0.08, 0.105]) {
    g.strokeStyle = k === 0.028 ? rgba(C.brassLight, 0.9) : rgba(C.umber, 0.7); g.lineWidth = k === 0.028 ? 1 : 0.6;
    g.beginPath(); g.moveTo(stern[0], stern[1] + k * L); g.quadraticCurveTo(sc[0], sc[1] + k * L, bow[0], bow[1] + k * L); g.stroke();
  }
  g.restore();
  g.strokeStyle = C.timber; g.lineWidth = 0.8; g.beginPath();
  for (let u = 0; u <= 0.3; u += 0.05) { const p = qpt(stern, sc, bow, u); g.moveTo(...p); g.lineTo(p[0], p[1] - L * 0.04); }
  const r0 = qpt(stern, sc, bow, 0), r1 = qpt(stern, sc, bow, 0.3);
  g.moveTo(r0[0], r0[1] - L * 0.04); g.lineTo(r1[0], r1[1] - L * 0.04); g.stroke();
}

// ---------- the stage: layers, parallax, size ----------

function stage(W, H, dpr, id) {
  const S = { W, H, dpr, s: Math.min(W, H), cam: 0, dir: [1, 0.2] };
  S.mx = Math.ceil(W * 0.04) + 2; S.my = Math.ceil(H * 0.02) + 2;
  S.r = makeRng('mizan-scene:' + id);
  S.layer = (fn) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil((W + 2 * S.mx) * dpr); c.height = Math.ceil((H + 2 * S.my) * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, S.mx * dpr, S.my * dpr);
    fn(g);
    return c;
  };
  S.off = (depth) => [-S.cam * S.mx * 0.9 * depth * S.dir[0], -S.cam * S.my * 0.9 * depth * S.dir[1]];
  S.put = (ctx, c, depth) => {
    const [ox, oy] = S.off(depth);
    ctx.drawImage(c, -S.mx + ox, -S.my + oy, c.width / dpr, c.height / dpr);
  };
  S.at = (ctx, depth) => { const [ox, oy] = S.off(depth); ctx.translate(ox, oy); };
  return S;
}

function grainPattern(ctx) {
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), r = makeRng('grain');
  const [lr, lg, lb] = hex(C.chalk), [dr, dg, db] = hex(C.umber);
  for (let i = 0; i < n * n; i++) {
    const v = r(), dark = v < 0.5, a = Math.abs(v - 0.5) * 2;
    img.data.set(dark ? [dr, dg, db] : [lr, lg, lb], i * 4);
    img.data[i * 4 + 3] = Math.round(a * a * 26);
  }
  g.putImageData(img, 0, 0);
  return ctx.createPattern(c, 'repeat');
}

// ---------- the six scenes ----------
// Each builder draws its static layers once and returns draw(ctx, t, p),
// with t in seconds and p the shot's progress from 0 to 1.

const BUILD = {
  nizwa(S) {
    const { W, H, s, r, mx, my } = S;
    const gy = H * 0.72, R = s * 0.19, cx = W * 0.56;
    const sky = [mix(C.ink, C.indigo, 0.5), C.indigo, mix(C.indigo, C.sandDeep, 0.42),
      mix(C.sandDeep, C.ochre, 0.3), mix(C.ochre, C.brassLight, 0.55), mix(C.brassLight, C.chalk, 0.4)];
    const farN = fbm(r, 5, 0.5, true), nearN = fbm(r, 5, 0.55, true);
    const farY = (x) => H * 0.6 - s * 0.34 * Math.pow(farN(x / s * 2.2 + 5), 1.8);
    const nearY = (x) => H * 0.69 - s * 0.16 * Math.pow(nearN(x / s * 3 + 11), 1.6);
    const back = S.layer((g) => {
      bands(g, -mx, -my, W + 2 * mx, H * 0.64 + my, sky, 12, 1, 0.05);
      for (let i = 0; i < 30; i++) {
        const x = -mx + r() * (W + 2 * mx), y = -my + r() * H * 0.2;
        g.fillStyle = rgba(C.chalk, (0.2 + 0.5 * r()) * (1 - y / (H * 0.22))); g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = C.chalk; g.beginPath(); g.arc(W * 0.2, H * 0.09, 1.5, 0, TAU); g.fill();
      massif(g, S, farY, mix(C.sandDeep, C.indigo, 0.3), mix(C.indigo, C.sandDeep, 0.28), s * 0.05, 1.5, rgba(C.indigo, 0.22));
    });
    const mid = S.layer((g) => {
      massif(g, S, nearY, mix(C.umber, C.sandDeep, 0.4), mix(C.indigo, C.umber, 0.55), s * 0.04, 1, rgba(C.ink, 0.25));
    });
    const shd = mix(C.umber, C.indigo, 0.3), mdc = mix(C.sandDeep, C.ochre, 0.35), lit = mix(C.sand, C.brassLight, 0.3);
    const tone = (a) => ramp([shd, mix(shd, mdc, 0.6), mdc, lit], clamp(-0.72 * Math.sin(a) + 0.69 * Math.cos(a)));
    const backPalms = Array.from({ length: 10 }, (_, i) => {
      const x = -mx + (W + 2 * mx) * (i + r() * 0.8) / 10;
      return makePalm(r, x, gy + s * 0.02, s * (0.07 + 0.06 * r()), 'date', s * 0.045, mix(C.umber, C.indigo, 0.3), (r() - 0.5) * 0.2);
    });
    const fort = S.layer((g) => {
      bands(g, -mx, gy - s * 0.035, W + 2 * mx, H + my - gy + s * 0.035,
        [mix(C.sandDeep, C.umber, 0.25), mix(C.umber, C.timber, 0.4)], 6, 1);
      hatchRect(g, -mx, gy, W + mx, H + my, 3.4, 0.03, rgba(C.timber, 0.12), 0.6);
      // curtain walls and a square bastion, mud brick with pointed merlons
      const wall = (x0, x1, h, face, side) => {
        g.fillStyle = face; g.fillRect(x0, gy - h, x1 - x0, h + 2);
        if (side) { g.fillStyle = lit; g.fillRect(x0, gy - h, side, h + 2); }
        g.save(); g.beginPath(); g.rect(x0, gy - h, x1 - x0, h); g.clip();
        hatchRect(g, x0, gy - h, x1, gy, 3, 0, rgba(C.umber, 0.12), 0.5);
        g.strokeStyle = rgba(C.umber, 0.2); g.lineWidth = 0.7; g.beginPath();
        for (let i = 0; i < (x1 - x0) / (R * 0.12); i++) { const x = x0 + r() * (x1 - x0); g.moveTo(x, gy - h); g.lineTo(x, gy - h + h * (0.1 + 0.3 * r())); }
        g.stroke(); g.restore();
        g.fillStyle = face;
        for (let x = x0 + R * 0.03; x < x1 - R * 0.06; x += R * 0.15) {
          g.beginPath(); g.moveTo(x, gy - h); g.lineTo(x, gy - h - R * 0.05); g.lineTo(x + R * 0.035, gy - h - R * 0.09);
          g.lineTo(x + R * 0.07, gy - h - R * 0.05); g.lineTo(x + R * 0.07, gy - h); g.fill();
        }
        g.fillStyle = rgba(C.chalk, 0.35); g.fillRect(x0, gy - h, x1 - x0, 0.8);
      };
      wall(cx - R * 2.5, cx - R * 0.5, R * 0.62, mix(mdc, shd, 0.25));
      wall(cx + R * 0.5, cx + R * 2.3, R * 0.52, mix(mdc, shd, 0.45));
      wall(cx + R * 2.2, cx + R * 2.95, R * 0.86, mix(mdc, shd, 0.5));
      wall(cx - R * 3.05, cx - R * 2.4, R * 1.02, mix(mdc, shd, 0.2), R * 0.12);
      g.fillStyle = mix(C.timber, C.indigo, 0.3);
      for (const [x, w, h] of [[cx - R * 1.6, R * 0.13, R * 0.4], [cx + R * 2.55, R * 0.05, R * 0.12], [cx + R * 2.7, R * 0.05, R * 0.12], [cx - R * 2.8, R * 0.05, R * 0.14]]) {
        g.beginPath(); g.moveTo(x - w, gy - (w > R * 0.1 ? 0 : R * 0.55)); const b = gy - (w > R * 0.1 ? 0 : R * 0.55);
        g.lineTo(x - w, b - h + w); g.arc(x, b - h + w, w, Math.PI, 0); g.lineTo(x + w, b); g.fill();
      }
      // the round tower: stepped strips across a slightly tapered drum
      const drum = (yb, yt, rb, rt, eb, et) => {
        const N = 14;
        for (let i = 0; i < N; i++) {
          const a0 = -Math.PI / 2 + (Math.PI * i) / N, a1 = a0 + Math.PI / N;
          g.fillStyle = tone((a0 + a1) / 2); g.beginPath();
          g.moveTo(cx + rt * Math.sin(a0) - 0.4, yt - et * Math.cos(a0)); g.lineTo(cx + rt * Math.sin(a1) + 0.4, yt - et * Math.cos(a1));
          g.lineTo(cx + rb * Math.sin(a1) + 0.4, yb - eb * Math.cos(a1)); g.lineTo(cx + rb * Math.sin(a0) - 0.4, yb - eb * Math.cos(a0));
          g.fill();
        }
      };
      const Hd = R * 1.55, top = gy - Hd, ry = R * 0.08;
      drum(gy + 2, gy - R * 0.32, R * 1.12, R, 0, ry * 0.2);
      drum(gy - R * 0.3, top, R, R * 0.92, ry * 0.2, ry);
      g.lineWidth = 0.6; g.strokeStyle = rgba(C.umber, 0.22);
      for (let k = 1; k < 16; k++) {
        const y = gy - R * 0.3 - (Hd - R * 0.3) * k / 16, rr = R - R * 0.08 * k / 16, e = ry * (0.2 + 0.8 * k / 16);
        g.beginPath();
        for (let j = 0; j <= 28; j++) { const a = -Math.PI / 2 + (Math.PI * j) / 28; g.lineTo(cx + rr * Math.sin(a), y - e * Math.cos(a)); }
        g.stroke();
      }
      drum(top + 1, top - R * 0.17, R * 0.97, R * 0.97, ry, ry * 1.05);
      g.strokeStyle = rgba(C.timber, 0.45); g.lineWidth = 1.4; g.beginPath();
      for (let j = 0; j <= 28; j++) { const a = -Math.PI / 2 + (Math.PI * j) / 28; g.lineTo(cx + R * 0.96 * Math.sin(a), top + 1 - ry * Math.cos(a)); }
      g.stroke();
      const M = 17, py = top - R * 0.17;
      for (let m = 0; m < M; m++) {
        const a = -Math.PI / 2 + (Math.PI * (m + 0.5)) / M, w = ((Math.PI * R) / M) * 0.32 * Math.cos(a) + 0.4;
        const x = cx + R * 0.97 * Math.sin(a), y = py - ry * 1.05 * Math.cos(a) + 0.5;
        g.fillStyle = tone(a); g.beginPath();
        g.moveTo(x - w, y); g.lineTo(x - w, y - R * 0.07); g.lineTo(x, y - R * 0.13); g.lineTo(x + w, y - R * 0.07); g.lineTo(x + w, y); g.fill();
      }
      g.fillStyle = mix(C.timber, C.indigo, 0.35);
      for (const [lv, n] of [[0.28, 7], [0.62, 4]]) {
        for (let j = 1; j < n; j++) {
          const a = -Math.PI / 2 + (Math.PI * j) / n, y = top + Hd * lv - ry * 0.7 * Math.cos(a);
          g.fillRect(cx + R * 0.95 * Math.sin(a) - 0.6, y, R * 0.03 * Math.cos(a) + 1, R * 0.09);
        }
      }
      for (const p of backPalms) if (Math.abs(p.top[0] - cx) > R * 0.7) p.draw(g, 0, 0);
      // a grove across the plain between the fort and the viewer
      for (let i = 0; i < 9; i++) {
        const x = -mx + (W + 2 * mx) * (i + 0.2 + r() * 0.6) / 9, by = gy + s * (0.07 + 0.1 * r());
        if (Math.abs(x - cx) < R * 0.45) continue;
        makePalm(r, x, by, s * (0.1 + 0.07 * r()), 'date', s * 0.07, mix(C.umber, C.indigo, 0.42), (r() - 0.5) * 0.15).draw(g, 0, 0);
      }
    });
    const front = S.layer((g) => {
      const fn = (x) => H * 0.94 - s * 0.02 * Math.sin(x / s * 4);
      g.fillStyle = mix(C.timber, C.indigo, 0.25); g.fill(curvePath(-mx, W + mx, fn, H + my));
    });
    const pcol = mix(C.timber, C.indigo, 0.28);
    const palms = [[0.03, 0.7, -0.08], [0.19, 0.78, 0.06], [0.86, 0.75, -0.05], [1.0, 0.66, -0.1]].map(([fx, fy, lean]) =>
      makePalm(r, W * fx, H * 0.97, H * 0.97 - H * fy, 'date', s * 0.17, pcol, lean));
    const birds = makeBirds(r, 5, W, H * 0.16, H * 0.36, s * 0.012, s * 0.02);
    const streaks = Array.from({ length: 5 }, (_, i) => ({ x: r() * W, y: H * (0.1 + i * 0.065 + 0.03 * r()), l: s * (0.35 + 0.5 * r()), w: s * (0.012 + 0.014 * r()) }));
    return (ctx, t) => {
      S.put(ctx, back, 0.08);
      // long dusk clouds: dark lenses with a warm underside
      ctx.save(); S.at(ctx, 0.1);
      for (const k of streaks) {
        const x = ((k.x + t * s * 0.008) % (W + k.l * 2)) - k.l, y = k.y, u = y / H;
        const lens = (dy0, up, down) => {
          ctx.beginPath(); ctx.moveTo(x, y + dy0);
          ctx.quadraticCurveTo(x + k.l * 0.4, y + dy0 - up * 2, x + k.l, y + dy0);
          ctx.quadraticCurveTo(x + k.l * 0.55, y + dy0 + down * 2, x, y + dy0); ctx.fill();
        };
        ctx.fillStyle = mix(mix(C.indigo, C.ink, 0.2), C.sandDeep, 0.15 + u * 0.9); lens(0, k.w, k.w * 0.35);
        ctx.fillStyle = mix(C.brassLight, C.ochre, 0.3 - u); lens(k.w * 0.3, k.w * 0.12, k.w * 0.22);
      }
      ctx.restore();
      S.put(ctx, mid, 0.2);
      S.put(ctx, fort, 0.45);
      ctx.save(); S.at(ctx, 0.15); drawBirds(ctx, birds, t, W, mix(C.ink, C.indigo, 0.3)); ctx.restore();
      S.put(ctx, front, 0.8);
      ctx.save(); S.at(ctx, 0.8); for (const p of palms) p.draw(ctx, t); ctx.restore();
    };
  },

  sea(S) {
    const { W, H, s, r, mx, my } = S;
    const hz = H * 0.5, sunX = W * 0.42, sr = s * 0.06;
    const sky = [mix(C.indigo, C.bone, 0.38), mix(C.indigo, C.bone, 0.56), mix(C.turquoise, C.bone, 0.58),
      mix(C.sand, C.bone, 0.45), mix(C.brassLight, C.chalk, 0.45), mix(C.brassLight, C.chalk, 0.7)];
    const back = S.layer((g) => bands(g, -mx, -my, W + 2 * mx, hz + my + 1, sky, 12, 1, 0.06));
    const hn = fbm(r, 4, 0.5);
    const water = S.layer((g) => {
      const head = (x) => hz - s * 0.085 * smooth(W * 0.6, W * 0.67, x) * (0.7 + 0.45 * hn(x / s * 3)) - smooth(W * 0.6, W * 0.62, x) * 1.5;
      g.fillStyle = mix(C.indigo, C.bone, 0.48); g.fill(curvePath(W * 0.58, W + mx, head, hz + 1));
      g.save(); g.clip(curvePath(W * 0.58, W + mx, head, hz + 1));
      hatchRect(g, W * 0.58, hz - s * 0.1, W + mx, hz, 2.6, 0, rgba(C.bone, 0.18), 0.6);
      g.restore();
      const far = (x) => hz - s * 0.03 * smooth(W * 0.22, W * 0.12, x) * (0.6 + 0.6 * hn(x / s * 5 + 9));
      g.fillStyle = mix(C.indigo, C.bone, 0.64); g.fill(curvePath(-mx, W * 0.24, far, hz + 1));
      bands(g, -mx, hz, W + 2 * mx, H + my - hz, [mix(C.brassLight, C.bone, 0.45), mix(C.turquoise, C.bone, 0.42),
        mix(C.turquoise, C.indigo, 0.45), mix(C.indigo, C.ink, 0.25)], 13, 1.6);
      g.fillStyle = rgba(C.chalk, 0.7); g.fillRect(-mx, hz, W + 2 * mx, 1);
    });
    const streaks = Array.from({ length: 5 }, () => ({ x: r() * W, y: hz - s * (0.03 + 0.22 * r()), l: s * (0.3 + 0.5 * r()), w: 1 + r() * s * 0.006 }));
    const swells = makeSwells(r, 24), glit = makeGlitter(r, 120);
    const birds = makeBirds(r, 3, W, H * 0.22, H * 0.34, s * 0.01, s * 0.015);
    return (ctx, t, p) => {
      S.put(ctx, back, 0.05);
      const sy = hz + sr * 0.35 - sr * 2.5 * p, up = clamp((hz - sy) / (sr * 2) + 0.3);
      ctx.save(); S.at(ctx, 0.05);
      for (const [k, a] of [[4.4, 0.06], [3.2, 0.07], [2.2, 0.09], [1.5, 0.12]]) {
        ctx.fillStyle = rgba(C.chalk, a * (0.4 + up)); ctx.beginPath(); ctx.arc(sunX, sy, sr * k, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = mix(C.chalk, C.brassLight, 0.12); ctx.beginPath(); ctx.arc(sunX, sy, sr, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(C.brassLight, 0.8); ctx.lineWidth = 1; ctx.stroke();
      ctx.lineCap = 'round';
      for (const k of streaks) {
        const x = ((k.x + t * s * 0.006) % (W + k.l * 2)) - k.l;
        ctx.strokeStyle = rgba(mix(C.sandDeep, C.indigo, 0.35), 0.55); ctx.lineWidth = k.w;
        ctx.beginPath(); ctx.moveTo(x, k.y); ctx.lineTo(x + k.l, k.y); ctx.stroke();
        ctx.strokeStyle = rgba(C.chalk, 0.5); ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x + k.l * 0.15, k.y + k.w * 0.5 + 0.5); ctx.lineTo(x + k.l * 0.7, k.y + k.w * 0.5 + 0.5); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.restore();
      S.put(ctx, water, 0.15);
      ctx.save(); S.at(ctx, 0.15);
      drawGlitter(ctx, S, glit, t, sunX, hz, sr * 0.6, 0.85 * up);
      drawSwells(ctx, S, swells, t, hz, 0.55, 0.018, hz, H + my);
      drawBirds(ctx, birds, t, W, mix(C.indigo, C.bone, 0.2));
      ctx.restore();
    };
  },

  dhow(S) {
    const { W, H, s, r, mx, my } = S;
    const hz = H * 0.56, sun = [W * 0.8, H * 0.22], sr = s * 0.05;
    S.dir = [1, 0.1];
    const sky = [mix(C.turquoise, C.bone, 0.42), mix(C.turquoise, C.bone, 0.6), mix(C.sand, C.bone, 0.55),
      mix(C.brassLight, C.bone, 0.48), mix(C.brassLight, C.sand, 0.3)];
    const cn = fbm(r, 4, 0.5);
    const back = S.layer((g) => {
      bands(g, -mx, -my, W + 2 * mx, hz + my + 1, sky, 11, 1, 0.06);
      for (const [k, a] of [[4, 0.07], [2.8, 0.08], [1.8, 0.1]]) {
        g.fillStyle = rgba(C.chalk, a); g.beginPath(); g.arc(sun[0], sun[1], sr * k, 0, TAU); g.fill();
      }
      g.fillStyle = mix(C.chalk, C.brassLight, 0.2); g.beginPath(); g.arc(sun[0], sun[1], sr, 0, TAU); g.fill();
      cloud(g, r, W * 0.05, H * 0.2, s * 0.42, 0.45, mix(C.bone, C.chalk, 0.4), mix(C.sand, C.bone, 0.35));
      cloud(g, r, W * 0.42, H * 0.12, s * 0.3, 0.4, mix(C.bone, C.chalk, 0.3), mix(C.sand, C.bone, 0.4));
      cloud(g, r, W * 0.6, hz - s * 0.04, s * 0.5, 0.25, mix(C.bone, C.sand, 0.2), mix(C.sandDeep, C.bone, 0.4));
      const coast = (x) => hz - s * 0.05 * smooth(W * 0.42, W * 0.25, x) * (0.5 + 0.7 * cn(x / s * 4));
      g.fillStyle = mix(C.indigo, C.bone, 0.58); g.fill(curvePath(-mx, W * 0.44, coast, hz + 1));
    });
    const sea = S.layer((g) => {
      bands(g, -mx, hz, W + 2 * mx, H + my - hz, [mix(C.turquoise, C.bone, 0.45), mix(C.turquoise, C.indigo, 0.15),
        mix(C.indigo, C.turquoise, 0.4), mix(C.indigo, C.ink, 0.2)], 11, 1.5);
      g.fillStyle = rgba(C.chalk, 0.5); g.fillRect(-mx, hz, W + 2 * mx, 1);
    });
    const L = Math.min(W * 0.74, H * 0.6), wl = H * 0.71;
    const swells = makeSwells(r, 18), glit = makeGlitter(r, 90), birds = makeBirds(r, 2, W, H * 0.1, H * 0.2, s * 0.011, s * 0.02);
    return (ctx, t, p) => {
      S.put(ctx, back, 0.1);
      S.put(ctx, sea, 0.3);
      ctx.save(); S.at(ctx, 0.3);
      drawGlitter(ctx, S, glit, t, sun[0], hz, sr * 0.8, 0.7);
      drawSwells(ctx, S, swells, t, hz, 0.45, 0.02, hz, wl - L * 0.02, C.chalk, C.indigo);
      drawBirds(ctx, birds, t, W, mix(C.indigo, C.ink, 0.3));
      ctx.restore();
      // the dhow pitches about its waterline and makes slow way to the left
      const x = W * 0.53 - p * W * 0.05, pitch = 0.035 * Math.sin(t * 1.15), bob = L * 0.01 * Math.sin(t * 1.15 + 0.7);
      ctx.save(); S.at(ctx, 0.55);
      ctx.save(); ctx.beginPath(); ctx.rect(-W, -H, W * 3, wl + H + 1); ctx.clip();
      ctx.translate(x, wl + bob); ctx.rotate(pitch);
      drawDhow(ctx, L, { belly: 0.015 * Math.sin(t * 0.8), light: mix(C.chalk, C.brassLight, 0.15) });
      ctx.restore();
      // reflection, waterline foam and wake
      ctx.fillStyle = rgba(C.timber, 0.28);
      for (let i = 0; i < 9; i++) {
        const y = wl + 2 + i * L * 0.016, w = L * (0.82 - i * 0.07), o = Math.sin(t * 1.4 + i) * L * 0.012;
        ctx.fillRect(x - w / 2 + o - L * 0.02, y, w, 1 + L * 0.004);
      }
      ctx.strokeStyle = rgba(C.chalk, 0.75); ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(x - L * 0.36, wl + bob * 0.5); ctx.lineTo(x + L * 0.36, wl - bob * 0.3); ctx.stroke();
      ctx.setLineDash([L * 0.05, L * 0.03]); ctx.lineDashOffset = -t * L * 0.06;
      for (const [k, a] of [[0.05, 0.7], [0.14, 0.5], [0.24, 0.3]]) {
        ctx.strokeStyle = rgba(C.chalk, a); ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(x + L * 0.38, wl + 1); ctx.quadraticCurveTo(x + L * 0.7, wl + L * k * 0.3, W + mx, wl + L * k * 0.6); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba(C.chalk, 0.8); ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.arc(x - L * 0.36, wl - L * 0.01, L * 0.03 * (1 + 0.2 * Math.sin(t * 2.3)), Math.PI * 0.6, Math.PI * 1.3); ctx.stroke();
      ctx.restore();
      ctx.save(); S.at(ctx, 0.3);
      drawSwells(ctx, S, swells, t, hz, 0.45, 0.02, wl - L * 0.02, H + my, C.chalk, C.indigo);
      ctx.restore();
    };
  },

  zanzibar(S) {
    const { W, H, s, r, mx, my } = S;
    const yw = H * 0.63, sun = [W * 0.25, yw - s * 0.075], sr = s * 0.05;
    const sky = [mix(C.indigo, C.sandDeep, 0.35), mix(C.indigo, C.sandDeep, 0.62), mix(C.sandDeep, C.ochre, 0.35),
      mix(C.ochre, C.terracotta, 0.22), mix(C.brassLight, C.ochre, 0.25), mix(C.brassLight, C.chalk, 0.4)];
    const back = S.layer((g) => {
      bands(g, -mx, -my, W + 2 * mx, yw + my + 1, sky, 12, 1, 0.05);
      const isle = (x) => yw - s * 0.018 * smooth(W * 0.02, W * 0.06, x) * smooth(W * 0.19, W * 0.15, x);
      g.fillStyle = mix(C.indigo, C.sandDeep, 0.4); g.fill(curvePath(0, W * 0.2, isle, yw + 1));
    });
    // Stone Town: coral-stone blocks, flat roofs, arched windows, balconies
    const hx = W * 0.68, hw = s * 0.4, hh = s * 0.27;
    const cols = [mix(C.limestone, C.bone, 0.5), C.sand, mix(C.sand, C.ochre, 0.25), mix(C.limestone, C.sandDeep, 0.3),
      mix(C.bone, C.turquoise, 0.12), mix(C.sand, C.terracotta, 0.12)];
    const town = S.layer((g) => {
      for (let x = W * 0.3; x < W + mx;) {
        const w = s * (0.06 + 0.08 * r()), h = s * (0.2 + 0.14 * r());
        g.fillStyle = mix(mix(C.sandDeep, C.indigo, 0.25), C.ochre, 0.15); g.fillRect(x, yw - h, w + 1, h);
        x += w;
      }
      const bld = (x, w, h, col) => {
        g.fillStyle = col; g.fillRect(x, yw - h, w + 0.5, h);
        g.fillStyle = rgba(C.chalk, 0.3); g.fillRect(x, yw - h, 1.2, h);
        g.fillStyle = rgba(C.umber, 0.3); g.fillRect(x, yw - h, w, s * 0.008);
        const floors = Math.max(2, Math.round(h / (s * 0.06))), fh = h / floors, nw = Math.max(1, Math.floor(w / (s * 0.04)));
        const ww = s * 0.013, shut = r() < 0.5 ? mix(C.turquoise, C.bone, 0.2) : null;
        for (let f = 0; f < floors; f++) {
          const fy = yw - h + f * fh + s * 0.012;
          if (f > 0 && r() < 0.3) {
            g.strokeStyle = rgba(C.timber, 0.7); g.lineWidth = 0.6; g.beginPath();
            g.moveTo(x, fy + fh * 0.62); g.lineTo(x + w, fy + fh * 0.62);
            for (let bx = x + 2; bx < x + w; bx += 2.5) { g.moveTo(bx, fy + fh * 0.62); g.lineTo(bx, fy + fh * 0.82); }
            g.stroke(); g.fillStyle = rgba(C.timber, 0.35); g.fillRect(x, fy - 1, w, 1.4);
          }
          for (let i = 0; i < nw; i++) {
            const wx = x + (w * (i + 0.5)) / nw - ww / 2, wh = fh * 0.48;
            if (shut) { g.fillStyle = shut; g.fillRect(wx - ww * 0.45, fy + ww * 0.5, ww * 1.9, wh - ww * 0.5); }
            g.fillStyle = mix(C.timber, C.indigo, 0.3); g.beginPath();
            g.moveTo(wx, fy + wh); g.lineTo(wx, fy + ww / 2); g.arc(wx + ww / 2, fy + ww / 2, ww / 2, Math.PI, 0); g.lineTo(wx + ww, fy + wh); g.fill();
          }
        }
        g.fillStyle = rgba(C.umber, 0.07);
        for (let i = 0; i < (w * h) / 40; i++) g.fillRect(x + r() * w, yw - h + r() * h, 1, 1);
      };
      for (let x = W * 0.34; x < W + mx;) {
        if (x >= hx - hw / 2 - 1 && x < hx + hw / 2) { x = hx + hw / 2; continue; }
        let w = s * (0.06 + 0.08 * r());
        if (x < hx - hw / 2 && x + w > hx - hw / 2) w = hx - hw / 2 - x;
        bld(x, w, s * (0.1 + 0.12 * r()), cols[Math.floor(r() * cols.length)]);
        x += w;
      }
      // the House of Wonders: three tiers of colonnade and a clock tower
      const x0 = hx - hw / 2, top = yw - hh, wall = mix(C.bone, C.limestone, 0.3), recess = mix(C.sandDeep, C.umber, 0.4);
      const tw = hw * 0.15, th = s * 0.12;
      g.fillStyle = wall; g.fillRect(hx - tw / 2, top - th, tw, th + 1);
      g.fillStyle = rgba(C.umber, 0.25); g.fillRect(hx + tw * 0.2, top - th, tw * 0.3, th);
      g.fillStyle = wall; g.fillRect(hx - tw * 0.62, top - th - s * 0.008, tw * 1.24, s * 0.01);
      g.beginPath(); g.moveTo(hx - tw * 0.5, top - th - s * 0.008); g.lineTo(hx, top - th - s * 0.035); g.lineTo(hx + tw * 0.5, top - th - s * 0.008); g.fill();
      g.fillStyle = C.chalk; g.beginPath(); g.arc(hx, top - th * 0.62, tw * 0.28, 0, TAU); g.fill();
      g.strokeStyle = C.umber; g.lineWidth = 0.8; g.stroke();
      g.beginPath(); g.moveTo(hx, top - th * 0.62); g.lineTo(hx, top - th * 0.62 - tw * 0.2); g.moveTo(hx, top - th * 0.62); g.lineTo(hx + tw * 0.14, top - th * 0.6); g.stroke();
      g.fillStyle = wall; g.fillRect(x0, top, hw, hh);
      for (let k = 0; k < 3; k++) {
        const ty = top + (hh * k) / 3, slab = s * 0.012;
        g.fillStyle = recess; g.fillRect(x0 + hw * 0.03, ty + slab, hw * 0.94, hh / 3 - slab);
        g.fillStyle = wall; g.fillRect(x0 - 2, ty, hw + 4, slab);
        g.fillStyle = mix(C.chalk, C.bone, 0.3);
        for (let i = 0; i <= 16; i++) g.fillRect(x0 + hw * 0.03 + (hw * 0.94 * i) / 16 - s * 0.003, ty + slab, s * 0.006, hh / 3 - slab);
        g.strokeStyle = rgba(C.chalk, 0.75); g.lineWidth = 0.5; g.beginPath();
        const ry = ty + hh / 3 - hh * 0.08;
        g.moveTo(x0, ry); g.lineTo(x0 + hw, ry);
        for (let bx = x0 + 2; bx < x0 + hw; bx += 2.2) { g.moveTo(bx, ry); g.lineTo(bx, ty + hh / 3); }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = rgba(C.ochre, 0.12); g.fillRect(-mx, -my, W + 2 * mx, H + 2 * my);
      g.globalCompositeOperation = 'source-over';
      bands(g, -mx * 0 + W * 0.28, yw - s * 0.014, W + mx - W * 0.28, s * 0.014, [mix(C.sandDeep, C.umber, 0.2), mix(C.umber, C.sandDeep, 0.4)], 2);
    });
    // reflection of the town, darkened, drawn below in wobbling strips
    const refl = document.createElement('canvas');
    refl.width = town.width; refl.height = town.height;
    {
      const g = refl.getContext('2d'), d = S.dpr;
      g.setTransform(1, 0, 0, -1, 0, 2 * (yw + my) * d);
      g.drawImage(town, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = rgba(mix(C.indigo, C.ochre, 0.35), 0.45); g.fillRect(0, 0, refl.width, refl.height);
    }
    const sea = S.layer((g) => {
      bands(g, -mx, yw, W + 2 * mx, H + my - yw, [mix(C.brassLight, C.bone, 0.3), mix(C.ochre, C.turquoise, 0.45),
        mix(C.turquoise, C.indigo, 0.4), mix(C.indigo, C.ink, 0.3)], 11, 1.5);
      g.fillStyle = rgba(C.chalk, 0.5); g.fillRect(-mx, yw, W * 0.3, 1);
    });
    // jamb on the left and a quarter of the arch; the apex sits just off the top edge
    const wj = Math.max(W * 0.11, s * 0.085), AR = Math.min(W * 0.64 - wj, H * 0.6), acx = wj + AR, spring = AR - my - 2;
    const door = S.layer((g) => {
      const open = new Path2D();
      open.moveTo(wj, H + my + 2); open.lineTo(wj, spring); open.arc(acx, spring, AR, Math.PI, Math.PI * 1.5);
      open.lineTo(W + mx + 4, spring - AR); open.lineTo(W + mx + 4, H + my + 2); open.closePath();
      const frame = new Path2D(); frame.rect(-mx, -my, W + 2 * mx, H + 2 * my); frame.addPath(open);
      g.fillStyle = C.timber; g.fill(frame, 'evenodd');
      g.save(); g.clip(frame, 'evenodd');
      hatchRect(g, -mx, -my, wj + AR * 2, H + my, 3, Math.PI / 2, rgba(C.umber, 0.35), 0.5);
      const band = s * 0.03;
      const edge = new Path2D(); edge.moveTo(wj, H + my + 2); edge.lineTo(wj, spring); edge.arc(acx, spring, AR, Math.PI, Math.PI * 1.5);
      const edge2 = new Path2D(); edge2.moveTo(wj - band * 1.9, H + my + 2); edge2.lineTo(wj - band * 1.9, spring); edge2.arc(acx, spring, AR + band * 1.9, Math.PI, Math.PI * 1.5);
      g.strokeStyle = mix(C.umber, C.timber, 0.3); g.lineWidth = band * 2; g.stroke(edge);
      g.setLineDash([2, 2.5]); g.strokeStyle = C.timber; g.stroke(edge); g.setLineDash([]);
      g.strokeStyle = mix(C.umber, C.timber, 0.4); g.lineWidth = 1.2; g.stroke(edge2);
      g.restore();
      g.strokeStyle = mix(C.brassLight, C.ochre, 0.3); g.lineWidth = 1.2; g.stroke(edge);
      const sx = wj - band * 3.2;
      for (let y = spring + s * 0.04; y < H + my; y += s * 0.09) {
        if (sx > 6) { g.strokeStyle = rgba(C.umber, 0.9); g.lineWidth = 1; g.beginPath(); g.arc(sx * 0.5, y + s * 0.045, Math.min(sx * 0.32, s * 0.025), 0, TAU); g.stroke(); }
        g.fillStyle = C.brass; g.beginPath(); g.arc(sx, y, s * 0.008 + 0.8, 0, TAU); g.fill();
        g.fillStyle = rgba(C.chalk, 0.6); g.fillRect(sx - 1, y - 1.2, 1, 1);
      }
      for (let a = 0.05; a < 0.5; a += 0.05) {
        const ang = Math.PI + Math.PI * a, rr = AR + band * 3.2, x = acx + rr * Math.cos(ang), y = spring + rr * Math.sin(ang);
        g.fillStyle = C.brass; g.beginPath(); g.arc(x, y, s * 0.008 + 0.8, 0, TAU); g.fill();
      }
    });
    const pcol = mix(C.timber, C.umber, 0.25);
    const palms = [[0.37, 0.4, -0.1], [0.46, 0.46, 0.12], [0.94, 0.42, -0.07]].map(([fx, fh, lean]) =>
      makePalm(r, W * fx, yw - s * 0.01, s * fh, 'coconut', s * 0.13, pcol, lean));
    const glit = makeGlitter(r, 70), birds = makeBirds(r, 3, W, H * 0.12, H * 0.3, s * 0.011, s * 0.016);
    const ripples = Array.from({ length: 40 }, () => ({ x: r() * W, v: r(), l: r() }));
    return (ctx, t, p) => {
      S.put(ctx, back, 0.08);
      const sy = sun[1] + p * s * 0.03;
      ctx.save(); S.at(ctx, 0.08);
      for (const [k, a] of [[3.6, 0.06], [2.5, 0.08], [1.6, 0.1]]) { ctx.fillStyle = rgba(C.chalk, a); ctx.beginPath(); ctx.arc(sun[0], sy, sr * k, 0, TAU); ctx.fill(); }
      ctx.fillStyle = mix(C.chalk, C.brassLight, 0.3); ctx.beginPath(); ctx.arc(sun[0], sy, sr, 0, TAU); ctx.fill();
      drawBirds(ctx, birds, t, W, mix(C.ink, C.umber, 0.3));
      ctx.restore();
      S.put(ctx, town, 0.35);
      ctx.save(); S.at(ctx, 0.35); for (const pm of palms) pm.draw(ctx, t, 0.8); ctx.restore();
      S.put(ctx, sea, 0.35);
      const [ox, oy] = S.off(0.35), d = S.dpr, rh = Math.min(H + my - yw, s * 0.3);
      for (let y = 0; y < rh; y += 3) {
        const a = 0.5 * (1 - y / rh) * ((y / 3) % 3 === 2 ? 0.35 : 1), wob = Math.sin(y * 0.35 + t * 1.6) * (1 + y * 0.04);
        ctx.globalAlpha = a;
        ctx.drawImage(refl, 0, (yw + my + y) * d, refl.width, 3 * d, -mx + ox + wob, yw + y + oy, refl.width / d, 3);
      }
      ctx.globalAlpha = 1;
      ctx.save(); S.at(ctx, 0.35);
      drawGlitter(ctx, S, glit, t, sun[0], yw, sr * 0.7, 0.7);
      for (const q of ripples) {
        const y = yw + 3 + (H - yw) * q.v * q.v, x = ((q.x + t * s * 0.01 * (0.3 + q.v)) % (W + 40)) - 20;
        ctx.fillStyle = rgba(C.chalk, 0.18 + 0.2 * q.v); ctx.fillRect(x, y, s * (0.02 + 0.06 * q.l) * (0.3 + q.v), 0.8);
      }
      const bl = s * 0.3, bx = W * 0.5, bwl = yw + s * 0.1 + Math.sin(t * 0.9) * bl * 0.006;
      ctx.fillStyle = rgba(C.timber, 0.25);
      for (let i = 0; i < 6; i++) ctx.fillRect(bx - bl * 0.38 + Math.sin(t * 1.3 + i) * 2, bwl + 2 + i * bl * 0.02, bl * (0.76 - i * 0.08), 1.2);
      ctx.save(); ctx.beginPath(); ctx.rect(-W, -H, W * 3, bwl + H); ctx.clip();
      ctx.translate(bx, bwl); ctx.rotate(0.012 * Math.sin(t * 0.9 + 1));
      drawDhow(ctx, bl, { furled: true, light: C.bone });
      ctx.restore(); ctx.restore();
      S.put(ctx, door, 1);
    };
  },

  sands(S) {
    const { W, H, s, r, mx, my } = S;
    const hz = H * 0.56;
    S.dir = [1, 0.1];
    const sky = [C.ink, mix(C.ink, C.indigo, 0.45), mix(C.indigo, C.ink, 0.15), C.indigo, mix(C.indigo, C.sandDeep, 0.25)];
    const back = S.layer((g) => bands(g, -mx, -my, W + 2 * mx, hz + s * 0.1 + my, sky, 12, 0.9, 0.03));
    const pole = [W * 0.12, H * 0.06];
    const polar = (x, y) => [Math.hypot(x - pole[0], y - pole[1]), Math.atan2(y - pole[1], x - pole[0])];
    const stars = Array.from({ length: 260 }, () => {
      const [d, a] = polar(-W * 0.25 + r() * W * 1.5, -H * 0.15 + r() * (hz + H * 0.15));
      const m = r();
      return { d, a, z: m > 0.97 ? 2 : m > 0.85 ? 1.4 : 0.9, b: 0.35 + 0.6 * r(), ph: r() * TAU };
    });
    const dust = Array.from({ length: 520 }, () => {
      const u = r() * 1.6 - 0.3, v = (r() + r() + r() - 1.5) * s * 0.07;
      const [d, a] = polar(W * 0.35 + u * W * 0.6 - v * 0.5, -H * 0.1 + u * hz * 0.9 + v);
      return { d, a, b: 0.1 + 0.2 * r() };
    });
    const dune = (base, amp, count) => {
      const x0 = -mx - W * 0.1, x1 = W + mx + W * 0.1, span = (x1 - x0) / count, pts = [];
      for (let i = 0; i <= count; i++) {
        const tx = x0 + span * i + (r() - 0.5) * span * 0.35;
        pts.push({ x: tx, y: base + amp * 0.25 * r(), P: false });
        if (i < count) pts.push({ x: tx + span * (0.62 + 0.18 * r()), y: base - amp * (0.35 + 0.65 * r()), P: true });
      }
      const fn = (x) => {
        let i = 0;
        while (i < pts.length - 2 && pts[i + 1].x < x) i++;
        const a = pts[i], b = pts[i + 1], u = clamp((x - a.x) / (b.x - a.x));
        return a.y + (b.y - a.y) * (a.P ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u));
      };
      return { fn, pts, span, amp };
    };
    // Shade fills the body; stepped lit bands hug the windward faces, which
    // face left toward the glow. Slip faces stay dark.
    const drawDune = (g, d, lit, shade, ripple) => {
      const x0 = -mx - W * 0.1, x1 = W + mx + W * 0.1, bottom = H + my, body = curvePath(x0, x1, d.fn, bottom);
      g.fillStyle = lit; g.fill(body);
      g.save(); g.clip(body);
      g.fillStyle = mix(lit, shade, 0.3); g.fill(curvePath(x0, x1, (x) => d.fn(x) + d.amp * 0.6, bottom));
      g.fillStyle = shade;
      d.pts.forEach((P, j) => {
        if (!P.P) return;
        const T = d.pts[j + 1], w = T.x - P.x, sh = new Path2D();
        sh.moveTo(P.x, P.y);
        for (let x = P.x; x < T.x; x += 2) sh.lineTo(x, d.fn(x));
        sh.lineTo(T.x, T.y); sh.quadraticCurveTo(T.x + w * 0.6, T.y + d.amp * 0.3, T.x + w * 1.4 + d.amp, bottom);
        sh.lineTo(P.x - w * 0.6 - d.amp * 0.5, bottom);
        sh.quadraticCurveTo(P.x - w * 0.05, P.y + d.amp * 1.2, P.x, P.y);
        g.fill(sh);
      });
      hatchRect(g, x0, hz - s * 0.3, x1, bottom, 3, -0.5, rgba(C.ink, 0.1), 0.5);
      if (ripple) {
        g.strokeStyle = rgba(C.chalk, 0.07); g.lineWidth = 0.7;
        for (let k = 1; k < 12; k++) strokeCurve(g, x0, x1, (x) => d.fn(x) + k * k * 0.9 + 4 * Math.sin(x / 30 + k), 4);
      }
      g.restore();
      g.strokeStyle = rgba(C.chalk, 0.32); g.lineWidth = 0.9;
      d.pts.forEach((P) => { if (P.P) strokeCurve(g, P.x - d.span * 0.3, P.x, d.fn, 2); });
    };
    const D = H - hz;
    const ridges = [[0.05, 0.05, 5], [0.14, 0.09, 4], [0.28, 0.14, 3], [0.48, 0.22, 3], [0.8, 0.34, 2]]
      .map(([b, a, n]) => dune(hz + D * b, Math.min(D * a, s * a * 1.4), n));
    const tone = (k) => {
      const u = k / 4;
      return [mix(mix(C.indigo, C.sandDeep, 0.28), mix(C.sandDeep, C.indigo, 0.34), u), mix(mix(C.indigo, C.ink, 0.1), mix(C.ink, C.umber, 0.25), u)];
    };
    const far = S.layer((g) => { for (const k of [0, 1]) drawDune(g, ridges[k], ...tone(k), false); });
    const mid = S.layer((g) => {
      for (const k of [2, 3]) drawDune(g, ridges[k], ...tone(k), k === 3);
      // a lone ghaf tree on a windward slope
      const gx = W * 0.24, gyy = ridges[2].fn(gx), tw = s * 0.06;
      g.strokeStyle = mix(C.ink, C.indigo, 0.2); g.lineWidth = 2; g.beginPath();
      g.moveTo(gx, gyy + 2); g.quadraticCurveTo(gx - tw * 0.1, gyy - tw * 0.3, gx + tw * 0.05, gyy - tw * 0.55); g.stroke();
      g.fillStyle = mix(C.ink, C.indigo, 0.2);
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(gx + (r() - 0.45) * tw, gyy - tw * (0.6 + 0.25 * r()), tw * (0.22 + 0.15 * r()), tw * 0.1, 0, 0, TAU); g.fill(); }
    });
    const near = S.layer((g) => drawDune(g, ridges[4], ...tone(4), true));
    const crest = ridges[3].pts.filter((q) => q.P).reduce((a, b) => (Math.abs(b.x - W * 0.62) < Math.abs(a.x - W * 0.62) ? b : a));
    const grains = Array.from({ length: 80 }, () => ({ ph: r(), v: 0.6 + 0.4 * r(), j: r() * TAU, z: 0.7 + r() * 0.8 }));
    return (ctx, t) => {
      S.put(ctx, back, 0.05);
      ctx.save(); S.at(ctx, 0.05);
      const rot = (t - 3.5) * 0.018;
      for (const d of dust) {
        const a = d.a + rot, x = pole[0] + d.d * Math.cos(a), y = pole[1] + d.d * Math.sin(a);
        if (y > hz + s * 0.05 || x < -2 || x > W + 2) continue;
        ctx.fillStyle = rgba(C.bone, d.b); ctx.fillRect(x, y, 0.8, 0.8);
      }
      for (const st of stars) {
        const a = st.a + rot, x = pole[0] + st.d * Math.cos(a), y = pole[1] + st.d * Math.sin(a);
        if (y > hz + s * 0.05 || x < -3 || x > W + 3) continue;
        const b = st.b * (0.75 + 0.25 * Math.sin(t * 2 + st.ph * 7)) * (1 - smooth(hz - s * 0.2, hz, y) * 0.6);
        ctx.fillStyle = rgba(C.chalk, b); ctx.fillRect(x - st.z / 2, y - st.z / 2, st.z, st.z);
        if (st.z > 1.8) { ctx.fillStyle = rgba(C.chalk, b * 0.5); ctx.fillRect(x - 3, y - 0.3, 6, 0.6); ctx.fillRect(x - 0.3, y - 3, 0.6, 6); }
      }
      ctx.restore();
      S.put(ctx, far, 0.15);
      S.put(ctx, mid, 0.4);
      ctx.save(); S.at(ctx, 0.4);
      for (const q of grains) {
        const age = (t / 2.6 + q.ph) % 1, d = age * s * 0.28 * q.v;
        const x = crest.x + d, y = crest.y - age * s * 0.025 + Math.sin(age * 7 + q.j) * s * 0.008 + age * age * s * 0.03;
        ctx.fillStyle = rgba(mix(C.sand, C.chalk, 0.3), Math.sin(Math.PI * age) * 0.5);
        ctx.fillRect(x, y, q.z * (1 + age * 3), q.z * 0.6);
      }
      ctx.strokeStyle = rgba(C.sand, 0.07); ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const k = (t * 0.3 + i / 5) % 1;
        ctx.lineWidth = 2 + 3 * k; ctx.beginPath(); ctx.moveTo(crest.x, crest.y);
        ctx.quadraticCurveTo(crest.x + s * 0.1 * k, crest.y - s * 0.02, crest.x + s * (0.06 + 0.2 * k), crest.y + s * 0.01 * (i - 2)); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.restore();
      S.put(ctx, near, 0.85);
    };
  },

  jebel(S) {
    const { W, H, s, r, mx, my } = S;
    const hz = H * 0.3;
    S.dir = [1, 0.3];
    const sky = [mix(C.indigo, C.bone, 0.5), mix(C.turquoise, C.bone, 0.55), mix(C.bone, C.turquoise, 0.18), mix(C.bone, C.sand, 0.3)];
    const haze = mix(C.bone, C.turquoise, 0.2), pn = fbm(r, 4, 0.5);
    const back = S.layer((g) => {
      bands(g, -mx, -my, W + 2 * mx, hz + my + 1, sky, 9, 1, 0.06);
      const sn = fbm(r, 5, 0.5, true);
      const summit = (x) => hz - s * 0.15 * smooth(W * 1.0, W * 0.3, x) * Math.pow(sn(x / s * 2.2 + 3), 1.3) * smooth(-W * 0.2, W * 0.15, x);
      massif(g, S, summit, mix(mix(C.sandDeep, C.bone, 0.5), haze, 0.3), mix(mix(C.indigo, C.sandDeep, 0.5), haze, 0.45), s * 0.04, 1, null);
      const plat =(x) => hz - s * 0.012 * pn(x / s * 2) - (pn(x / s * 0.7 + 4) > 0.6 ? s * 0.012 : 0);
      g.fillStyle = mix(mix(C.sandDeep, C.indigo, 0.25), haze, 0.5); g.fill(curvePath(-mx, W + mx, plat, H + my));
      g.save(); g.clip(curvePath(-mx, W + mx, plat, H + my));
      hatchRect(g, -mx, hz - s * 0.05, W + mx, hz + H * 0.12, 2.4, 0, rgba(C.umber, 0.12), 0.5);
      g.restore();
      bands(g, -mx, hz + H * 0.1, W + 2 * mx, H, [mix(C.indigo, C.umber, 0.4), mix(C.ink, C.umber, 0.35)], 7, 0.7);
      g.save(); g.beginPath(); g.rect(-mx, hz + H * 0.1, W + 2 * mx, H); g.clip();
      hatchRect(g, -mx, hz + H * 0.1, W + mx, H + my, 3, -1.1, rgba(C.ink, 0.25), 0.5);
      g.restore();
      g.strokeStyle = rgba(mix(C.turquoise, C.bone, 0.15), 0.6); g.lineWidth = 1; g.beginPath();
      for (let y = hz + H * 0.12; y < hz + H * 0.3; y += 3) g.lineTo(W * 0.5 + Math.sin(y * 0.08) * s * 0.012, y);
      g.stroke();
    });
    const shadeStrata = [mix(C.umber, C.indigo, 0.45), mix(C.umber, C.indigo, 0.6), mix(C.timber, C.indigo, 0.35), mix(C.umber, C.indigo, 0.3)];
    const litStrata = [C.ochre, mix(C.sandDeep, C.ochre, 0.4), C.sand, mix(C.ochre, C.umber, 0.3), mix(C.terracotta, C.ochre, 0.6), C.sandDeep];
    const terrain = [];
    const wall = (g, k, side) => {
      const t = k / 3, yT = hz + H * (0.025 + 0.1 * t);
      const yB = k === 3 ? H + my + 2 : hz + H * (0.2 + 0.1 * t + 0.36 * t * t);
      const xTop = W * (0.5 + side * (0.08 + 0.32 * t)) + side * W * 0.03 * (r() - 0.5);
      const xBot = W * (0.5 + side * (0.03 + 0.05 * t));
      const outer = side < 0 ? -mx : W + mx, poly = new Path2D(), edge = [];
      poly.moveTo(outer, yT + s * 0.01);
      for (let i = 1; i <= 8; i++) { const u = i / 8; poly.lineTo(outer + (xTop - outer) * u, yT + s * 0.008 * Math.sin(i * 1.7 + k) * (1 - u) + (r() < 0.3 ? s * 0.004 : 0)); }
      let x = xTop, y = yT;
      edge.push([x, y]);
      const n = 6 + Math.floor(r() * 4);
      for (let i = 1; i <= n; i++) {
        const ny = yT + (yB - yT) * Math.pow(i / n, 0.9), nx = xTop + (xBot - xTop) * (i / n) + side * (r() - 0.5) * W * 0.02;
        edge.push([x - side * (ny - y) * 0.06, ny - (ny - y) * 0.15]); edge.push([nx, ny]);
        x = nx; y = ny;
      }
      edge.forEach((p) => poly.lineTo(...p));
      poly.lineTo(outer, yB); poly.closePath();
      terrain.push(poly);
      const pal = side < 0 ? shadeStrata : litStrata;
      g.save(); g.clip(poly);
      for (let sy = yT - s * 0.05; sy < yB + s * 0.05;) {
        const bh = s * (0.008 + 0.03 * r()) * (0.5 + t);
        g.save(); g.translate(W / 2, sy); g.rotate(-side * 0.02);
        g.fillStyle = pal[Math.floor(r() * pal.length)]; g.fillRect(-W, 0, W * 2 + 2 * mx, bh + 0.8);
        g.restore(); sy += bh;
      }
      hatchRect(g, Math.min(outer, xBot), yT, Math.max(outer, xBot), yB, 2.6, 0, rgba(side < 0 ? C.ink : C.umber, 0.16), 0.5);
      g.beginPath(); edge.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
      g.strokeStyle = side < 0 ? rgba(C.ink, 0.35) : rgba(C.chalk, 0.25); g.lineWidth = s * 0.06 * (0.4 + t); g.stroke();
      g.fillStyle = rgba(haze, (1 - t) * 0.5); g.fill(poly);
      g.restore();
      g.strokeStyle = rgba(side < 0 ? C.sandDeep : C.chalk, 0.5); g.lineWidth = 1; g.beginPath();
      g.moveTo(outer, yT + s * 0.01); g.lineTo(xTop, yT); g.stroke();
    };
    const L1 = S.layer((g) => { for (const k of [0, 1]) for (const sd of [1, -1]) wall(g, k, sd); });
    const L2 = S.layer((g) => { for (const sd of [1, -1]) wall(g, 2, sd); });
    const L3 = S.layer((g) => { for (const sd of [1, -1]) wall(g, 3, sd); });
    const clouds = Array.from({ length: 3 }, (_, i) => ({ x: W * (0.1 + 0.4 * i) + r() * W * 0.1, y: H * (0.06 + 0.07 * r()), w: s * (0.2 + 0.15 * r()), seed: 'c' + i }));
    const shadows = Array.from({ length: 3 }, (_, i) => ({ x: W * (i * 0.45 - 0.1), y: hz + H * (0.15 + 0.22 * i), rx: s * (0.25 + 0.1 * r()) }));
    const fly = (ctx, x, y, ws, bank, flap) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(bank, 1); ctx.fillStyle = mix(C.ink, C.umber, 0.3);
      ctx.beginPath(); ctx.moveTo(-ws / 2, -ws * 0.05 + flap);
      ctx.quadraticCurveTo(-ws * 0.25, -ws * 0.09, 0, -ws * 0.01); ctx.quadraticCurveTo(ws * 0.25, -ws * 0.09, ws / 2, -ws * 0.05 + flap);
      ctx.lineTo(ws * 0.44, -ws * 0.01 + flap); ctx.quadraticCurveTo(ws * 0.2, ws * 0.02, ws * 0.06, ws * 0.04);
      ctx.lineTo(0, ws * 0.12); ctx.lineTo(-ws * 0.06, ws * 0.04);
      ctx.quadraticCurveTo(-ws * 0.2, ws * 0.02, -ws * 0.44, -ws * 0.01 + flap); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    return (ctx, t) => {
      S.put(ctx, back, 0.06);
      ctx.save(); S.at(ctx, 0.08);
      for (const c of clouds) cloud(ctx, makeRng(c.seed), ((c.x + t * s * 0.01) % (W + c.w * 2)) - c.w, c.y, c.w, 0.32, mix(C.chalk, C.bone, 0.4), mix(C.sand, C.bone, 0.4));
      ctx.restore();
      S.put(ctx, L1, 0.25);
      const a = 0.4 + t * 0.32;
      ctx.save(); S.at(ctx, 0.35);
      fly(ctx, W * 0.55 + Math.cos(a) * W * 0.2, hz + H * 0.08 + Math.sin(a) * H * 0.04, s * 0.13, Math.sin(a) < 0 ? -1 : 1, Math.sin(t * 0.8) * s * 0.004);
      fly(ctx, W * 0.42 + Math.cos(-a * 0.8) * W * 0.1, hz - H * 0.04 + Math.sin(-a * 0.8) * H * 0.02, s * 0.04, 1, 0);
      ctx.restore();
      S.put(ctx, L2, 0.5);
      S.put(ctx, L3, 0.85);
      ctx.save(); S.at(ctx, 0.5);
      ctx.beginPath(); ctx.rect(-mx, hz - 1, W + 2 * mx, H); ctx.clip();
      for (const sh of shadows) {
        const x = ((sh.x + t * s * 0.025) % (W + sh.rx * 3)) - sh.rx;
        for (const k of [1, 0.75, 0.5]) {
          ctx.fillStyle = rgba(C.ink, 0.09); ctx.beginPath(); ctx.ellipse(x, sh.y, sh.rx * k, sh.rx * k * 0.3, -0.05, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    };
  },
};

// ---------- mounting ----------

// still: draw one frame, no fades, no end. Used as the backdrop of a level.
export function mountScene(container, id, { reduced = false, still = false, hold = false, duration = 7000, onEnd } = {}) {
  const build = BUILD[id] || BUILD.nizwa;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const fade = Math.min(800, duration / 3);
  // a backdrop rests on the frame the film ends on, so the level opens where the scene stopped
  let S = null, draw = null, grain = null, raf = 0, timer = 0, start = 0, lastMs = still ? duration : duration / 2;
  let stopped = false, ended = false;

  function setup() {
    const rect = container.getBoundingClientRect();
    const W = Math.max(2, Math.round(rect.width)), H = Math.max(2, Math.round(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (S && S.W === W && S.H === H && S.dpr === dpr) return false;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = stage(W, H, dpr, id); draw = build(S); grain = grainPattern(ctx);
    return true;
  }
  function render(ms, fades) {
    const p = clamp(ms / duration);
    S.cam = -Math.cos(Math.PI * p);
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.limestone; ctx.fillRect(0, 0, S.W, S.H);
    draw(ctx, ms / 1000, p);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = grain; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (fades) {
      const a = 1 - clamp(Math.min(ms / fade, hold ? Infinity : (duration - ms) / fade));
      if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = C.limestone; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
    }
  }
  function finish() {
    if (ended || stopped) return;
    ended = true;
    cancelAnimationFrame(raf); clearTimeout(timer);
    if (onEnd) onEnd();
  }
  function tick(now) {
    if (stopped || ended) return;
    if (!start) start = now;
    lastMs = Math.min(duration, now - start);
    render(lastMs, true);
    if (lastMs >= duration) { if (hold) ended = true; else finish(); }
    else raf = requestAnimationFrame(tick);
  }

  setup();
  let ro = null;
  const onResize = () => { if (!stopped && setup() && (reduced || still || ended)) render(lastMs, !(reduced || still)); };
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(onResize); ro.observe(container); }
  else window.addEventListener('resize', onResize);

  if (still) {
    render(lastMs, false);
  } else if (reduced) {
    render(lastMs, false);
    if (!hold) timer = setTimeout(finish, duration);
  } else {
    render(0, true);
    raf = requestAnimationFrame(tick);
    if (!hold) timer = setTimeout(finish, duration + 1500); // if frames are throttled, still end
  }

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf); clearTimeout(timer);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      canvas.remove();
    },
  };
}
