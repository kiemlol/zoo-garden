import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as M from '../src/model.ts';
import { applyGameAction } from '../src/actions.ts';
import * as Config from '../src/halloween-gacha-config.ts';
import { PUMPKIN_OPEN_SECONDS } from '../src/gacha-pumpkin.ts';
const source = readFileSync(new URL('../src/halloween-gacha-ui.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
function fixture() {
  let state = M.newGame('UI'), release, calls = 0, clock = 0, openings = 0, disposed = 0; const sounds = [], itemEvents = []; state.energy = 100000; state.halloweenGacha = { total: 149, misses: 149 };
  const tasks = new Map(); let timer = 0;
  const context = { ...Config, PUMPKIN_OPEN_SECONDS, performance: { now: () => clock }, ITEMS: M.ITEMS, t: (s, params = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(params[k])), setTimeout: callback => { tasks.set(++timer, callback); return timer; }, clearTimeout: id => tasks.delete(id), matchMedia: () => ({ matches: false }) };
  vm.createContext(context); vm.runInContext(stripTypeScriptTypes(source, { mode: 'transform' }) + '\nglobalThis.Panel = HalloweenGachaPanel;', context);
  const panel = new context.Panel({ state: () => state, art: id => `<img src="${id}.webp">`, close: () => panel.unmount(), sound: sound => sounds.push(sound), item: () => ({ show(slot,id,rotating){itemEvents.push(['show',id,rotating]);},dispose(){itemEvents.push(['dispose']);} }), pumpkin: () => ({ show(slot, opening) { if (opening) openings++; }, dispose() { disposed++; } }), draw: async count => { const original = state; calls++; await new Promise(r => release = r); return applyGameAction(original, { type: 'halloweenDraw', payload: { count } }, { now: 100, random: () => .999 }); } });
  function host() { return { hidden: true, innerHTML: '', addEventListener() {}, removeEventListener() {}, querySelector(selector) { return (selector === '.gacha-pumpkin-slot' && this.innerHTML.includes('gacha-pumpkin-slot') || selector === '.gacha-model-slot' && this.innerHTML.includes('gacha-model-slot')) ? {} : null; } }; }
  const click = action => panel.click({ target: { closest: () => action ? ({ dataset: { gacha: action }, disabled: false }) : null }, stopPropagation() {} });
  return { panel, host, click, tasks, sounds, itemEvents, tick() { clock += 400; }, flush() { clock += 2000; for (const cb of tasks.values()) cb(); tasks.clear(); }, get state() { return state; }, replaceState() { state = M.newGame('Other'); }, get calls() { return calls; }, get openings() { return openings; }, get disposed() { return disposed; }, release() { release(); } };
}

test('pending UI closes/reopens safely, prevents double purchase, and reveals already saved rewards', async () => {
  const f = fixture(), first = f.host(); f.panel.mount(first);
  const pending = f.panel.draw(1); await f.panel.draw(1); assert.equal(f.calls, 1);
  f.panel.unmount(); assert.equal(first.hidden, true); const second = f.host(); f.panel.mount(second); assert.match(second.innerHTML, /Confirming draw/);
  f.release(); await pending; assert.equal(f.state.bag.rod_key, 1); assert.equal(f.state.energy, 98000); assert.match(second.innerHTML, /data-gacha-phase="ready"/);
  f.click('advance'); assert.match(second.innerHTML, /data-gacha-phase="opening"/);
  f.flush(); f.click('all'); assert.match(second.innerHTML, /data-gacha-phase="summary"/); assert.equal(f.calls, 1);
});

test('closing during the first pumpkin animation cancels its timer and disposes the model; reopening completes without another payment', async () => {
  const f = fixture(); f.panel.mount(f.host()); const pending = f.panel.draw(1); f.release(); await pending;
  f.click('advance'); assert.equal(f.tasks.size, 2); const before = f.disposed; f.panel.unmount(); assert.equal(f.tasks.size, 0); assert.equal(f.disposed, before + 1);
  const next = f.host(); f.panel.mount(next); assert.match(next.innerHTML, /data-gacha-phase="ready"/);
  f.click('advance'); f.flush(); assert.match(next.innerHTML, /data-gacha-phase="reward"/); assert.match(next.innerHTML, /GUARANTEED/); assert.equal(f.calls, 1);
});

test('switching saves cannot show the former account receipt or finish a pending draw in the new save', async () => {
  const f = fixture(); f.panel.mount(f.host()); const pending = f.panel.draw(1);
  f.panel.unmount(); f.replaceState(); const other = f.host(); f.panel.mount(other); f.release(); await pending;
  assert.match(other.innerHTML, /data-gacha-phase="shop"/); assert.doesNotMatch(other.innerHTML, /data-gacha="history"/); assert.equal(f.state.halloweenGacha, undefined);
});

test('ten draws open only one pumpkin, then screen taps advance all rewards and the final result; OK returns to shop', async () => {
  const f = fixture(), host = f.host(); f.panel.mount(host); const pending = f.panel.draw(10); f.release(); await pending;
  assert.match(host.innerHTML, /Tap the screen to open the box!/); assert.match(host.innerHTML, /HALLOWEEN NIGHT DRAW/);
  f.click('advance'); f.click('advance'); assert.equal(f.openings, 1); f.flush();
  f.click('advance'); assert.equal(f.panel.index, 0, 'rapid double taps cannot skip a fresh reward');
  for (let i = 1; i <= 10; i++) {
    f.tick(); f.click(i % 2 ? 'advance' : null); // both the large tap target and surrounding screen work
    assert.equal(f.openings, 1); assert.equal(f.calls, 1); assert.equal(f.tasks.size, 0);
    if (i < 10) { assert.equal(f.panel.index, i); assert.match(host.innerHTML, /data-gacha-phase="reward"/); assert.doesNotMatch(host.innerHTML, /gacha-pumpkin-slot/); }
  }
  assert.match(host.innerHTML, /data-gacha-phase="summary"/);
  assert.equal((host.innerHTML.match(/class="gacha-result-card /g) || []).length, 10);
  assert.doesNotMatch(host.innerHTML, /gacha-number|<progress|data-gacha="next"|View results|<small>×/);
  assert.match(host.innerHTML, /data-gacha="back">OK/);
  f.click('back'); assert.match(host.innerHTML, /data-gacha-phase="shop"/); assert.equal(f.calls, 1);
});

test('shop shows icon-only prizes and a compact pity badge, names appear on selection, odds remain public', () => {
  const f = fixture(), host = f.host(); f.panel.mount(host);
  assert.match(host.innerHTML, /149\/150/); assert.doesNotMatch(host.innerHTML, /<progress|gacha-rate|gacha-item-name/);
  assert.equal((host.innerHTML.match(/class="gacha-prize /g) || []).length, 10);
  f.panel.selected = Config.HALLOWEEN_PRIZES[0]; f.panel.render(); assert.match(host.innerHTML, /gacha-item-name/);
  f.click('rates'); for (const p of Config.HALLOWEEN_PRIZES) assert.ok(host.innerHTML.includes(`${p.weight / 100}%`));
  f.click('rates-close'); assert.doesNotMatch(host.innerHTML, /gacha-odds-shade/);
});


test('sound cues follow real transitions once: squash, lid launch, rarity reveal and result; history/repaint never replays a win', async () => {
  const f=fixture(),host=f.host();f.panel.mount(host);const pending=f.panel.draw(10);f.release();await pending;f.sounds.length=0;
  f.click('advance');assert.deepEqual(f.sounds,['gacha-squash']);f.flush();assert.deepEqual(f.sounds,['gacha-squash','gacha-open','gacha-purple']);
  f.panel.render();assert.equal(f.sounds.length,3);f.tick();f.click('advance');assert.equal(f.sounds.at(-1),'gacha-blue');
  f.click('all');assert.equal(f.sounds.at(-1),'gacha-summary');f.click('back');f.click('history');assert.equal(f.sounds.at(-1),'click');
});

test('closing before the lid lift cancels all delayed sound cues; 3D viewer is disposed when leaving a preview', async () => {
  const f=fixture();f.panel.mount(f.host());f.panel.selected=Config.HALLOWEEN_PRIZES[0];f.panel.render();assert.deepEqual(f.itemEvents.at(-1),['show','rod_key',true]);
  const pending=f.panel.draw(1);f.release();await pending;assert.ok(f.itemEvents.some(e=>e[0]==='dispose'));
  f.click('advance');const before=f.sounds.length;f.panel.unmount();f.flush();assert.equal(f.sounds.length,before);
});
