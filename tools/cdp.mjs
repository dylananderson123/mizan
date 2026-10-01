// A tiny Chrome driver for playtests: starts headless Chrome, talks to it over
// the DevTools protocol, and gives a page you can click, drag, read and
// photograph. No dependencies (Node 22+ has WebSocket and fetch built in).
//
//   const b = await launch({ width: 390, height: 844, mobile: true });
//   const page = await b.open('http://127.0.0.1:8963/?dev&noopening');
//   await page.tap('.btn.primary');
//   await page.shot('shots/x.png');
//   await b.close();

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 390, height = 844, mobile = true, port = 9333 + Math.floor(Math.random() * 500) } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mizan-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`,
    '--mute-audio', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    '--hide-scrollbars', `--window-size=${Math.max(width, 500)},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(150); }
  }
  return {
    async open(url) {
      const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
      const page = await connect(t.webSocketDebuggerUrl, { width, height, mobile });
      await page.goto(url);
      return page;
    },
    async close() {
      proc.kill('SIGKILL');
    },
  };
}

async function connect(wsUrl, view) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(`${msg.error.message}`)) : res(msg.result);
    } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      logs.push({ type: msg.params.type, text: msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      logs.push({ type: 'exception', text: msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text });
    } else if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) {
      logs.push({ type: `log-${msg.params.entry.level}`, text: `${msg.params.entry.text} ${msg.params.entry.url ?? ''}` });
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 2, mobile: view.mobile });
  if (view.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const page = {
    logs,
    send,
    async goto(url) {
      await send('Page.navigate', { url });
      await sleep(900);
    },
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n${expr.slice(0, 200)}`);
      return r.result.value;
    },
    async rect(sel) {
      const r = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
      if (!r) throw new Error(`no element: ${sel}`);
      return r;
    },
    async exists(sel) { return page.eval(`Boolean(document.querySelector(${JSON.stringify(sel)}))`); },
    async text(sel) { return page.eval(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`); },
    async count(sel) { return page.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`); },
    async mouse(type, x, y, extra = {}) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
    },
    async tapAt(x, y) {
      await page.mouse('mouseMoved', x, y, { buttons: 0 });
      await page.mouse('mousePressed', x, y);
      await sleep(40);
      await page.mouse('mouseReleased', x, y);
      await sleep(120);
    },
    async tap(sel) {
      const r = await page.rect(sel);
      await page.tapAt(r.x + r.w / 2, r.y + r.h / 2);
    },
    async drag(fromSel, toSel) {
      const a = await page.rect(fromSel);
      const b = await page.rect(toSel);
      const [x0, y0, x1, y1] = [a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2];
      await page.mouse('mouseMoved', x0, y0, { buttons: 0 });
      await page.mouse('mousePressed', x0, y0);
      for (let i = 1; i <= 8; i++) { await page.mouse('mouseMoved', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8); await sleep(16); }
      await page.mouse('mouseReleased', x1, y1);
      await sleep(150);
    },
    async key(key) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key, text: key.length === 1 ? key : undefined });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
      await sleep(80);
    },
    async waitFor(sel, ms = 6000) {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await page.exists(sel)) return true; await sleep(100); }
      throw new Error(`timed out waiting for ${sel}`);
    },
    async waitGone(sel, ms = 6000) {
      const t = Date.now();
      while (Date.now() - t < ms) { if (!(await page.exists(sel))) return true; await sleep(100); }
      throw new Error(`timed out waiting for ${sel} to go`);
    },
    async shot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(r.data, 'base64'));
    },
    async resize(width, height, mobile = true) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
    },
    sleep,
  };
  return page;
}

export { sleep };
