import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { createAccountStore } from '../server/account-store.mjs';
import { createActionService } from '../server/action-service.mjs';
import { createGameServer } from '../server/server.mjs';
import * as M from '../src/model.ts';
import { HALLOWEEN_GACHA as C } from '../src/halloween-gacha-config.ts';
const request = (revision, count = 1) => ({ rulesVersion: 1, requestId: `r${revision}-${randomUUID()}`, expectedRevision: revision, type: 'halloweenDraw', payload: { count } });
async function fixture(t, misses = 0, energy = 100000) {
  const dir = await mkdtemp(join(tmpdir(), 'zoo-gacha-'));
  let store = await createAccountStore({ dataDir: dir, databaseUrl: '' });
  t.after(async () => { await store.close(); await rm(dir, { recursive: true, force: true }); });
  const profile = M.newGame('Halloween'); profile.energy = energy; profile.halloweenGacha = { total: misses, misses };
  await store.create({ id: 'gacha', username: 'gacha', hash: 'h', salt: 's', friends: [], requests: [], profile });
  return { get store() { return store; }, service() { return createActionService({ store, getPeer: () => null }); }, async reopen() { await store.close(); store = await createAccountStore({ dataDir: dir, databaseUrl: '' }); } };
}

test('server gacha uses its own dice, atomic payment, sequential pity and durable receipts across reconnects', async t => {
  const f = await fixture(t, 145);
  // Deterministic server entropy for this test only; the HTTP payload cannot choose it.
  t.mock.method(crypto, 'randomInt', (min, max) => max - 1); syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const command = request(0, 10); command.payload = { count: 10, cost: 0, reward: 'rod_key', random: 0, misses: 149 };
  const first = await f.service()('gacha', command);
  assert.deepEqual(first.result.rewards.map(r => r.id), ['energy', 'energy', 'energy', 'energy', 'rod_key', 'energy', 'energy', 'energy', 'energy', 'energy']);
  assert.equal(first.result.rewards[4].guaranteed, true);
  assert.equal(first.profile.energy, 100000 - C.cost * 10 + 9000);
  assert.equal(first.profile.bag.rod_key, 1); assert.equal(first.profile.halloweenGacha.total, 155); assert.equal(first.profile.halloweenGacha.misses, 5);
  const later = await f.service()('gacha', request(1));
  await f.reopen();
  const replay = await f.service()('gacha', { ...command, expectedRevision: 2 });
  assert.equal(replay.replayed, true); assert.deepEqual(replay.result, first.result);
  assert.equal(replay.profile.halloweenGacha.total, 156); assert.equal(replay.profile.energy, later.profile.energy);
  assert.equal((await f.store.get('gacha')).profile.bag.rod_key, 1);
});

test('concurrent same-ID draw requests debit and grant once; competing stale revisions cannot both win', async t => {
  const f = await fixture(t, 149), execute = f.service(), command = request(0);
  const [a, b] = await Promise.all([execute('gacha', command), execute('gacha', command)]);
  assert.deepEqual(a.result, b.result); assert.equal([a, b].filter(r => r.replayed).length, 1);
  assert.equal((await f.store.get('gacha')).profile.energy, 100000 - C.cost);
  const results = await Promise.allSettled([execute('gacha', request(1)), execute('gacha', request(1))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal((await f.store.get('gacha')).profile.halloweenGacha.total, 151);
});

test('online insufficient balance/malformed counts leave no debit, reward, pity change or receipt', async t => {
  const f = await fixture(t, 149, C.cost - 1), before = await f.store.get('gacha'), execute = f.service();
  await assert.rejects(execute('gacha', request(0)), e => e.status === 409 && /Not enough energy/.test(e.message));
  await assert.rejects(execute('gacha', request(0, 11)), e => e.status === 400);
  assert.deepEqual(await f.store.get('gacha'), before);
});

test('authenticated HTTP draws update canonical profile, session and retry receipt; anonymous calls cannot draw', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'zoo-gacha-http-')), store = await createAccountStore({ dataDir: dir, databaseUrl: '' });
  const server = await createGameServer({ host: '127.0.0.1', port: 0, dataDir: dir, databaseUrl: '', databaseRequired: false, accountStore: store });
  t.after(async () => { await server.close(); await rm(dir, { recursive: true, force: true }); });
  const post = (route, body, cookie) => fetch(server.url + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  const registration = await post('auth/register', { username: 'gacha_http', password: 'Local-gacha-123', name: 'Gacha HTTP' });
  assert.equal(registration.status, 200); const login = await registration.json(), cookie = registration.headers.get('set-cookie').split(';')[0];
  await store.command({ actorId: login.account.id, expectedRevision: login.revision, requestId: randomUUID(), actionType: 'testSetup', hash: 'a'.repeat(64), run: records => { const s = records.get(login.account.id).profile; s.energy = 50000; s.halloweenGacha = { total: 149, misses: 149 }; return true; } });
  const command = request(1), response = await post('actions', command, cookie); assert.equal(response.status, 200);
  const reply = await response.json(); assert.equal(reply.result.rewards[0].id, 'rod_key'); assert.equal(reply.result.rewards[0].guaranteed, true); assert.equal(reply.profile.energy, 50000 - C.cost);
  const repeated = await post('actions', command, cookie); assert.equal(repeated.status, 200); const replay = await repeated.json(); assert.equal(replay.replayed, true); assert.deepEqual(replay.result, reply.result);
  const session = await (await fetch(server.url + '/api/auth/session', { headers: { Cookie: cookie } })).json();
  assert.equal(session.profile.bag.rod_key, 1); assert.equal(session.profile.halloweenGacha.total, 150); assert.deepEqual(session.profile.halloweenGacha.last, reply.result);
  assert.equal((await post('actions', command)).status, 401);
});
