import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import * as M from '../src/model.ts';
import {ENEMY_TYPES,SWAMP_OCTO_COUNT} from '../src/enemy-types.ts';
import {enemyRoster} from '../src/enemy-roster.ts';
import {World} from '../src/world.ts';
import {Venom} from '../src/venom.ts';
import {lineBreakChance} from '../src/fishing.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KitLibrary} from '../src/assets.ts';
import {creatureArt} from '../src/creature-art.ts';

test('swamp hybrids append after durable home IDs and match server health/damage/level',()=>{
 const roster=enemyRoster('home'),list=roster.filter(e=>e.type==='swamp_octo');
 assert.equal(list.length,SWAMP_OCTO_COUNT);assert.equal(list[0].id,'home:enemy:157');
 assert.deepEqual(roster.slice(146,151).map(e=>e.type),['bear','treant','croc','mushking','titan_turtle']);
 const w=Object.assign(Object.create(World.prototype), {state:M.newGame(),scene:new T.Scene(),camera:new T.PerspectiveCamera(40,4/3,.5,300),root:new T.Group(),player:new T.Group(),companion:new T.Group(),position:new T.Vector3(),destination:null,route:[],selected:null,obstacles:[],entities:[],enemies:[],plotMeshes:[],cropSignatures:[],particles:[],keys:new Set<string>(),facing:0,time:0,planet:'home',hazardTimer:0,marker:new T.Mesh(),ring:new T.Mesh(),cameraTarget:new T.Vector3(),sun:new T.DirectionalLight(),raycaster:new T.Raycaster(),onInteract(){},onAttackEnemy(){},onDamage(){},onZone(){}}) as World;
 w.build('home');for(const entry of list){const e=w.enemies.find(e=>e.id===entry.id)!;assert.equal(e.type,entry.type);assert.equal(e.maxHp,entry.baseMaxHp);assert.equal(e.damage,entry.baseDamage);assert.equal(e.level,entry.level);assert.ok(e.z<0&&Math.abs(e.z)>=Math.abs(e.x));}
 const def=ENEMY_TYPES.swamp_octo;assert.equal(def.behavior,'shooter');assert.equal(def.poison,true);
 for(const e of list){assert.equal(e.zone,'swamp');assert.equal(e.level,7);assert.equal(e.baseMaxHp,Math.round(def.hp*2.6));assert.equal(e.baseDamage,def.damage*2.6);}
 assert.deepEqual(M.rollLoot('swamp_octo',0,()=>0).map(e=>e.id),['jelly_resin','venom_ink']);
});
test('venom ticks once per second, refreshes without stacking, expires and respects immunity',()=>{
 const v=new Venom();assert.equal(v.active,false);v.infect(20);assert.equal(v.active,true);assert.equal(v.step(.5),0);assert.equal(v.step(.5),3);
 v.infect(20);assert.equal(v.step(1),3);assert.equal(v.step(3),9);assert.equal(v.step(10),0);assert.equal(v.active,false);
 v.infect(100);assert.equal(v.step(1,true),0);assert.equal(v.step(1),0);
 v.infect(20);v.clear();assert.equal(v.step(1),0);
});
test('lava rod consumes both new drops and grants its real gear/fishing buffs',()=>{
 const s=M.newGame(),index=M.RECIPES.findIndex(r=>r.result==='rod_lava'),r=M.RECIPES[index];
 s.planet='lava';s.worldRewards.lava.braziers=[0,1,2];s.energy=10000;
 for(const[id,n]of Object.entries(r.materials))s.bag[id]=n;
 assert.ok(r.materials.venom_ink&&r.materials.jelly_resin);assert.equal(M.craft(s,index),true);
 assert.equal(s.bag.venom_ink,undefined);assert.equal(s.bag.jelly_resin,undefined);assert.equal(s.bag.rod_lava,1);
 const before=M.activeStats(s);assert.equal(M.equip(s,'rod_lava'),true);const after=M.activeStats(s);
 assert.equal(after.defense-before.defense,8);assert.equal(after.regen-before.regen,2);
 assert.equal(M.weaponStats(s).quality,1.1);assert.equal(lineBreakChance(M.weaponStats(s)),.1);
});
async function kit(file:string){const bytes=readFileSync(new URL('../public/assets/models/'+file,import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');const k=new KitLibrary(['fixture'],async()=>gltf.scene);await k.load();return k;}
test('GLB has toon hybrid, real loot meshes and usable lava rod tip; goat adult/kid keep every hinge',async()=>{
 const k=await kit('swamp-gear.glb');const octo=creatureArt('swamp_octo',k);assert.ok(octo);
 const box=new T.Box3().setFromObject(octo);assert.ok(box.max.y>1.4);assert.ok(box.max.x-box.min.x>1.8);
 for(const id of ['venom_ink','jelly_resin','rod_lava'])assert.ok(k.instance(id),id);
 assert.ok(k.instance('rod_lava')!.getObjectByName('rod-tip'));
 const farm=await kit('farm.glb');for(const id of ['goat','kid']){const g=farm.instance(id)!;assert.ok(g);for(const role of ['body','head','leg_fl','leg_fr','leg_bl','leg_br','tail'])assert.ok(farm.parts(id)?.some(p=>p.name.startsWith(id+'_'+role)),id+role);}
 assert.ok(new T.Box3().setFromObject(farm.instance('goat')!).max.y>1.15);
 assert.ok(new T.Box3().setFromObject(farm.instance('kid')!).max.y>.75);
});
