import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {World} from '../src/world.ts';
import {heroKit,disguiseKit,heroKitFor,useHeroLoader} from '../src/assets.ts';
import {DEFAULT_LOOK,ROWS,type LookId} from '../src/looks.ts';
import {JumpState} from '../src/jump-rules.ts';
import {mergeParts} from '../src/avatar-merge.ts';
import * as M from '../src/model.ts';

const disk=async(url:string)=>{const file=url.split('/').pop()!.split('?')[0],b=readFileSync(new URL(`../public/assets/models/${file}`,import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer,'')).scene;};
useHeroLoader(disk);
for(const kit of [heroKit,disguiseKit]){(kit as any).loadScene=disk;await kit.load();}
const world=()=>Object.assign(Object.create(World.prototype),{state:M.newGame(),position:new T.Vector3(),facing:0,walkClock:0,playerMaterials:[],weaponKind:'fist',time:0});
const meshes=(root:T.Object3D)=>{const a:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&!o.userData.outline)a.push(o);});return a;};
const visibleTriangles=(root:T.Object3D)=>meshes(root).filter(m=>m.visible).reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3,0);
const ids=['dz_penguin','dz_explorer_duck'];
function checkCostume(root:T.Group,id:string){
 const all=meshes(root),base=all.filter(m=>!m.name.startsWith(id));assert.ok(base.length>0,'the original render meshes remain on their rig');
 assert.ok(base.every(m=>!m.visible),'no original skin, hair, shirt, shorts, shoes or backpack can draw');
 assert.ok(all.filter(m=>m.name.startsWith(id)).every(m=>m.visible),'costume parts remain visible');
 for(const name of ['head','body','arm-left','arm-right','leg-left','leg-right','hand-right']){const part=root.getObjectByName(name);assert.ok(part&&part.visible,`${name} remains available for animation/held weapons`);}
}

test('complete bird costumes replace all original meshes for every body and height, including ears and animal hoods',()=>{
 const w=world();for(const id of ids)for(const body of ROWS.body)for(const height of ROWS.height){const look=`${body}-${height}-bunny-fox` as LookId,c=w.lookAvatar('#ff00ff',{disguise:id,hat:'hat_straw',outfit:'armor_knight',boots:'boots_rocket'},look);checkCostume(c,id);assert.equal(c.userData.look,DEFAULT_LOOK,'complete costume proportions are independent of the mirror body');assert.equal(c.userData.fit,undefined);}
});
test('idle, walking, jumping, attacks and belly-slide poses never reveal an original mesh',()=>{
 const w=world();for(const id of ids){w.state.gear.disguise=id;w.jump=new JumpState();w.player=w.lookAvatar('#00ffff',{disguise:id},DEFAULT_LOOK);
  for(const pose of [null,{kind:'dash',t:.15},{kind:'slam',t:.2},{kind:'slide',t:.2}])for(const moving of [false,true])for(let i=0;i<32;i++){
   w.pose=pose;w.moving=moving;w.punchT=i%3===0?.2:0;w.spinT=i%7===0?1:0;w.player.position.set(0,0,0);w.player.scale.setScalar(1);w.animatePlayer(.025);checkCostume(w.player,id);
  }
  w.jump.jump();for(let i=0;i<12;i++){w.jump.step(.025);w.player.position.set(0,w.jump.height,0);w.player.scale.setScalar(1);w.animatePlayer(.025);checkCostume(w.player,id);}
 }
});
test('remote and friend mesh merging cannot resurrect the concealed original body',()=>{
 const w=world();for(const id of ids)for(const exact of [false,true]){const c=w.lookAvatar('#ff00ff',{disguise:id},DEFAULT_LOOK),before=visibleTriangles(c),original=meshes(c).filter(m=>!m.name.startsWith(id));mergeParts(c,{exact});assert.equal(visibleTriangles(c),before,'merging contains only visible costume geometry');assert.ok(original.every(m=>!m.visible));}
});
test('the original explorer and older disguises remain visible and styled after taking a bird costume off',async()=>{
 const w=world();for(const id of ids)w.lookAvatar('#ff00ff',{disguise:id},DEFAULT_LOOK);
 const look='girl-tall-cat-bare';await heroKitFor(look).load();
 const plain=w.lookAvatar('#ff00ff',{},look);assert.equal(plain.userData.look,look);assert.ok(meshes(plain).some(m=>m.visible));
 const old=w.lookAvatar('#ff00ff',{disguise:'dz_superhero'},DEFAULT_LOOK);assert.ok(meshes(old).some(m=>m.visible&&!m.name.startsWith('dz_superhero')),'open-faced legacy disguises retain their explorer');
});
test('a costume awaiting its GLB keeps the visible fallback, then replaces it once ready',()=>{
 const w=world(),ready=disguiseKit.ready;try{disguiseKit.ready=false;const c=w.lookAvatar('#ff00ff',{disguise:'dz_penguin'},DEFAULT_LOOK);assert.ok(meshes(c).some(m=>m.visible&&!m.name.startsWith('dz_penguin')));}finally{disguiseKit.ready=ready;}
 checkCostume(w.lookAvatar('#ff00ff',{disguise:'dz_penguin'},DEFAULT_LOOK),'dz_penguin');
});
