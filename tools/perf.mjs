// Measures the game, never guesses. Real Chrome, CPU slowed 4x to stand in for
// a modest phone. Reports what loads, how fast, and how smooth the heaviest
// moments are (a scene backdrop, the finish burst, the interlude film).
//
//   node tools/perf.mjs
import { launch } from './cdp.mjs';

const BASE = 'http://127.0.0.1:8963/?dev';
const b = await launch({ width: 390, height: 844, mobile: true });
const page = await b.open(BASE + '&noopening');
const reqs = new Map();
const pending = [];
page.send('Network.enable');
page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
// network log through the page's own timing API instead: simpler and exact
await page.eval('localStorage.clear()');
await page.goto(BASE);
await page.sleep(2500);
const load = await page.eval(`(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource').map((r) => ({ name: r.name.replace(location.origin, ''), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024), ms: Math.round(r.duration) }));
  const paint = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
  return { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), paint, res, totalKb: res.reduce((a, r) => a + r.kb, 0) };
})()`);
console.log('LOAD (4x slower CPU, with the opening film):');
console.log('  DOMContentLoaded', load.dcl, 'ms | load', load.load, 'ms | paints', JSON.stringify(load.paint));
console.log('  requests:', load.res.length, '| transferred:', load.totalKb, 'KB');
for (const r of load.res.sort((a, z) => z.kb - a.kb).slice(0, 8)) console.log(`   ${String(r.kb).padStart(5)} KB ${String(r.ms).padStart(5)} ms  ${r.name}`);
const external = load.res.filter((r) => !r.name.startsWith('/'));
console.log('  requests that leave the game:', external.length ? JSON.stringify(external) : 'none');

// frame pacing: record rAF gaps during a window
const frames = async (label, ms) => {
  await page.eval(`window.__f = []; (function loop(t) { window.__f.push(t); if (window.__f.length < 4000) window.__raf = requestAnimationFrame(loop); })(performance.now())`);
  await page.sleep(ms);
  const r = await page.eval(`(() => { cancelAnimationFrame(window.__raf); const f = window.__f; const gaps = f.slice(1).map((t, i) => t - f[i]); gaps.sort((a, b) => a - b); const n = gaps.length; return { n, fps: Math.round(1000 / (gaps.reduce((a, b) => a + b, 0) / n)), p95: Math.round(gaps[Math.floor(n * 0.95)]), worst: Math.round(gaps[n - 1]), over50: gaps.filter((g) => g > 50).length }; })()`);
  console.log(`  ${label.padEnd(34)} ${String(r.fps).padStart(3)} fps | p95 gap ${r.p95} ms | worst ${r.worst} ms | frames over 50 ms: ${r.over50}`);
  return r;
};
const longTasks = () => page.eval(`window.__lt`);
await page.eval(`window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] })`);

console.log('FRAME PACING (4x slower CPU):');
await frames('menu with the opening film', 3000);
await page.goto(BASE + '&noopening');
await page.eval('mizanDev.unlockAll()');
await page.goto(BASE + '&noopening');
await page.eval(`window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] })`);
await page.eval(`[...document.querySelectorAll('.menu-nav .btn')].find((x) => x.textContent.trim() === 'Journey').click()`);
await page.waitFor('.chapters');
const answer = (id) => page.eval(`(async () => { const { levelDef } = await import('/src/puzzles/definitions.js'); const { solve } = await import('/src/puzzles/kit.js'); const d = levelDef(${JSON.stringify(id)}); return { nodes: d.nodes, givens: d.givens, sol: solve(d, { limit: 1 })[0] }; })()`);
await frames('journey list (idle)', 1500);
for (const n of [2, 5]) {
  await page.eval(`[...document.querySelectorAll('.chapter .btn.go')][${n - 1}].click()`);
  await page.waitFor('.play'); await page.sleep(900);
  await frames(`level ${n} scene backdrop (idle)`, 2500);
  if (n === 2) {
    await page.eval(`window.__f = []; (function loop(t) { window.__f.push(t); window.__raf = requestAnimationFrame(loop); })(performance.now())`);
    await page.drag('.tray .tile[data-tile="t10"]', '.socket-hit[data-cell="6"]');
    await page.sleep(5500);
    const r = await page.eval(`(() => { cancelAnimationFrame(window.__raf); const f = window.__f; const gaps = f.slice(1).map((t, i) => t - f[i]); gaps.sort((a, b) => a - b); const n = gaps.length; return { fps: Math.round(1000 / (gaps.reduce((a, b) => a + b, 0) / n)), p95: Math.round(gaps[Math.floor(n * 0.95)]), worst: Math.round(gaps[n - 1]), over50: gaps.filter((g) => g > 50).length }; })()`);
    console.log(`  ${'level 2 finish burst (5.5 s)'.padEnd(34)} ${String(r.fps).padStart(3)} fps | p95 gap ${r.p95} ms | worst ${r.worst} ms | frames over 50 ms: ${r.over50}`);
    await page.eval(`document.querySelector('.play > .done .btn:not(.primary)').click()`);
    await page.waitFor('.chapters');
  }
}
console.log('  long tasks (>50 ms) seen on the way:', JSON.stringify(await longTasks()));
const mem = await page.eval(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null`);
console.log('MEMORY: JS heap after the above', mem, 'MB');
const nodes = await page.eval(`document.getElementsByTagName('*').length`);
console.log('DOM elements on the current screen:', nodes);
console.log('console problems:', JSON.stringify(page.logs.filter((l) => !/preload/i.test(l.text))));
await b.close();
