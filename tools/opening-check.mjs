// The real first launch, as a stranger sees it: clean storage, no flags.
// Shots of the opening film, then the menu. Prints every console message
// (including the font-preload warning the other tools hide).
//   node tools/opening-check.mjs [390x844|1280x720]
import { launch } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number);
const OUT = new URL('../shots/look/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const b = await launch({ width: w, height: h, mobile: w < 900 });
const page = await b.open('http://127.0.0.1:8963/');
await page.eval('localStorage.clear()');
const t0 = Date.now();
await page.goto('http://127.0.0.1:8963/');
for (const t of [0.8, 3, 6, 9.5]) {
  await page.sleep(Math.max(0, t * 1000 - (Date.now() - t0)));
  await page.shot(`${OUT}open-${w}x${h}-${t}s.png`);
}
await page.sleep(800);
const nav = await page.eval(`[...document.querySelectorAll('.op-nav .btn, .menu-nav .btn')].map((b) => b.textContent.trim().replace(/\\s+/g, ' '))`);
console.log('buttons after the film:', JSON.stringify(nav));
console.log('console messages:', JSON.stringify(page.logs));
await b.close();
