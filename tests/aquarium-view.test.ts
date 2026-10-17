import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fishKit,heroKit,disguiseKit,weaponKit,heroKitFor,useHeroLoader} from '../src/assets.ts';
import {World} from '../src/world.ts';
import {newGame,DISGUISES} from '../src/model.ts';
import {ROWS,type LookId} from '../src/looks.ts';
import {AQUARIUMS} from '../src/aquarium.ts';
import {AquariumView} from '../src/aquarium-view.ts';
import {buildDecoration} from '../src/decorations-art.ts';
import {drawFishShow} from '../src/fish-show-view.ts';
const disk=async(url:string)=>{const b=readFileSync(new URL('../public/assets/models/'+url.split('/').pop()!.split('?')[0],import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'')).scene;};
useHeroLoader(disk);for(const kit of [fishKit,heroKit,disguiseKit,weaponKit]){(kit as any).loadScene=disk;await kit.load();}
const looks=ROWS.body.flatMap(b=>ROWS.height.map(h=>`${b}-${h}-none-bare` as LookId));
await Promise.all(looks.map(look=>heroKitFor(look).load()));

test('three distinct grounded tank sizes contain real fish swimming, turning and wagging through complete loops',()=>{
 const sizes:number[]=[];
 for(const [id,spec] of Object.entries(AQUARIUMS)){
  const root=buildDecoration(id),bounds=new T.Box3().setFromObject(root);sizes.push(bounds.max.x-bounds.min.x);
  const fish=Array.from({length:spec.capacity},(_,i)=>({id:spec.maxClass===2?'fish_whale':spec.maxClass===1?'fish_icepike':'fish_jelly',size:20})),view=new AquariumView(root,id,fish),first=root.getObjectByName('aquarium-fish:0')!,before=first.position.clone();let tail:T.Object3D|undefined;first.traverse(o=>{if(o.name.endsWith('_tail'))tail=o;});assert.ok(tail,'authored fish tail present');let tailMin=Infinity,tailMax=-Infinity;
  for(let i=0;i<240;i++){view.update(i/10);root.updateMatrixWorld(true);for(let j=0;j<fish.length;j++){const f=root.getObjectByName('aquarium-fish:'+j)!,b=new T.Box3().setFromObject(f);assert.ok(b.min.x>-.54*spec.scale&&b.max.x<.54*spec.scale);assert.ok(b.min.z>-.465*spec.scale&&b.max.z<.465*spec.scale);assert.ok(b.min.y>.25*spec.scale&&b.max.y<1.19*spec.scale);assert.ok(Number.isFinite(f.rotation.y));}tailMin=Math.min(tailMin,tail!.rotation.y);tailMax=Math.max(tailMax,tail!.rotation.y);}
  assert.ok(first.position.distanceTo(before)>.05);assert.ok(tailMax-tailMin>.7);view.update(0);assert.ok(first.position.distanceTo(before)<1e-9,'loop poses are absolute-time, not integrated drift');
 }
 assert.ok(Math.abs(sizes[1]/sizes[0]-1.5)<1e-6&&Math.abs(sizes[2]/sizes[0]-2)<1e-6);
});

test('every costume/body/height keeps native arm lengths throughout a two-hand show, with both arms parallel forward',()=>{
 const w:any=Object.assign(Object.create(World.prototype),{state:newGame(),scene:new T.Scene(),position:new T.Vector3(),time:0,facing:0,walkClock:0,playerMaterials:[],castT:0});
 for(const look of looks)for(const disguise of [undefined,...Object.keys(DISGUISES)]){
  w.state.gear={disguise};const p=w.player=w.lookAvatar('#fff',w.state.gear,look);w.animatePlayer(0);
  const arms=['left','right'].map(side=>{const arm=p.getObjectByName('arm-'+side)!,hand=p.getObjectByName('hand-'+side)!;return {arm,hand,scale:arm.scale.clone(),length:hand.position.clone().multiply(arm.scale).length()};});
  for(const elapsed of [0,175,1000,5750]){
   drawFishShow(p,{id:'fish_kraken',size:180,until:16000},0,10000+elapsed);p.updateMatrixWorld(true);
   for(const {arm,hand,scale,length} of arms){
    const tip=hand.getWorldPosition(new T.Vector3()),inParent=arm.parent!.worldToLocal(tip.clone()).sub(arm.position);assert.deepEqual(arm.scale,scale,`${look}/${disguise}: native scale`);assert.ok(Math.abs(inParent.length()-length)<1e-5,'rotation preserves native shoulder-to-palm length');
    if(elapsed===1000){const palm=p.worldToLocal(tip),shoulder=p.worldToLocal(arm.getWorldPosition(new T.Vector3()));assert.ok(Math.abs(palm.x-shoulder.x)<1e-5&&Math.abs(palm.y-shoulder.y)<1e-5&&palm.z>shoulder.z,`${look}/${disguise}: no inward diagonal`);}
   }
  }
  drawFishShow(p,null,0,16000);
 }
});

test('showing fish uses one left hand or both hands forward below the head, and restores gear and idle after expiry',()=>{
 const w:any=Object.assign(Object.create(World.prototype),{state:newGame(),scene:new T.Scene(),position:new T.Vector3(),time:0,facing:0,walkClock:0,playerMaterials:[],castT:0});
 for(const disguise of [undefined,'dz_penguin','dz_explorer_duck','dz_sorcerer','dz_ink_painter','dz_superhero'])for(const id of ['fish_jelly','fish_icepike','fish_whale']){
  w.state.gear={weapon:'sword_wood',disguise};w.player=w.lookAvatar('#fff',w.state.gear);const p=w.player,hand=p.getObjectByName('hand-right')!,weapon=hand.children[0];const right=p.getObjectByName('arm-right')!,left=p.getObjectByName('arm-left')!;w.animatePlayer(0);const idle=right.rotation.clone(),armScale=right.scale.clone();const now=10000,until=now+3000;
  drawFishShow(p,{id,size:id==='fish_whale'?800:id==='fish_icepike'?120:30,until},0,now);p.updateMatrixWorld(true);const fish=p.getObjectByName('held-show-fish')!;assert.ok(fish);assert.equal(weapon.visible,false);
  assert.equal(fish.parent,p);const bounds=new T.Box3().setFromObject(fish),head=new T.Box3().setFromObject(p.getObjectByName('head')!);
  for(const side of id==='fish_jelly'?['left']:['left','right']){
   const arm=p.getObjectByName('arm-'+side)!,palm=p.getObjectByName('hand-'+side)!.getWorldPosition(new T.Vector3()),shoulder=arm.getWorldPosition(new T.Vector3());assert.ok(palm.y<head.max.y,'hands are never raised over the head');p.worldToLocal(palm);p.worldToLocal(shoulder);
   assert.ok(side==='left'?palm.x<0:palm.x>0,'arms never cross');
   if(id==='fish_jelly')assert.ok(Math.abs(palm.z-.85)<1e-5);else{assert.ok(Math.abs(palm.x-shoulder.x)<1e-5&&Math.abs(palm.y-shoulder.y)<1e-5,'arms point straight forward, never inward');assert.ok(palm.z>shoulder.z);assert.deepEqual(arm.scale,armScale,'two-hand pose never stretches the arm');}
   const near=new T.Vector3(0,0,bounds.min.z);p.localToWorld(palm);assert.ok(near.z>palm.z,'fish floats just beyond the hands');
  }

  if(id==='fish_jelly')assert.deepEqual(right.rotation.toArray(),idle.toArray());

  drawFishShow(p,{id,size:30,until},7,until+1);assert.equal(p.getObjectByName('held-show-fish'),undefined);assert.equal(weapon.visible,true);assert.deepEqual(right.scale,armScale);w.animatePlayer(0);assert.deepEqual(right.rotation.toArray(),idle.toArray());
 }
});
