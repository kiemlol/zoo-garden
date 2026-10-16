import * as T from 'three';
import {toonMaterial} from './toon.ts';
import type {FishingPose} from './fishing-pose.ts';

import {isKeyRod} from './fishing-rods.ts';
const TAU=Math.PI*2;
/** Shared, untextured star geometry: no sprites, lights or per-frame allocations. */
function starShape(points:number,outer:number,inner:number){const shape=new T.Shape();for(let i=0;i<points*2;i++){const a=Math.PI/2+i*Math.PI/points,r=i%2?inner:outer;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();return shape;}
const sparkGeometry=new T.ShapeGeometry(starShape(4,.026,.007));sparkGeometry.userData.sharedKit=true;
const sparkMaterial=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});sparkMaterial.userData.sharedKit=true;
interface KeyVisual {gear:T.Group;base:T.Quaternion;crystal:T.Group;glow:T.MeshToonMaterial[];glint:T.MeshToonMaterial[];sparks:T.InstancedMesh;dummy:T.Object3D;color:T.Color}
const visuals=new WeakMap<T.Object3D,KeyVisual>();
const remoteBobbers=new WeakMap<T.Object3D,T.Group>();
/** Reassemble the named primitives flattened by KitLibrary at their authored pivot. */
function gather(root:T.Object3D,name:string){
 const pieces:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&new RegExp(`^${name}(?:_\\d+)?$`).test(o.name))pieces.push(o);});
 if(!pieces.length)return null;
 const group=new T.Group(),first=pieces[0];group.name=name;group.position.copy(first.position);group.quaternion.copy(first.quaternion);group.scale.copy(first.scale);first.parent!.add(group);group.updateMatrix();const inverse=group.matrix.clone().invert();
 for(const piece of pieces){piece.updateMatrix();piece.applyMatrix4(inverse);piece.name=name+'-surface';piece.userData.animated=true;group.add(piece);}return group;
}
/** Prepared once for each local/remote avatar. Animated materials belong to this instance. */
export function prepareKeyRod(root:T.Object3D){
 const gear=gather(root,'gear'),crystal=gather(root,'crystal');if(!gear||!crystal)return;
 const glow:T.MeshToonMaterial[]=[],glint:T.MeshToonMaterial[]=[];
 crystal.traverse(o=>{if(!(o instanceof T.Mesh))return;const m=(o.material as T.MeshToonMaterial).clone();m.userData={...m.userData,sharedKit:false};o.material=m;(m.name.endsWith(' glint')?glint:glow).push(m);});
 const sparks=new T.InstancedMesh(sparkGeometry,sparkMaterial,6);sparks.name='key-sparkles';sparks.userData.animated=true;sparks.frustumCulled=false;sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);sparks.setColorAt(0,new T.Color());sparks.instanceColor!.setUsage(T.DynamicDrawUsage);crystal.add(sparks);
 visuals.set(root,{gear,base:gear.quaternion.clone(),crystal,glow,glint,sparks,dummy:new T.Object3D(),color:new T.Color()});
}
/** Absolute time keeps both frame rates and online observers at the same gentle speed. */
export function animateKeyRod(root:T.Object3D,time:number){
 const v=visuals.get(root);if(!v)return;
 v.gear.quaternion.copy(v.base);v.gear.rotateZ(-time*TAU/5);
 for(const m of v.glow)if(!m.userData.flash)m.emissiveIntensity=.9+.18*Math.sin(time*Math.PI);
 for(const m of v.glint)if(!m.userData.flash)m.emissiveIntensity=.9+.7*Math.max(0,Math.sin(time*TAU*1.3))**6;
 for(let i=0;i<6;i++){const u=(time/1.6+i/6)%1,a=i*2.399,spread=.17+u*.18;v.dummy.position.set(Math.cos(a)*spread,Math.sin(a)*spread+u*.08,.075);v.dummy.rotation.z=a+u;v.dummy.scale.setScalar(Math.sin(u*Math.PI));v.dummy.updateMatrix();v.sparks.setMatrixAt(i,v.dummy.matrix);v.color.set(i%2?'#efe1ff':'#aa62ff').multiplyScalar(Math.sin(u*Math.PI));v.sparks.setColorAt(i,v.color);}
 v.sparks.instanceMatrix.needsUpdate=true;v.sparks.instanceColor!.needsUpdate=true;
}

const starGeometry=new T.ExtrudeGeometry(starShape(5,.17,.075),{depth:.028,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.006,bevelThickness:.006});starGeometry.userData.sharedKit=true;
export function makeStarBobber(){
 const group=new T.Group();group.name='bobber_star';
 const material=toonMaterial({color:'#FFD34D',emissive:'#FFBA23',emissiveIntensity:.85});
 const star=new T.Mesh(starGeometry,material);star.name='bobber-star-glow';star.rotation.x=-Math.PI/2;star.position.y=.006;group.add(star);return group;
}
export function pulseStarBobber(bobber:T.Object3D,time:number){const mesh=bobber.children[0] as T.Mesh; (mesh.material as T.MeshToonMaterial).emissiveIntensity=.85+.15*Math.sin(time*Math.PI);}
const remotePosition=new T.Vector3(),remoteRotation=new T.Quaternion(),remoteScale=new T.Vector3();
/** The new rod has an invisible line: observers only need its authoritative visual float point. */
export function drawRemoteKeyBobber(player:T.Object3D,pose:FishingPose|null|undefined,time:number){
 let bobber=remoteBobbers.get(player);
 if(!pose||!isKeyRod(pose.rod)||!pose.bobber){if(bobber)bobber.visible=false;return;}
 if(!bobber){bobber=makeStarBobber();bobber.userData.animated=true;player.add(bobber);remoteBobbers.set(player,bobber);}
 bobber.visible=true;player.updateWorldMatrix(true,false);remotePosition.set(pose.bobber.x,pose.bobber.y,pose.bobber.z);player.worldToLocal(remotePosition);bobber.position.copy(remotePosition);
 player.getWorldQuaternion(remoteRotation);bobber.quaternion.copy(remoteRotation).invert();player.getWorldScale(remoteScale);bobber.scale.set(1/remoteScale.x,1/remoteScale.y,1/remoteScale.z);pulseStarBobber(bobber,time);
}
