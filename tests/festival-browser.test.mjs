import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chooseOffline,dismissWelcome} from './browser-start.mjs';
const url=process.env.HUD_LAYOUT_URL;
test('festival clothes and carriage render; rapid taps and multi-touch keep page scale fixed and preserve game holds',{skip:!url&&'set HUD_LAYOUT_URL and provide Playwright',timeout:120000},async()=>{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));localStorage.setItem('cute-game-tutorial','done');});
 await page.goto(url);await chooseOffline(page);await page.locator('[data-action=start]').click({force:true});await dismissWelcome(page);
 await page.evaluate(async()=>{const z=__zoo;z.world.renderer.setPixelRatio(.5);z.state.level=50;z.state.energy=100000;z.state.hp=1000;for(const e of z.world.enemies){e.hp=0;e.respawn=999999;}const {FESTIVAL_RECIPES}=await import('/src/festival-content.ts');for(const r of FESTIVAL_RECIPES)for(const[id,n]of Object.entries(r.materials))z.state.bag[id]=(z.state.bag[id]||0)+n;const {wearKit,festivalKit}=await import('/src/assets.ts');await Promise.all([wearKit.load(),festivalKit.load()]);z.panel('craft');});
 const recipeIndexes=await page.evaluate(async()=>{const M=await import('/src/model.ts');return Object.fromEntries(['hair_pumpkin','dress_pumpkin','boots_pumpkin','hair_flex','glasses_flex','outfit_flex','boots_flex','deco_ghost_carriage'].map(id=>[id,M.RECIPES.findIndex(r=>r.result===id)]));});
 // Craft through the ordinary UI, verifying that material consumption reaches the game state.
 for(const id of Object.keys(recipeIndexes)){await page.locator(`[data-action=craft][data-index="${recipeIndexes[id]}"]`).click({force:true});assert.equal(await page.evaluate(id=>__zoo.state.bag[id],id),1);}
 await page.locator('[data-action=close]').click({force:true});
 await page.evaluate(async()=>{const M=await import('/src/model.ts');for(const id of ['hair_pumpkin','dress_pumpkin','boots_pumpkin'])M.equip(__zoo.state,id);__zoo.world.refreshPlayer();});
 await page.waitForFunction(()=>{const h=__zoo.world.player.getObjectByName('head');return h.children.some(n=>n.name.startsWith('hair_pumpkin'));});await page.screenshot({path:'/tmp/pumpkin-mobile.png'});
 await page.evaluate(async()=>{const M=await import('/src/model.ts');for(const id of ['hair_flex','glasses_flex','outfit_flex','boots_flex'])M.equip(__zoo.state,id);M.placeDecoration(__zoo.state,'deco_ghost_carriage',-10,-5);__zoo.world.syncDecorations();__zoo.world.refreshPlayer();__zoo.world.position.set(-8,0,-3);__zoo.world.destination=null;__zoo.world.selected=null;__zoo.world.route=[];});
 assert.ok(await page.evaluate(()=>__zoo.world.player.getObjectByName('head').children.some(n=>n.name.startsWith('glasses_flex'))));assert.ok(await page.evaluate(()=>__zoo.world.entities.some(e=>e.kind==='decoration'&&e.mesh.userData.decorationId==='deco_ghost_carriage'&&!e.mesh.userData.fallback)));await page.screenshot({path:'/tmp/flex-carriage-mobile.png'});
 const scale=await page.evaluate(()=>visualViewport.scale);assert.equal(scale,1);const skill=page.locator('.skill[data-index="0"]:visible').first();const bounds=await skill.boundingBox();assert.ok(bounds);
 let taps=0;await page.exposeFunction('recordGestureTap',()=>taps++);await page.evaluate(()=>document.querySelector('.skill[data-index="0"]').addEventListener('click',()=>window.recordGestureTap()));
 for(let i=0;i<10;i++)await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);assert.equal(await page.evaluate(()=>visualViewport.scale),scale);assert.ok(taps>=10);
 const stick=await page.locator('#movement-joystick').boundingBox();assert.ok(stick);const cdp=await page.context().newCDPSession(page),a={id:1,x:stick.x+stick.width/2+24,y:stick.y+stick.height/2},b={id:2,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});await page.waitForTimeout(800);
 assert.ok(await page.evaluate(()=>__zoo.world.joystickInput!==null),'movement thumb remains held');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,x:a.x-25},{...b,x:b.x+25}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>visualViewport.scale),scale);
 const native=await page.evaluate(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('.skill[data-index="0"]').dispatchEvent(e);const g=new Event('gesturestart',{bubbles:true,cancelable:true});document.dispatchEvent(g);return {context:e.defaultPrevented,gesture:g.defaultPrevented,selection:getSelection().toString(),skillTouch:getComputedStyle(document.querySelector('.skills')).touchAction,select:getComputedStyle(document.querySelector('.skills')).userSelect,callout:getComputedStyle(document.querySelector('.skills')).getPropertyValue('-webkit-touch-callout'),viewport:document.querySelector('meta[name=viewport]').content};});
 assert.ok(native.context&&native.gesture);assert.equal(native.selection,'');assert.equal(native.skillTouch,'none');assert.equal(native.select,'none');assert.match(native.viewport,/maximum-scale=1/);assert.match(native.viewport,/user-scalable=no/);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
