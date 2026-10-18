import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as M from '../src/model.ts';
import { applyGameAction } from '../src/actions.ts';
import * as Config from '../src/halloween-gacha-config.ts';
const source = readFileSync(new URL('../src/halloween-gacha-ui.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
function fixture() {
  let state = M.newGame('UI'), release, calls = 0; state.energy = 100000; state.halloweenGacha = { total: 149, misses: 149 };
  const tasks = new Map(); let timer = 0;
  const context = { ...Config, ITEMS: M.ITEMS, t: (s, params = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(params[k])), setTimeout: callback => { tasks.set(++timer, callback); return timer; }, clearTimeout: id => tasks.delete(id), matchMedia: () => ({ matches: false }) };
  vm.createContext(context); vm.runInContext(stripTypeScriptTypes(source, { mode: 'transform' }) + '\nglobalThis.Panel = HalloweenGachaPanel;', context);
  const panel = new context.Panel({ state: () => state, art: id => `<img src="${id}.webp">`, draw: async count => { calls++; await new Promise(r => release = r); return applyGameAction(state, { type: 'halloweenDraw', payload: { count } }, { now: 100, random: () => .999 }); } });
  function host() { return { innerHTML: '', addEventListener() {}, removeEventListener() {} }; }
  const click = action => panel.click({ target: { closest: () => ({ dataset: { gacha: action }, disabled: false }) }, stopPropagation() {} });
  return { panel, host, click, tasks, flush() { for (const cb of tasks.values()) cb(); tasks.clear(); }, get state() { return state; }, replaceState() { state = M.newGame('Other'); }, get calls() { return calls; }, release() { release(); } };
}

test('pending UI closes/reopens safely, prevents double purchase, and reveals already saved rewards', async () => {
  const f = fixture(), first = f.host(); f.panel.mount(first);
  const pending = f.panel.draw(1); await f.panel.draw(1); assert.equal(f.calls, 1);
  f.panel.unmount(); const second = f.host(); f.panel.mount(second); assert.match(second.innerHTML, /Confirming draw/);
  f.release(); await pending; assert.equal(f.state.bag.rod_key, 1); assert.equal(f.state.energy, 98000); assert.match(second.innerHTML, /data-gacha-phase="ready"/);
  f.click('open'); assert.match(second.innerHTML, /data-gacha-phase="opening"/);
  f.click('all'); f.flush(); assert.match(second.innerHTML, /data-gacha-phase="summary"/); assert.equal(f.calls, 1);
});

test('closing during a pumpkin animation cancels its timer and reopening allows completion without another payment', async () => {
  const f = fixture(); f.panel.mount(f.host()); const pending = f.panel.draw(1); f.release(); await pending;
  f.click('open'); assert.equal(f.tasks.size, 1); f.panel.unmount(); assert.equal(f.tasks.size, 0);
  const next = f.host(); f.panel.mount(next); assert.match(next.innerHTML, /data-gacha-phase="ready"/);
  f.click('open'); f.flush(); assert.match(next.innerHTML, /data-gacha-phase="reward"/); assert.match(next.innerHTML, /GUARANTEED/); assert.equal(f.calls, 1);
});

test('switching save profiles cannot display the former account receipt, and resetting clears old presentation', async () => {
  const f = fixture(); f.panel.mount(f.host()); const pending = f.panel.draw(1); f.release(); await pending;
  f.panel.unmount(); f.replaceState(); const other = f.host(); f.panel.mount(other); assert.match(other.innerHTML, /data-gacha-phase="shop"/); assert.doesNotMatch(other.innerHTML, /data-gacha="history"/);
  assert.equal(f.state.halloweenGacha, undefined);
});
