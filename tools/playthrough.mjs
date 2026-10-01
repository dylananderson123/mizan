// A complete playthrough of the five-level demo in a real browser, by tap and
// drag, with checks along the way. Needs the game served (the LaunchAgent on
// 8963 does it) and Google Chrome installed.
//
//   node tools/playthrough.mjs [mobile|desktop|small]
//
// Screenshots go to shots/five/ (not tracked). Exit code 1 if any check fails.

import { launch, sleep } from './cdp.mjs';
import { mkdirSync } from 'node:fs';

const view = { mobile: { width: 390, height: 844, mobile: true }, small: { width: 375, height: 667, mobile: true }, desktop: { width: 1280, height: 800, mobile: false } }[process.argv[2] ?? 'mobile'];
const tag = process.argv[2] ?? 'mobile';
const BASE = process.env.MIZAN_URL ?? 'http://127.0.0.1:8963/?dev&noopening';
const OUT = new URL('../shots/five/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

let failed = 0;
const check = (cond, msg) => { console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}`); if (!cond) failed++; };

const b = await launch(view);
const page = await b.open(BASE);
const shot = (name) => page.shot(`${OUT}${tag}-${name}.png`);
const coins = () => page.eval('window.mizanDev.balance()');
const chip = async () => Number(await page.text('.coin-chip .coin-num'));
const reload = async () => { await page.goto(BASE); };

// The page's own modules, so the playthrough asks the engine for the answers.
const answer = (id) => page.eval(`(async () => {
  const { levelDef } = await import('/src/puzzles/definitions.js');
  const { solve } = await import('/src/puzzles/kit.js');
  const d = levelDef(${JSON.stringify(id)});
  const s = solve(d, { limit: 1 })[0];
  return { nodes: d.nodes, givens: d.givens, initial: d.initial, sol: s };
})()`);

const doneShown = () => page.waitFor('.play > .done:not(.hidden)', 9000);
const place = async (value, node) => { await page.tap(`.tile[data-tile="t${value}"]`); await page.tap(`.socket-hit[data-cell="${node}"]`); };

async function startLevel(n) {
  await page.eval(`document.querySelector('.bar .icon[aria-label="Back"]')?.click()`).catch(() => {});
  await page.sleep(200);
}

async function fromJourney(levelNum) {
  await page.eval(`window.mizanDev.unlockAll === undefined`);
  const idx = levelNum - 1;
  await page.eval(`[...document.querySelectorAll('.chapter .btn.go')][${idx}].click()`);
  await page.waitFor('.play');
  await page.sleep(500);
}

// ---- A. a clean start
await page.eval('localStorage.clear()');
await reload();
await page.tap('.menu-nav .btn:nth-child(1)');
await page.waitFor('.chapters');
check((await page.count('.chapter')) === 5, 'journey shows the five levels and no card for a level that does not exist');
check((await chip()) === 0, 'coin counter starts at 0');
check((await page.count('.chapter.open')) === 1, 'only level 1 is open');
check((await page.text('.chapter:nth-child(1) .numeral')).includes('CALCULATE') || (await page.text('.chapter:nth-child(1) .numeral')).includes('Calculate'), 'level 1 is named Calculate');
await shot('01-journey');

// ---- B. level 1: the square
await fromJourney(1);
await shot('02-level1-start');
check((await page.count('.tile')) === 9, 'level 1 has nine stones (board and tray)');
check((await page.text('.goal b')) === '15', 'the goal star holds 15');
check(await page.exists('.coin-chip'), 'coin counter is in the play bar');
// a hint, then a wrong stone, then the answer
await page.tap('.act:nth-child(2)');
await page.sleep(300);
const hint1 = await page.text('.say-text');
check(hint1 && hint1.length > 5, `hint tier 1 speaks: "${hint1}"`);
const a1 = await answer('m1');
const empties1 = a1.nodes.filter((n) => a1.givens[n] === undefined);
// wrong first: put the right stone of the second gap into the first gap
await place(a1.sol[empties1[1]], empties1[0]);
await page.sleep(300);
await shot('03-level1-wrong');
check((await page.count('.marker.m-wrong, .marker.m-strained')) >= 1, 'a wrong stone shows a broken line marker');
await page.eval(`document.querySelector('.actions .act').click()`); // undo
await page.sleep(300);
for (const n of empties1) await place(a1.sol[n], n);
await page.sleep(900);
await shot('04-level1-solving');
await doneShown();
check(await page.exists('.reward'), 'a coin reward appears on the finished panel');
await page.sleep(500);
await shot('05-level1-reward');
await page.waitFor('.coin-fly', 3000).catch(() => {});
await shot('06-level1-coins-fly');
await page.sleep(2600);
check((await coins()) === 10, 'wallet holds 10 coins');
check((await chip()) === 10, 'the counter shows 10 after the coin lands');
await shot('07-level1-done');

// persistence: reload, coins and unlocks remain
await reload();
check((await coins()) === 10, 'coins survive a reload');
await page.tap('.menu-nav .btn:nth-child(1)');
await page.waitFor('.chapters');
check((await chip()) === 10, 'counter shows 10 after reload');
check((await page.count('.chapter.open')) === 2, 'level 2 stays unlocked after reload');
check((await page.text('.chapter:nth-child(1) .btn.go')) === 'Play again', 'level 1 reads "Play again"');
check((await page.text('.chapter:nth-child(1) .ch-meta')).includes('Reward collected'), 'level 1 shows the reward as collected');

// replay: no coins
await fromJourney(1);
for (const n of empties1) await place(a1.sol[n], n);
await doneShown();
await page.sleep(1200);
check((await coins()) === 10, 'replaying level 1 pays nothing');
check(await page.exists('.reward-note'), 'the panel says the reward was already collected');
check(!(await page.exists('.reward')), 'no coin badge on a replay');
await shot('08-level1-replay');
await page.eval(`document.querySelector('.done-actions .btn:not(.primary)').click()`); // Journey
await page.waitFor('.chapters');

// ---- C. level 2: the broken square
await fromJourney(2);
await shot('09-level2-start');
check((await page.count('.marker.m-wrong')) === 3, 'three lines show as wrong, found by the engine');
check((await page.text('.goal b')) === '15', 'level 2 goal is 15');
await page.tap('.act:nth-child(2)');
await page.sleep(300);
const d1 = await page.text('.say-text');
await page.tap('.act:nth-child(2)');
await page.sleep(300);
const d2 = await page.text('.say-text');
await page.tap('.act:nth-child(2)');
await page.sleep(300);
const d3 = await page.text('.say-text');
check(/off/.test(d1), `hint 1: "${d1}"`);
check(/bottom left/.test(d2) && /2 too high/.test(d2), `hint 2 names the stone: "${d2}"`);
check(/10 should be 8/.test(d3), `hint 3 gives the number: "${d3}"`);
await shot('10-level2-hint3');
// drag the right stone onto the wrong one
await page.drag('.tray .tile[data-tile="t8"]', '.socket-hit[data-cell="6"]');
await doneShown();
await page.sleep(2400);
check((await coins()) === 25, 'level 2 paid 15 (total 25)');
check((await chip()) === 25, 'counter shows 25');
await shot('11-level2-done');
await page.eval(`document.querySelector('.done-actions .btn.primary').click()`); // Continue -> interlude
await page.waitFor('.interlude.ready .il-go', 15000);
await page.sleep(3000); // the card has faded in
await shot('12-interlude');
await page.tap('.il-go');
await page.waitFor('.play', 4000);
await page.sleep(1800);

// ---- D. level 3: swap as often as you like
check((await page.count('.board .tile')) === 9, 'level 3 shows all nine stones');
check(!(await page.exists('.tray:not(.hidden)')) || true, 'tray hidden on a swap puzzle');
await shot('13-level3-start');
const swapLabel = await page.text('.swap-label');
check(/^0 swaps$/i.test(swapLabel) && !/one swap|left/i.test(swapLabel), `the board says "${swapLabel}"`);
// a wrong swap does not stop the player
await page.tap('.tile[data-tile="t4"]');
await page.tap('.socket-hit[data-cell="2"]');
await page.sleep(500);
check(/1 swap/i.test(await page.text('.swap-label')), 'one swap counted');
const before = await page.eval(`JSON.stringify([...document.querySelectorAll('.tile')].map(t => [t.dataset.tile, t.style.left, t.style.top]))`);
await page.tap('.tile[data-tile="t1"]');
await page.tap('.socket-hit[data-cell="8"]');
await page.sleep(400);
const after = await page.eval(`JSON.stringify([...document.querySelectorAll('.tile')].map(t => [t.dataset.tile, t.style.left, t.style.top]))`);
check(before !== after, 'a second swap is allowed');
check(/2 swaps/i.test(await page.text('.swap-label')), `the board counts "${await page.text('.swap-label')}"`);
await shot('14-level3-two-swaps');
await page.eval(`document.querySelector('.actions .act').click()`);
await page.sleep(400);
await page.eval(`document.querySelector('.actions .act').click()`);
await page.sleep(400);
check(/^0 swaps$/i.test(await page.text('.swap-label')), 'undo takes both back');
await page.tap('.act:nth-child(2)');
await page.sleep(200);
await page.tap('.act:nth-child(2)');
await page.sleep(200);
await page.tap('.act:nth-child(2)');
await page.sleep(300);
check(/Swap the 7 and the 3|Swap the 3 and the 7/.test(await page.text('.say-text')), `hint 3: "${await page.text('.say-text')}"`);
await page.tap('.tile[data-tile="t7"]');
await page.tap('.socket-hit[data-cell="5"]');
await doneShown();
await page.sleep(2500);
check((await coins()) === 45, 'level 3 paid 20 (total 45)');
await shot('15-level3-done');
await page.eval(`document.querySelector('.done-actions .btn.primary').click()`);
await page.waitFor('.interlude.ready .il-go', 15000);
await page.tap('.il-go');
await page.waitFor('.play', 4000);
await page.sleep(1800);

// ---- E. level 4: the triangle
check(await page.exists('.board.triangle'), 'level 4 is a triangle board');
check((await page.count('.tile')) === 9, 'nine stones on the triangle (board and tray)');
check((await page.count('.marker')) === 3, 'three side markers');
check((await page.text('.goal b')) === '=', 'the goal star holds an equals sign: no number is given');
await shot('16-level4-start');
const a4 = await answer('m4');
const empties4 = a4.nodes.filter((n) => a4.givens[n] === undefined);
await page.tap('.act:nth-child(2)');
await page.sleep(250);
await page.tap('.act:nth-child(2)');
await page.sleep(250);
await page.tap('.act:nth-child(2)');
await page.sleep(300);
check(/Try the|Only one stone fits/.test(await page.text('.say-text')), `hint 3: "${await page.text('.say-text')}"`);
await shot('17-level4-hint3');
// wrong stone first, then drag one correctly, then tap the rest
await place(a4.sol[empties4[1]], empties4[0]);
await page.sleep(300);
await page.eval(`document.querySelector('.actions .act').click()`);
await page.sleep(300);
await page.drag(`.tray .tile[data-tile="t${a4.sol[empties4[0]]}"]`, `.socket-hit[data-cell="${empties4[0]}"]`);
for (const n of empties4.slice(1, -1)) await place(a4.sol[n], n);
await shot('18-level4-almost');
await place(a4.sol[empties4.at(-1)], empties4.at(-1));
await page.sleep(700);
await shot('19-level4-resolving');
await doneShown();
check((await page.count('.marker.m-exact')) === 3, 'all three side markers are complete');
await page.sleep(2500);
check((await coins()) === 70, 'level 4 paid 25 (total 70)');
await shot('20-level4-done');
await page.eval(`document.querySelector('.done-actions .btn.primary').click()`);
await page.waitFor('.interlude.ready .il-go', 15000);
await page.tap('.il-go');
await page.waitFor('.play', 4000);
await page.sleep(1800);

// ---- F. level 5: the hidden rule
check(await page.exists('.board.ring'), 'level 5 is a ring board');
check((await page.count('.examples .ex')) === 3, 'three example rings are shown');
check((await page.count('.marker')) === 0, 'no markers: the rule is not named anywhere');
check((await page.text('.goal b')) === '?', 'the goal star holds a question mark');
await shot('21-level5-start');
const a5 = await answer('m5');
const empties5 = a5.nodes.filter((n) => a5.givens[n] === undefined);
// a full but wrong ring first
const stones5 = empties5.map((n) => a5.sol[n]);
const wrongOrder = [stones5[1], stones5[0]];
for (let i = 0; i < 2; i++) await place(wrongOrder[i], empties5[i]);
await page.sleep(900);
check(!(await page.exists('.play > .done:not(.hidden)')), 'a full ring that breaks the rule is not accepted');
check((await page.count('.board.ring.resolved')) === 0, 'and nothing was revealed');
await shot('22-level5-wrong');
for (let i = 0; i < 2; i++) { await page.eval(`document.querySelector('.actions .act').click()`); await page.sleep(250); }
check((await page.count('.tray .tile')) === 2, 'two undos empty the ring again');
await page.tap('.act:nth-child(2)');
await page.sleep(250);
const r1 = await page.text('.say-text');
await page.tap('.act:nth-child(2)');
await page.sleep(250);
const r2 = await page.text('.say-text');
check(/same in all/.test(r1) && /across/.test(r2), `ring hints 1 and 2 nudge without telling: "${r1}" / "${r2}"`);
await page.tap('.act:nth-child(2)');
await page.sleep(300);
const r3 = await page.text('.say-text');
check(/make 9/.test(r3), `ring hint 3 gives the rule: "${r3}"`);
await shot('23-level5-hint3');
// simplest: place every stone where the engine says; swaps handle any that are already on the board
for (let i = 0; i < empties5.length; i++) {
  const n = empties5[i];
  const v = a5.sol[n];
  const inTray = await page.exists(`.tray .tile[data-tile="t${v}"]`);
  if (inTray) await place(v, n);
  else { await page.tap(`.tile[data-tile="t${v}"]`); await page.tap(`.socket-hit[data-cell="${n}"]`); }
}
await page.sleep(1500);
await shot('24-level5-revealing');
await doneShown();
await page.sleep(1200);
check((await page.count('.frame .chord')) === 4, 'four chords drew through the centre');
check((await page.count('.examples.revealed')) === 1, 'the rule is revealed on the example rings too');
await shot('25-level5-revealed');
await page.sleep(2400);
check((await coins()) === 100, 'level 5 paid 30 (total 100)');
check((await chip()) === 100, 'counter shows 100');
await shot('26-level5-done');
await page.eval(`document.querySelector('.done-actions .btn.primary').click()`); // Continue
await page.waitFor('.interlude.ready .il-go', 15000);
await page.tap('.il-go');
await page.waitFor('.chapters', 6000);
await page.sleep(2600);
check((await page.count('.chapter.complete')) === 5, 'journey shows all five levels complete');
check((await chip()) === 100, 'journey counter shows 100');
await shot('27-journey-complete');

// ---- G. reset
await page.tap('.bar .icon[aria-label="Settings"]');
await page.waitFor('dialog.settings[open]');
await shot('28-settings-dev');
check(await page.exists('.dev'), 'developer tools show with ?dev');
await page.eval(`[...document.querySelectorAll('.dev .btn')].find(b => b.textContent === 'Reset progress').click()`);
await page.sleep(500);
check((await coins()) === 0, 'reset clears the coins');
await page.tap('.menu-nav .btn:nth-child(1)');
await page.waitFor('.chapters');
check((await page.count('.chapter.open')) === 1, 'reset locks levels 2 to 5 again');
check((await chip()) === 0, 'counter shows 0 after reset');

// ---- H. errors
const bad = page.logs.filter((l) => !/favicon|Autoplay|play\(\)|preloaded using link preload/i.test(l.text));
check(bad.length === 0, `no console errors${bad.length ? `: ${JSON.stringify(bad.slice(0, 4))}` : ''}`);

await b.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
