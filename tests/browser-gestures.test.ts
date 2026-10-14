import test from 'node:test';
import assert from 'node:assert/strict';
import {lockBrowserGestures} from '../src/browser-gestures.ts';
test('native zoom, context menus and selection are cancelled; game pointer/tap/hold and single-finger scroll pass through',()=>{
 const root=new EventTarget(),off=lockBrowserGestures(root as unknown as Document);
 for(const name of ['gesturestart','gesturechange','gestureend','contextmenu','selectstart']){const e=new Event(name,{cancelable:true});root.dispatchEvent(e);assert.equal(e.defaultPrevented,true,name);}
 for(const name of ['pointerdown','pointerup','click']){const e=new Event(name,{cancelable:true});root.dispatchEvent(e);assert.equal(e.defaultPrevented,false,name);}
 for(const count of [1,2,3]){const e=new Event('touchmove',{cancelable:true});Object.defineProperty(e,'touches',{value:Array(count).fill({})});root.dispatchEvent(e);assert.equal(e.defaultPrevented,count>1);}
 off();const e=new Event('contextmenu',{cancelable:true});root.dispatchEvent(e);assert.equal(e.defaultPrevented,false,'unmount removes the guard');
});
