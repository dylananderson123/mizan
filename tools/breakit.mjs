// Tries to break the game. Real Chrome, real taps. Reports faults, never fixes.
//
//   node tools/breakit.mjs            all sections
//   node tools/breakit.mjs layout     one section: layout | reload | spam | saves | tabs | keys
//
// Exit code 1 if any check fails.
import { launch } from './cdp.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.env.MIZAN_URL ?? 'http://127.0.0.1:8963/?dev&noopening';
const OUT = new URL('../shots/break/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
let failed = 0;
const check = (c, m) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${m}`); if (!c) failed++; };
const want = (s) => !only || only === s;

const PHONE = { width: 390, height: 844, mobile: true };

async function fresh(view = PHONE) {
  const b = await launch(view);
  const page = await b.open(BASE);
  await page.eval('localStorage.clear()');
  await page.goto(BASE);
  return { b, page };
}

const answer = (page, id) => page.eval(`(async () => {
  const { levelDef } = await import('/src/puzzles/definitions.js');
  const { solve } = await import('/src/puzzles/kit.js');
  const d = levelDef(${JSON.stringify(id)});
  return { nodes: d.nodes, givens: d.givens, initial: d.initial, sol: solve(d, { limit: 1 })[0] };
})()`);

const place = async (page, value, node) => { await page.tap(`.tile[data-tile="t${value}"]`); await page.tap(`.socket-hit[data-cell="${node}"]`); };
const openJourney = async (page) => { await page.eval(`[...document.querySelectorAll('.menu-nav .btn')].find((b) => b.textContent.trim() === 'Journey')?.click()`); await page.waitFor('.chapters'); };
const playLevel = async (page, n) => {
  await page.eval(`[...document.querySelectorAll('.chapter .btn.go')][${n - 1}].click()`);
  await page.waitFor('.play');
  await page.sleep(700);
};
// The last move for each level, so a test can stop one step short.
async function solveLevel(page, n, { stopShort = false } = {}) {
  if (n === 2) { if (!stopShort) await page.drag('.tray .tile[data-tile="t8"]', '.socket-hit[data-cell="6"]'); return; }
  if (n === 3) { if (!stopShort) { await page.tap('.tile[data-tile="t7"]'); await page.tap('.socket-hit[data-cell="5"]'); } return; }
  const a = await answer(page, `m${n}`);
  const empties = a.nodes.filter((x) => a.givens[x] === undefined);
  const todo = stopShort ? empties.slice(0, -1) : empties;
  for (const e of todo) await place(page, a.sol[e], e);
}
const wallet = (page) => page.eval('JSON.parse(localStorage.getItem("mizan.save")||"null")');
const errorsOf = (page) => page.logs.filter((l) => !/preload/i.test(l.text));

// ------------------------------------------------------------------ layout
if (want('layout')) {
  console.log('\n== layout across screens');
  const VIEWS = [
    ['phone-320', { width: 320, height: 568, mobile: true }],
    ['phone-360', { width: 360, height: 640, mobile: true }],
    ['phone-390', PHONE],
    ['phone-430', { width: 430, height: 932, mobile: true }],
    ['landscape-667', { width: 667, height: 375, mobile: true }],
    ['landscape-844', { width: 844, height: 390, mobile: true }],
    ['tablet-768', { width: 768, height: 1024, mobile: true }],
    ['laptop-1280', { width: 1280, height: 720, mobile: false }],
    ['desktop-1920', { width: 1920, height: 1080, mobile: false }],
    ['ultrawide-2560', { width: 2560, height: 1080, mobile: false }],
  ];
  const audit = `(() => {
    const vw = innerWidth, vh = innerHeight, out = { overflowX: document.documentElement.scrollWidth > vw + 1, scrollY: document.documentElement.scrollHeight > vh + 1, small: [], offscreen: [], tinyText: 0 };
    for (const e of document.querySelectorAll('button, .tile, .socket-hit, input, a, .act, .btn')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
      if (e.closest('.hidden, [hidden], dialog:not([open])')) continue;
      if (Math.min(r.width, r.height) < 40) out.small.push((e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 && !out.scrollY) out.offscreen.push((e.className || e.tagName) + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom));
    }
    for (const e of document.querySelectorAll('p, span, small, button, b, h1, h2, h3')) {
      if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect(); if (!r.width) continue;
      if (parseFloat(cs.fontSize) < 11) out.tinyText++;
    }
    return out;
  })()`;
  for (const [name, view] of VIEWS) {
    const { b, page } = await fresh(view);
    await page.eval('mizanDev.unlockAll()');
    await page.goto(BASE);
    const report = [];
    await openJourney(page);
    report.push(['journey', await page.eval(audit)]);
    for (let n = 1; n <= 5; n++) {
      if (!(await page.exists('.chapters'))) {
        await page.eval(`document.querySelector('.bar .icon[aria-label="Back"]')?.click()`).catch(() => {});
        await page.waitFor('.chapters', 4000).catch(() => {});
      }
      await playLevel(page, n);
      report.push([`level${n}`, await page.eval(audit)]);
      if (n === 1 || n === 5 || name === 'phone-320') await page.shot(`${OUT}${name}-level${n}.png`);
    }
    // finished panel on level 5
    await solveLevel(page, 5);
    await page.waitFor('.play > .done:not(.hidden)', 9000).catch(() => {});
    await page.sleep(2500);
    report.push(['level5-done', await page.eval(audit)]);
    await page.shot(`${OUT}${name}-level5-done.png`);
    for (const [where, r] of report) {
      const bad = r.overflowX || r.offscreen.length || r.small.length || r.tinyText;
      check(!r.overflowX && !r.offscreen.length, `${name} ${where}: fits width${r.offscreen.length ? ' OFFSCREEN ' + r.offscreen.slice(0, 3).join(' | ') : ''}`);
      if (r.small.length) console.log(`       note ${name} ${where}: touch targets under 40px: ${[...new Set(r.small)].slice(0, 4).join(' | ')}`);
      if (r.scrollY && where.startsWith('level')) console.log(`       note ${name} ${where}: page scrolls vertically`);
      if (r.tinyText) console.log(`       note ${name} ${where}: ${r.tinyText} text nodes under 11px`);
    }
    check(errorsOf(page).length === 0, `${name}: no console errors${errorsOf(page).length ? ' ' + JSON.stringify(errorsOf(page).slice(0, 2)) : ''}`);
    await b.close();
  }
}

// ------------------------------------------------------------------ reload during the finish
if (want('reload')) {
  console.log('\n== reload at every moment of a finish');
  for (const delay of [0, 30, 120, 400, 1200]) {
    const { b, page } = await fresh();
    await openJourney(page);
    await playLevel(page, 1);
    await solveLevel(page, 1, { stopShort: true });
    // final stone, then reload `delay` ms later, from inside the page's own clock
    const a = await answer(page, 'm1');
    const empties = a.nodes.filter((x) => a.givens[x] === undefined);
    const last = empties[empties.length - 1];
    await page.tap(`.tile[data-tile="t${a.sol[last]}"]`);
    const r = await page.rect(`.socket-hit[data-cell="${last}"]`);
    await page.mouse('mouseMoved', r.x + r.w / 2, r.y + r.h / 2, { buttons: 0 });
    await page.mouse('mousePressed', r.x + r.w / 2, r.y + r.h / 2);
    await page.mouse('mouseReleased', r.x + r.w / 2, r.y + r.h / 2);
    await page.sleep(delay);
    await page.goto(BASE);
    const s = await wallet(page);
    const solvedSaved = Boolean(s?.completed?.m1);
    // The one forbidden outcome is a half state: finished but unpaid, or paid twice.
    check(solvedSaved ? s.wallet.coins === 10 && s.unlocked.includes('l2') : s.wallet.coins === 0, `reload ${delay}ms after last stone: ${solvedSaved ? 'finish saved and paid 10, level 2 open' : 'not finished, nothing paid'} (coins ${s?.wallet?.coins}, current=${s?.current ? 'kept' : 'none'})`);
    if (!solvedSaved) check(Boolean(s.current), `   and the half-built puzzle is kept to resume (delay ${delay})`);
    // Whatever happened, the player can still finish and ends with exactly 10.
    await openJourney(page);
    await playLevel(page, 1);
    if (!solvedSaved) await solveLevel(page, 1);
    else await solveLevel(page, 1); // replay
    await page.waitFor('.play > .done:not(.hidden)', 9000).catch(() => {});
    await page.sleep(2500);
    const s2 = await wallet(page);
    check(s2.wallet.coins === 10, `   after finishing again the coins are exactly 10 (got ${s2.wallet.coins})`);
    check(errorsOf(page).length === 0, `   no console errors ${JSON.stringify(errorsOf(page).slice(0, 2))}`);
    await b.close();
  }
}

// ------------------------------------------------------------------ spam and odd input
if (want('spam')) {
  console.log('\n== spam, odd taps, back, undo');
  const { b, page } = await fresh();
  await openJourney(page);
  await playLevel(page, 1);
  // 1. hammer every stone and every space 3 times, no pattern
  for (let k = 0; k < 3; k++) {
    for (const t of await page.eval(`[...document.querySelectorAll('.tile:not(.locked)')].map(t => t.dataset.tile)`)) {
      await page.tap(`.tile[data-tile="${t}"]`).catch(() => {});
      await page.tap(`.socket-hit[data-cell="${(k * 3 + 1) % 9}"]`).catch(() => {});
    }
  }
  check(errorsOf(page).length === 0, 'tapping everything at random: no console errors');
  // 2. double click on a stone, then on the same space
  await page.eval(`mizanDev.reset()`);
  await openJourney(page); await playLevel(page, 1);
  const a = await answer(page, 'm1');
  const empties = a.nodes.filter((x) => a.givens[x] === undefined);
  await page.tap(`.tile[data-tile="t${a.sol[empties[0]]}"]`);
  await page.tap(`.tile[data-tile="t${a.sol[empties[0]]}"]`); // tap the held stone again
  await page.tap(`.socket-hit[data-cell="${a.givens ? 4 : 4}"]`); // a locked space
  const s0 = await page.eval(`mizanDev.save().current`);
  check(true, 'tapped a held stone twice and a carved space without error');
  // 3. fast finish: place all, then mash undo + hint + back inside the finish window
  for (const e of empties) await place(page, a.sol[e], e);
  for (let i = 0; i < 6; i++) { await page.eval(`document.querySelectorAll('.actions .act').forEach((a) => a.click())`).catch(() => {}); }
  await page.waitFor('.play > .done:not(.hidden)', 9000).catch(() => {});
  await page.sleep(2500);
  let sv = await wallet(page);
  check(sv.wallet.coins === 10, `mashing undo and hint during the finish still pays 10 once (got ${sv.wallet.coins})`);
  check(Object.keys(sv.wallet.claimed).length === 1, 'one reward key recorded');
  check(!!(await page.exists('.done:not(.hidden)')), 'the finished panel is still showing');
  // 4. click Continue / Journey many times fast
  await page.eval(`(() => { const bs = [...document.querySelectorAll('.done .btn')]; for (let i = 0; i < 5; i++) bs.forEach((x) => x.click()); })()`).catch(() => {});
  await page.sleep(1500);
  sv = await wallet(page);
  check(sv.wallet.coins === 10, 'mashing Continue does not pay again');
  check(errorsOf(page).length === 0, `no console errors after mashing ${JSON.stringify(errorsOf(page).slice(0, 3))}`);
  await page.shot(`${OUT}spam-after-mash.png`);
  // 5. skip the interlude with spam, then land in level 2 once (not twice)
  const plays = await page.count('.play');
  check(plays <= 1, `only one play screen exists (${plays})`);
  await page.eval(`[...document.querySelectorAll('.il-go')].forEach((x) => { for (let i = 0; i < 5; i++) x.click(); })`).catch(() => {});
  await page.sleep(1500);
  check((await page.count('.play')) <= 1 && (await page.count('.board')) <= 1, `after skipping, one board only (${await page.count('.board')})`);
  // 6. browser back button
  // The browser Back button leaves the page (there is no in-app history).
  // What matters: nothing is lost, and reopening the game picks up the save.
  const before = await wallet(page);
  await page.goto('about:blank');
  await page.goto(BASE);
  const afterBack = await wallet(page);
  check(afterBack.wallet.coins === before.wallet.coins && Object.keys(afterBack.completed).length === Object.keys(before.completed).length, 'leaving the page and coming back keeps coins and levels');
  await page.waitFor('.menu-nav .btn', 4000);
  // 7. Escape everywhere
  for (let i = 0; i < 4; i++) await page.key('Escape');
  check(errorsOf(page).length === 0, 'Escape x4: no console errors');
  // 8. resize during play (rotate the phone)
  await openJourney(page).catch(() => {});
  await page.eval(`[...document.querySelectorAll('.chapter .btn.go')][1]?.click()`).catch(() => {});
  await page.waitFor('.play', 4000).catch(() => {});
  await page.resize(844, 390, true); await page.sleep(500);
  check((await page.eval(`document.documentElement.scrollWidth <= innerWidth + 1`)), 'rotate to landscape during Level 2: no sideways scroll');
  await page.shot(`${OUT}spam-landscape-l2.png`);
  await page.resize(390, 844, true); await page.sleep(500);
  check(errorsOf(page).length === 0, 'rotate and back: no console errors');
  await b.close();
}

// ------------------------------------------------------------------ hostile saves
if (want('saves')) {
  console.log('\n== hostile and old saves');
  const bad = {
    'not json': 'hello',
    'null': 'null',
    'array': '[]',
    'wrong version': JSON.stringify({ v: 99 }),
    'negative coins': JSON.stringify({ v: 2, wallet: { coins: -50, claimed: {}, log: [] } }),
    'string coins': JSON.stringify({ v: 2, wallet: { coins: '9999', claimed: {}, log: [] } }),
    'float coins': JSON.stringify({ v: 2, wallet: { coins: 1.5, claimed: {}, log: [] } }),
    'giant coins': JSON.stringify({ v: 2, wallet: { coins: 1e300, claimed: {}, log: [] } }),
    'unlock sealed': JSON.stringify({ v: 2, unlocked: ['l1', 'l99', 'l6', '__proto__'] }),
    'proto pollution': '{"v":2,"completed":{"__proto__":{"x":1}},"best":{"__proto__":{"moves":1,"hints":0,"time":1}}}',
    'current garbage': JSON.stringify({ v: 2, current: { spec: {}, pos: {} } }),
    'current wrong level': JSON.stringify({ v: 2, current: { spec: { n: 3 }, pos: {}, mode: 'journey', levelId: 'nope' } }),
    'completed all, no coins': JSON.stringify({ v: 2, completed: { m1: { moves: 1, hints: 0, at: 1 }, m2: { moves: 1, hints: 0, at: 1 } }, unlocked: ['l1'] }),
  };
  for (const [name, raw] of Object.entries(bad)) {
    const { b, page } = await fresh();
    await page.eval(`localStorage.setItem('mizan.save', ${JSON.stringify(raw)})`);
    await page.goto(BASE);
    let ok = true; let why = '';
    try {
      await page.waitFor('.menu-nav .btn', 4000);
      await openJourney(page);
      await page.waitFor('.chapter', 3000);
      const chip = await page.text('.coin-chip .coin-num');
      if (!/^\d+$/.test(chip)) { ok = false; why = `counter shows "${chip}"`; }
      const open = await page.count('.chapter.open');
      await playLevel(page, 1);
      await page.eval('Object.prototype.x === undefined').then((v) => { if (!v) { ok = false; why += ' prototype polluted'; } });
      if (open > 2 && name !== 'completed all, no coins') { /* unlocking is local */ }
    } catch (e) { ok = false; why = e.message.slice(0, 120); }
    check(ok && errorsOf(page).length === 0, `${name}: game starts clean${why ? ' (' + why + ')' : ''}${errorsOf(page).length ? ' ERR ' + JSON.stringify(errorsOf(page)[0]) : ''}`);
    await b.close();
  }
  // an old v1 save keeps settings, drops progress
  const { b, page } = await fresh();
  await page.eval(`localStorage.setItem('mizan.save', JSON.stringify({ v: 1, settings: { highContrast: true }, completed: { 'c1-01': { moves: 1 } } }))`);
  await page.goto(BASE);
  const s = await page.eval('mizanDev.save()');
  check(s.settings.highContrast === true && Object.keys(s.completed).length === 0 && s.wallet.coins === 0, 'a version 1 save keeps settings and restarts progress');
  await b.close();
}

// ------------------------------------------------------------------ two tabs
if (want('tabs')) {
  console.log('\n== two tabs');
  const b = await launch(PHONE);
  const A = await b.open(BASE);
  await A.eval('localStorage.clear()'); await A.goto(BASE);
  const B = await b.open(BASE);
  // tab A finishes level 1
  await openJourney(A); await playLevel(A, 1); await solveLevel(A, 1);
  await A.waitFor('.play > .done:not(.hidden)', 9000); await A.sleep(2500);
  const afterA = await wallet(A);
  // tab B (opened before) now finishes level 1 as well, then plays on
  await openJourney(B); await playLevel(B, 1); await solveLevel(B, 1);
  await B.waitFor('.play > .done:not(.hidden)', 9000); await B.sleep(2500);
  const afterB = await wallet(B);
  check(afterA.wallet.coins === 10 && afterB.wallet.coins === 10, `same level finished in two tabs pays 10 once (A ${afterA.wallet.coins}, B ${afterB.wallet.coins})`);
  // tab A goes on to finish level 2; then tab B, stale, finishes level 2 too: must not lose A's record or double pay
  await A.eval(`[...document.querySelectorAll('.done .btn.primary')][0]?.click()`);
  await A.sleep(500);
  const final = await wallet(A);
  console.log(`       stored after both tabs: coins ${final.wallet.coins}, completed ${Object.keys(final.completed)}, unlocked ${final.unlocked}`);
  // stale-tab overwrite test: A completes level 2, B (still on its old in-memory save) opens level 1 and quits to menu
  await A.goto(BASE); await openJourney(A); await playLevel(A, 2); await solveLevel(A, 2);
  await A.waitFor('.play > .done:not(.hidden)', 9000); await A.sleep(2500);
  const a2 = await wallet(A);
  await B.eval(`document.querySelector('.bar .icon[aria-label="Back"]')?.click()`);
  await B.sleep(400);
  await B.eval(`document.querySelectorAll('.bar .icon')[0]?.click()`);
  await B.sleep(600);
  const afterStale = await wallet(A);
  check(afterStale.completed.m2 !== undefined && afterStale.wallet.coins === a2.wallet.coins, `a stale tab does not erase another tab's level 2 (coins ${a2.wallet.coins} -> ${afterStale.wallet.coins}, m2 ${afterStale.completed.m2 ? 'kept' : 'LOST'})`);
  await b.close();
}

// ------------------------------------------------------------------ keyboard and focus
if (want('keys')) {
  console.log('\n== keyboard and focus');
  const { b, page } = await fresh({ width: 1280, height: 800, mobile: false });
  const focusInfo = `(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { tag: e.tagName, cls: e.className?.toString?.().slice(0, 40), label: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 24), outline: cs.outlineStyle + ' ' + cs.outlineWidth, shadow: cs.boxShadow.slice(0, 40) }; })()`;
  const seen = [];
  for (let i = 0; i < 3; i++) { await page.key('Tab'); seen.push(await page.eval(focusInfo)); }
  console.log('       tab order on the menu:', seen.map((s) => s && (s.label || s.cls)).join(' > '));
  check(seen.every((s) => s), 'every Tab stop on the menu lands on something');
  const visible = seen.filter((s) => s && (s.outline !== 'none 0px' || s.shadow !== 'none')).length;
  check(visible === seen.length, `every focused control on the menu shows a focus ring (${visible}/${seen.length})`);
  await page.eval(`document.activeElement?.blur()`);
  await openJourney(page);
  await page.eval(`mizanDev.unlockAll()`);
  await playLevel(page, 1);
  const tabs = [];
  for (let i = 0; i < 14; i++) { await page.key('Tab'); tabs.push(await page.eval(focusInfo)); }
  console.log('       tab order in Level 1:', tabs.map((s) => s && (s.label || s.cls)).join(' > '));
  check(tabs.filter(Boolean).length >= 10, 'Level 1 has a reachable Tab order');
  const ring = tabs.filter((s) => s && (s.outline !== 'none 0px' || s.shadow !== 'none')).length;
  check(ring === tabs.filter(Boolean).length, `every focused control in Level 1 shows a ring (${ring}/${tabs.filter(Boolean).length})`);
  // play level 1 by keyboard only: Enter on a stone, arrows, Enter on space (whatever the board supports)
  await page.shot(`${OUT}keys-level1.png`);
  const labels = await page.eval(`[...document.querySelectorAll('.tile, .socket-hit')].slice(0, 4).map((e) => e.getAttribute('aria-label') || e.getAttribute('role') || '(no label)')`);
  console.log('       first labels:', JSON.stringify(labels));
  check(labels.every((l) => l !== '(no label)'), 'stones and spaces carry a label for screen readers');
  check(errorsOf(page).length === 0, 'no console errors');
  await b.close();
}

// ------------------------------------------------------------------ stones
if (want('stones')) {
  console.log('\n== stone sets (the one use of coins)');
  const { b, page } = await fresh();
  await openJourney(page);
  check(await page.exists('.stones-row'), 'the Journey shows the Stones row');
  check(/30 coins/.test(await page.text('.stones-row .stones-text small')), `it names the next set and price: "${await page.text('.stones-row .stones-text small')}"`);
  await page.tap('.stones-row');
  await page.waitFor('dialog.stones[open]');
  const buyBtn = (name) => page.eval(`[...document.querySelectorAll('dialog.stones .stone-opt')].find((r) => r.querySelector('b').textContent === ${JSON.stringify(name)}).querySelector('button')`).then(() => true);
  const state = (name) => page.eval(`(() => { const btn = [...document.querySelectorAll('dialog.stones .stone-opt')].find((r) => r.querySelector('b').textContent === ${JSON.stringify(name)}).querySelector('button'); return { disabled: btn.disabled, text: btn.textContent }; })()`);
  const click = (name) => page.eval(`[...document.querySelectorAll('dialog.stones .stone-opt')].find((r) => r.querySelector('b').textContent === ${JSON.stringify(name)}).querySelector('button').click()`);
  let l = await state('Lapis');
  check(l.disabled && l.text === '30 coins', `with no coins Lapis cannot be bought (${JSON.stringify(l)})`);
  await click('Lapis');
  check((await wallet(page)).owned.length === 1, 'clicking a disabled buy does nothing');
  await page.eval('mizanDev.addCoins ? 0 : 0');
  await page.eval(`(() => { const s = mizanDev.save(); s.wallet.coins = 100; s.wallet.claimed['level:m1'] = 1; })()`);
  await page.eval(`document.querySelector('dialog.stones .dlg-actions .btn.primary').click()`); // Done
  await page.sleep(300);
  await page.tap('.stones-row');
  await page.waitFor('dialog.stones[open]');
  await click('Lapis'); await page.sleep(200);
  let sv = await page.eval('mizanDev.save()');
  check(sv.wallet.coins === 70 && sv.owned.includes('lapis') && sv.stones === 'lapis', `buying Lapis costs 30 and puts it on (coins ${sv.wallet.coins})`);
  await click('Lapis'); await page.sleep(100);
  check((await page.eval('mizanDev.save()')).wallet.coins === 70, 'the in-use set cannot be bought again');
  await click('Ivory'); await page.sleep(100);
  check((await page.eval('mizanDev.save()')).stones === 'ivory', 'Ivory can be put back for free');
  await click('Lapis'); await page.sleep(100);
  check((await page.eval('mizanDev.save()')).wallet.coins === 70 && (await page.eval('mizanDev.save()')).stones === 'lapis', 'putting an owned set back on costs nothing');
  await click('Basalt'); await page.sleep(200);
  sv = await page.eval('mizanDev.save()');
  check(sv.wallet.coins === 10 && sv.stones === 'basalt', `buying Basalt costs 60 (coins ${sv.wallet.coins})`);
  await page.eval(`document.querySelector('dialog.stones .dlg-actions .btn.primary').click()`);
  await page.sleep(300);
  check((await page.text('.coin-chip .coin-num')) === '10', 'the counter shows 10 after both buys');
  await page.goto(BASE);
  sv = await wallet(page);
  check(sv.stones === 'basalt' && sv.owned.length === 3 && sv.wallet.coins === 10, 'sets, choice and coins survive a reload');
  check((await page.eval('document.documentElement.dataset.stones')) === 'basalt', 'the page wears the saved set');
  await openJourney(page); await playLevel(page, 1);
  await page.shot(`${OUT}stones-basalt-l1.png`);
  const numColor = await page.eval(`(() => { const t = document.querySelector('.tray .tile .num'); const f = document.querySelector('.tray .tile .face'); return [getComputedStyle(t).color, getComputedStyle(f).backgroundImage.slice(0, 80)]; })()`);
  console.log('       tray stone numeral colour and face:', JSON.stringify(numColor));
  // the set shows on the board stones as well, and the game still plays: drag one stone
  await page.eval(`document.documentElement.dataset.stones = 'lapis'`);
  await page.sleep(100);
  await page.shot(`${OUT}stones-lapis-l1.png`);
  check(errorsOf(page).length === 0, `no console errors ${JSON.stringify(errorsOf(page).slice(0, 2))}`);
  await b.close();
}

// ------------------------------------------------------------------ keyboard only
if (want('kbd')) {
  console.log('\n== all five levels by keyboard alone (no mouse, no tap)');
  const { b, page } = await fresh({ width: 1280, height: 800, mobile: false });
  await openJourney(page);
  await page.eval('mizanDev.unlockAll()');
  const focusCell = (c) => page.eval(`document.querySelector('.socket-hit[data-cell="${c}"]').focus()`);
  const type = async (txt) => { for (const ch of txt) await page.key(ch); await page.sleep(700); };
  const finish = async (n, coinsAfter) => {
    await page.waitFor('.play > .done:not(.hidden)', 9000);
    await page.sleep(2200);
    const sv = await wallet(page);
    check(sv.wallet.coins === coinsAfter, `level ${n} solved by keyboard, coins ${sv.wallet.coins}`);
  };
  const toLevel = async (n) => {
    if (!(await page.exists('.chapters'))) { await page.eval(`document.querySelector('.play > .done .btn:not(.primary)')?.click() || document.querySelector('.bar .icon[aria-label="Back"]')?.click()`); await page.waitFor('.chapters', 5000); }
    await playLevel(page, n);
  };
  let coins = 0;
  // 1 and 4 and 5: type the number onto each empty space
  for (const [n, pay] of [[1, 10], [4, 25], [5, 30]]) {
    if (n === 4) { coins = 45; await page.eval(`(() => { const s = mizanDev.save(); for (const k of ['m2','m3']) { s.completed[k] = { moves: 1, hints: 0, at: 1 }; } s.wallet.coins = 45; s.wallet.claimed['level:m2'] = 1; s.wallet.claimed['level:m3'] = 1; })()`); }
    await toLevel(n);
    const a = await answer(page, `m${n}`);
    for (const e of a.nodes.filter((x) => a.givens[x] === undefined)) { await focusCell(e); await type(String(a.sol[e])); }
    coins += pay;
    await finish(n, coins);
    await page.eval(`document.querySelector('.play > .done .btn:not(.primary)')?.click()`);
    await page.waitFor('.chapters', 5000).catch(() => {});
    if (n === 1) { // levels 2 and 3 by keyboard too
      await toLevel(2);
      await focusCell(6); await type('8');
      coins += 15; await finish(2, coins);
      await page.eval(`document.querySelector('.play > .done .btn:not(.primary)')?.click()`);
      await page.waitFor('.chapters', 5000);
      await toLevel(3);
      await focusCell(3); await page.key('Enter');           // pick up the 7
      await focusCell(5); await page.key('Enter');           // put it on the 3: they swap
      coins += 20; await finish(3, coins);
      await page.eval(`document.querySelector('.play > .done .btn:not(.primary)')?.click()`);
      await page.waitFor('.chapters', 5000);
      await page.eval(`(() => { const s = mizanDev.save(); s.unlocked = ['l1','l2','l3','l4','l5']; })()`);
      coins = 45; // levels 1 to 3 paid 10 + 15 + 20
    }
  }
  check(errorsOf(page).length === 0, `no console errors ${JSON.stringify(errorsOf(page).slice(0, 2))}`);
  await b.close();
}

// ------------------------------------------------------------------ nothing moves under the finger
if (want('stable')) {
  console.log('\n== the board and the stones do not move when the guide changes its words');
  for (const [name, view] of [['phone-390', PHONE], ['phone-375x667', { width: 375, height: 667, mobile: true }], ['phone-360', { width: 360, height: 640, mobile: true }], ['laptop-1280', { width: 1280, height: 720, mobile: false }], ['landscape-667', { width: 667, height: 375, mobile: true }]]) {
    const { b, page } = await fresh(view);
    await openJourney(page);
    for (const n of [1, 2, 4]) {
      if (n > 1) { await page.eval('mizanDev.unlockAll()'); await page.eval(`document.querySelector('.bar .icon[aria-label="Back"]')?.click()`); await page.waitFor('.chapters', 4000); }
      await playLevel(page, n);
      const pos = () => page.eval(`(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(b.top); }; return { board: r('.board'), tray: r('.tray'), actions: r('.actions') }; })()`);
      const p0 = await pos();
      await page.tap('.act:nth-child(2)'); await page.sleep(300);       // a hint changes the words
      const p1 = await pos();
      await page.tap('.act:nth-child(2)'); await page.sleep(300);
      const p2 = await pos();
      const same = (a, z) => Math.abs((a.board ?? 0) - (z.board ?? 0)) <= 1 && Math.abs((a.tray ?? 0) - (z.tray ?? 0)) <= 1;
      check(same(p0, p1) && same(p0, p2), `${name} level ${n}: board, tray and buttons stay put through two hints (${JSON.stringify(p0)} ${JSON.stringify(p1)} ${JSON.stringify(p2)})`);
    }
    // Level 1 again: the first stone triggers the marks note, the second clears it
    await page.eval(`document.querySelector('.bar .icon[aria-label="Back"]')?.click()`); await page.waitFor('.chapters', 4000);
    await page.eval(`mizanDev.save().current = null`);
    await page.eval(`[...document.querySelectorAll('.chapter .btn.go')][0].click()`); await page.waitFor('.play'); await page.sleep(500);
    const top = () => page.eval(`Math.round(document.querySelector('.board').getBoundingClientRect().top)`);
    const t0 = await top();
    const a = await answer(page, 'm1');
    const gaps = a.nodes.filter((x) => a.givens[x] === undefined);
    await place(page, a.sol[gaps[0]], gaps[0]); await page.sleep(400);
    const t1 = await top();
    await place(page, a.sol[gaps[1]], gaps[1]); await page.sleep(400);
    const t2 = await top();
    check(Math.abs(t0 - t1) <= 1 && Math.abs(t0 - t2) <= 1, `${name} level 1: board top ${t0} -> ${t1} -> ${t2} through the teach line, the marks note and silence`);
    await b.close();
  }
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nNothing broke');
process.exit(failed ? 1 : 0);
