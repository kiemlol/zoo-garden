import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
import {readFileSync,writeFileSync} from 'node:fs';
import {chooseOffline} from '../tests/browser-start.mjs';
// Use identical viewport, quality, save and camera for before/after. Run with a dev server.
const b=await chromium.launch({args:['--enable-unsafe-swiftshader']}); try { const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
await p.addInitScript(s=>{localStorage.setItem('cute-game-save-v1',s);localStorage.setItem('cute-game-tutorial','done');localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));},readFileSync(new URL('./save.json',import.meta.url),'utf8'));
await p.goto(process.env.HUD_LAYOUT_URL||'http://127.0.0.1:5173');await chooseOffline(p);await p.locator('[data-action=start]').click();await p.waitForTimeout(2500);await p.evaluate(()=>{document.querySelector('[data-action=welcome-pass]')?.click();document.querySelector('[data-action=close]')?.click();});
const results=[];
for(const scene of ['outdoor','indoor']){
 if(scene==='indoor')await p.evaluate(()=>window.__zoo.house.enter());
 await p.waitForTimeout(1500);await p.evaluate(zoom=>{__zoo.world.zoom=zoom;__zoo.world.resize();},scene==='indoor'?.87:.8);
 const result=await p.evaluate(async duration=>{
 const w=window.__zoo.world,times={update:[],render:[]},original={};
 for(const name of Object.keys(times)){original[name]=w[name];w[name]=function(...args){const t=performance.now();const out=original[name].apply(this,args);times[name].push(performance.now()-t);return out;};}
 const memorySamples=[];let memoryAt=0;const mem0=performance.memory?.usedJSHeapSize;let mutations=0;const obs=new MutationObserver(rs=>mutations+=rs.length);obs.observe(document.querySelector('#app'),{subtree:true,childList:true,attributes:true,characterData:true});
 const frames=await new Promise(resolve=>{const xs=[];let previous=0,start=0;function sample(t){if(t-memoryAt>=5000){memoryAt=t;memorySamples.push({atMs:t,heap:performance.memory?.usedJSHeapSize,geometries:w.renderer.info.memory.geometries,textures:w.renderer.info.memory.textures});}if(previous)xs.push(t-previous);else start=t;previous=t;if(t-start<duration)requestAnimationFrame(sample);else resolve(xs);}requestAnimationFrame(sample);});
 obs.disconnect();for(const name of Object.keys(times))w[name]=original[name];
 const stats=a=>{const sum=a.reduce((x,y)=>x+y,0);a.sort((x,y)=>x-y);return {n:a.length,mean:sum/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
 return {memorySamples,frame:stats(frames),fps:1000/(frames.reduce((x,y)=>x+y,0)/frames.length),longFrames:frames.filter(v=>v>50).length,update:stats(times.update),render:stats(times.render),drawCalls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,geometries:w.renderer.info.memory.geometries,textures:w.renderer.info.memory.textures,heapStart:mem0,heapEnd:performance.memory?.usedJSHeapSize,mutations,zoom:w.zoom,offset:w.viewOffset.length()};
 },Math.max(1,Number(process.env.PERF_SECONDS)||10)*1000); results.push({scene,...result});
}
console.log(JSON.stringify(results,null,2));if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(results,null,2));} finally {await b.close();}
