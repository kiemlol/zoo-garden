import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as M from '../src/model.ts';
import {World} from '../src/world.ts';
import {heroKit} from '../src/assets.ts';
import {HALLOWEEN_ITEMS,HALLOWEEN_RECIPES,CURSED_BENCH,CURSED_COFFIN,PATCHWORK_PET,PUMPKIN_SPELL} from '../src/halloween-content.ts';
import {coffinLid,furniturePoint,COFFIN_OPEN_MS,COFFIN_ENTER_MS,COFFIN_WAIT_MS,COFFIN_CLOSE_MS,FURNITURE_LEAVE_MS,readFurniturePose} from '../src/furniture-rules.ts';
import {drawFurnitureLids} from '../src/furniture-use.ts';
import {buildPatchworkPet} from '../src/halloween-art.ts';
import {disguiseForm} from '../src/disguise-form.ts';
import {CombatSimulation,type CombatTarget} from '../src/combat.ts';
import {currentFurniture,useFurniture} from '../server/furniture-service.mjs';

const now=1_790_000_000_000;
const file=readFileSync(new URL('../public/assets/models/hero.glb',import.meta.url));
(heroKit as any).loadScene=async()=>(await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'')).scene;await heroKit.load();
function fixture(id=CURSED_BENCH,rotation=Math.PI/3){
 const state=M.newGame();state.decorations=[{uid:'seat1',id,x:4,z:-4,rotation}];
 const w=Object.assign(Object.create(World.prototype),{state,scene:new T.Scene(),camera:new T.PerspectiveCamera(40,4/3,.5,300),root:new T.Group(),player:new T.Group(),companion:new T.Group(),position:new T.Vector3(),destination:null,route:[],selected:null,obstacles:[],entities:[],enemies:[],plotMeshes:[],cropSignatures:[],particles:[],keys:new Set<string>(),facing:0,time:0,planet:'home',hazardTimer:0,furnitureGarden:'local',marker:new T.Mesh(),ring:new T.Mesh(),cameraTarget:new T.Vector3(),sun:new T.DirectionalLight(),raycaster:new T.Raycaster(),onInteract(){},onAttackEnemy(){},onDamage(){},onZone(){}}) as World;
 w.build('home');w.refreshPlayer();w.position.set(1.6,0,-4);w.update(.01,true,false);return{w,e:w.entities.find(e=>e.kind==='decoration')!};
}
test('five Halloween items can be crafted, equipped/placed and saved without losing old decorations',()=>{
 for(const r of HALLOWEEN_RECIPES){const s=M.newGame();s.level=50;s.energy=100000;s.decorations=[{uid:'old',id:'deco_teddy',x:5,z:5,rotation:0}];for(const[id,n]of Object.entries(r.materials))s.bag[id]=n;assert.ok(M.craft(s,M.RECIPES.indexOf(r)));assert.equal(s.bag[r.result],1);if(r.result===PATCHWORK_PET)assert.ok(M.equip(s,r.result));const loaded=M.parseSave(JSON.stringify(s))!;assert.equal(loaded.decorations[0].uid,'old');assert.equal(loaded.bag[r.result],1);}
 assert.equal(Object.keys(HALLOWEEN_ITEMS).length,5);
});
test('bench keeps a seated explorer through menus, refuses movement/attacks, then exits to reachable ground',async t=>{
 let time=now;t.mock.method(Date,'now',()=>time);const{w,e}=fixture();assert.ok(await w.useFurniture(e));
 w.update(.1,true,false);assert.equal(w.resting,true);const at=furniturePoint(w.state.decorations[0],0);assert.ok(Math.hypot(w.position.x-at.x,w.position.z-at.z)<1e-6);assert.equal(w.player.rotation.y,e.mesh.rotation.y);
 w.update(.2,false,false);assert.equal(w.furniture!.active,true,'opening a panel never ejects a sitter');const p=w.position.clone();w.walkTo(0,0);w.select(e);assert.equal(w.destination,null);assert.ok(w.position.equals(p));
 w.joystickInput={x:1,z:0};w.update(.02,true,false);assert.equal(w.furniture!.pose!.leavingAt,time);w.joystickInput=null;await w.furniture!.leave();time+=FURNITURE_LEAVE_MS;w.update(.02,true,false);assert.equal(w.resting,false);assert.equal(w.blocked(w.position.x,w.position.z),false);assert.equal(await w.useFurniture(e),false,'rapid repeated events cannot reenter');
});
test('coffin opens, allows lying down, waits two seconds and closes, then reopens on exit',async t=>{
 let time=now;t.mock.method(Date,'now',()=>time);const{w,e}=fixture(CURSED_COFFIN);assert.ok(await w.useFurniture(e));const p=w.furniture!.pose!;assert.equal(coffinLid(p,time),0);
 time+=COFFIN_OPEN_MS;w.update(.01,true,false);assert.equal(coffinLid(p,time),1);
 time+=COFFIN_ENTER_MS;w.update(.01,true,false);assert.ok(Math.abs(w.player.rotation.x+Math.PI/2)<1e-8);assert.equal(w.player.rotation.y,e.mesh.rotation.y);
 time+=COFFIN_WAIT_MS-1;assert.equal(coffinLid(p,time),1);time+=1+COFFIN_CLOSE_MS;w.update(.01,false,false);assert.equal(coffinLid(p,time),0);assert.equal(w.furniture!.active,true);
 await w.furniture!.leave();time+=COFFIN_OPEN_MS;drawFurnitureLids(w,time);assert.ok(e.mesh.getObjectByName('coffin-lid')!.rotation.z>1.5);assert.equal(w.furniture!.active,true);time+=FURNITURE_LEAVE_MS;w.update(.01,true,false);assert.equal(w.resting,false);assert.equal(w.player.rotation.x,0);assert.equal(w.blocked(w.position.x,w.position.z),false);
});
test('furniture rebinds after a cosmetic rebuild and releases safely on removal, death, travel or disconnect',async t=>{
 t.mock.method(Date,'now',()=>now);
 for(const reason of ['remove','death','travel','disconnect']){const{w,e}=fixture();assert.ok(await w.useFurniture(e));w.syncDecorations();assert.equal(w.resting,true);w.refreshPlayer();w.update(.01,true,false);assert.equal(w.player.getObjectByName('leg-left')!.rotation.x,-Math.PI/2);
  if(reason==='remove'){w.state.decorations=[];w.syncDecorations();}else if(reason==='death'){w.state.hp=0;w.update(.01,true,false);}else if(reason==='travel')w.build('candy');else w.furniture!.cancel(false);
  assert.equal(w.resting,false,reason);assert.equal(w.blocked(w.position.x,w.position.z),false,reason);
 }
});
test('a delayed online reservation cannot seat an explorer after moving away or rebuilding',async()=>{
 const{w,e}=fixture();let resolve!:(p:unknown)=>void;const requests:(string|null)[]=[];w.requestFurniture=uid=>{requests.push(uid);return uid===null?Promise.resolve(null):new Promise(r=>resolve=r as typeof resolve);};const job=w.useFurniture(e);w.build('candy');resolve({uid:'seat1',id:CURSED_BENCH,seat:0,garden:'local',since:now});assert.equal(await job,false);assert.equal(w.resting,false);assert.ok(requests.includes(null));
});
test('server allocates two distinct seats atomically and keys occupancy to the actual garden',()=>{
 const garden={decorations:[{uid:'same',id:CURSED_BENCH,x:0,z:0,rotation:0}]};
 const peer=(id:string,visit:string|null='owner')=>({account:{id,profile:{hp:100}},active:true,planet:'home',room:'home',visit,pose:{x:0,z:2,y:0}});
 const a=peer('owner',null),b=peer('guest'),c=peer('third'),outsider=peer('other',null),peers=new Map([a,b,c,outsider].map(p=>[p.account.id,p]));
 assert.equal(useFurniture(a,peers,garden,'same',now).pose!.seat,0);assert.equal(useFurniture(b,peers,garden,'same',now).pose!.seat,1);assert.match(useFurniture(c,peers,garden,'same',now).error!,/no free/);assert.equal(useFurniture(outsider,peers,garden,'same',now).pose!.seat,0);
 const leaving=useFurniture(a,peers,garden,null,now+100).pose!;assert.equal(useFurniture(a,peers,garden,null,now+200).pose!.leavingAt,leaving.leavingAt);assert.equal(currentFurniture(a,garden,now+100+FURNITURE_LEAVE_MS),null);assert.equal(useFurniture(c,peers,garden,'same',now+100+FURNITURE_LEAVE_MS).pose!.seat,0);
});
test('server rejects far, airborne, dead and invented furniture requests, and releases moved furniture',()=>{
 const g={decorations:[{uid:'one',id:CURSED_COFFIN,x:0,z:0,rotation:0}]},p:any={account:{id:'p',profile:{hp:100}},active:true,planet:'home',room:'home',visit:null,pose:{x:0,z:2,y:0}},peers=new Map([['p',p]]);
 for(const change of [{x:50,y:0,hp:100},{x:0,y:2,hp:100},{x:0,y:0,hp:0}]){Object.assign(p.pose,change);p.account.profile.hp=change.hp;assert.equal(useFurniture(p,peers,g,'one',now).pose,null);}
 p.pose={x:0,z:2,y:0};p.account.profile.hp=100;assert.equal(useFurniture(p,peers,g,'invented',now).pose,null);assert.ok(useFurniture(p,peers,g,'one',now).pose);g.decorations[0].rotation=.5;assert.equal(currentFurniture(p,g,now),null);
 assert.equal(readFurniturePose({uid:'one',id:CURSED_BENCH,seat:2,garden:'p',since:now}),null);
});
test('pumpkin spell clusters at most three living creatures, does no damage and repeats after seven seconds in either pet slot',()=>{
 for(const slot of ['pet','pet2'] as const){const targets:CombatTarget[]=[0,1,2,3,15].map((x,i)=>({id:String(i),x:x+2,z:0,radius:.4,hp:100,maxHp:100}));let casts:{id:string;duration:number;at:number}[]=[];let time=0;
  const pet=()=>({...M.ITEMS[PATCHWORK_PET].pet!,x:0,z:0,dmg:1,cd:7,shot:'pumpkin'}),sim=new CombatSimulation({position:()=>({x:0,z:0}),facing:()=>0,attack:()=>10,haste:()=>0,crit:()=>0,targets:()=>targets,effect:()=>{},hit:()=>assert.fail('the pumpkin support spell must not damage enemies'),status:(e,kind,duration)=>{assert.equal(kind,'pumpkin');casts.push({id:e.id,duration,at:time});},[slot]:pet} as any);
  sim.update(.01);assert.equal(casts.length,3);assert.deepEqual(casts.map(c=>c.id),['0','1','2']);assert.ok(casts.every(c=>c.duration===PUMPKIN_SPELL.duration));assert.equal(sim.projectiles.length,0);for(let i=0;i<69;i++){time+=.1;sim.update(.1);}assert.equal(casts.length,3);time+=.2;sim.update(.2);assert.equal(casts.length,6);
 }
});
test('temporary pumpkin mesh restores every original visibility flag, including during overlapping sheep status',()=>{
 const m=new T.Group(),visible=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),hidden=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());hidden.visible=false;m.add(visible,hidden);
 disguiseForm(m,'sheep',true,0);disguiseForm(m,'sheep',false,0);disguiseForm(m,'pumpkin',true,0);assert.equal(visible.visible,false);assert.equal(m.getObjectByName('form-pumpkin')!.visible,true);
 for(let i=0;i<3;i++){disguiseForm(m,'sheep',false,i);disguiseForm(m,'pumpkin',true,i);assert.equal(visible.visible,false);}
 disguiseForm(m,'pumpkin',false,4);assert.equal(visible.visible,true);assert.equal(hidden.visible,false);
 disguiseForm(m,'sheep',true,5);assert.equal(m.getObjectByName('form-pumpkin')!.visible,false);disguiseForm(m,'sheep',false,6);assert.equal(visible.visible,true);
 const pet=buildPatchworkPet();assert.ok(pet.getObjectByName('patchwork-tail'));assert.ok(new T.Box3().setFromObject(pet).getSize(new T.Vector3()).y<1.5);
});

test('driven creatures also leave pumpkin form after three real seconds without adding another stun',t=>{
 let time=now;t.mock.method(Date,'now',()=>time);const{w}=fixture(),enemy=w.enemies[0];
 (enemy as any).driver={incoming:(_:unknown,n:number)=>n};enemy.stun=0;
 w.statusEnemy(enemy,'pumpkin',3);assert.equal(enemy.stun,0);
 (w as any).updateEnemyAi(enemy,.01);assert.equal(enemy.statuses!.pumpkin,3);
 time+=2000;(w as any).updateEnemyAi(enemy,.01);assert.equal(enemy.statuses!.pumpkin,1);
 time+=1100;(w as any).updateEnemyAi(enemy,.01);assert.equal(enemy.statuses!.pumpkin,0);assert.equal(enemy.pumpkinUntil,undefined);
});

test('an online reply for another object cannot attach a passenger to the requested furniture',async()=>{
 const{w,e}=fixture();const requests:(string|null)[]=[];
 w.requestFurniture=async uid=>{requests.push(uid);return uid===null?null:{uid:'stale-other-seat',id:CURSED_BENCH,seat:0,garden:'local',since:now};};
 assert.equal(await w.useFurniture(e),false);assert.equal(w.resting,false);assert.ok(requests.includes(null));
});
