import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {CombatSimulation,type CombatHost,type CombatTarget,type CombatHit,type CombatEffect} from '../src/combat.ts';
import {SORCERER as S,SORCERER_LOOKS} from '../src/sorcerer-skills.ts';
import {SorcererView} from '../src/sorcerer-view.ts';
import * as Game from '../src/model.ts';
function arena(){
 const p={x:0,z:0},targets:CombatTarget[]=[],hits:{id:string;hit:CombatHit}[]=[],effects:CombatEffect[]=[],status:{id:string;kind:string;duration:number}[]=[];let angle=0,aim:{x:number;z:number}|null=null,wall=Infinity;
 const host:CombatHost={position:()=>p,facing:()=>angle,face:a=>angle=a,aimPoint:()=>aim,targets:()=>targets,weapon:()=>({kind:'fist'}),stats:()=>({attack:100,critChance:0}),move:(x,z)=>{p.x+=x;p.z=Math.min(wall,p.z+z);},effect:e=>effects.push(e),hit:(t,h)=>{hits.push({id:t.id,hit:h});t.hp-=h.amount;return h.amount;},status:(t,kind,duration)=>{status.push({id:t.id,kind,duration});t.statuses??={};t.statuses[kind]=duration;}};
 const sim=new CombatSimulation(host,()=>.5),enemy=(id:string,x:number,z:number)=>{const t={id,x,z,hp:10000,radius:.4,statuses:{}};targets.push(t);return t;};
 const run=(seconds:number,active=true)=>{for(let left=seconds;left>1e-8;left-=.025)sim.update(Math.min(left,.025),active);};
 return {sim,p,enemy,hits,effects,status,run,set aim(v:{x:number;z:number}|null){aim=v;},set wall(v:number){wall=v;}};
}
test('sorcerer is a one-energy disguise with a solid six-part model and no crafting recipe',()=>{
 const s=Game.newGame();s.energy=5;assert.equal(Game.buy(s,'dz_sorcerer'),true);assert.equal(s.energy,4);assert.equal(Game.DISGUISES.dz_sorcerer.skills.length,4);assert.equal(Game.RECIPES.filter(r=>r.result==='dz_sorcerer'&&r.station!=='shop').length,0);
 const b=readFileSync(new URL('../public/assets/models/sorcerer.glb',import.meta.url)),doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()),root=doc.nodes.find((n:{name:string})=>n.name==='dz_sorcerer');assert.equal(root.children.length,6);assert.ok(doc.meshes.length>=6);
});
test('mandala deals five quick single-target hits, then the disc pierces every enemy along a fixed line once',()=>{
 const a=arena();a.enemy('front',0,2);a.enemy('behind',0,7);a.enemy('last',0,13);a.enemy('outside',4,8);assert.equal(a.sim.disguise('dz_sorcerer',0),true);a.run(.39);assert.equal(a.hits.length,4);a.run(1);assert.equal(a.hits.filter(h=>h.id==='front').length,6);assert.equal(a.hits.filter(h=>h.id==='behind').length,1);assert.equal(a.hits.filter(h=>h.id==='last').length,1);assert.equal(a.hits.filter(h=>h.id==='outside').length,0);a.run(2);assert.equal(a.hits.length,8);
});
test('concealment is fully invulnerable, blocks attacks and movement, pauses, and exits the original stationary portal early',()=>{
 const a=arena();a.enemy('front',0,2);assert.equal(a.sim.disguise('dz_sorcerer',1),true);const portal=a.effects.find(e=>e.look==='veil-portal')!;assert.equal(a.sim.portalHidden,true);assert.equal(a.sim.invulnerable,true);assert.equal(a.sim.locksMovement,true);assert.equal(a.sim.basic(),false);assert.equal(a.sim.disguise('dz_sorcerer',0),false);a.run(10,false);assert.equal(a.sim.portalHidden,true);a.run(1);assert.equal(a.sim.disguise('dz_sorcerer',1),true);assert.equal(a.sim.portalHidden,false);assert.equal(a.sim.invulnerable,false);const exit=a.effects.find(e=>e.look==='veil-exit')!;assert.deepEqual([exit.x,exit.z],[portal.x,portal.z]);assert.equal(a.sim.statuses.ambush,1);assert.equal(a.sim.locksMovement,false);
});
test('portal auto-exits at 2.5 seconds, grants exactly 30% ambush damage for 1 second, and reset cancels it',()=>{
 const a=arena();const e=a.enemy('front',0,2);a.sim.disguise('dz_sorcerer',1);a.run(2.45);assert.equal(a.sim.portalHidden,true);a.run(.1);assert.equal(a.sim.portalHidden,false);a.sim.disguise('dz_sorcerer',0);a.run(.15);const buffed=a.hits[0].hit.amount;
 const b=arena();b.enemy('front',0,2);b.sim.disguise('dz_sorcerer',0);b.run(.15);assert.ok(Math.abs(buffed/b.hits[0].hit.amount-1.3)<.02);a.run(1);assert.equal(a.sim.statuses.ambush,0);a.sim.disguise('dz_sorcerer',1);a.sim.reset();assert.equal(a.sim.portalHidden,false);assert.equal(a.sim.invulnerable,false);a.run(4);assert.equal(a.sim.statuses.ambush,undefined);assert.ok(e.hp>0);
});
test('red bands root late entrants once for 2.5 seconds and deal four stationary damage ticks',()=>{
 const a=arena(),initial=a.enemy('initial',1,1),late=a.enemy('late',20,0);a.sim.disguise('dz_sorcerer',2);a.run(.1);a.p.x=30;late.x=0;a.run(.2);assert.equal(a.status.filter(s=>s.kind==='root').length,2);assert.ok(a.status.every(s=>s.duration===2.5));a.run(4);assert.equal(a.hits.filter(h=>h.id===initial.id).length,4);assert.equal(a.hits.filter(h=>h.id===late.id).length,3);assert.equal(a.status.length,2);
});
test('meteor damage waits for the ring arc and falling rocks, stuns only enemies in the aimed blast',()=>{
 const a=arena();a.aim={x:10,z:0};a.enemy('impact',10,0);a.enemy('outside',0,0);a.sim.disguise('dz_sorcerer',3);a.run(S.meteor.flight+S.meteor.fall-.05);assert.equal(a.hits.length,0);a.run(.1);assert.deepEqual(a.hits.map(h=>h.id),['impact']);assert.deepEqual(a.status.map(s=>[s.kind,s.duration]),[['stun',1.5]]);
});
test('persistent spells retain the ambush bonus from their cast, and reset cancels pending damage',()=>{
 const a=arena();a.aim={x:10,z:0};a.enemy('impact',10,0);a.sim.disguise('dz_sorcerer',1);a.sim.leavePortal();a.sim.disguise('dz_sorcerer',3);a.run(1.4);const b=arena();b.aim={x:10,z:0};b.enemy('impact',10,0);b.sim.disguise('dz_sorcerer',3);b.run(1.4);assert.ok(Math.abs(a.hits[0].hit.amount/b.hits[0].hit.amount-1.3)<.01);
 for(const index of [0,2,3]){const c=arena();c.enemy('enemy',0,2);c.sim.disguise('dz_sorcerer',index);c.sim.reset();c.run(8);assert.equal(c.hits.length,0);assert.equal(c.status.length,0);}
});
test('all procedural spell models have finite transforms, pause with simulation and release scene resources',()=>{
 const scene=new T.Scene(),fx=new SorcererView(scene,()=>0);for(const look of SORCERER_LOOKS){assert.equal(fx.play({look,kind:'cast',x:0,z:0,toX:8,toZ:2,color:'#ff963a',radius:4,duration:1.3}),true);for(let i=0;i<40;i++){fx.update(.025);scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),look));}fx.clear();assert.equal(scene.children.length,0);}
 fx.play({look:'veil-portal',kind:'cast',x:1,z:2,color:'#ff963a',radius:1.2,duration:2.5},'friend');fx.update(.5);const gate=scene.children[0];const at=gate.position.clone();fx.update(0);assert.deepEqual(gate.position,at);fx.play({look:'veil-exit',kind:'cast',x:1,z:2,color:'#ff963a',radius:1.2,duration:.35},'friend');fx.update(.01);assert.equal(gate.parent,null);fx.clear();
});

test('hidden explorers stop drawing monster aggro and no longer act as a solid collision body',async()=>{
 const {World}=await import('../src/world.ts');const w:any=Object.assign(Object.create(World.prototype),{planet:'home',position:new T.Vector3(0,0,30),playerStealth:false,playerHidden:false,remotePlayers:new Map(),enemies:[],decoyList:[]});const enemy={id:'test',x:0,z:30,hp:100,radius:.4,homeX:0,homeZ:30,definition:{speed:2},statuses:{}};w.enemies=[enemy];assert.ok(w.enemyTarget(enemy));w.playerHidden=true;assert.equal(w.enemyTarget(enemy),undefined);let pushes=0;w.moveCreature=()=>pushes++;w.separateCreatures();assert.equal(pushes,0);w.playerHidden=false;w.separateCreatures();assert.equal(pushes,1);
});
