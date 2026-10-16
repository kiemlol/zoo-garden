import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {World} from '../src/world.ts';
import {heroKit,disguiseKit,weaponKit,heroKitFor,useHeroLoader} from '../src/assets.ts';
import {ROWS,DEFAULT_LOOK,type LookId} from '../src/looks.ts';
import {newGame,DISGUISES} from '../src/model.ts';
import {FishingView,type PondView} from '../src/fishing-view.ts';
import {FishingSimulation} from '../src/fishing.ts';
import {readFishingPose,type FishingPose} from '../src/fishing-pose.ts';

const disk=async(url:string)=>{const b=readFileSync(new URL('../public/assets/models/'+url.split('/').pop()!.split('?')[0],import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'')).scene;};
useHeroLoader(disk);
for(const kit of [heroKit,disguiseKit,weaponKit]){(kit as any).loadScene=disk;await kit.load();}
const looks=ROWS.body.flatMap(b=>ROWS.height.map(h=>`${b}-${h}-none-bare` as LookId));
await Promise.all(looks.map(l=>heroKitFor(l).load()));
const recent=['dz_penguin','dz_explorer_duck','dz_sorcerer','dz_ink_painter'];
const world=()=>Object.assign(Object.create(World.prototype),{state:newGame(),scene:new T.Scene(),position:new T.Vector3(),facing:0,time:0,castT:0,walkClock:0,playerMaterials:[],moving:false,weaponKind:'rod'} as any) as any;
function animate(w:any,phase:'idle'|FishingPose['phase'],tension=0){w.fishing=phase;w.fishTension=tension;w.player.position.set(0,0,0);w.player.scale.setScalar(1);w.animatePlayer(0);w.player.updateMatrixWorld(true);}
/** Recover separate authored solids from their actual GLB triangles, independently of the hand-anchor table. */
function solids(mesh:T.Mesh){
 const pos=mesh.geometry.getAttribute('position'),points:T.Vector3[]=[],ids:number[]=[],keys=new Map<string,number>(),edges:Set<number>[]=[];
 for(let i=0;i<pos.count;i++){const p=new T.Vector3().fromBufferAttribute(pos,i),key=p.toArray().map(n=>n.toFixed(5)).join();if(!keys.has(key)){keys.set(key,points.length);points.push(p);edges.push(new Set());}ids.push(keys.get(key)!);}
 const index=mesh.geometry.index?.array??Array.from({length:pos.count},(_,i)=>i);
 for(let i=0;i<index.length;i+=3){const a=ids[index[i]],b=ids[index[i+1]],c=ids[index[i+2]];edges[a].add(b).add(c);edges[b].add(a).add(c);edges[c].add(a).add(b);}
 const seen=new Set<number>(),out:T.Vector3[][]=[];
 for(let i=0;i<points.length;i++){if(seen.has(i))continue;const todo=[i],vertices:T.Vector3[]=[];while(todo.length){const j=todo.pop()!;if(seen.has(j))continue;seen.add(j);vertices.push(points[j]);todo.push(...edges[j]);}out.push(vertices);}
 return out;
}
function palm(root:T.Object3D,id:string,side:'left'|'right'){
 const color=id==='dz_penguin'?'coal':id==='dz_explorer_duck'?'ink':'skin',arm=root.getObjectByName('arm-'+side)!;
 const mesh=arm.children.find(o=>o instanceof T.Mesh&&o.name.startsWith(id)&&(o.material as T.Material).name.endsWith(' '+color)) as T.Mesh;
 assert.ok(mesh,`${id} palm mesh`);
 // The penguin's separate palm is the smaller solid; the sorcerer's thumb is smaller than its palm.
 const parts=solids(mesh).sort((a,b)=>b.length-a.length),points=parts[0];
 const box=new T.Box3().setFromPoints(points),y=(box.min.y+box.max.y)/2,rings=new Map<string,T.Box3>();
 for(const p of points){const key=p.y.toFixed(5),b=rings.get(key)??new T.Box3();b.expandByPoint(p);rings.set(key,b);}
 const centres=[...rings.values()].map(b=>b.getCenter(new T.Vector3())).sort((a,b)=>a.y-b.y),upper=centres.findIndex(p=>p.y>=y),a=centres[Math.max(0,upper-1)],b=centres[upper];
 return a.clone().lerp(b,b.y===a.y?0:(y-a.y)/(b.y-a.y)).applyMatrix4(mesh.matrixWorld);
}

test('all four full costumes grip at their real palm geometry for every body/height, at rest and while fishing',()=>{
 const w=world();let maximum=0;
 for(const id of recent)for(const look of looks){w.state.gear={disguise:id,weapon:'rod'};w.player=w.lookAvatar('#fff',w.state.gear,look);
  for(const phase of ['idle','cast','wait','fight'] as const){w.castT=phase==='cast'?.25:0;animate(w,phase,.8);
   for(const side of ['left','right'] as const){const actual=palm(w.player,id,side),grip=w.player.getObjectByName('hand-'+side).getWorldPosition(new T.Vector3()),distance=actual.distanceTo(grip);maximum=Math.max(maximum,distance);assert.ok(distance<.012,`${id} ${look} ${phase} ${side}: grip ${distance}m from palm`);}
  }
 }
 assert.ok(maximum<.012);
});

test('all sixteen legacy costumes preserve the original hand anchors and held-rod fit for every body/height',()=>{
 const w=world();for(const look of looks){const plain=w.lookAvatar('#fff',{weapon:'rod'},look);plain.updateMatrixWorld(true);
  for(const id of Object.keys(DISGUISES).filter(id=>!recent.includes(id))){const p=w.lookAvatar('#fff',{disguise:id,weapon:'rod'},look);p.updateMatrixWorld(true);
   for(const side of ['left','right']){assert.deepEqual(p.getObjectByName('hand-'+side).position,plain.getObjectByName('hand-'+side).position,`${id} ${look} unchanged ${side}`);}
   const tip=p.getObjectByName('rod-tip').getWorldPosition(new T.Vector3()),expected=plain.getObjectByName('rod-tip').getWorldPosition(new T.Vector3());assert.ok(tip.distanceTo(expected)<1e-6,`${id} ${look} unchanged standing rod`);
  }
 }
});

test('every avatar and all authored rods lean forward another 20 degrees at wait, keep the grip fixed and restore idle',()=>{
 const w=world();for(const id of ['',...Object.keys(DISGUISES)])for(const rod of ['rod','rod_gold','rod_steady','rod_key']){
  w.state.gear={...(id?{disguise:id}:{}),weapon:rod};w.player=w.lookAvatar('#fff',w.state.gear,DEFAULT_LOOK);
  animate(w,'wait');const hand=w.player.getObjectByName('hand-right'),tip=w.player.getObjectByName('rod-tip'),grip=hand.getWorldPosition(new T.Vector3()),after=tip.getWorldPosition(new T.Vector3()).sub(grip).normalize();
  hand.rotation.x=0;w.player.updateMatrixWorld(true);const before=tip.getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3())).normalize();
  assert.ok(Math.abs(after.angleTo(before)-Math.PI/9)<1e-6,`${id} ${rod} 20 degree tilt`);assert.ok(after.z>before.z&&after.z>0,`${id} ${rod} toward water`);
  animate(w,'fight',1);const fight=tip.getWorldPosition(new T.Vector3()).sub(hand.getWorldPosition(new T.Vector3()));assert.ok(fight.z>0,`${id} ${rod} tip forward while reeling`);
  animate(w,'idle');assert.equal(hand.rotation.x,0,`${id} ${rod} idle wrist restored`);
 }
 // The procedural rod used while the weapon kit loads must follow the same wrist pose.
 const ready=weaponKit.ready;try{weaponKit.ready=false;w.state.gear={weapon:'rod'};w.player=w.lookAvatar('#fff',w.state.gear,DEFAULT_LOOK);animate(w,'wait');assert.ok(w.player.getObjectByName('rod-tip').getWorldPosition(new T.Vector3()).z>0);}finally{weaponKit.ready=ready;}
});

test('moving the rod tip never shifts the cast point or disconnects either end of the line',()=>{
 const w=world(),pond:PondView={id:'test',x:0,z:5,rx:3,rz:3,surface:.1,waterId:'home'},view=new FishingView(new T.Scene(),{ring(){},burst(){}} as any,{ready:false} as any,()=>{}),sim=new FishingSimulation({quality:.3,bait:false,choose:()=>null,water:{x:0,z:5,r:3},cast:{x:0,z:5},player:{x:0,z:0}});
 for(const id of ['',...recent,'dz_superhero','dz_mage']){
  w.state.gear={...(id?{disguise:id}:{}),weapon:'rod'};w.player=w.lookAvatar('#fff',w.state.gear,DEFAULT_LOOK);animate(w,'wait');const tip=w.player.getObjectByName('rod-tip').getWorldPosition(new T.Vector3());view.begin(pond,tip,{x:0,z:5});
  for(const phase of ['cast','wait','fight'] as const){w.castT=.25;animate(w,phase,.8);tip.copy(w.player.getObjectByName('rod-tip').getWorldPosition(new T.Vector3()));view.update(1,1,tip,w.position,sim);const a=(view as any).line.geometry.attributes.position,bob=(view as any).bobber.position;
   assert.ok(new T.Vector3().fromBufferAttribute(a,0).distanceTo(tip)<1e-5,`${id} ${phase} line starts at actual rod tip`);const end=new T.Vector3().fromBufferAttribute(a,a.count-1);assert.ok(end.distanceTo(bob.clone().add(new T.Vector3(0,.134,0)))<1e-5,'line reaches bobber antenna');assert.equal(bob.x,0);assert.equal(bob.z,5);assert.ok(Math.abs(bob.y-pond.surface)<.03,'bobber stays at the water surface');
  }
 }
});

test('online observers keep the corrected pose and contextual rod through deltas, late art and cancellation',()=>{
 const w=world();for(const id of recent){w.state.gear={disguise:id,weapon:'rod_gold'};w.player=w.lookAvatar('#fff',w.state.gear,DEFAULT_LOOK);animate(w,'wait');
  const visual=w.visualSnapshot(),canonicalGear={disguise:id,weapon:'sword_wood'};w.addRemotePlayer('fisher',{x:0,z:0,y:0,facing:0,gear:canonicalGear,visual});w.animateRemotes(.025);
  const remote=()=>w.remotePlayers.get('fisher').mesh;assert.ok(remote().getObjectByName('rod-tip'),'contextual rod visible despite canonical combat weapon');assert.equal(remote().getObjectByName('hand-right').rotation.x,Math.PI/9);
  w.updateRemotePlayer('fisher',{x:0,z:0,hp:90});w.animateRemotes(.025);assert.equal(remote().getObjectByName('hand-right').rotation.x,Math.PI/9);
  w.removeRemotePlayer('fisher');w.addRemotePlayer('fisher',{x:0,z:0,gear:canonicalGear,visual});w.animateRemotes(.025);assert.ok(remote().getObjectByName('rod-tip'),'late model refresh keeps rod');
  animate(w,'fight',.7);w.updateRemotePlayer('fisher',{x:0,z:0,visual:w.visualSnapshot()});w.animateRemotes(.025);assert.ok(remote().rotation.x<0);
  animate(w,'idle');w.updateRemotePlayer('fisher',{x:0,z:0,visual:w.visualSnapshot()});w.animateRemotes(.025);assert.equal(remote().getObjectByName('rod-tip'),undefined);assert.ok(Math.abs(remote().getObjectByName('hand-right').rotation.x)<1e-8);assert.ok(Math.abs(remote().rotation.x)<1e-8);w.removeRemotePlayer('fisher');
 }
 const valid={phase:'wait',cast:0,tension:.5,rod:'rod'};assert.deepEqual(readFishingPose(valid),valid);
 for(const patch of [{phase:'flying'},{rod:'sword_wood'},{cast:2},{tension:NaN},{tension:9}])assert.equal(readFishingPose({...valid,...patch}),null);
});
