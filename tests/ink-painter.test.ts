import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {CombatSimulation,type CombatHost,type CombatTarget,type CombatHit,type CombatEffect} from '../src/combat.ts';
import {INK,INK_LOOKS,inkBoundary,inkDamageFactor,inInkDomain} from '../src/ink-skills.ts';
import {InkSkillView} from '../src/ink-skill-view.ts';
import {InkDomainView} from '../src/ink-domain-view.ts';
import {World} from '../src/world.ts';
import * as Game from '../src/model.ts';
function arena(){
 const p={x:0,z:0},targets:CombatTarget[]=[],hits:{id:string;hit:CombatHit}[]=[],effects:CombatEffect[]=[],status:{id:string;kind:string;duration:number}[]=[];let angle=0,aim:{x:number;z:number}|null=null,wall=Infinity;
 const host:CombatHost={position:()=>p,facing:()=>angle,face:a=>angle=a,aimPoint:()=>aim,targets:()=>targets,weapon:()=>({kind:'fist'}),stats:()=>({attack:100,critChance:0}),move:(x,z)=>{p.x+=x;p.z=Math.min(wall,p.z+z);},effect:e=>effects.push(e),hit:(t,h)=>{hits.push({id:t.id,hit:h});t.hp-=h.amount;return h.amount;},status:(t,kind,duration)=>{status.push({id:t.id,kind,duration});t.statuses??={};t.statuses[kind]=duration;}};
 const sim=new CombatSimulation(host,()=>.5),enemy=(id:string,x:number,z:number)=>{const t={id,x,z,hp:10000,radius:.4,statuses:{}};targets.push(t);return t;};
 const run=(seconds:number,active=true)=>{for(let left=seconds;left>1e-8;left-=.025)sim.update(Math.min(left,.025),active);};
 return {sim,p,enemy,hits,effects,status,run,set aim(v:{x:number;z:number}|null){aim=v;},set wall(v:number){wall=v;}};
}
test('ink painter is a one-energy disguise with three authored models and no skill props for sale',()=>{
 const s=Game.newGame();s.energy=10;assert.equal(Game.buy(s,'dz_ink_painter'),true);assert.equal(s.energy,9);assert.deepEqual(Game.DISGUISES.dz_ink_painter.skills.map(s=>s.cd),[4,6,15,20]);assert.ok(!Game.RECIPES.some(r=>r.result==='dz_ink_painter'&&r.station!=='shop'));
 const b=readFileSync(new URL('../public/assets/models/ink-painter.glb',import.meta.url)),doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());for(const id of ['dz_ink_painter','ink_brush','ink_dragon'])assert.ok(doc.nodes.some((n:{name:string})=>n.name===id));for(const id of ['ink_brush','ink_dragon'])assert.equal(Game.ITEMS[id],undefined);
});
test('five brushes fly one at a time; every next launch waits for the previous hit and the fifth alone bursts',()=>{
 const a=arena();a.enemy('front',0,10);a.enemy('splash',1.5,10);a.enemy('outside',5,10);assert.equal(a.sim.disguise('dz_ink_painter',0),true);a.run(.2);assert.equal(a.hits.length,0);assert.equal(a.effects.filter(e=>e.look==='ink-brush').length,1);a.run(.21);assert.equal(a.hits.length,1);assert.equal(a.effects.filter(e=>e.look==='ink-brush').length,1);a.run(.1);assert.equal(a.effects.filter(e=>e.look==='ink-brush').length,2);a.run(3);assert.equal(a.effects.filter(e=>e.look==='ink-brush').length,5);assert.equal(a.effects.filter(e=>e.look==='ink-burst').length,1);assert.equal(a.hits.filter(h=>h.id==='front').length,5);assert.equal(a.hits.filter(h=>h.id==='splash').length,1);assert.equal(a.hits.filter(h=>h.id==='outside').length,0);
});
test('a brush follows a moving victim and subsequent brushes retarget after a kill',()=>{
 const a=arena(),first=a.enemy('first',0,3);first.hp=20;a.enemy('next',0,4);a.sim.disguise('dz_ink_painter',0);first.x=.9;a.run(3);assert.equal(first.hp<=0,true);assert.ok(a.hits.some(h=>h.id==='next'));assert.equal(a.effects.filter(e=>e.look==='ink-brush').length,5);
});
test('stationary domain lasts ten simulation seconds and gives 50% extra damage only while its caster is inside',()=>{
 const a=arena();a.enemy('victim',0,2);a.sim.disguise('dz_ink_painter',3);assert.deepEqual(a.sim.inkDomain,{x:0,z:0,radius:8});a.sim.disguise('dz_ink_painter',0);a.run(.2);const buffed=a.hits[0].hit.amount;
 const b=arena();b.enemy('victim',0,2);b.sim.disguise('dz_ink_painter',0);b.run(.2);assert.ok(Math.abs(buffed/b.hits[0].hit.amount-1.5)<.03);a.p.x=20;assert.equal(a.sim.inkDomain!.x,0);a.run(15,false);assert.ok(a.sim.inkDomain);a.run(10);assert.equal(a.sim.inkDomain,null);assert.equal(inkDamageFactor({x:1,z:1},[{x:0,z:0,radius:8}]),.6);assert.equal(inkDamageFactor({x:9,z:0},[{x:0,z:0,radius:8}]),1);
});
test('a swept domain barrier blocks exits, entries, knockback and outside-to-outside tunnelling',()=>{
 const f=[{x:0,z:0,radius:8}];const inside=inkBoundary({x:0,z:0,radius:.5},{x:20,z:0},f);assert.ok(inside.x>7.4&&inside.x<7.5);const outside=inkBoundary({x:-12,z:0,radius:.5},{x:12,z:0},f);assert.ok(outside.x<-8.5);const exit=inkBoundary({x:2,z:0},{x:3,z:0},f);assert.deepEqual(exit,{x:3,z:0});assert.deepEqual(inkBoundary({x:7.99,z:0,radius:.5},{x:7.99,z:1},f),{x:7.99,z:0});assert.deepEqual(inkBoundary({x:0,z:0},{x:20,z:0},[]),{x:20,z:0});
});
test('world navigation applies domain weakening and 20% slow, with an additional 30% slow on ink trails',()=>{
 const e:any={id:'enemy',x:0,z:0,radius:.4,statuses:{},hp:100},w:any=Object.assign(Object.create(World.prototype),{enemies:[e],inkDomains:()=>[{x:0,z:0,radius:8}],blizzardFields:()=>[]});w.moveCreatureStep=(t:any,x:number,z:number)=>{t.x+=x;t.z+=z;};assert.equal(w.enemyDamageFactor('enemy'),.6);w.moveCreature(e,2,0);assert.equal(e.x,1.6);e.x=0;e.statuses.inkSlow=1;w.moveCreature(e,2,0);assert.ok(Math.abs(e.x-1.12)<1e-6);e.x=0;w.moveCreature(e,100,0);assert.ok(e.x<7.6);assert.equal(inInkDomain(e,w.inkDomains()),true);
});
test('ink dash travels 13 m, transforms the caster and lays working slowing segments while still moving',()=>{
 const a=arena();a.enemy('trail',0,2);a.sim.disguise('dz_ink_painter',1);assert.equal(a.sim.inkDashing,true);a.run(.2);assert.equal(a.sim.inkDashing,true);assert.ok(a.effects.some(e=>e.look==='ink-trail'));assert.ok(a.status.some(s=>s.kind==='inkSlow'));a.run(.4);assert.equal(a.sim.inkDashing,false);assert.ok(Math.abs(a.p.z-13)<1e-5);a.run(5);const count=a.status.length;a.run(1);assert.equal(a.status.length,count);
});
test('dragon draws for 0.8 s, follows the caster for five pulses, alternates tail/breath and leaves slowing ink rain',()=>{
 const a=arena();const t=a.enemy('victim',0,2);a.sim.disguise('dz_ink_painter',2);a.run(.79);assert.equal(a.hits.length,0);a.run(.1);assert.equal(a.hits.length,1);a.p.x=10;t.x=10;a.run(4.1);assert.equal(a.hits.length,5);assert.equal(a.hits.filter(h=>h.hit.knock===3).length,3);assert.equal(a.status.filter(s=>s.kind==='blind').length,2);a.run(1);assert.equal(a.effects.filter(e=>e.look==='ink-rain').length,1);assert.equal(a.effects.find(e=>e.look==='ink-pool')!.x,10);assert.ok(a.status.some(s=>s.kind==='inkSlow'));a.run(5);const count=a.hits.length;a.run(2);assert.equal(a.hits.length,count);
});
test('reset cancels every delayed brush, dragon, trail and domain, and announces domain closure',()=>{
 for(let slot=0;slot<4;slot++){const a=arena();a.enemy('enemy',0,3);a.sim.disguise('dz_ink_painter',slot);a.sim.reset();a.run(15);assert.equal(a.hits.length,0);assert.equal(a.status.length,0);assert.equal(a.sim.inkDomain,null);assert.equal(a.sim.inkDashing,false);if(slot===3)assert.ok(a.effects.some(e=>e.look==='ink-domain-end'));}
});
test('ink wash shaders preserve earlier hooks, use world/instance positions and leave players coloured',()=>{
 const view=new InkDomainView(),scene=new T.Scene(),shared=new T.MeshBasicMaterial({color:'red'});shared.userData.sharedKit=true;let called=0;shared.onBeforeCompile=()=>{called++;};const tree=new T.Mesh(new T.BoxGeometry(),shared),player=new T.Group(),shirt=new T.Mesh(new T.BoxGeometry(),shared);scene.add(tree,player);player.add(shirt);view.update(.2,[{x:0,z:0,radius:8}],scene,[player]);assert.notEqual(shirt.material,shared);assert.equal((shirt.material as T.Material).userData.inkKeepColor,true);
 const shader:any={vertexShader:'void main(){ vec3 transformed=position;\n#include <project_vertex>\n}',fragmentShader:'void main(){gl_FragColor=vec4(1.0);}',uniforms:{}};shared.onBeforeCompile(shader,{} as any);assert.equal(called,1);assert.match(shader.vertexShader,/instanceMatrix/);assert.match(shader.fragmentShader,/inkLuma/);assert.equal(shader.uniforms.inkDomains.value[0].z,8);view.clear();assert.equal(shader.uniforms.inkDomains.value[0].z,0);
});
test('all ink effects render finite transforms, close the right owner domain and release owned scene resources',()=>{
 const scene=new T.Scene(),fx=new InkSkillView(scene,()=>0,()=>null,false);for(const look of INK_LOOKS){fx.play({look,kind:'cast',x:0,z:0,toX:5,toZ:1,radius:4,duration:1,color:'#17191e'});for(let i=0;i<20;i++){fx.update(.025);scene.updateMatrixWorld(true);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),look));}fx.clear();assert.equal(scene.children.length,0);}
 fx.play({look:'ink-domain',kind:'cast',x:0,z:0,radius:8,duration:10,color:'#17191e'},'friend');fx.play({look:'ink-domain-end',kind:'cast',x:0,z:0,radius:8,color:'#17191e'},'friend');fx.update(.01);assert.equal(scene.children.length,0);
});

test('ink wash also handles the crop billboard shader after its custom projection replaces the stock vertex chunk',()=>{
 const view=new InkDomainView(),m=new T.MeshBasicMaterial();m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <project_vertex>','vec3 pivot=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vec3 right=vec3(1.,0.,0.);vec3 up=vec3(0.,1.,0.);vec2 q=position.xy;vec4 mvPosition=viewMatrix*vec4(pivot+right*q.x+up*q.y,1.);gl_Position=projectionMatrix*mvPosition;');};view.patch(m);const shader:any={vertexShader:'void main(){\n#include <project_vertex>\n}',fragmentShader:'void main(){gl_FragColor=vec4(1.);}',uniforms:{}};m.onBeforeCompile(shader,{} as any);assert.match(shader.vertexShader,/vInkWorld=pivot\+right\*q.x\+up\*q.y/);assert.match(shader.fragmentShader,/inkLuma/);assert.ok(shader.uniforms.inkDomains);
});
