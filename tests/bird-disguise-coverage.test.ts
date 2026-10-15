import {applyGait,limbsOf} from '../src/walk-cycle.ts';
import {aimPortrait} from '../src/hero-portrait.ts';
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
const ids=['dz_penguin','dz_explorer_duck','dz_sorcerer','dz_ink_painter'];
function checkCostume(root:T.Group,id:string){
 const all=meshes(root),base=all.filter(m=>!m.name.startsWith(id));assert.ok(base.length>0,'the original render meshes remain on their rig');
 assert.ok(base.every(m=>!m.visible),'no original skin, hair, shirt, shorts, shoes or backpack can draw');
 assert.ok(all.filter(m=>m.name.startsWith(id)).every(m=>m.visible),'costume parts remain visible');
 for(const name of ['head','body','arm-left','arm-right','leg-left','leg-right','hand-right']){const part=root.getObjectByName(name);assert.ok(part&&part.visible,`${name} remains available for animation/held weapons`);}
}

test('complete bird costumes replace all original meshes for every body and height, including ears and animal hoods',()=>{
 const w=world();for(const id of ids)for(const body of ROWS.body)for(const height of ROWS.height){const look=`${body}-${height}-bunny-fox` as LookId,c=w.lookAvatar('#ff00ff',{disguise:id,hat:'hat_straw',outfit:'armor_knight',boots:'boots_rocket'},look);checkCostume(c,id);assert.equal(c.userData.look,look,'the selected mirror look also controls complete costumes');assert.ok(c.userData.fit['hand-right'],'retargeted hand anchors still accept held gear');}
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


test('costumes change height and build without exposing the base or mutating shared models',()=>{
 const w=world(),size=(id:string,look:LookId)=>{const c=w.lookAvatar('#ff00ff',{disguise:id},look),bounds=new T.Box3(),part=new T.Box3();c.updateMatrixWorld(true);c.traverseVisible((o:T.Object3D)=>{if(o instanceof T.Mesh&&!o.userData.outline){o.geometry.computeBoundingBox();bounds.union(part.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld));}});checkCostume(c,id);return bounds.getSize(new T.Vector3());};
 for(const id of ids){const heights=ROWS.height.map(h=>size(id,`boy-${h}-none-bare` as LookId).y);for(let i=1;i<heights.length;i++)assert.ok(heights[i]>heights[i-1],`${id}: ${heights}`);assert.ok(size(id,'sturdy-chibi-none-bare').x>size(id,'slim-chibi-none-bare').x);const before=size(id,DEFAULT_LOOK);size(id,'girl-grown-bunny-fox');assert.deepEqual(size(id,DEFAULT_LOOK),before,'shared kit geometry stays unchanged');}
});


test('portrait framing follows the visible costume head at every selected height',()=>{
 const w=world();for(const id of ids)for(const h of ROWS.height){const c=w.lookAvatar('#fff',{disguise:id},`girl-${h}-none-bare`),holder=new T.Group().add(c),camera=new T.PerspectiveCamera(30,1,.01,100);aimPortrait(camera,holder);camera.updateMatrixWorld(true);holder.updateMatrixWorld(true);const bounds=new T.Box3(),box=new T.Box3();c.getObjectByName('head')!.traverseVisible((o:T.Object3D)=>{if(o instanceof T.Mesh&&!o.userData.outline){o.geometry.computeBoundingBox();bounds.union(box.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld));}});const centre=bounds.getCenter(new T.Vector3()).project(camera);assert.ok(Math.abs(centre.x)<.7&&Math.abs(centre.y)<.7&&centre.z<1,`${id} ${h}: ${centre.toArray()}`);}
});

test('tall costumes keep compact coats and separate shoes with their own visible animated shins',()=>{
 const w=world();const bounds=(root:T.Object3D,predicate:(o:T.Mesh)=>boolean)=>{root.updateMatrixWorld(true);const b=new T.Box3(),part=new T.Box3();root.traverseVisible(o=>{if(o instanceof T.Mesh&&!o.userData.outline&&predicate(o)){o.geometry.computeBoundingBox();b.union(part.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld));}});return b;};
 for(const id of ids){const normal=w.lookAvatar('#fff',{disguise:id},DEFAULT_LOOK),tall=w.lookAvatar('#fff',{disguise:id},'girl-tall-none-bare');
 const isBody=(m:T.Mesh)=>m.userData.tag==='body',a=bounds(normal,isBody),b=bounds(tall,isBody),feet=bounds(tall,m=>m.userData.tag?.startsWith('leg-')),shin=tall.getObjectByName(id+'@shin') as T.Mesh;
 assert.ok(b.getSize(new T.Vector3()).y<=a.getSize(new T.Vector3()).y*(id==='dz_penguin'?1.12:1.09),'the upper costume keeps its proportions instead of stretching into a long coat');assert.ok(b.min.y>feet.min.y+.45,'raised hem and grounded footwear are separate');assert.ok(shin&&shin.parent?.name.startsWith('leg-'),'the visible leg belongs to its animated leg bone');assert.ok(bounds(tall,m=>m.name===id+'@shin').min.y<b.min.y,'costume legs fill the exposed gap');checkCostume(tall,id);
 }
});


test('penguin mirror heights preserve the rounded body shape and keep the footwear close to the hem',()=>{
 const w=world(),bounds=(root:T.Object3D,tag:string)=>{root.updateMatrixWorld(true);const b=new T.Box3(),v=new T.Box3();root.traverseVisible(o=>{if(o instanceof T.Mesh&&!o.userData.outline&&o.userData.tag===tag){o.geometry.computeBoundingBox();b.union(v.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld));}});return b;};
 for(const body of ROWS.body){let aspect:number|undefined;for(const height of ROWS.height){const c=w.lookAvatar('#fff',{disguise:'dz_penguin'},`${body}-${height}-none-bare`),b=bounds(c,'body'),size=b.getSize(new T.Vector3()),feet=bounds(c,'leg-left');
  const ratio=size.y/size.x;if(aspect!==undefined)assert.ok(Math.abs(ratio-aspect)<1e-5,'the hem and belly are uniformly scaled, without a pinched or stretched outline');aspect=ratio;
  assert.ok(b.min.y-feet.max.y<.08,'only a small ankle gap can be visible at rest, even at grown height');assert.ok(c.getObjectByName('leg-left')!.position.y<.72,'the costume uses a low leg joint rather than the explorer hip');
 }}
});
test('penguin walking restores its natural stride throughout the cycle for local, remote and friend avatars',()=>{
 const w=world();for(const height of ROWS.height){w.state.gear.disguise='dz_penguin';w.player=w.lookAvatar('#fff',{disguise:'dz_penguin'},`girl-${height}-none-bare`);w.jump=new JumpState();w.moving=true;
  const foot=w.player.getObjectByName('leg-left')!.children.find((o:T.Object3D)=>o.userData.tag==='leg-left')!;
  const centre=()=>{w.player.updateMatrixWorld(true);const b=new T.Box3().setFromObject(foot);return w.player.worldToLocal(b.getCenter(new T.Vector3()));};const rest=centre();
  for(let i=0;i<80;i++){w.player.position.set(0,0,0);w.player.scale.setScalar(1);w.animatePlayer(.025);const at=centre();assert.ok(Math.abs(at.z-rest.z)<.4,'walking does not pull the shoe far out from under the rounded hem');assert.ok(Math.abs(w.player.getObjectByName('leg-left')!.rotation.x)<=.701);checkCostume(w.player,'dz_penguin');}
  const limbs=limbsOf(w.player);for(let i=0;i<24;i++){limbs.legL!.rotation.x=limbs.legR!.rotation.x=0;applyGait(limbs,{phase:i*Math.PI/12,blend:1},.8);assert.ok(Math.abs(limbs.legL!.rotation.x)<=.801,'remote/friend walking restores the normal stride');}
 }
 const plain=w.lookAvatar('#fff',{},DEFAULT_LOOK),limbs=limbsOf(plain);applyGait(limbs,{phase:Math.PI/2,blend:1},.8);assert.equal(limbs.legL!.rotation.x,.8,'ordinary explorers keep their normal gait');
});
