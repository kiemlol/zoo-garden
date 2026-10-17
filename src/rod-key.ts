import * as T from 'three';
import {toonMaterial} from './toon.ts';
import type {FishingPose} from './fishing-pose.ts';

import {isKeyRod} from './fishing-rods.ts';
const TAU=Math.PI*2;
// Absolute-time sine: a three-second breath, 0.6–1.6, with no sharp peaks.
const breath=(time:number,phase=0)=>1.1+.5*Math.sin(time*TAU/3+phase);
/** Shared, untextured star geometry: no sprites, lights or per-frame allocations. */
function starShape(points:number,outer:number,inner:number){const shape=new T.Shape();for(let i=0;i<points*2;i++){const a=Math.PI/2+i*Math.PI/points,r=i%2?inner:outer;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)shape.lineTo(x,y);else shape.moveTo(x,y);}shape.closePath();return shape;}
const sparkGeometry=new T.ShapeGeometry(starShape(4,.026,.007));sparkGeometry.userData.sharedKit=true;
const sparkMaterial=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});sparkMaterial.userData.sharedKit=true;
interface KeyVisual {gear:T.Group;base:T.Quaternion;crystal:T.Group;surfaces:T.Mesh[];sparks:T.InstancedMesh;dummy:T.Object3D;color:T.Color}
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
 const surfaces:T.Mesh[]=[];
 crystal.traverse(o=>{if(!(o instanceof T.Mesh))return;const m=(o.material as T.MeshToonMaterial).clone();m.userData={...m.userData,sharedKit:false};o.material=m;surfaces.push(o);});
 const sparks=new T.InstancedMesh(sparkGeometry,sparkMaterial,6);sparks.name='key-sparkles';sparks.userData.animated=true;sparks.frustumCulled=false;sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);sparks.setColorAt(0,new T.Color());sparks.instanceColor!.setUsage(T.DynamicDrawUsage);crystal.add(sparks);
 visuals.set(root,{gear,base:gear.quaternion.clone(),crystal,surfaces,sparks,dummy:new T.Object3D(),color:new T.Color()});
}
/** Absolute time keeps both frame rates and online observers at the same gentle speed. */
export function animateKeyRod(root:T.Object3D,time:number){
 const v=visuals.get(root);if(!v)return;
 v.gear.quaternion.copy(v.base);v.gear.rotateZ(-time*TAU/5);
 // Read the live mesh material: refreshPlayer clones materials after preparing the rod.
 // Restore purple after avatar hurt/blink tinting so the crystal itself never strobes.
 for(const surface of v.surfaces){const m=surface.material as T.MeshToonMaterial;m.emissive.setHex(0xaa62ff);m.emissiveIntensity=breath(time);}
 // Three-second sine envelopes reach zero with zero slope at particle resets.
 for(let i=0;i<6;i++){const u=(time/3+i/6)%1,a=i*2.399,spread=.17+u*.18,fade=.5+.5*Math.sin(u*TAU-Math.PI/2);v.dummy.position.set(Math.cos(a)*spread,Math.sin(a)*spread+u*.08,.075);v.dummy.rotation.z=a+u;v.dummy.scale.setScalar(fade);v.dummy.updateMatrix();v.sparks.setMatrixAt(i,v.dummy.matrix);v.color.set(i%2?'#efe1ff':'#aa62ff').multiplyScalar(fade);v.sparks.setColorAt(i,v.color);}
 v.sparks.instanceMatrix.needsUpdate=true;v.sparks.instanceColor!.needsUpdate=true;
}

const starGeometry=new T.ExtrudeGeometry(starShape(5,.17,.075),{depth:.028,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.006,bevelThickness:.006});starGeometry.userData.sharedKit=true;
export function makeStarBobber(){
 const group=new T.Group();group.name='bobber_star';
 const material=toonMaterial({color:'#FFD34D',emissive:'#FFBA23',emissiveIntensity:breath(0,Math.PI)});
 const star=new T.Mesh(starGeometry,material);star.name='bobber-star-glow';star.rotation.x=-Math.PI/2;star.position.y=.006;group.add(star);return group;
}
// Half a cycle (1.5 s) behind the crystal; local and remote floats share this pulse.
export function pulseStarBobber(bobber:T.Object3D,time:number){const mesh=bobber.children[0] as T.Mesh; (mesh.material as T.MeshToonMaterial).emissiveIntensity=breath(time,Math.PI);}
const remotePosition=new T.Vector3(),remoteRotation=new T.Quaternion(),remoteScale=new T.Vector3();
/** The new rod has an invisible line: observers only need its authoritative visual float point. */
export function drawRemoteKeyBobber(player:T.Object3D,pose:FishingPose|null|undefined,time:number){
 let bobber=remoteBobbers.get(player);
 if(!pose||!isKeyRod(pose.rod)||!pose.bobber){if(bobber)bobber.visible=false;return;}
 if(!bobber){bobber=makeStarBobber();bobber.userData.animated=true;player.add(bobber);remoteBobbers.set(player,bobber);}
 bobber.visible=true;player.updateWorldMatrix(true,false);remotePosition.set(pose.bobber.x,pose.bobber.y,pose.bobber.z);player.worldToLocal(remotePosition);bobber.position.copy(remotePosition);
 player.getWorldQuaternion(remoteRotation);bobber.quaternion.copy(remoteRotation).invert();player.getWorldScale(remoteScale);bobber.scale.set(1/remoteScale.x,1/remoteScale.y,1/remoteScale.z);pulseStarBobber(bobber,time);
}
