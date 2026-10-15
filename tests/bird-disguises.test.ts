import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatSimulation,type CombatHost,type CombatTarget,type CombatHit,type CombatEffect} from '../src/combat.ts';
import {BIRD,birdLanding} from '../src/bird-skills.ts';
import * as Game from '../src/model.ts';
import {World} from '../src/world.ts';
import * as T from 'three';

function arena(){
 const p={x:0,z:0},targets:CombatTarget[]=[],hits:{id:string;hit:CombatHit}[]=[],effects:CombatEffect[]=[],status:{id:string;kind:string;duration:number}[]=[];let angle=0,aim:{x:number;z:number}|null=null,wall=Infinity;
 const host:CombatHost={position:()=>p,facing:()=>angle,face:a=>angle=a,aimPoint:()=>aim,targets:()=>targets,weapon:()=>({kind:'fist'}),stats:()=>({attack:100,critChance:0}),move:(x,z)=>{p.x+=x;p.z=Math.min(wall,p.z+z);},effect:e=>effects.push(e),hit:(t,h)=>{hits.push({id:t.id,hit:h});t.hp-=h.amount;return h.amount;},status:(t,kind,duration)=>{status.push({id:t.id,kind,duration});t.statuses??={};t.statuses[kind]=duration;}};
 const sim=new CombatSimulation(host,()=>.5),enemy=(id:string,x:number,z:number)=>{const t={id,x,z,hp:10000,radius:.4,statuses:{}};targets.push(t);return t;};
 const run=(seconds:number,active=true)=>{for(let left=seconds;left>1e-8;left-=.025)sim.update(Math.min(left,.025),active);};
 return {sim,p,enemy,hits,effects,status,run,set aim(v:{x:number;z:number}|null){aim=v;},set wall(v:number){wall=v;}};
}
test('both disguises cost exactly one energy in Outfitters and skill props cannot be purchased or crafted',()=>{
 const s=Game.newGame();s.energy=10;
 for(const id of ['dz_penguin','dz_explorer_duck']){assert.equal(Game.ITEMS[id].price,1);assert.ok(Game.SHOP_CATEGORIES.find(c=>c.tab==='Disguises')?.items.some(i=>i.id===id&&i.cost===1));assert.equal(Game.RECIPES.filter(r=>r.result===id&&r.station!=='shop').length,0);const before=s.energy;assert.equal(Game.buy(s,id),true);assert.equal(s.energy,before-1);assert.equal(s.bag[id],1);assert.equal(Game.DISGUISES[id].skills.length,4);}
 for(const id of ['explorer_lantern','explorer_dagger']){assert.equal(Game.ITEMS[id],undefined);assert.ok(!Game.RECIPES.some(r=>r.result===id));}
});
test('GLB contains four complete authored models and six animated parts per disguise',()=>{
 const data=readFileSync(new URL('../public/assets/models/bird-disguises.glb',import.meta.url)),len=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+len).toString());
 for(const id of ['dz_penguin','dz_explorer_duck','explorer_lantern','explorer_dagger']){const root=doc.nodes.find((n:{name:string})=>n.name===id);assert.ok(root,id);const parts=root.children.map((i:number)=>doc.nodes[i].name);if(id.startsWith('dz_'))for(const p of ['head','body','arm-left','arm-right','leg-left','leg-right'])assert.ok(parts.some((n:string)=>n.endsWith('@'+p)),`${id} ${p}`);}
});
test('penguin beak locks one target for exactly five hits and launches only on the final hit',()=>{
 const a=arena();a.enemy('first',0,2);a.enemy('other',.4,2);assert.equal(a.sim.disguise('dz_penguin',0),true);assert.equal(a.sim.disguise('dz_penguin',0),false);a.run(.6);assert.deepEqual(a.hits.map(h=>h.id),Array(5).fill('first'));assert.deepEqual(a.hits.map(h=>h.hit.lift),[0,0,0,0,BIRD.peck.lift]);
});
test('dagger final hit applies a four-second compass mark; a target that escaped avoids the remaining combo',()=>{
 const a=arena(),t=a.enemy('first',0,2);a.sim.disguise('dz_explorer_duck',0);a.run(.6);assert.equal(a.hits.length,5);assert.deepEqual(a.status,[{id:t.id,kind:'compassMark',duration:4}]);
 const b=arena(),escaped=b.enemy('escape',0,2);b.sim.disguise('dz_explorer_duck',0);b.run(.05);escaped.z=20;b.run(1);assert.equal(b.hits.length,1);assert.equal(b.status.length,0);
});
test('belly slide covers fourteen metres, hits each crossed target once and never paints ice through a wall',()=>{
 const a=arena();a.enemy('one',0,3);a.enemy('two',0,8);a.enemy('off',7,8);a.sim.disguise('dz_penguin',1);assert.equal(a.sim.pose?.kind,'slide');a.run(.7);assert.ok(Math.abs(a.p.z-14)<1e-6);assert.deepEqual(a.hits.map(h=>h.id),['one','two']);assert.ok(a.hits.every(h=>h.hit.knock===6));
 const b=arena();b.wall=2;b.sim.disguise('dz_penguin',1);b.run(.7);assert.ok(b.effects.filter(e=>e.look==='penguin-slide').every(e=>e.z<=2&&e.toZ!<=2));
});
test('ice catches later entrants and expires on active time; no effects advance while paused',()=>{
 const a=arena(),t=a.enemy('later',9,4);a.sim.disguise('dz_penguin',1);a.run(.7);t.x=0;a.run(.05);assert.ok(a.status.some(s=>s.kind==='iceSlow'&&s.duration===3));a.run(6,false);a.status.length=0;a.run(.05);assert.ok(a.status.some(s=>s.kind==='iceSlow'));a.run(4);a.status.length=0;a.run(.05);assert.equal(a.status.length,0);
});
test('blizzard follows the explorer, ticks four times and slows attack speed throughout its lifetime',()=>{
 const a=arena();a.enemy('near',0,2);const later=a.enemy('later',20,2);a.sim.disguise('dz_penguin',2);a.run(1.5);assert.equal(a.hits.filter(h=>h.id==='near').length,2);a.p.x=20;a.run(2.6);assert.equal(a.hits.filter(h=>h.id===later.id).length,2);assert.equal(a.hits.length,4);assert.ok(a.status.some(s=>s.id==='later'&&s.kind==='attackSlow'));
});
test('three fish travel in arcs to the designated point before exploding and stunning for 1.5 seconds',()=>{
 const a=arena();a.aim={x:10,z:0};a.enemy('aimed',10,0);a.enemy('behind',0,-5);a.sim.disguise('dz_penguin',3);a.run(.6);assert.equal(a.hits.length,0);assert.equal(a.effects.filter(e=>e.look==='frozen-fish').length,3);a.run(.5);assert.deepEqual(a.hits.map(h=>h.id),Array(3).fill('aimed'));assert.ok(a.status.every(s=>s.kind==='stun'&&s.duration===1.5));
});
test('grapple follows a clamped designated direction, is airborne and hits each crossed enemy once',()=>{
 const a=arena();a.aim={x:100,z:0};a.enemy('path',8,0);a.enemy('off',0,7);a.sim.disguise('dz_explorer_duck',1);a.run(.2);assert.ok(a.sim.airborne>0);a.run(.5);assert.ok(Math.abs(a.p.x-14)<1e-6);assert.ok(Math.abs(a.p.z)<1e-6);assert.deepEqual(a.hits.map(h=>h.id),['path']);
 assert.deepEqual(birdLanding({x:0,z:0},{x:NaN,z:0},0,14),{x:0,z:14});
});
test('stationary net damages and roots every entrant once, including enemies entering after placement',()=>{
 const a=arena(),late=a.enemy('late',20,0);a.enemy('initial',1,1);a.sim.disguise('dz_explorer_duck',2);a.run(.1);a.p.x=30;late.x=0;a.run(.1);assert.deepEqual(a.hits.map(h=>h.id),['initial','late']);assert.ok(a.status.every(s=>s.kind==='root'&&s.duration===2.5));a.run(2);assert.equal(a.hits.length,2);a.run(4.1);a.enemy('expired',0,0);a.run(.1);assert.equal(a.hits.length,2);
});
test('lantern waits for the arc, then deals exactly four fire ticks in its own fixed area',()=>{
 const a=arena();a.aim={x:10,z:0};a.enemy('fire',10,0);a.enemy('off',0,-4);a.sim.disguise('dz_explorer_duck',3);a.run(.65);assert.equal(a.hits.length,0);a.run(4.2);assert.equal(a.hits.length,4);assert.ok(a.hits.every(h=>h.id==='fire'));assert.equal(a.effects.filter(e=>e.look==='duck-fire').length,1);
});
test('reset cancels combos, traps, moving actions, delayed fish and fire',()=>{
 for(const id of ['dz_penguin','dz_explorer_duck'])for(let slot=0;slot<4;slot++){const a=arena();a.enemy('target',0,2);a.sim.disguise(id,slot);a.run(.05);a.sim.reset();a.hits.length=0;a.status.length=0;const before={...a.p};a.run(10);assert.deepEqual(a.p,before);assert.equal(a.hits.length,0);assert.equal(a.status.length,0);assert.equal(a.sim.pose,null);}
});
test('compass mark increases real offline damage by 20% and a root prevents creature movement',()=>{
 const w=Object.create(World.prototype) as World,e:any={id:'test',x:0,z:30,hp:100,maxHp:100,stun:0,statuses:{compassMark:4,root:2.5},mesh:new T.Group(),radius:.4,type:'wolf',phase:'idle'};
 w.enemies=[e];w.burst=()=>{};w.damageEnemy(e,10,0,true);assert.equal(e.hp,88);e.statuses.compassMark=0;w.damageEnemy(e,10,0,true);assert.equal(e.hp,78);(w as any).moveCreature(e,5,5);assert.deepEqual({x:e.x,z:e.z},{x:0,z:30});
});

test('air slide keeps its captured power and boss damage cap until the moving hit lands',()=>{
 const a=arena();a.enemy('path',0,3);a.sim.disguise('dz_penguin',1,{power:1.3,cap:()=>180});a.run(1);assert.equal(a.hits.length,1);assert.equal(a.hits[0].hit.amount,180);
});
test('blizzard halves enemy attack cadence while ice halves movement without replacing other statuses',()=>{
 const w=Object.create(World.prototype) as any,e:any={id:'test',x:0,z:30,hp:0,maxHp:100,cooldown:2,stun:0,respawn:10,statuses:{attackSlow:4,iceSlow:3},mesh:new T.Group(),radius:.4};
 w.updateTitanAttacks=()=>{};w.authoritativeAction=()=>{};w.updateEnemyAi(e,1);assert.equal(e.cooldown,1.5);assert.equal(e.statuses.attackSlow,3);
 w.creatureObstacles=()=>[];w.navigationOptions=()=>({});w.creatureWalkable=()=>true;w.resolveOverlap=()=>{};w.moveCreature(e,2,2);assert.deepEqual({x:e.x,z:e.z},{x:1,z:31});
});
test('bird visuals produce finite transforms, batch snow/fire, pause and release their scene objects',async()=>{
 const {BirdSkillView}=await import('../src/bird-skill-view.ts'),{BIRD_LOOKS}=await import('../src/bird-skills.ts'),scene=new T.Scene(),fx=new BirdSkillView(scene,()=>2,()=>null,()=>[],false);
 for(const look of BIRD_LOOKS)assert.equal(fx.play({kind:'cast',look,x:1,z:3,toX:8,toZ:6,radius:4,duration:1,color:'#b8efff'}),true);
 fx.update(.3);scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
 assert.ok(scene.children.some(g=>g.children.some(o=>o instanceof T.InstancedMesh)),'snow and fire use instanced draws');
 const children=scene.children.length;fx.update(0);assert.equal(scene.children.length,children);fx.update(1);assert.equal(scene.children.length,0);
 fx.play({kind:'cast',look:'duck-net',x:0,z:0,radius:4,duration:6,color:'#b8efff'});fx.clear();assert.equal(scene.children.length,0);
});
