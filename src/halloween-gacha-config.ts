/** Shared Halloween banner: percentages are ordinary per-pull odds, before the rod guarantee. */
export const HALLOWEEN_GACHA = { id: 'halloween', cost: 2000, rodPity: 150 } as const;
export const HALLOWEEN_PRIZES = [
  { id: 'rod_key', rarity: 'purple', weight: 50, count: 1 },
  { id: 'deco_undying_teddy', rarity: 'purple', weight: 500, count: 1 },
  { id: 'deco_cursed_tree', rarity: 'purple', weight: 500, count: 1 },
  { id: 'deco_cursed_coffin', rarity: 'purple', weight: 300, count: 1 },
  { id: 'deco_cursed_bench', rarity: 'purple', weight: 500, count: 1 },
  { id: 'deco_ghost_carriage', rarity: 'purple', weight: 300, count: 1 },
  { id: 'dress_pumpkin', rarity: 'purple', weight: 150, count: 1 },
  { id: 'boots_pumpkin', rarity: 'blue', weight: 2400, count: 1 },
  { id: 'deco_aquarium_m', rarity: 'blue', weight: 2400, count: 1 },
  { id: 'energy', rarity: 'blue', weight: 2900, count: 1000 },
] as const;
export type HalloweenPrize = typeof HALLOWEEN_PRIZES[number];
export const HALLOWEEN_WEIGHT = HALLOWEEN_PRIZES.reduce((n, p) => n + p.weight, 0);
export interface HalloweenReward { id: HalloweenPrize['id']; count: number; guaranteed: boolean; destination: 'bag' | 'chest' | 'energy'; fresh: boolean }
export interface HalloweenDraw { rewards: HalloweenReward[]; cost: number; total: number; misses: number; at: number }
export interface HalloweenGachaSave { total: number; misses: number; last?: HalloweenDraw }
const integer = (v: unknown, max = 1e9): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
/** Old saves have no banner. Invalid records cannot introduce arbitrary items or rewards. */
export function parseHalloweenGacha(raw: unknown): HalloweenGachaSave | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const v = raw as Record<string, unknown>;
  if (!integer(v.total) || !integer(v.misses, HALLOWEEN_GACHA.rodPity - 1) || v.misses > v.total) return undefined;
  const out: HalloweenGachaSave = { total: v.total, misses: v.misses };
  const last = v.last as HalloweenDraw | undefined;
  if (last && typeof last === 'object' && integer(last.at, Number.MAX_SAFE_INTEGER) && last.total === out.total && last.misses === out.misses && Array.isArray(last.rewards) && [1, 10].includes(last.rewards.length) && last.total >= last.rewards.length && last.cost === last.rewards.length * HALLOWEEN_GACHA.cost) {
    const valid = last.rewards.every(r => {
      if (!r || typeof r !== 'object') return false;
      const prize = HALLOWEEN_PRIZES.find(p => p.id === r.id);
      return prize && r.count === prize.count && typeof r.guaranteed === 'boolean' && (!r.guaranteed || r.id === 'rod_key') && typeof r.fresh === 'boolean' && (r.id === 'energy' ? r.destination === 'energy' : r.destination === 'bag' || r.destination === 'chest');
    });
    if (valid) out.last = { at: last.at, cost: last.cost, total: last.total, misses: last.misses, rewards: last.rewards.map(r => ({ id: r.id, count: r.count, guaranteed: r.guaranteed, destination: r.destination, fresh: r.fresh })) };
  }
  return out;
}
