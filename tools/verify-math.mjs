// An independent check of the five levels. It does NOT use the puzzle kit's
// solver or rules: every rule is written out again by hand here, and every
// answer is found by plain brute force, so a bug in the kit cannot hide.
//
//   node tools/verify-math.mjs
import { LEVELS } from '../src/puzzles/definitions.js';

let failed = 0;
const check = (c, m) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${m}`); if (!c) failed++; };
const def = (id) => LEVELS.find((d) => d.id === id);

// Square rules, written by hand. Cells are row-major: 0 1 2 / 3 4 5 / 6 7 8.
const LINES3 = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const isMagic3 = (g, t) => LINES3.every((l) => l.reduce((a, i) => a + g[i], 0) === t);

// All ways to fill a square: choose which stones go on which free cells.
function allSquares(d, t) {
  const found = [];
  const g = Array(9).fill(0);
  for (const [c, v] of Object.entries(d.givens)) g[+c] = v;
  const free = [...Array(9).keys()].filter((c) => !g[c]);
  const pool = d.stones.filter((v) => !Object.values(d.givens).includes(v));
  const used = new Set();
  const go = (k) => {
    if (k === free.length) { if (isMagic3(g, t)) found.push([...g]); return; }
    for (const v of pool) {
      if (used.has(v)) continue;
      used.add(v); g[free[k]] = v;
      // prune: any complete line that is already wrong
      if (LINES3.every((l) => l.some((i) => !g[i]) || l.reduce((a, i) => a + g[i], 0) === t)) go(k + 1);
      g[free[k]] = 0; used.delete(v);
    }
  };
  go(0);
  return found;
}

// ---- Level 1
{
  const d = def('m1');
  const s = allSquares(d, 15);
  check(s.length === 1, `L1 has exactly one solution (found ${s.length}): ${s[0]?.join(' ')}`);
  check(d.stones.reduce((a, b) => a + b, 0) === 45 && 45 / 3 === 15, 'L1 target 15 = (1+...+9)/3');
  check(Object.keys(d.givens).length === 4, 'L1 gives four stones');
}

// ---- Level 2
{
  const d = def('m2');
  const g = Array(9).fill(0);
  for (const [c, v] of Object.entries(d.initial)) g[+c] = v;
  const bad = LINES3.filter((l) => l.reduce((a, i) => a + g[i], 0) !== 15);
  const crossing = [...new Set(bad.flat())].filter((c) => bad.every((l) => l.includes(c)));
  check(bad.length === 3, `L2 starts with exactly three wrong lines (${bad.length})`);
  check(crossing.length === 1 && g[crossing[0]] === 10, `L2 wrong lines cross at one stone, the ${g[crossing[0]]} (cell ${crossing})`);
  const fixed = [...g]; fixed[crossing[0]] = 8;
  check(isMagic3(fixed, 15), 'L2 swapping that 10 for an 8 makes every line 15');
  check(d.stones.includes(8) && !Object.values(d.initial).includes(8), 'L2 tray holds the 8');
  const s = allSquares(d, 15);
  console.log(`       L2 solutions using any nine of the eleven stones: ${s.length}`);
  for (const x of s) console.log('        ', x.join(' '));
  check(s.length >= 1, 'L2 is solvable');
  // each wrong stone choice: can the player get stuck? every stone in the tray
  check(new Set(d.stones).size === d.stones.length, 'L2 stones are distinct');
}

// ---- Level 3
{
  const d = def('m3');
  const g = Array(9).fill(0);
  for (const [c, v] of Object.entries(d.initial)) g[+c] = v;
  check(!isMagic3(g, 15), 'L3 starts broken');
  let oneSwap = [];
  for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) {
    const h = [...g]; [h[a], h[b]] = [h[b], h[a]];
    if (isMagic3(h, 15)) oneSwap.push([a, b, h.join(' ')]);
  }
  check(oneSwap.length === 1, `L3 exactly one swap repairs it (${oneSwap.length}): ${JSON.stringify(oneSwap)}`);
  const all = allSquares({ ...d, givens: {} }, 15);
  check(all.length === 8, `L3 the 1-9 square has 8 forms (${all.length})`);
  const dist = all.map((s) => { let diff = 0; s.forEach((v, i) => { if (v !== g[i]) diff++; }); return diff; });
  console.log(`       L3 cells differing from each of the 8 forms: ${dist.join(', ')}`);
  check(dist.filter((x) => x === 2).length === 1 && dist.filter((x) => x <= 2).length === 1, 'L3 only one form is one swap away');
  check(dist.every((x) => x !== 3), 'L3 no form sits one three-cycle away');
}

// ---- Level 4
{
  const d = def('m4');
  const sides = [[0,3,4,1],[1,5,6,2],[2,7,8,0]];
  const sols = [];
  const g = Array(9).fill(0);
  for (const [c, v] of Object.entries(d.givens)) g[+c] = v;
  const free = [...Array(9).keys()].filter((c) => !g[c]);
  const pool = d.stones.filter((v) => !Object.values(d.givens).includes(v));
  const used = new Set();
  const go = (k) => {
    if (k === free.length) {
      const t = sides.map((s) => s.reduce((a, i) => a + g[i], 0));
      if (t[0] === t[1] && t[1] === t[2]) sols.push([[...g], t[0]]);
      return;
    }
    for (const v of pool) { if (used.has(v)) continue; used.add(v); g[free[k]] = v; go(k + 1); g[free[k]] = 0; used.delete(v); }
  };
  go(0);
  console.log(`       L4 solutions: ${sols.map((s) => s[0].join('')+' total '+s[1]).join(' | ')}`);
  check(sols.length === 2, `L4 has two solutions (${sols.length})`);
  check(sols.every((s) => s[1] === 20), 'L4 both total 20');
  // the two differ by exchanging two stones on one side's middle
  const diff = sols.length === 2 ? sols[0][0].map((v, i) => (v !== sols[1][0][i] ? i : -1)).filter((i) => i >= 0) : [];
  check(diff.length === 2 && sides.some((s) => s.slice(1, 3).every((c) => diff.includes(c))), `L4 the two differ only by a middle pair on one side (nodes ${diff})`);
  // with NO givens, which totals are possible (NRICH says 17 to 23)
  const totals = new Set();
  const h = Array(9).fill(0); const u2 = new Set();
  const go2 = (k) => { if (k === 9) { const t = sides.map((s) => s.reduce((a, i) => a + h[i], 0)); if (t[0] === t[1] && t[1] === t[2]) totals.add(t[0]); return; } for (let v = 1; v <= 9; v++) { if (u2.has(v)) continue; u2.add(v); h[k] = v; go2(k + 1); u2.delete(v); } };
  go2(0);
  check([...totals].sort().join() === '17,19,20,21,23', `L4 possible totals with no givens: ${[...totals].sort()}`);
  // do the givens pin the total to one value? (so the solver cannot be 'right' by another total)
  check(new Set(sols.map((s) => s[1])).size === 1, 'L4 givens fix the total');
}

// ---- Level 5
{
  const d = def('m5');
  const opp = (i) => (i + 4) % 8;
  for (const [k, ex] of d.examples.entries()) {
    check(ex.every((v, i) => v + ex[opp(i)] === 9) && new Set(ex).size === 8 && ex.every((v) => v >= 1 && v <= 8), `L5 example ${k + 1} is a ring of 1-8 with opposites totalling 9`);
  }
  const g = Array(8).fill(0);
  for (const [c, v] of Object.entries(d.givens)) g[+c] = v;
  const free = [...Array(8).keys()].filter((c) => !g[c]);
  const pool = d.stones.filter((v) => !Object.values(d.givens).includes(v));
  const sols = []; const used = new Set();
  const go = (k) => {
    if (k === free.length) { const t = [0,1,2,3].map((i) => g[i] + g[i + 4]); if (t.every((x) => x === t[0])) sols.push([...g]); return; }
    for (const v of pool) { if (used.has(v)) continue; used.add(v); g[free[k]] = v; go(k + 1); g[free[k]] = 0; used.delete(v); }
  };
  go(0);
  check(sols.length === 1, `L5 has exactly one completion (${sols.length}): ${sols[0]?.join(' ')}`);
  // Alternative rules a thoughtful player could guess from the three rings
  const rings = d.examples;
  const rules = {
    'opposites total 9': (r) => r.every((v, i) => v + r[(i + 4) % 8] === 9),
    'neighbours total 9': (r) => r.every((v, i) => v + r[(i + 1) % 8] === 9),
    'every other stone is odd/even alternately': (r) => r.every((v, i) => v % 2 === r[(i + 1) % 8] % 2),
    'opposites differ by 4': (r) => r.every((v, i) => Math.abs(v - r[(i + 4) % 8]) === 4),
    'opposites differ by the same amount': (r) => new Set(r.slice(0, 4).map((v, i) => Math.abs(v - r[i + 4]))).size === 1,
    'opposites share one product': (r) => new Set(r.slice(0, 4).map((v, i) => v * r[i + 4])).size === 1,
    'next stone is 4 or 5 away round the ring (mod 8)': (r) => r.every((v, i) => [4, 5, 3].includes(Math.abs(v - r[(i + 1) % 8]))),
    'three in a row total the same each time': (r) => new Set(r.map((v, i) => v + r[(i + 1) % 8] + r[(i + 2) % 8])).size === 1,
    'top row (first four) total 18': (r) => r.slice(0, 4).reduce((a, b) => a + b, 0) === 18,
    'halves total the same': (r) => r.slice(0, 4).reduce((a, b) => a + b, 0) === r.slice(4).reduce((a, b) => a + b, 0),
    'first stone + last stone = 9 (rotated)': (r) => r[0] + r[7] === 9,
  };
  for (const [name, f] of Object.entries(rules)) {
    const fits = rings.every(f);
    if (name !== 'opposites total 9') check(!fits, `L5 rival rule does not fit all three: ${name}`);
  }
  check(rings.every(rules['opposites total 9']), 'L5 the real rule fits all three');
  // rival rules fitting the three examples would give the same completions? show those that fit
}

console.log(failed ? `\n${failed} FAILED` : '\nAll maths checks passed');
process.exit(failed ? 1 : 0);
