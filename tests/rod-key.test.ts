import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {heroKit,disguiseKit,weaponKit,useHeroLoader} from '../src/assets.ts';
import {World} from '../src/world.ts';
import * as M from '../src/model.ts';
import {FishingView,type PondView} from '../src/fishing-view.ts';
import {FishingSimulation} from '../src/fishing.ts';
import {animateKeyRod,drawRemoteKeyBobber} from '../src/rod-key.ts';
import {readFishingPose} from '../src/fishing-pose.ts';
import {mergeParts} from '../src/avatar-merge.ts';
import {ContextGearSelection} from '../src/context-gear.ts';
const disk=async(url:string)=>{const b=readFileSync(new URL('../public/assets/models/'+url.split('/').pop()!.split('?')[0],import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'')).scene;};
useHeroLoader(disk);for(const kit of [heroKit,disguiseKit,weaponKit]){(kit as any).loadScene=disk;await kit.load();}
const fixture=()=>{const w:any=Object.assign(Object.create(World.prototype),{state:M.newGame(),scene:new T.Scene(),position:new T.Vector3(),time:0,facing:0,walkClock:0,playerMaterials:[],castT:0,weaponKind:'rod'});w.state.bag.rod_key=1;w.state.gear.weapon='rod_key';w.player=w.lookAvatar('#ffffff',w.state.gear);return w;};

test('key rod is obtainable through the rod shop and shares existing rod selection/equip rules',()=>{
 const s=M.newGame();s.energy=10000;for(const [id,n] of Object.entries(M.ITEMS.rod_key.materials!))s.bag[id]=n;
 assert.equal(M.buy(s,'rod_key'),true);assert.equal(M.equip(s,'rod_key'),true);assert.equal(s.gear.weapon,'rod_key');assert.equal(M.ITEMS.rod_key.weapon!.kind,'rod');assert.ok(M.ITEMS.rod_key.weapon!.quality!>=M.ITEMS.rod_gold.weapon!.quality!);assert.equal(new ContextGearSelection().forFishing(s),'rod_key');
});

test('authored key rod stays inside weapon budgets with its grip below the gear and its tip above the crystal',async()=>{
 const file=readFileSync(new URL('../public/assets/models/gear-weapons.glb',import.meta.url));assert.ok(file.length<=500*1024);
 const scene=await disk('gear-weapons.glb'),rod=scene.getObjectByName('rod_key')!;assert.ok(rod);let triangles=0;rod.traverse(o=>{if(o instanceof T.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.ok(triangles<=900);
 let tip:T.Object3D|undefined;rod.traverse(o=>{if(o.name.startsWith('rod-tip'))tip=o;});const gear=rod.getObjectByName('gear')!,crystal=rod.getObjectByName('crystal')!;assert.ok(gear&&crystal&&tip);scene.updateMatrixWorld(true);
 const grip=new T.Vector3(.37,.72,.05),centre=crystal.getWorldPosition(new T.Vector3()),end=tip!.getWorldPosition(new T.Vector3());assert.ok(centre.distanceTo(grip)>1.2);assert.ok(end.y>centre.y);assert.ok(end.z>centre.z);
 const shaft:T.Vector3[]=[];rod.traverse(o=>{if(!(o instanceof T.Mesh)||!(o.material as T.Material).name.endsWith('grip silver'))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)shaft.push(new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));});assert.ok(Math.min(...shaft.map(p=>p.distanceTo(grip)))<.08);
});

test('each avatar rotates only the gear, holds the crystal still, pulses owned materials and retains animated parts through merging',()=>{
 for(const disguise of [undefined,'dz_penguin','dz_explorer_duck','dz_sorcerer','dz_ink_painter','dz_superhero']){
  const w=fixture();w.state.gear.disguise=disguise;w.player=w.lookAvatar('#ffffff',w.state.gear);const p=w.player,gear=p.getObjectByName('gear')!,crystal=p.getObjectByName('crystal')!;assert.ok(gear&&crystal);const c=crystal.matrix.clone(),base=gear.quaternion.clone(),tip=p.getObjectByName('rod-tip')!.position.clone();
  mergeParts(p,{exact:true});animateKeyRod(p,1.25);assert.ok(Math.abs(base.angleTo(gear.quaternion)-Math.PI/2)<1e-6);assert.deepEqual(crystal.matrix,c);assert.deepEqual(p.getObjectByName('rod-tip')!.position,tip);
  const glow=(crystal.children.find((o:T.Object3D)=>o instanceof T.Mesh&&o.material.name==='Weapon rod_key crystal') as T.Mesh).material as T.MeshToonMaterial;const intensity=glow.emissiveIntensity;animateKeyRod(p,.5);assert.notEqual(glow.emissiveIntensity,intensity);animateKeyRod(p,5);assert.ok(base.angleTo(gear.quaternion)<1e-6);assert.equal((p.getObjectByName('key-sparkles') as T.InstancedMesh).count,6);
  const second=w.lookAvatar('#ffffff',w.state.gear),other=second.getObjectByName('crystal').children.find((o:T.Object3D)=>o instanceof T.Mesh&&o.material.name==='Weapon rod_key crystal');assert.notEqual(glow,other.material);assert.equal(glow.userData.sharedKit,false);assert.doesNotThrow(()=>p.clone());
 }
});

test('key rod changes only the float appearance and line: cast/nibbles/hook trajectories match a normal rod and swapping back restores the line',()=>{
 const pond:PondView={id:'pond',x:0,z:5,rx:3,rz:3,surface:.1,waterId:'home'},tip=new T.Vector3(.3,2,1),player=new T.Vector3(),fx={ring(){},burst(){},shake(){}},kit={ready:false},key=new FishingView(new T.Scene(),fx as any,kit as any,()=>{}),normal=new FishingView(new T.Scene(),fx as any,kit as any,()=>{});
 key.begin(pond,tip,pond,'rod_key');normal.begin(pond,tip,pond,'rod_gold');const k=key as any,n=normal as any;assert.equal(k.line.visible,false);assert.equal(k.bobber.name,'bobber_star');let draws=0;k.drawLine=()=>{draws++;};
 const simulation=new FishingSimulation({quality:.8,bait:false,choose:()=>null,water:{x:0,z:5,r:3},cast:pond,player});
 for(const phase of ['cast','wait','approach','nibble','bite','hooked'] as const){simulation.phase=phase;for(let i=0;i<5;i++){key.update(.025,i*.025,tip,player,simulation);normal.update(.025,i*.025,tip,player,simulation);assert.ok(k.bobber.position.distanceTo(n.bobber.position)<1e-8);assert.equal(k.line.visible,false);}}
 assert.equal(draws,0);assert.ok(k.bobber.children[0].material.emissive.getHex()>0);const snapshot=key.bobberPose()!;assert.deepEqual(snapshot,{x:k.bobber.position.x,y:k.bobber.position.y,z:k.bobber.position.z});
 key.cancel();assert.equal(key.bobberPose(),undefined);assert.equal(k.bobber.visible,false);key.begin(pond,tip,pond,'rod');assert.equal(k.line.visible,true);assert.notEqual(k.bobber.name,'bobber_star');
});

test('online key-rod poses retain the float position, draw no line and clear on cancellation or replacement',()=>{
 const pose={phase:'wait' as const,cast:0,tension:.2,rod:'rod_key',bobber:{x:1,y:.13,z:5}};assert.deepEqual(readFishingPose(pose),pose);for(const bobber of [{x:NaN,y:0,z:1},{x:0,y:0,z:Infinity}])assert.equal(readFishingPose({...pose,bobber}),null);assert.equal(readFishingPose({...pose,rod:'rod',bobber:pose.bobber}),null);
 const w=fixture();w.addRemotePlayer('remote',{x:-2,z:3,facing:.7,gear:{weapon:'sword_wood'},visual:{fishing:pose}});w.animateRemotes(.1);const p=w.remotePlayers.get('remote').mesh,b=p.getObjectByName('bobber_star');assert.ok(b?.visible);p.updateMatrixWorld(true);assert.ok(b.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(1,.13,5))<1e-6);assert.ok(p.getObjectByName('gear'));let lines=0;b.traverse((o:T.Object3D)=>{if(o instanceof T.Line)lines++;});assert.equal(lines,0);
 w.updateRemotePlayer('remote',{x:-2,z:3,visual:{fishing:null}});w.animateRemotes(.1);assert.equal(w.remotePlayers.get('remote').mesh.getObjectByName('bobber_star')?.visible??false,false);w.removeRemotePlayer('remote');
 const actor=new T.Group();drawRemoteKeyBobber(actor,pose,0);drawRemoteKeyBobber(actor,null,1);assert.equal(actor.getObjectByName('bobber_star')!.visible,false);
});
