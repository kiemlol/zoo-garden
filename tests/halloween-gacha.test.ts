import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.ts';
import { applyGameAction } from '../src/actions.ts';
import { rollHalloween } from '../src/halloween-gacha.ts';
import { HALLOWEEN_GACHA as C, HALLOWEEN_PRIZES as prizes, HALLOWEEN_WEIGHT as total, parseHalloweenGacha } from '../src/halloween-gacha-config.ts';
const funded = () => { const s = M.newGame('Gacha'); s.energy = 1e7; return s; };
const draw = (s: M.SaveState, count: number, random = () => .999) => applyGameAction(s, { type: 'halloweenDraw', payload: { count } }, { now: 10000, random }) as NonNullable<M.SaveState['halloweenGacha']>['last'] & {};

test('Halloween odds total exactly 100%, match all requested items and rarity ordering', () => {
  assert.equal(total, 10000); assert.equal(prizes.length, 10);
  assert.deepEqual(prizes.map(p => p.id), ['rod_key', 'deco_undying_teddy', 'deco_cursed_tree', 'deco_cursed_coffin', 'deco_cursed_bench', 'deco_ghost_carriage', 'dress_pumpkin', 'boots_pumpkin', 'deco_aquarium_m', 'energy']);
  assert.equal(prizes.filter(p => p.rarity === 'purple').length, 7);
  const weight = (id: string) => prizes.find(p => p.id === id)!.weight;
  assert.ok(weight('rod_key') < weight('dress_pumpkin') && weight('dress_pumpkin') < weight('deco_cursed_coffin') && weight('deco_cursed_coffin') < weight('deco_cursed_tree') && weight('deco_cursed_tree') < weight('boots_pumpkin'));
  for (const p of prizes) if (p.id !== 'energy') assert.ok(M.ITEMS[p.id]);
});

test('every weighted interval has exact boundaries; duplicates and first-pull rod wins are possible', () => {
  let lower = 0;
  for (const p of prizes) {
    assert.equal(rollHalloween(() => lower / total).id, p.id);
    assert.equal(rollHalloween(() => (lower + p.weight - .001) / total).id, p.id);
    const s = funded(), result = draw(s, 10, () => (lower + p.weight / 2) / total);
    assert.equal(result.rewards.length, 10);
    assert.ok(result.rewards.every(r => r.id === p.id));
    assert.equal(s.energy, 1e7 - 10 * C.cost + (p.id === 'energy' ? 10000 : 0));
    if (p.id !== 'energy') assert.equal(s.bag[p.id], 10);
    lower += p.weight;
  }
});

test('pull 150 guarantees the rod; early wins reset only pity, including inside ten draws', () => {
  const s = funded(); s.halloweenGacha = { total: 145, misses: 145 };
  let calls = 0;
  const result = draw(s, 10, () => { calls++; return .999; });
  assert.equal(result.rewards[4].id, 'rod_key'); assert.equal(result.rewards[4].guaranteed, true);
  assert.equal(calls, 9); assert.equal(result.total, 155); assert.equal(result.misses, 5);
  assert.equal(s.bag.rod_key, 1);
  const early = draw(s, 1, () => 0); assert.equal(early.misses, 0); assert.equal(early.total, 156); assert.equal(early.rewards[0].guaranteed, false);
  const edge = funded(); edge.halloweenGacha = { total: 148, misses: 148 };
  assert.equal(draw(edge, 1).rewards[0].id, 'energy');
  assert.equal(draw(edge, 1, () => { throw Error('Pity must not need dice'); }).rewards[0].id, 'rod_key');
});

test('failed/malformed draws never debit energy, advance pity or partially grant a batch', () => {
  for (const count of [0, 2, 11, -1, 1.5, NaN, '10']) {
    const s = funded(), before = structuredClone(s);
    assert.throws(() => draw(s, count as number)); assert.deepEqual(s, before);
  }
  const s = funded(); s.energy = C.cost - 1; const before = structuredClone(s);
  assert.throws(() => draw(s, 1), /Not enough energy/); assert.deepEqual(s, before);
  s.energy = C.cost * 10; const paid = structuredClone(s); let calls = 0;
  assert.throws(() => draw(s, 10, () => ++calls === 5 ? NaN : 0), /Invalid gacha random/); assert.deepEqual(s, paid);
  for (const value of [-.1, 1, Infinity, NaN]) assert.throws(() => rollHalloween(() => value));
});

test('full bag safely delivers to chest; repeated rewards stack and are NEW only once', () => {
  const s = funded(); for (const id of Object.keys(M.ITEMS).slice(0, 110)) s.bag[id] = 1;
  delete s.bag.rod_key;
  const first = draw(s, 1, () => 0).rewards[0];
  assert.equal(first.destination, 'chest'); assert.equal(first.fresh, true); assert.equal(s.chest.rod_key, 1);
  const second = draw(s, 1, () => 0).rewards[0]; assert.equal(second.fresh, false); assert.equal(s.chest.rod_key, 2);
});

test('save/load retains pity and last receipt, old saves preserve possessions without a banner', () => {
  const s = funded(); s.bag.rod = 2; s.decorations = [{ uid: 'existing', id: 'deco_aquarium', x: 2, z: 2, rotation: 0 }];
  const old = M.parseSave(JSON.stringify(s))!; assert.equal(old.halloweenGacha, undefined); assert.deepEqual(old.decorations, s.decorations); assert.equal(old.bag.rod, 2);
  draw(s, 10); const loaded = M.parseSave(JSON.stringify(s))!;
  assert.deepEqual(loaded.halloweenGacha, s.halloweenGacha); assert.deepEqual(loaded.bag, s.bag); assert.equal(loaded.energy, s.energy);
  loaded.halloweenGacha = { total: 149, misses: 149 }; const reloaded = M.parseSave(JSON.stringify(loaded))!;
  assert.equal(draw(reloaded, 1).rewards[0].guaranteed, true);
  assert.equal(parseHalloweenGacha({ total: -1, misses: 1 }), undefined);
  assert.equal(parseHalloweenGacha({ total: 5, misses: 6 }), undefined);
  assert.equal(parseHalloweenGacha({ total: 200, misses: 150 }), undefined);
  const corrupt = structuredClone(s.halloweenGacha!); corrupt.last!.rewards[0].id = 'unknown' as never;
  assert.deepEqual(parseHalloweenGacha(corrupt), { total: corrupt.total, misses: corrupt.misses });
});

test('drawing uses fixed server/config rewards and cost, ignoring forged payload fields', () => {
  const s = funded();
  const result = applyGameAction(s, { type: 'halloweenDraw', payload: { count: 1, reward: 'rod_key', seed: 0, cost: 0, misses: 149 } }, { now: 10000, random: () => .999 }) as any;
  assert.equal(result.rewards[0].id, 'energy'); assert.equal(result.cost, C.cost); assert.equal(result.misses, 1);
});
