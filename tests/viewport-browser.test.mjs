import test from 'node:test';
import assert from 'node:assert/strict';

test('visible viewport follows keyboard height and scroll, while game resize follows layout dimensions',async()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 const win=new EventTarget(),visual=new EventTarget(),properties=new Map();
 Object.assign(win,{innerWidth:390,innerHeight:844,visualViewport:visual});Object.assign(visual,{width:390,height:844,offsetTop:0,scale:1});
 globalThis.window=win;globalThis.document={documentElement:{style:{setProperty:(k,v)=>properties.set(k,v)},dataset:{}}};
 let resized=0;win.addEventListener('gameviewportresize',()=>resized++);
 try{
 const viewport=await import('../src/viewport.ts?browser-fixture');assert.equal(viewport.viewHeight(),844);
 visual.height=300;visual.dispatchEvent(new Event('resize'));assert.equal(properties.get('--visible-h'),'300px');assert.equal(viewport.viewHeight(),844);assert.equal(resized,0);
 visual.offsetTop=30;visual.dispatchEvent(new Event('scroll'));assert.equal(properties.get('--visible-top'),'30px');
 Object.assign(win,{innerWidth:844,innerHeight:390});Object.assign(visual,{width:844,height:390,offsetTop:0});win.dispatchEvent(new Event('orientationchange'));assert.equal(resized,1);assert.equal(viewport.viewWidth(),844);assert.equal(viewport.viewHeight(),390);
 win.dispatchEvent(new Event('resize'));assert.equal(resized,1,'duplicate resize notifications must not resize WebGL twice');
 visual.scale=2;visual.height=190;visual.dispatchEvent(new Event('resize'));assert.equal(properties.get('--visible-h'),'390px','browser pinch zoom must not change HUD layout dimensions');
 }finally{globalThis.window=previousWindow;globalThis.document=previousDocument;}
});
