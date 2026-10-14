import {zoneInfo} from '../src/hud-combat.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {World,type Enemy} from '../src/world.ts';
import * as M from '../src/model.ts';
import {enemyRoster} from '../src/enemy-roster.ts';
import {HOME_REGION,HOME_SPAWNS} from '../src/enemy-types.ts';
import {zoneAt,EnvironmentSimulation,createEnvironmentLayout} from '../src/environments.ts';
import {MOSSLUG,PANGOLIN,inHabitat,shellBlocks,slimeAt} from '../src/wild-creatures.ts';
import {KitLibrary} from '../src/assets.ts';
import {creatureArt} from '../src/creature-art.ts';
import {CombatSimulation,type CombatHit} from '../src/combat.ts';
function world(){return Object.assign(Object.create(World.prototype),{state:M.newGame(),scene:new T.Scene(),camera:new T.OrthographicCamera(-3,3,3,-3,.1,20),root:new T.Group(),player:new T.Group(),companion:new T.Group(),position:new T.Vector3(),destination:null,route:[],selected:null,obstacles:[],entities:[],enemies:[],plotMeshes:[],cropSignatures:[],particles:[],keys:new Set<string>(),facing:0,time:0,planet:'home',hazardTimer:0,marker:new T.Mesh(),ring:new T.Mesh(),cameraTarget:new T.Vector3(),sun:new T.DirectionalLight(),raycaster:new T.Raycaster(),environment:new EnvironmentSimulation(createEnvironmentLayout('home')),onInteract(){},onAttackEnemy(){},onDamage(){},onZone(){}}) as World;}
function ai(w:World,e:Enemy,seconds:number){for(let i=0;i<seconds/.025;i++){w.time+=.025;(w as any).updateEnemyAi(e,.025);}}

test('all home species and bosses occupy their requested regions without shifting durable IDs',()=>{
 assert.match(zoneInfo('Mushroom Forest','home').chip,/Mushroom King/);assert.match(zoneInfo('Blue Lake Meadow','home').chip,/Ancient Treant/);
 const roster=enemyRoster('home');assert.equal(roster.length,187);
 assert.deepEqual(roster.slice(146,151).map(e=>e.type),['bear','treant','croc','mushking','titan_turtle']);
 assert.ok(roster.filter(e=>e.type==='forest_raptor').every(e=>e.zone==='meadow'));
 assert.ok(roster.filter(e=>e.type==='swamp_octo').every(e=>e.index>=157&&e.index<=164));
 const w=world();w.build('home');assert.equal(w.enemies.length,roster.length);
 for(const entry of roster){const e=w.enemies.find(e=>e.id===entry.id)!;assert.ok(e,entry.id);assert.equal(e.type,entry.type);assert.equal(zoneAt(e),HOME_REGION[e.type!]);assert.equal(e.maxHp,entry.baseMaxHp);}
 for(const[zone,spawns]of Object.entries(HOME_SPAWNS))for(const[type,count]of spawns){assert.equal(HOME_REGION[type],zone);assert.equal(roster.filter(e=>e.type===type&&e.zone===zone).length,count);}
});

test('chase stops at a sector edge even after a recent hit, and knockback cannot cross',()=>{
 const w=world(),e=w.spawnSpecies('boar',-36,-30,0)!;e.x=-32;w.position.set(-31,0,-29);e.phase='chase';e.lastHitAt=0;
 w.position.set(-29,0,-32);ai(w,e,.5);assert.equal(e.phase,'return');assert.equal(zoneAt(e),'forest');
 for(let i=0;i<40;i++)(w as any).moveCreature(e,3,-3,true);
 assert.equal(zoneAt(e),'forest');assert.ok(inHabitat({x:e.homeX,z:e.homeZ},e));
 e.knockVX=30;e.knockVZ=-30;for(let i=0;i<40;i++)w.stepCreatureMotion(e,.025);assert.equal(zoneAt(e),'forest');
});

test('Mosslug hides on a heavy hit, blocks ordinary blows, emerges and Quake breaks its shell',()=>{
 const w=world(),e=w.spawnSpecies('mosslug',-35,0,0)!;w.position.set(-34,0,0);
 w.damageEnemy(e,e.maxHp*.1);assert.equal(e.phase,'shell');const hp=e.hp;
 w.damageEnemy(e,30);assert.equal(e.hp,hp);ai(w,e,MOSSLUG.hide+.1);assert.notEqual(e.phase,'shell');
 e.mesh.userData.shellCooldown=0;w.damageEnemy(e,e.maxHp*.1);assert.equal(e.phase,'shell');const hiddenHp=e.hp;
 w.damageEnemy(e,15,.8,false,true,false);assert.equal(e.hp,hiddenHp-15);assert.equal(e.phase,'recover');
});

test('pangolin telegraphs for one second, rolls, bounces from scenery and rests',()=>{
 const w=world(),e=w.spawnSpecies('pangolin',40,0,0)!;w.position.set(46,0,0);ai(w,e,.025);assert.equal(e.phase,'roll-windup');
 ai(w,e,.8);assert.equal(e.phase,'roll-windup');ai(w,e,.25);assert.equal(e.phase,'roll');
 w.obstacles.push({x:43,z:0,r:.6});const start=e.x;ai(w,e,1);assert.ok(e.x<43);assert.notEqual(e.x,start);assert.ok(e.targetX!==58||e.targetZ!==0,'collision redirects the roll');
 ai(w,e,1);assert.equal(e.phase,'recover');assert.ok(e.phaseTime!>1);assert.equal(zoneAt(e),'canyon');
});

test('pangolin close attack is two separate swipes while its rolling skill cools down',()=>{
 const w=world(),e=w.spawnSpecies('pangolin',40,0,0)!;w.position.set(41.4,0,0);e.mesh.userData.rollCooldown=8;const hits:number[]=[];w.onDamage=n=>hits.push(n);
 ai(w,e,1.1);assert.equal(hits.length,2);assert.ok(hits.every(n=>n===e.damage));
});

test('rolling armor blocks a frontal basic hit, exposes the rear and allows skills',()=>{
 const e={x:40,z:0},front={x:40,z:2},rear={x:40,z:-2};
 assert.ok(shellBlocks('pangolin','roll',false,true,e,0,front));assert.ok(!shellBlocks('pangolin','roll',false,true,e,0,rear));assert.ok(!shellBlocks('pangolin','roll',false,false,e,0,front));
 const w=world(),enemy=w.spawnSpecies('pangolin',40,0,0)!;enemy.phase='roll';w.position.set(40,0,2);const hp=enemy.hp;w.damageEnemy(enemy,20);assert.equal(enemy.hp,hp);w.position.z=-2;w.damageEnemy(enemy,20);assert.equal(enemy.hp,hp-20);
});

test('slime has a limited footprint and expiry, reduces accuracy and stun gates movement and attacks',()=>{
 assert.ok(slimeAt([{x:-30,z:0,life:1}],{x:-30,z:.3}));assert.ok(!slimeAt([{x:-30,z:0,life:0}],{x:-30,z:0}));assert.ok(!slimeAt([{x:-30,z:0,life:1}],{x:-28,z:0}));
 const target={id:'enemy',x:0,z:1,hp:100,radius:.5};let hit=0;
 const sim=new CombatSimulation({position:()=>({x:0,z:0}),facing:()=>0,face(){},targets:()=>[target],weapon:()=>({kind:'fist'}),stats:()=>({attack:10,critChance:0}),move(){},hit(){hit++;},effect(){}},()=>.2);
 sim.statuses.slip=1;assert.equal(sim.basic(target),true);assert.equal(hit,0);sim.statuses.slip=0;sim.statuses.stun=2;assert.equal(sim.locksMovement,true);assert.equal(sim.basic(target),false);assert.equal(sim.skill(2),false);sim.update(2.1,true);assert.equal(sim.locksMovement,false);assert.equal(sim.basic(target),true);
});

test('both Quake workflows and delayed ranged basics identify their impacts',()=>{
 for(const moves of [false,true]){const hits:CombatHit[]=[],target={id:'moss',x:0,z:1,hp:10000,radius:.8};const sim=new CombatSimulation({position:()=>({x:0,z:0}),facing:()=>0,face(){},targets:()=>[target],weapon:()=>({kind:'fist'}),stats:()=>({attack:10,critChance:0}),move(){},hit(_t,h){hits.push(h);},effect(){}},()=>.5);sim.edge.moves=moves;assert.equal(sim.skill(2),true);for(let i=0;i<80;i++)sim.update(.025,true);assert.ok(hits.some(h=>h.quake),String(moves));}
 const hits:CombatHit[]=[],target={id:'pangolin',x:0,z:3,hp:100,radius:.8};const sim=new CombatSimulation({position:()=>({x:0,z:0}),facing:()=>0,face(){},targets:()=>[target],weapon:()=>({kind:'gun',range:8,shot:'pea'}),stats:()=>({attack:10,critChance:0}),move(){},hit(_t,h){hits.push(h);},effect(){}},()=>.5);sim.basic(target);for(let i=0;i<40;i++)sim.update(.025,true);assert.ok(hits[0]?.basic);
});

test('original GLB supplies animated creature parts and four loot meshes, icons and loot rules',async()=>{
 const bytes=readFileSync(new URL('../public/assets/models/wild-creatures.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');const kit=new KitLibrary(['fixture'],async()=>gltf.scene);await kit.load();
 for(const name of ['mosslug','pangolin']){const model=creatureArt(name,kit);assert.ok(model);const bounds=new T.Box3().setFromObject(model);assert.ok(bounds.max.y>1);assert.ok(bounds.min.y>-.1);}
 for(const name of ['rainbow_slime','moss_shell','lava_scale','rolling_shell']){assert.ok(kit.instance(name));assert.ok(readFileSync(new URL('../public/assets/icons/items/'+name+'.webp',import.meta.url)).byteLength>100);assert.equal(M.ITEMS[name].type,'material');}
 assert.deepEqual(M.rollLoot('mosslug',0,()=>0).map(x=>x.id),['rainbow_slime','moss_shell']);assert.deepEqual(M.rollLoot('pangolin',0,()=>0).map(x=>x.id),['lava_scale','rolling_shell']);
});
