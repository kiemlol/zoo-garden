import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chooseOffline,dismissWelcome} from './browser-start.mjs';
const url=process.env.HUD_LAYOUT_URL;
test('lava rod shop shows and charges its ingredients; actual goat rigs animate',{skip:!url&&'set HUD_LAYOUT_URL',timeout:120000},async()=>{
 const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright'),b=await pw.chromium.launch();
 try{
 const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'})));
 await p.goto(url);await chooseOffline(p);await p.locator('[data-action=start]').click({force:true});await dismissWelcome(p);
 await p.evaluate(()=>{__zoo.world.renderer.setPixelRatio(.5);__zoo.state.level=50;__zoo.state.energy=1e6;__zoo.state.bag={};__zoo.panel('shop');});
 const button=p.locator('[data-action=buy][data-item=rod_lava]'),row=p.locator('.shop-item').filter({has:button});
 assert.ok((await button.innerText()).includes('1,500'));assert.equal(await row.locator('.special-tag').count(),0);
 for(const id of ['rod_steady','magma','obsidian','venom_ink','jelly_resin'])assert.ok(await row.locator(`.chips img[src*="/${id}.webp"]`).count(),id+' ingredient displayed');
 await button.click({force:true});assert.equal(await p.evaluate(()=>__zoo.state.bag.rod_lava??0),0);
 await p.evaluate(async()=>{const M=await import('/src/model.ts');for(const[id,n]of Object.entries(M.ITEMS.rod_lava.materials))__zoo.state.bag[id]=n;__zoo.panel('shop');});
 await button.scrollIntoViewIfNeeded();await p.screenshot({path:'/tmp/lava-rod-shop-fixed.png'});await button.click({force:true});
 assert.equal(await p.evaluate(()=>__zoo.state.bag.rod_lava),1);assert.equal(await p.evaluate(()=>__zoo.state.energy),998500);
 await p.locator('[data-action=close]').click({force:true});
 await p.evaluate(async()=>{
  const M=await import('/src/model.ts'),{farmKit}=await import('/src/assets.ts');await farmKit.load();
  const s=__zoo.state;s.energy=1e6;s.farm.built=true;M.buildSpeciesPen(s,'goat');
  M.buyAnimal(s,'goat',Date.now()-M.ANIMALS.goat.growMs-10000);M.buyAnimal(s,'goat',Date.now());
  __zoo.world.build('home');__zoo.world.refreshPlayer();__zoo.world.position.set(M.PEN.x,0,M.PEN.z+4);__zoo.world.destination=null;__zoo.world.route=[];
 });
 await p.waitForFunction(()=>__zoo.world.farmView.animals.children.some(m=>m.name==='farm-goat:legs'&&m.count>0));
 await p.waitForTimeout(1500);await p.screenshot({path:'/tmp/goat-rigs-fixed-portrait.png'});
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(1500);await p.screenshot({path:'/tmp/goat-rigs-fixed-landscape.png'});
 assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
