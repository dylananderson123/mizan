// Screenshots of chosen levels at chosen sizes, for looking at a layout.
//   node tools/shots.mjs 667x375 1,3,5 [done]
// Files go to shots/look/. `done` also solves each level and shoots the finish.
import { launch } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number);
const levels = (process.argv[3] ?? '1,2,3,4,5').split(',').map(Number);
const done = process.argv[4] === 'done';
const BASE = 'http://127.0.0.1:8963/?dev&noopening';
const OUT = new URL('../shots/look/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const b = await launch({ width: w, height: h, mobile: w < 900 });
const page = await b.open(BASE);
await page.eval('localStorage.clear()'); await page.goto(BASE);
await page.eval('mizanDev.unlockAll()'); await page.goto(BASE);
const answer = (id) => page.eval(`(async () => { const { levelDef } = await import('/src/puzzles/definitions.js'); const { solve } = await import('/src/puzzles/kit.js'); const d = levelDef(${JSON.stringify(id)}); return { nodes: d.nodes, givens: d.givens, sol: solve(d, { limit: 1 })[0] }; })()`);
for (const n of levels) {
  await page.eval(`[...document.querySelectorAll('.menu-nav .btn')].find((b) => b.textContent.trim() === 'Journey')?.click()`).catch(() => {});
  await page.waitFor('.chapters', 3000).catch(() => {});
  await page.eval(`[...document.querySelectorAll('.chapter .btn.go')][${n - 1}].click()`);
  await page.waitFor('.play'); await page.sleep(900);
  await page.shot(`${OUT}${w}x${h}-L${n}.png`);
  if (done) {
    if (n === 2) await page.drag('.tray .tile[data-tile="t10"]', '.socket-hit[data-cell="6"]');
    else if (n === 3) { await page.tap('.tile[data-tile="t8"]'); await page.tap('.socket-hit[data-cell="6"]'); }
    else { const a = await answer(`m${n}`); for (const e of a.nodes.filter((x) => a.givens[x] === undefined)) { await page.tap(`.tile[data-tile="t${a.sol[e]}"]`); await page.tap(`.socket-hit[data-cell="${e}"]`); } }
    await page.waitFor('.play > .done:not(.hidden)', 9000).catch(() => {}); await page.sleep(2600);
    await page.shot(`${OUT}${w}x${h}-L${n}-done.png`);
  }
  await page.goto(BASE);
}
console.log('errors:', JSON.stringify(page.logs.filter((l) => !/preload/i.test(l.text))));
await b.close();
