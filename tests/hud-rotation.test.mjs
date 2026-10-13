import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chooseOffline} from './browser-start.mjs';
import {measureHud,findings,STATES} from './support/hud-measure.mjs';
const url=process.env.HUD_LAYOUT_URL;
test('full HUD survives repeated resizing, both hands, safe areas and menu scrolling without recreating the game',{skip:!url&&'set HUD_LAYOUT_URL to a running dev server',timeout:180000},async()=>{
 const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright'),b=await pw.chromium.launch({args:['--enable-unsafe-swiftshader']});
 try{
 const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(s=>{localStorage.setItem('cute-game-save-v1',s);localStorage.setItem('cute-game-tutorial','done');localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));},readFileSync(new URL('../promo/save.json',import.meta.url),'utf8'));
 await p.routeWebSocket(u=>new URL(u).searchParams.has('token'),()=>{});await p.goto(url);await chooseOffline(p);await p.locator('[data-action=start]').click();await p.waitForSelector('#hud:not([hidden])');await p.waitForTimeout(2000);
 await p.evaluate(()=>{window.__qaWorld=window.__zoo.world;window.__qaState=window.__zoo.state;window.__canvasTaps=0;document.querySelector('#world').addEventListener('pointerdown',()=>window.__canvasTaps++);document.querySelector('[data-action=welcome-pass]')?.click();document.querySelector('[data-action=close]')?.click();});
 for(const [width,height]of [[320,568],[430,932],[667,320],[844,390],[768,1024],[1440,900],[390,844]]){
 await p.setViewportSize({width,height});await p.waitForTimeout(200);
 for(const scenario of ['calm','fight','fishing']){
 await STATES[scenario](p);assert.deepEqual(findings(await p.evaluate(measureHud)),[],`${width}x${height} ${scenario}`);
 }
 const same=await p.evaluate(()=>({world:window.__qaWorld===window.__zoo.world,state:window.__qaState===window.__zoo.state,aspect:window.__zoo.world.camera.aspect,width:innerWidth,height:innerHeight}));assert.ok(same.world&&same.state);assert.ok(Math.abs(same.aspect-same.width/same.height)<.001);
 }
 await p.setViewportSize({width:667,height:320});await STATES.fight(p);
 await p.evaluate(()=>{const r=document.documentElement.style;r.setProperty('--safe-left','28px');r.setProperty('--safe-right','30px');r.setProperty('--safe-top','12px');r.setProperty('--safe-bottom','20px');});await p.waitForTimeout(200);
 for(const hand of ['left','right']){await p.evaluate(hand=>document.querySelector('#hud').classList.toggle('joystick-right',hand==='right'),hand);await p.waitForTimeout(100);assert.deepEqual(findings(await p.evaluate(measureHud)),[],`safe areas, ${hand} hand`);}
 // Every menu button remains reachable in the bounded column, including the last.
 const buttons=p.locator('#hud .top-actions button');for(let i=0;i<await buttons.count();i++){const button=buttons.nth(i);if(!await button.isVisible())continue;await button.scrollIntoViewIfNeeded();const reached=await button.evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return hit===el||el.contains(hit)});assert.ok(reached,await button.getAttribute('aria-label'));}
 await p.locator('#hud .skill[data-index="0"]').tap();assert.equal(await p.evaluate(()=>window.__canvasTaps),0);assert.deepEqual(errors,[]);await p.screenshot({path:'/tmp/zoopet-hud-landscape.png'});
 }finally{await b.close();}
});
