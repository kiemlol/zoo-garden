import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {World,type Entity} from '../src/world.ts';
import {houseFocus} from '../src/house-session.ts';
import {cameraPitch,setCameraPitch,groundAt} from '../src/camera-rig.ts';
import {HOUSE} from '../src/house.ts';

test('resize resolves indoor/orientation zoom, ignores stale zoom and resizes the canvas only when its dimensions change',()=>{
 const previous={width:globalThis.innerWidth,height:globalThis.innerHeight};let resized=0;
 const w=Object.assign(Object.create(World.prototype),{camera:new T.PerspectiveCamera(),viewOffset:new T.Vector3(),renderer:{setSize(){resized++;}}}) as World;
 try{
 for(const [width,height,inside,expected]of [[844,390,false,.8],[390,844,false,1.1],[844,390,true,.87],[390,844,true,.87],[844,390,true,.87],[844,390,false,.8],[390,844,false,1.1]] as const){
  globalThis.innerWidth=width;globalThis.innerHeight=height;w.interior=inside?{} as NonNullable<World['interior']>:null;w.zoom=1.6;w.resize();assert.equal(w.zoom,expected);assert.ok(Math.abs(w.viewOffset.length()-Math.hypot(17,13.5)*expected)<1e-9);const count=resized;w.resize();assert.equal(resized,count);
 }
 assert.equal(resized,6);
 }finally{globalThis.innerWidth=previous.width;globalThis.innerHeight=previous.height;}
});

test('cached indoor focus remains equivalent to fresh ground rays after pitch, zoom and aspect changes',()=>{
 const previous=cameraPitch();
 try{
 const clamp=(v:number,lo:number,hi:number)=>{const mid=(lo+hi)/2,reach=lo>hi?(lo-hi)/4:(hi-lo)/2;return Math.min(mid+reach,Math.max(mid-reach,v));};
 for(const pitch of [42,30,51.5,42])for(const aspect of [.46,2.16,.9])for(const zoom of [.87,1.1]){
 setCameraPitch(pitch);const p={x:3,z:-2},b=HOUSE.bounds;
 const expected=[clamp(p.x,b.x0-.6-groundAt(aspect,zoom,-1,0).x,b.x1+.6-groundAt(aspect,zoom,1,0).x),0,clamp(p.z,b.z0-2.2-groundAt(aspect,zoom,0,1).z,b.z1+.6-groundAt(aspect,zoom,0,-1).z)];
 for(let repeat=0;repeat<3;repeat++)assert.deepEqual(houseFocus(p,aspect,zoom).toArray(),expected);
 }
 }finally{setCameraPitch(previous);}
});

test('single-pass interaction search preserves selection, door priority and stable ties of the former sorted search',()=>{
 const w=Object.assign(Object.create(World.prototype),{position:new T.Vector3(),validTarget:(e:Entity)=>e.mesh.visible}) as World;
 let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let run=0;run<100;run++){
 w.entities=Array.from({length:200},(_,i)=>({kind:i%10===0?'home':'friend',x:(random()-.5)*20,z:(random()-.5)*20,radius:random()*3,mesh:{visible:random()>.1}} as Entity));
 w.selected=run%2?w.entities[0]:null;
 const gap=(e:Entity)=>Math.hypot(e.x-w.position.x,e.z-w.position.z)-e.radius-(e.kind==='home'?1.6:0);
 const s=w.selected,expected=s&&w.validTarget(s)&&Math.hypot(s.x,s.z)<s.radius+2?s:w.entities.filter(e=>w.validTarget(e)).sort((a,b)=>gap(a)-gap(b)).find(e=>Math.hypot(e.x,e.z)<e.radius+2);
 assert.equal(w.nearest(),expected);
 }
});
