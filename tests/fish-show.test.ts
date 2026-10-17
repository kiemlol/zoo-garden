import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FISH} from '../src/content.ts';
import {fishKit,heroKit,useHeroLoader} from '../src/assets.ts';
import {World} from '../src/world.ts';
import {newGame} from '../src/model.ts';
import {fishShowPlan,fishShowBlend,FISH_SHOW_SPECIES,FISH_SHOW_MAX_SPAN,FISH_SHOW_MIN_SPAN,FISH_SHOW_HAND_GAP} from '../src/fish-show-rules.ts';
import {drawFishShow,fishShowBounds} from '../src/fish-show-view.ts';
import {cameraOffset,defaultCameraZoom} from '../src/camera-rig.ts';
import {FishShowCamera} from '../src/fish-show-camera.ts';
const now=10000,until=now+3000;
const disk=async(url:string)=>{const b=readFileSync(new URL('../public/assets/models/'+url.split('/').pop()!.split('?')[0],import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'')).scene;};
useHeroLoader(disk);for(const kit of [fishKit,heroKit]){(kit as any).loadScene=disk;await kit.load();}
function avatar(scale=.84){const w:any=Object.assign(Object.create(World.prototype),{state:newGame(),scene:new T.Scene(),position:new T.Vector3(),time:0,facing:0,walkClock:0,playerMaterials:[],castT:0});w.player=w.lookAvatar('#fff',{});w.animatePlayer(0);w.player.scale.setScalar(scale);return w.player as T.Group;}
function measuredSpan(root:T.Object3D,axis:'x'|'z'){
 root.updateWorldMatrix(true,true);const direction=new T.Vector3(axis==='x'?1:0,0,axis==='z'?1:0).transformDirection(root.matrixWorld),corner=new T.Vector3();let min=Infinity,max=-Infinity;
 root.traverse(o=>{if(!(o instanceof T.Mesh))return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!;for(let i=0;i<8;i++){corner.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(o.matrixWorld);const n=corner.dot(direction);min=Math.min(min,n);max=Math.max(max,n);}});return max-min;
}

test('every real species has a display measurement; actual caught cm select the pose without changing tank classes',()=>{
 const ids=Object.keys(FISH).filter(id=>id!=='boot');assert.deepEqual(Object.keys(FISH_SHOW_SPECIES).sort(),ids.sort());
 assert.equal(fishShowPlan('fish_whale',99.9)!.twoHands,false);assert.equal(fishShowPlan('fish_jelly',100)!.twoHands,false);
 assert.equal(fishShowPlan('fish_jelly',100.1)!.twoHands,true);assert.ok(fishShowPlan('fish_jelly',5)!.span>FISH_SHOW_MIN_SPAN);
 assert.equal(fishShowPlan('fish_manta',700)!.measure,'wingspan');assert.equal(fishShowPlan('fish_whale',3120)!.span,FISH_SHOW_MAX_SPAN);
 for(const id of ids){assert.equal(fishShowPlan(id,100.1)!.pitch,0,id+' two-hand fish is horizontal');if(FISH_SHOW_SPECIES[id].axis==='z')assert.equal(fishShowPlan(id,100)!.pitch,-Math.PI/2,id+' one-hand fish is upright');}
 for(const size of [0,-1,NaN,Infinity])assert.equal(fishShowPlan('fish_jelly',size),null);for(const id of ['boot','carrot','__proto__'])assert.equal(fishShowPlan(id,20),null);
});

test('all species follow the readable cm curve, independent of avatar size, including oversized legacy records',()=>{
 for(const id of Object.keys(FISH_SHOW_SPECIES))for(const cm of [FISH[id].size?.[0]??10,FISH[id].size?.[1]??60])for(const scale of [.65,1.25]){
  const p=avatar(scale),show={id,size:cm,until};drawFishShow(p,show,0,now);const fish=p.getObjectByName('held-show-fish')!;
  assert.ok(Math.abs(measuredSpan(fish,fishShowPlan(id,cm)!.axis)-fishShowPlan(id,cm)!.span)<1e-5,`${id} ${cm}cm at avatar scale ${scale}`);
  const b=new T.Box3().setFromObject(fish),head=new T.Box3().setFromObject(p.getObjectByName('head')!),palm=p.getObjectByName('hand-left')!.getWorldPosition(new T.Vector3());
  assert.ok(palm.y<head.max.y,'hands stay forward below the head, never overhead');
  assert.ok(b.min.z-palm.z>FISH_SHOW_HAND_GAP*scale-.001,'visible surface stays clear of the palm');
  for(const step of [125,375,625]){drawFishShow(p,show,0,now+step);const animated=new T.Box3().setFromObject(fish),hand=p.getObjectByName('hand-left')!.getWorldPosition(new T.Vector3());assert.ok(animated.min.z-hand.z>FISH_SHOW_HAND_GAP*scale-.002,`${id}: wagging never closes the palm gap`);assert.ok(animated.min.z-hand.z<FISH_SHOW_HAND_GAP*scale+.002,`${id}: wriggling never pushes the fish away from the palms`);}

  drawFishShow(p,null,0,now);
 }
 const p=avatar();for(const cm of [5,20,20.1,40,100,100.1,400,800,1200,3120]){drawFishShow(p,{id:'fish_whale',size:cm,until},0,now);assert.ok(Math.abs(measuredSpan(p.getObjectByName('held-show-fish')!,'z')-fishShowPlan('fish_whale',cm)!.span)<1e-5);}
 drawFishShow(p,null,0,now);
});

test('raise and lower transitions are smooth, finish on time, and late observers see the same pose phase',()=>{
 const end=16000;assert.equal(fishShowBlend(end,10000),0);assert.equal(fishShowBlend(end,10350),1);assert.equal(fishShowBlend(end,15750),1);assert.equal(fishShowBlend(end,end),0);
 let previous=0;for(let t=10000;t<=10350;t+=5){const n=fishShowBlend(end,t);assert.ok(n>=previous&&n-previous<.03);previous=n;}
 previous=1;for(let t=15750;t<=end;t+=5){const n=fishShowBlend(end,t);assert.ok(n<=previous&&previous-n<.04);previous=n;}
 const local=avatar(),remote=avatar(1.4);for(const t of [10175,12000,15875]){const show={id:'fish_manta',size:456.7,until:end};drawFishShow(local,show,0,t);drawFishShow(remote,show,0,t);assert.ok(Math.abs(measuredSpan(local.getObjectByName('held-show-fish')!,'x')-measuredSpan(remote.getObjectByName('held-show-fish')!,'x'))<1e-5);}
 drawFishShow(local,null,0,end);drawFishShow(remote,null,0,end);
});

test('camera frames giant fish and feet on portrait/landscape, then returns without altering user zoom/offset',()=>{
 for(const aspect of [390/844,844/390,16/9]){
  const p=avatar(),camera=new T.PerspectiveCamera(40,aspect,.5,300),rig=new FishShowCamera(),target=new T.Vector3(),offset=cameraOffset(aspect,defaultCameraZoom(aspect,false)),bounds=new T.Box3(),v=new T.Vector3(),fog=new T.Fog('#eee',45,110);
  drawFishShow(p,{id:'fish_whale',size:3120,until},0,now);
  for(let i=0;i<120;i++){camera.position.copy(offset);camera.lookAt(target);rig.update(camera,target,p,1/60,fog);}
  assert.ok(camera.position.distanceTo(target)<offset.length()*1.4,'even the biggest old catch needs only modest framing');
  assert.ok(fog.near>camera.position.distanceTo(p.position),'the holder remains visible despite the distant camera');
  camera.updateMatrixWorld(true);assert.ok(fishShowBounds(p,bounds));bounds.expandByPoint(p.position);
  for(let i=0;i<8;i++){v.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).project(camera);assert.ok(Math.abs(v.x)<.8&&Math.abs(v.y)<.8&&v.z<1,'entire fish and player fit with UI margins');}
  rig.reset();assert.equal(fog.near,45);assert.equal(fog.far,110);
  // Starting another show after a cutscene reset must not accumulate fog offsets.
  for(let i=0;i<120;i++){camera.position.copy(offset);camera.lookAt(target);rig.update(camera,target,p,1/60,fog);}
  drawFishShow(p,null,0,until);for(let i=0;i<180;i++){camera.position.copy(offset);camera.lookAt(target);rig.update(camera,target,p,1/60,fog);}
  assert.deepEqual(camera.position,offset);assert.equal(camera.zoom,1);assert.deepEqual(target,new T.Vector3());
  assert.equal(fog.near,45);assert.equal(fog.far,110);
 }
});

test('display-only fog/material changes leave shared pond and aquarium fish intact',()=>{
 const original=fishKit.instance('fish_whale')!;let source:T.Material|undefined;original.traverse(o=>{if(o instanceof T.Mesh)source=o.material as T.Material;});const fog=(source as T.MeshStandardMaterial).fog,p=avatar();
 drawFishShow(p,{id:'fish_whale',size:1200,until},0,now);p.getObjectByName('held-show-fish')!.traverse(o=>{if(o instanceof T.Mesh){assert.notEqual(o.material,source);assert.equal((o.material as T.MeshStandardMaterial).fog,false);}});
 drawFishShow(p,null,0,until);assert.equal((source as T.MeshStandardMaterial).fog,fog);assert.equal(source!.userData.sharedKit,true);
});


test('fish struggle moves body and tail smoothly at the same absolute phase for online observers',()=>{
 const p=avatar(),show={id:'fish_whale',size:786,until};drawFishShow(p,show,0,now);const fish=p.getObjectByName('held-show-fish')!,before=fish.quaternion.clone(),y=fish.position.y;let tail:T.Object3D|undefined;fish.traverse(o=>{if(o.name.endsWith('_tail'))tail=o;});
 const swings:number[]=[];for(const step of [125,375,625]){drawFishShow(p,show,999,now+step);swings.push(tail!.rotation.y);assert.ok(fish.quaternion.angleTo(before)>.01,'whole body wriggles');}
 assert.ok(Math.max(...swings)-Math.min(...swings)>.4,'tail flaps clearly');drawFishShow(p,show,900,now+2000);assert.ok(fish.quaternion.angleTo(before)<1e-6);assert.ok(Math.abs(fish.position.y-y)<1e-5);
 const remote=avatar(1.4);drawFishShow(p,show,900,now+125);drawFishShow(remote,show,-123,now+125);const remoteFish=remote.getObjectByName('held-show-fish')!;let remoteTail:T.Object3D|undefined;remoteFish.traverse(o=>{if(o.name.endsWith('_tail'))remoteTail=o;});
 assert.ok(remoteFish.quaternion.angleTo(fish.quaternion)<1e-6,'a late observer with a different world clock sees the same body phase');assert.ok(Math.abs(remoteTail!.rotation.y-tail!.rotation.y)<1e-8,'tail phase is shared too');drawFishShow(p,null,0,until);drawFishShow(remote,null,0,until);
});
