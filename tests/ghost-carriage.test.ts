import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {World,HERO_SCALE} from '../src/world.ts';
import {newGame} from '../src/model.ts';
import {festivalKit,heroKit} from '../src/assets.ts';
import {carriageSeat,GHOST_CARRIAGE} from '../src/ghost-carriage.ts';
import {findRoute} from '../src/navigation.ts';

async function scene(file:string){const b=readFileSync(new URL('../public/assets/models/'+file,import.meta.url));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
(festivalKit as any).loadScene=()=>scene('festival-gear.glb');(heroKit as any).loadScene=()=>scene('hero.glb');
await Promise.all([festivalKit.load(),heroKit.load()]);
function fixture(rotation=Math.PI/3){
  const state=newGame();state.decorations=[{uid:1,id:GHOST_CARRIAGE,x:4,z:-4,rotation}];
  const w=Object.assign(Object.create(World.prototype),{
    state,scene:new T.Scene(),camera:new T.PerspectiveCamera(40,4/3,.5,300),root:new T.Group(),player:new T.Group(),companion:new T.Group(),position:new T.Vector3(),
    destination:null,route:[],selected:null,obstacles:[],entities:[],enemies:[],plotMeshes:[],cropSignatures:[],particles:[],keys:new Set<string>(),facing:0,time:0,planet:'home',hazardTimer:0,
    marker:new T.Mesh(),ring:new T.Mesh(),cameraTarget:new T.Vector3(),sun:new T.DirectionalLight(),raycaster:new T.Raycaster(),onInteract(){},onAttackEnemy(){},onDamage(){},onZone(){},
  }) as World;
  w.build('home');w.refreshPlayer();w.position.set(1.6,0,-4);w.update(.01,true,false);
  return {w,e:w.entities.find(e=>e.kind==='decoration')!};
}
function settle(w:World){for(let i=0;i<40;i++)w.update(.025,true,false);assert.equal(w.carriage?.seated,true);}

test('boarding uses the existing jump, shrinks into a rotated seat, and the green interaction dismounts',()=>{
  const {w,e}=fixture();let landed=0;w.onLanded=()=>landed++;
  assert.equal(w.boardCarriage(e),true);assert.equal(w.jump.airborne,true);assert.equal(w.carriage!.seated,false);
  w.update(.1,true,false);assert.ok(w.player.position.y>0);assert.equal(w.carriage!.seated,false);
  settle(w);assert.equal(landed,0,'boarding is not a combat landing');assert.equal(w.jump.airborne,false);
  const seat=carriageSeat(e.mesh),hip=w.player.getObjectByName('leg-left')!.position.y;
  assert.ok(Math.abs(w.player.position.x-seat.x)<1e-8&&Math.abs(w.player.position.z-seat.z)<1e-8);
  assert.ok(Math.abs(w.player.position.y+hip*w.player.scale.y-seat.y)<1e-8);
  assert.equal(w.player.getObjectByName('leg-left')!.rotation.x,-Math.PI/2);
  const ratio=new T.Box3().setFromObject(w.player).getSize(new T.Vector3()).y/new T.Box3().setFromObject(e.mesh).getSize(new T.Vector3()).y;
  assert.ok(ratio>=.6&&ratio<=.7,`seated height ratio ${ratio}`);assert.ok(w.player.scale.x<HERO_SCALE);
  assert.equal(w.nearest(),e);w.interactNearest();assert.equal(w.carriage!.active,false);
  assert.equal(w.jump.airborne,false);assert.equal(w.blocked(w.position.x,w.position.z),false);assert.equal(w.player.getObjectByName('leg-left')!.rotation.x,0);
  w.keys.add('ArrowRight');const old=w.position.clone();w.update(.05,true,false);assert.ok(w.position.distanceTo(old)>0);assert.ok(Math.abs(w.player.scale.x-HERO_SCALE)<1e-8);
});

test('distant and stale carriages cannot board; clicking a distant carriage still approaches before boarding',()=>{
  const {w,e}=fixture();w.position.set(0,0,3);assert.equal(w.boardCarriage(e),false);assert.equal(w.carriage?.active,false);
  w.onInteract=entity=>{w.boardCarriage(entity);};w.select(e);assert.ok(w.route.length>0);
  for(let i=0;i<500&&!w.carriage?.active;i++)w.update(.025,true,false);
  assert.equal(w.carriage?.active,true);w.carriage!.leave();e.mesh.visible=false;assert.equal(w.boardCarriage(e),false);
});

test('menus, a second interaction mid-jump, movement, removal, defeat and world changes release the passenger',()=>{
  for(const seated of [false,true])for(const cancel of ['menu','button','move','remove','defeat','world','teleport'] as const){
    const {w,e}=fixture();assert.equal(w.boardCarriage(e),true);if(seated)settle(w);else w.update(.1,true,false);
    if(cancel==='menu')w.update(.025,false,false);
    if(cancel==='button')w.interactNearest();
    if(cancel==='move'){w.joystickInput={x:1,z:0};w.update(.025,true,false);}
    if(cancel==='remove')w.syncDecorations();
    if(cancel==='defeat'){w.state.hp=0;w.update(.025,true,false);}
    if(cancel==='world')w.build('candy');
    if(cancel==='teleport'){w.position.set(-2,0,0);w.update(.025,true,false);assert.equal(w.position.x,-2);}
    assert.equal(w.carriage!.active,false,`${cancel}, seated=${seated}`);assert.equal(w.jump.airborne,false);
    assert.equal(w.blocked(w.position.x,w.position.z),false,`${cancel} leaves free ground`);
    assert.equal(w.player.getObjectByName('leg-left')!.rotation.x,0);
  }
});

test('exit searches current obstacles and a refreshed avatar is refitted without losing the seat',()=>{
  const {w,e}=fixture();assert.equal(w.boardCarriage(e),true);settle(w);
  w.refreshPlayer();w.update(.025,true,false);assert.equal(w.carriage!.seated,true);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;w.obstacle(e.x+Math.sin(a)*2.3,e.z+Math.cos(a)*2.3,.8);}
  assert.equal(w.carriage!.leave(),true);assert.equal(w.blocked(w.position.x,w.position.z),false);
  assert.ok(findRoute(w.position,{x:0,z:-4.8},w.obstacles).length>0,'exit is connected to open village ground');
  assert.equal(w.jump.airborne,false);assert.equal(w.carriage!.active,false);
});

test('festival clothing and hidden avatar meshes do not distort the visible seated height',()=>{
  for(const gear of [{hat:'hair_pumpkin',outfit:'dress_pumpkin',boots:'boots_pumpkin'},{hat:'hair_flex',glasses:'glasses_flex',outfit:'outfit_flex',boots:'boots_flex'}]){
    const {w,e}=fixture();w.state.gear=gear;w.refreshPlayer();
    const hidden=new T.Mesh(new T.BoxGeometry(50,50,50),new T.MeshBasicMaterial());hidden.visible=false;w.player.add(hidden);
    assert.equal(w.boardCarriage(e),true);settle(w);
    const copy=w.player.clone(true),remove:T.Object3D[]=[];copy.traverse(o=>{if(!o.visible)remove.push(o);});remove.forEach(o=>o.removeFromParent());
    const height=new T.Box3().setFromObject(copy).getSize(new T.Vector3()).y,car=new T.Box3().setFromObject(e.mesh).getSize(new T.Vector3()).y;
    assert.ok(height/car>=.6&&height/car<=.7,`${gear.hat}: ${height/car}`);
  }
});

test('repeated boarding and cancellation restores normal scale without accumulating pose transforms',()=>{
  const {w,e}=fixture();
  for(let i=0;i<12;i++){
    assert.equal(w.boardCarriage(e),true);if(i%2)settle(w);else w.update(.1,true,false);
    assert.equal(w.carriage!.leave(),true);w.update(.025,true,false);
    assert.ok(Math.abs(w.player.scale.x-HERO_SCALE)<1e-8);assert.equal(w.player.getObjectByName('leg-left')!.rotation.x,0);
    assert.equal(w.blocked(w.position.x,w.position.z),false);
  }
});
