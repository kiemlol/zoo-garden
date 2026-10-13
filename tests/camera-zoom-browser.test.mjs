import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chooseOffline} from './browser-start.mjs';
const url=process.env.HUD_LAYOUT_URL;
test('camera defaults coexist with Settings, wheel and two-finger zoom',{skip:!url&&'set HUD_LAYOUT_URL',timeout:180000},async()=>{
 const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright'),b=await pw.chromium.launch({args:['--enable-unsafe-swiftshader']});
 try{
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));localStorage.setItem('cute-game-tutorial','done');});
 await p.goto(url);await chooseOffline(p);await p.locator('[data-action=start]').click({force:true});await p.evaluate(()=>{document.querySelector('[data-action=welcome-pass]')?.click();document.querySelector('[data-action=close]')?.click();__zoo.world.renderer.setPixelRatio(.5);});
 const zoom=()=>p.evaluate(()=>__zoo.world.zoom),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
 near(await zoom(),.8);
 await p.evaluate(()=>__zoo.panel('settings'));assert.equal(await p.locator('[data-action=zoom-out]').isEnabled(),true);await p.locator('[data-action=zoom-out]').click({force:true});near(await zoom(),.9);await p.locator('[data-action=zoom-in]').click({force:true});near(await zoom(),.8);await p.locator('[data-action=close]').click({force:true});
 await p.evaluate(()=>document.querySelector('#world').dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true})));near(await zoom(),.9);
 await p.evaluate(()=>__zoo.world.resize());near(await zoom(),.9);
 const cdp=await p.context().newCDPSession(p);
 const points=gap=>[{x:420-gap/2,y:225,id:1},{x:420+gap/2,y:225,id:2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(80)});
 for(const gap of [90,100,120,140,160])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(gap)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const pinched=await zoom();assert.ok(pinched<.9&&pinched>=.6,'spreading fingers zooms in');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(160)});
 for(const gap of [140,120,100,90,80])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(gap)});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await zoom()>pinched,'bringing fingers together zooms out');
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(150);near(await zoom(),1.1);
 near(await p.evaluate(()=>__zoo.world.viewOffset.length()),Math.hypot(17,13.5)*1.1*1.3);
 await p.evaluate(()=>{__zoo.world.zoom=1.25;__zoo.world.resize();});near(await zoom(),1.25);
 await p.evaluate(()=>__zoo.house.enter(true));await p.waitForFunction(()=>!!__zoo.world.interior);near(await zoom(),.87);
 await p.evaluate(()=>__zoo.panel('settings'));await p.locator('[data-action=zoom-out]').click({force:true});near(await zoom(),.97);await p.locator('[data-action=close]').click({force:true});await p.evaluate(()=>__zoo.world.resize());near(await zoom(),.97);
 await p.setViewportSize({width:844,height:390});await p.waitForTimeout(150);near(await zoom(),.87);
 await p.evaluate(()=>__zoo.house.leave());await p.waitForFunction(()=>!__zoo.world.interior);near(await zoom(),.8);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
