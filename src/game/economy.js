// The coin economy. Pure functions over the save object: no DOM, no clock
// unless one is passed in, so every rule here is tested without a browser.
//
// Earning. A reward has a KEY ("level:m1", and later "daily:2026-10-05" or
// "bonus:first-no-hint:m3"). A key is paid once, ever. That one rule is the
// whole anti-farming guard: replaying a level asks for the same key and gets
// nothing. A mode that should pay again just uses a key that changes (a date,
// a week) and the same rule keeps it honest.
//
// Spending. `spend` is built and tested but no screen calls it yet. When
// hints, tile skins, themes or puzzle packs become things to buy, they call
// `spend(save, "hint:m3", cost)` and the wallet needs no change.

export const rewardKey = (kind, id) => `${kind}:${id}`;

export const balance = (save) => save.wallet.coins;

const LOG_LIMIT = 200;

function note(wallet, key, delta, at) {
  wallet.log.push({ key, delta, at });
  if (wallet.log.length > LOG_LIMIT) wallet.log.splice(0, wallet.log.length - LOG_LIMIT);
}

// Pay `amount` for `key` unless it was already paid. Returns what happened.
export function award(save, key, amount, at = Date.now()) {
  const w = save.wallet;
  if (!Number.isInteger(amount) || amount <= 0) return { granted: 0, balance: w.coins, reason: 'nothing to pay' };
  if (w.claimed[key] !== undefined) return { granted: 0, balance: w.coins, reason: 'already paid' };
  w.claimed[key] = at;
  w.coins += amount;
  note(w, key, amount, at);
  return { granted: amount, balance: w.coins, reason: 'paid' };
}

export const canAfford = (save, cost) => Number.isInteger(cost) && cost >= 0 && save.wallet.coins >= cost;

// Take `cost` coins for `key`. Never goes below zero.
export function spend(save, key, cost, at = Date.now()) {
  const w = save.wallet;
  if (!canAfford(save, cost) || cost === 0) return { ok: false, balance: w.coins };
  w.coins -= cost;
  note(w, key, -cost, at);
  return { ok: true, balance: w.coins };
}

// The one thing coins buy: a set of stones. Looks only; no set is easier to
// play with. Ivory is free. Lapis and Basalt together cost 90, and the five
// levels pay 100, so finishing the game once is enough to own both.
// The prices are the author's, not yet agreed with Dylan.
export const STONE_SETS = [
  { id: 'ivory', name: 'Ivory', cost: 0 },
  { id: 'lapis', name: 'Lapis', cost: 30 },
  { id: 'basalt', name: 'Basalt', cost: 60 },
];
export const stoneSet = (id) => STONE_SETS.find((x) => x.id === id) ?? null;
export const ownsStones = (save, id) => save.owned.includes(id);

// Buy a set and use it. Never goes below zero, never charges twice.
export function buyStones(save, id, at = Date.now()) {
  const set = stoneSet(id);
  if (!set) return { ok: false, reason: 'unknown' };
  if (ownsStones(save, id)) return { ok: false, reason: 'owned' };
  if (!canAfford(save, set.cost) || set.cost === 0) return { ok: false, reason: 'short', need: set.cost - save.wallet.coins };
  spend(save, `stones:${id}`, set.cost, at);
  save.owned.push(id);
  save.stones = id;
  return { ok: true, balance: save.wallet.coins };
}

// Use a set that is already owned.
export function useStones(save, id) {
  if (!ownsStones(save, id)) return false;
  save.stones = id;
  return true;
}
