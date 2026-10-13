import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chooseOffline} from './browser-start.mjs';
import {STATES} from './support/hud-measure.mjs';
const url=process.env.HUD_LAYOUT_URL;
test('camera and panels remain correct through rotation, house transitions and safe areas',{skip:!url&&'set HUD_LAYOUT_URL',timeout:300000},async()=>{
 const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright'),b=await pw.chromium.launch({args:['--enable-unsafe-swiftshader']});
 try{
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(s=>{localStorage.setItem('cute-game-save-v1',s);localStorage.setItem('cute-game-tutorial','done');localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));localStorage.setItem('cute-game-language','vi');},readFileSync(new URL('../promo/save.json',import.meta.url),'utf8'));
 console.log('open game');await p.goto(url);await chooseOffline(p);await p.locator('[data-action=start]').click({force:true});await p.waitForTimeout(1800);await p.evaluate(()=>{document.querySelector('[data-action=welcome-pass]')?.click();document.querySelector('[data-action=close]')?.click();// Software-rendered QA uses fewer canvas pixels; camera and HUD CSS coordinates are unchanged.
__zoo.world.renderer.setPixelRatio(.5);window.__originalWorld=__zoo.world;window.__canvasTaps=0;document.querySelector('#world').addEventListener('pointerdown',()=>window.__canvasTaps++);});
 const camera=async expected=>{const x=await p.evaluate(()=>({zoom:__zoo.world.zoom,length:__zoo.world.viewOffset.length(),aspect:__zoo.world.camera.aspect,width:innerWidth,height:innerHeight,same:__originalWorld===__zoo.world}));assert.equal(x.zoom,expected);assert.ok(Math.abs(x.length-Math.hypot(17,13.5)*expected)<1e-8);assert.ok(Math.abs(x.aspect-x.width/x.height)<1e-8);assert.ok(x.same);};
 for(const [width,height]of [[844,390],[390,844],[667,320],[320,568],[430,932],[768,1024],[1440,900],[844,390]]){
 console.log('viewport',width,height);await p.setViewportSize({width,height});await p.waitForTimeout(200);await camera(width>=height?.8:1.1);
 if(width===844||width===390){await p.evaluate(()=>__zoo.house.enter());await p.waitForFunction(()=>!!__zoo.world.interior);await camera(.87);
 await p.setViewportSize({width:height,height:width});await p.waitForTimeout(200);await camera(.87);
 await p.evaluate(()=>__zoo.house.leave());await p.waitForFunction(()=>!__zoo.world.interior);await camera(height>=width?.8:1.1);
 }await p.setViewportSize({width,height});await p.waitForTimeout(150);
 // The new edge token moves only the functional dock, never the combat cluster.
 const edge=await p.evaluate(()=>{const root=document.documentElement.style,dock=document.querySelector('.top-actions'),skill=document.querySelector('#hud .skills'),a=dock.getBoundingClientRect().right,s=JSON.stringify(skill.getBoundingClientRect().toJSON());root.setProperty('--dock-edge','var(--edge)');const old=dock.getBoundingClientRect().right,same=s===JSON.stringify(skill.getBoundingClientRect().toJSON());root.removeProperty('--dock-edge');return {a,old,same};});assert.ok(edge.a>=edge.old);assert.ok(edge.same);
 console.log('food');await p.locator('[data-action=quick-eat-pick]').click({force:true});await p.waitForTimeout(100);
 const food=await p.evaluate(()=>{const el=document.querySelector('#quick-eat-menu'),r=el.getBoundingClientRect(),skill=document.querySelector('#hud .skills').getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:el.scrollWidth-el.clientWidth,skillOverlap:r.left<skill.right&&r.right>skill.left&&r.top<skill.bottom&&r.bottom>skill.top};});assert.ok(food.x>=0&&food.right<=food.width&&food.top>=0&&food.bottom<=food.height,JSON.stringify(food));assert.ok(food.overflow<=1);assert.ok(!food.skillOverlap);
 const rows=p.locator('#quick-eat-menu button');for(let i=0;i<await rows.count();i++){await rows.nth(i).evaluate(el=>el.scrollIntoView({block:'nearest',behavior:'instant'}));assert.ok(await rows.nth(i).evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}),`food row ${i} is covered`);}
 await p.evaluate(()=>document.querySelector('#quick-eat-menu button').click());
 console.log('ranking');await p.evaluate(()=>__zoo.ranking.open());await p.waitForSelector('.ranking-row');
 const layout=await p.evaluate(()=>{const d=document.querySelector('#ranking-dialog'),l=d.querySelector('.ranking-list'),f=d.querySelector('.ranking-mine'),r=l.getBoundingClientRect(),footer=f.getBoundingClientRect();return {height:l.clientHeight,bottom:r.bottom,footer:footer.top,scrollWidth:l.scrollWidth,clientWidth:l.clientWidth,dialog:d.getBoundingClientRect().toJSON()};});assert.ok(layout.height>=52,JSON.stringify(layout));assert.ok(layout.bottom<=layout.footer+1);assert.ok(layout.scrollWidth<=layout.clientWidth+1);
 const last=p.locator('.ranking-row').last();await last.evaluate(el=>el.scrollIntoView({block:'nearest',behavior:'instant'}));assert.ok(await last.evaluate(el=>{const r=el.getBoundingClientRect(),l=el.closest('.ranking-list').getBoundingClientRect();return r.top>=l.top-1&&r.bottom<=l.bottom+1;}));
 if(width===844&&height===390)await p.screenshot({path:'/tmp/zoopet-ranking-fixed.png'});
 await p.locator('#ranking-dialog .social-close').click({force:true});
 }
 await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{document.documentElement.style.setProperty('--safe-right','30px');document.documentElement.style.setProperty('--safe-left','28px');document.documentElement.style.setProperty('--safe-top','12px');document.documentElement.style.setProperty('--safe-bottom','20px');});await p.waitForTimeout(100);
 await p.locator('[data-action=quick-eat-pick]').click({force:true});await p.waitForTimeout(100);assert.ok(await p.locator('#quick-eat-menu').evaluate(el=>el.getBoundingClientRect().right<=innerWidth-30));await p.screenshot({path:'/tmp/zoopet-food-fixed.png'});
 await p.evaluate(()=>document.querySelector('#quick-eat-menu button').click());await p.keyboard.down('ArrowRight');await p.waitForTimeout(1000);await p.keyboard.up('ArrowRight');
 assert.ok(!await p.evaluate(()=>!!__zoo.world.interior));await STATES.fight(p);await p.locator('#hud .skill[data-index="0"]').tap({force:true});assert.equal(await p.evaluate(()=>window.__canvasTaps),0);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
