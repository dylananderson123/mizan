// The coin counter and the reward moment.
//
// The counter lives in every screen's top bar. When a first completion pays,
// the reward appears over the finished puzzle as a coin and a "+10", holds
// for a moment, and then the coins travel up to the counter one at a time;
// each one that lands ticks the number up. Restrained on purpose: one coin
// per ten paid, a soft brass tick, no shower, no shake.
//
// Reduced motion: no travel. The counter simply takes the new number.

import { h, s } from './dom.js';
import { starOutline } from './pattern.js';
import { sfx } from './sound.js';

const chips = new Set();
let shown = 0; // the number the chips currently display
let flight = 0; // counts reward flights, so a stale one can tell it was cancelled

// The coin itself: a brass disc with the game's eight-point star cut into it.
export function coinGlyph(cls = '') {
  return s('svg', { class: `coin-glyph ${cls}`.trim(), viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    s('circle', { class: 'coin-disc', cx: 12, cy: 12, r: 10.6 }),
    s('circle', { class: 'coin-rim', cx: 12, cy: 12, r: 8.4 }),
    s('path', { class: 'coin-star', d: starOutline(12, 12, 6.4, 0.7) }));
}

// The persistent counter. Every bar makes its own; they all follow `setCoins`.
export function coinChip(balance) {
  const num = h('span', { class: 'coin-num' }, String(balance));
  const chip = h('div', { class: 'coin-chip', role: 'status', 'aria-label': `${balance} coins` }, coinGlyph(), num);
  chip._num = num;
  chips.add(chip);
  shown = balance;
  return chip;
}

function paint(n) {
  shown = n;
  for (const chip of [...chips]) {
    if (!chip.isConnected) { chips.delete(chip); continue; }
    chip._num.textContent = String(n);
    chip.setAttribute('aria-label', `${n} coins`);
  }
}

export const setCoins = (n) => paint(n);

// A reward in flight is abandoned (the player moved on): drop the coins and
// show the true balance at once.
export function settleCoins(balance) {
  flight++;
  for (const c of document.querySelectorAll('.coin-fly')) c.remove();
  paint(balance);
}

const liveChip = () => [...chips].reverse().find((c) => c.isConnected) ?? null;

function pulse(chip) {
  chip.classList.remove('pulse');
  void chip.offsetWidth;
  chip.classList.add('pulse');
}

// A reward appears at `anchor` and travels to the counter. Returns a promise
// that resolves once the counter shows the final balance.
export function payReward({ anchor, amount, balance, reduced = false }) {
  const chip = liveChip();
  const start = balance - amount;
  if (!chip || reduced || !anchor?.isConnected) {
    paint(balance);
    if (chip) pulse(chip);
    return Promise.resolve();
  }
  paint(start);
  anchor.closest('.reward')?.classList.add('paid'); // the coin has left the panel
  const mine = ++flight;
  const count = Math.max(1, Math.min(5, Math.round(amount / 10)));
  const each = Math.floor(amount / count);
  const from = anchor.getBoundingClientRect();
  const to = chip.getBoundingClientRect();
  const dx = to.left + to.width * 0.3 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  let landed = 0;
  let running = start;
  return new Promise((resolve) => {
    for (let i = 0; i < count; i++) {
      const coin = h('div', { class: 'coin-fly', 'aria-hidden': 'true' }, coinGlyph());
      coin.style.left = `${from.left + from.width / 2 - 12}px`;
      coin.style.top = `${from.top + from.height / 2 - 12}px`;
      document.body.append(coin);
      const bow = (i % 2 ? 1 : -1) * (18 + i * 6); // a gentle arc, alternating sides
      const anim = coin.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.45 + bow}px, ${dy * 0.3 - 26}px) scale(1.15)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.55)`, opacity: 0.9, offset: 1 },
      ], { duration: 760, delay: i * 140, easing: 'cubic-bezier(0.5, 0, 0.3, 1)', fill: 'both' });
      anim.onfinish = () => {
        coin.remove();
        if (mine !== flight) return;
        landed++;
        running = landed === count ? balance : running + each;
        paint(running);
        pulse(chip);
        sfx.coin(landed - 1);
        if (landed === count) resolve();
      };
    }
  });
}

// What appears on the finished panel: the coin and the amount, and a note when
// nothing is owed because the reward was taken before.
export function rewardBadge(amount) {
  const glyph = coinGlyph('big');
  const el = h('div', { class: 'reward', role: 'status', 'aria-label': `${amount} coins earned` }, glyph, h('span', { class: 'reward-amt' }, `+${amount}`));
  el._glyph = glyph;
  return el;
}

export function claimedNote() {
  return h('p', { class: 'reward-note' }, 'Reward already collected');
}
