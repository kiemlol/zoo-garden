import {createHash} from 'node:crypto';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshyCostumeLibrary,animateWindSpirit,WIND_SPIRIT} from '../src/meshy-costume.ts';import * as M from '../src/model.ts';import {DISGUISE_KITS} from '../src/combat.ts';import {disposeTree} from '../src/dispose-tree.ts';
(globalThis as any).self=globalThis;(globalThis as any).createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const bytes=readFileSync(new URL('../public/assets/models/wind-spirit.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const library=new MeshyCostumeLibrary(async()=>gltf);await library.load();
function skin(root:T.Object3D){let result!:T.SkinnedMesh;root.traverse(o=>{if(o instanceof T.SkinnedMesh)result=o;});assert.ok(result);return result;}
test('Meshy source is a complete textured 14504-triangle skin with identity game axes and ten Blender clips',()=>{
 const p=library.instance()!,s=skin(p);assert.equal(s.geometry.index!.count/3,14504);assert.equal(s.skeleton.bones.length,15);assert.equal(gltf.animations.length,10);assert.ok((s.material as T.MeshStandardMaterial).map);assert.equal((s.material as T.Material).type,'MeshStandardMaterial');
 for(const name of ['head','arm-left','arm-right','hand-left','hand-right','leg-left','leg-right']){const b=gltf.scene.getObjectByName(name)!;assert.ok(b,name);assert.ok(b.quaternion.angleTo(new T.Quaternion())<1e-6);}
 p.updateMatrixWorld(true);const box=new T.Box3().setFromObject(p);assert.ok(Math.abs(box.max.y-box.min.y-2.35)<1e-4);
 const weights=s.geometry.attributes.skinWeight;for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<.001);
});
test('local and remote costume copies share the original render data but never share bones or pose state',()=>{
 const a=library.instance()!,b=library.instance()!,sa=skin(a),sb=skin(b);assert.equal(sa.geometry,sb.geometry);assert.equal(sa.material,sb.material);assert.notEqual(sa.skeleton,sb.skeleton);assert.notEqual(a.getObjectByName('arm-right'),b.getObjectByName('arm-right'));
 a.getObjectByName('arm-right')!.rotation.x=-1.2;assert.ok(Math.abs(b.getObjectByName('arm-right')!.rotation.x)<1e-8);assert.deepEqual(a.userData.fit['hand-right'].offset,[0,0,0]);
 const hp=a.getObjectByName('leg-left')!;hp.rotation.x=-Math.PI/2;for(let i=0;i<12;i++)animateWindSpirit(a,'Sit',.1);assert.ok(a.getObjectByName('shin-left')!.rotation.x>1.3);assert.equal(hp.rotation.x,-Math.PI/2,'secondary clips never replace primary furniture/skill poses');
 for(let i=0;i<12;i++)animateWindSpirit(a,'Lie',.1);assert.ok(Math.abs(a.getObjectByName('shin-left')!.rotation.x)<.01);assert.ok(Math.abs(b.getObjectByName('shin-left')!.rotation.x)<1e-8);
 for(const mode of ['Idle','Walk','Jump','FishCast','FishWait','FishReel','Attack'] as const){animateWindSpirit(a,mode,.1,.7);a.updateMatrixWorld(true);sa.skeleton.update();for(let i=0;i<sa.geometry.attributes.position.count;i+=137){const v=sa.getVertexPosition(i,new T.Vector3());assert.ok([v.x,v.y,v.z].every(Number.isFinite));assert.ok(v.length()<8,mode);}}
});
test('the new costume is obtainable and survives save/equip using the existing fairy combat kit',()=>{
 const s=M.newGame();s.energy=10;const recipe=M.RECIPES.findIndex(r=>r.result===WIND_SPIRIT&&r.station==='shop');assert.ok(recipe>=0);assert.equal(M.craft(s,recipe),true);assert.equal(M.equip(s,WIND_SPIRIT),true);assert.equal(M.parseSave(JSON.stringify(s))!.gear.disguise,WIND_SPIRIT);assert.deepEqual(DISGUISE_KITS[WIND_SPIRIT],DISGUISE_KITS.dz_fairy);assert.deepEqual(M.DISGUISES[WIND_SPIRIT].skills,M.DISGUISES.dz_fairy.skills);
});
test('disposing one skinned costume frees its private bone texture while keeping shared mesh and textures alive',()=>{
 const a=library.instance()!,b=library.instance()!,s=skin(a);s.skeleton.computeBoneTexture();let freed=0,geometryFreed=0;s.skeleton.boneTexture!.addEventListener('dispose',()=>freed++);s.geometry.addEventListener('dispose',()=>geometryFreed++);disposeTree(a);assert.equal(freed,1);assert.equal(geometryFreed,0);b.updateMatrixWorld(true);skin(b).skeleton.update();assert.ok(skin(b).skeleton.bones.length);
});

test('the delivered skin retains Meshy UVs, exact normals, triangle topology and all original texture bytes',()=>{
 const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n).toString()),bin=bytes.subarray(28+n),report=JSON.parse(readFileSync(new URL('../art/meshy-wind-spirit-rig.json',import.meta.url),'utf8')),primitive=doc.meshes[0].primitives[0];
 const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
 const attr=(i:number)=>{const a=doc.accessors[i],v=doc.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0),size=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4} as Record<string,number>)[a.type],width=a.componentType===5123?2:4;return bin.subarray(offset,offset+a.count*size*width);};
 for(const [field,name] of [['POSITION','position'],['NORMAL','NORMAL'],['TEXCOORD_0','TEXCOORD_0']])assert.equal(hash(attr(primitive.attributes[field])),report.appearance[name],field);
 const indices=attr(primitive.indices),count=doc.accessors[primitive.indices].count,expanded=Buffer.alloc(count*4);for(let i=0;i<count;i++)expanded.writeUInt32LE(doc.accessors[primitive.indices].componentType===5123?indices.readUInt16LE(i*2):indices.readUInt32LE(i*4),i*4);assert.equal(hash(expanded),report.appearance.indices);
 for(let i=0;i<doc.images.length;i++){const v=doc.bufferViews[doc.images[i].bufferView];assert.equal(hash(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)),report.appearance.textures[i]);}
 assert.equal(report.sourcePreserved,true);assert.ok(report.positionError<1e-6);
});
