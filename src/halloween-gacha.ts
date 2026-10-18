import { stowItem, type SaveState } from './model.ts';
import { HALLOWEEN_GACHA, HALLOWEEN_PRIZES, HALLOWEEN_WEIGHT, type HalloweenDraw, type HalloweenPrize } from './halloween-gacha-config.ts';
export const GACHA_ENERGY_ERROR = 'Not enough energy for this draw.';
export class HalloweenDrawError extends Error { readonly status = 409; }
/** Half-open intervals: a rare prize can occur on ANY ordinary pull; no shuffled/finite reward pool. */
export function rollHalloween(random: () => number): HalloweenPrize {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid gacha random source.');
  let roll = value * HALLOWEEN_WEIGHT;
  for (const prize of HALLOWEEN_PRIZES) { if (roll < prize.weight) return prize; roll -= prize.weight; }
  return HALLOWEEN_PRIZES[HALLOWEEN_PRIZES.length - 1];
}
/** Called inside applyGameAction's copy/commit boundary, with server crypto RNG online. No client-chosen seed/reward. */
export function drawHalloween(s: SaveState, count: 1 | 10, random: () => number, now: number): HalloweenDraw {
  const reject = (message: string): never => { throw new HalloweenDrawError(message); };
  if (count !== 1 && count !== 10) return reject('Choose one or ten draws.');
  const cost = count * HALLOWEEN_GACHA.cost;
  if (s.energy < cost) return reject(GACHA_ENERGY_ERROR);
  const saved = s.halloweenGacha ?? { total: 0, misses: 0 };
  if (saved.total > 1e9 - count) return reject('The draw counter has reached its limit.');
  let { total, misses } = saved;
  const rewards: HalloweenDraw['rewards'] = [];
  s.energy -= cost;
  for (let i = 0; i < count; i++) {
    // Every 150 consecutive misses guarantees the rod. An early rod resets this counter; batches obey pull order.
    const guaranteed = misses >= HALLOWEEN_GACHA.rodPity - 1;
    const prize = guaranteed ? HALLOWEEN_PRIZES[0] : rollHalloween(random);
    const fresh = prize.id !== 'energy' && !s.collection[prize.id] && !(s.bag[prize.id] || s.chest[prize.id]);
    const destination = prize.id === 'energy' ? 'energy' : stowItem(s, prize.id, prize.count);
    if (!destination) return reject('There is no room for this reward.');
    if (prize.id === 'energy') s.energy += prize.count;
    misses = prize.id === 'rod_key' ? 0 : misses + 1;
    total++;
    rewards.push({ id: prize.id, count: prize.count, guaranteed, fresh, destination });
  }
  // Save the receipt too: closing/reloading during the animation never loses already committed rewards.
  const result: HalloweenDraw = { rewards, cost, total, misses, at: now };
  s.halloweenGacha = { total, misses, last: result };
  return result;
}
