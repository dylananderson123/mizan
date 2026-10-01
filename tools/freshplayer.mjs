// The stranger's playthrough. Clean storage, no developer flag, the real
// opening film, and every button found by the words printed on it, the way a
// person finds them. Only the puzzle answers come from the engine (a person
// would work them out). Shots at each moment go to shots/fresh/.
//   node tools/freshplayer.mjs [390x844|1280x720|667x375]
import { launch } from './cdp.mjs';
import { mkdirSync } from 'node:fs';
const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number);
const tag = `${w}x${h}`;
const OUT = new URL('../shots/fresh/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const URL0 = 'http://127.0.0.1:8963/';
let failed = 0;
const check = (c, m) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${m}`); if (!c) failed++; };
const b = await launch({ width: w, height: h, mobile: w < 900 });
const page = await b.open(URL0);
await page.eval('localStorage.clear()');
await page.goto(URL0);
const shot = (n) => page.shot(`${OUT}${tag}-${n}.png`);
const clickText = (txt, scope = 'button') => page.eval(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope)})].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden' && !x.closest('.hidden'); }).reverse().find((x) => x.textContent.trim().replace(/\\s+/g, ' ').startsWith(${JSON.stringify(txt)})); if (!b) return false; b.click(); return true; })()`);
const answer = (id) => page.eval(`(async () => { const { levelDef } = await import('/src/puzzles/definitions.js'); const { solve } = await import('/src/puzzles/kit.js'); const d = levelDef(${JSON.stringify(id)}); return { nodes: d.nodes, givens: d.givens, sol: solve(d, { limit: 1 })[0] }; })()`);
const coins = () => page.text('.coin-chip .coin-num');
const place = async (v, c) => { await page.tap(`.tile[data-tile="t${v}"]`); await page.tap(`.socket-hit[data-cell="${c}"]`); };

// 1. the opening, then the menu
await page.sleep(1200); await shot('01-opening');
check(await clickText('Skip'), 'the opening can be skipped');
await page.sleep(1500); await shot('02-menu');
const menuButtons = await page.eval(`[...document.querySelectorAll('.op-nav .btn, .menu-nav .btn')].map((b) => b.textContent.trim().replace(/\\s+/g, ' '))`);
console.log('  menu offers:', JSON.stringify(menuButtons));
check(menuButtons[0] === 'Journey', 'the first button is Journey');
await clickText('Journey'); await page.waitFor('.chapters'); await page.sleep(500); await shot('03-journey');

// 2. level 1
check(await clickText('Begin', '.chapter .btn'), 'Level 1 has a Begin button');
await page.waitFor('.play'); await page.sleep(700); await shot('04-level1');
const first = await page.text('.say-text');
check(/drag|tap/i.test(first), `a stranger is told how to move a stone: "${first}"`);
const a1 = await answer('m1');
const gaps = a1.nodes.filter((x) => a1.givens[x] === undefined);
await place(a1.sol[gaps[0]], gaps[0]); await page.sleep(500); await shot('05-first-stone');
check(/mark|total/i.test(await page.text('.say-text')), `after the first stone the marks are explained: "${await page.text('.say-text')}"`);
await place(a1.sol[gaps[2]], gaps[1]); await page.sleep(500); await shot('06-wrong-stone'); // a wrong stone on purpose
for (const g of gaps) { const t = await page.eval(`document.querySelector('.socket-hit[data-cell="${g}"]')`); }
await page.eval(`[...document.querySelectorAll('.act')].find((x) => /Undo/.test(x.textContent)).click()`); await page.sleep(300);
for (const g of gaps.slice(1)) await place(a1.sol[g], g);
await page.waitFor('.play > .done:not(.hidden)', 9000).catch(() => {});
await page.sleep(700); await shot('07-finish-0.7s');
await page.sleep(1800); await shot('08-finish-2.5s');
await page.sleep(2400); await shot('09-finish-4.9s');
check((await coins()) === '10', `the counter shows ${await coins()} after Level 1`);
await clickText('Continue', '.done .btn');
await page.waitFor('.interlude.ready .il-go', 15000).catch(() => {}); await page.sleep(3000); await shot('10-interlude');
await clickText('Skip'); await page.waitFor('.play', 5000); await page.sleep(1800); await shot('11-level2');
await clickText('Hint'); await page.sleep(400); await shot('12-level2-hint');
await page.drag('.tray .tile[data-tile="t10"]', '.socket-hit[data-cell="6"]');
await page.waitFor('.play > .done:not(.hidden)', 9000).catch(() => {}); await page.sleep(2800); await shot('13-level2-done');
check((await coins()) === '25', `Level 2: counter ${await coins()}`);
// 3. open the stones shop once there are coins to spend
await clickText('Journey', '.done .btn'); await page.waitFor('.chapters'); await page.sleep(400); await shot('14-journey-after-2');
console.log('  stones row says:', await page.text('.stones-row .stones-text small'));
console.log('console problems:', JSON.stringify(page.logs));
check(page.logs.filter((l) => !/preload/i.test(l.text)).length === 0, 'no console errors');
await b.close();
console.log(failed ? `${failed} FAILED` : 'ok');
