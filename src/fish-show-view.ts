import * as T from 'three';
import {fishKit} from './assets.ts';
import {FISH_SHOW_SECONDS,type FishShow} from './aquarium.ts';
import {fishShowPlan,fishShowBlend,fishShowMotion,FISH_SHOW_HAND_GAP,type FishMeasureAxis} from './fish-show-rules.ts';
import {part} from './part-cache.ts';
import {displayFish,disposeDisplay} from './display-fish.ts';

interface ArmRest {node:T.Object3D;scale:T.Vector3;rotation:T.Quaternion}
interface HeldFish {id:string;cm:number;ready:boolean;root:T.Group;tail:T.Object3D|null;hidden:{node:T.Object3D;visible:boolean}[];twoHands:boolean;arms:ArmRest[];solids:{mesh:T.Mesh;bounds:T.Box3}[];headTop:number;gripMax:number;axis:FishMeasureAxis}
const held=new WeakMap<T.Object3D,HeldFish>();
const box=new T.Box3(),point=new T.Vector3(),origin=new T.Vector3(),axisPoint=new T.Vector3();
const target=new T.Vector3(),palm=new T.Vector3(),goalRotation=new T.Quaternion(),goalScale=new T.Vector3();
const parentInverse=new T.Matrix4(),leftPalm=new T.Vector3(),rightPalm=new T.Vector3();
const solidMatrix=new T.Matrix4(),poseBounds=new T.Box3(),corner=new T.Vector3();
/** Reuse cached mesh boxes, not vertices/allocations, to keep the near surface a small fixed distance from the palms. */
function heldBounds(player:T.Object3D,view:HeldFish){
 player.updateWorldMatrix(true,true);parentInverse.copy(player.matrixWorld).invert();poseBounds.makeEmpty();
 for(const {mesh,bounds} of view.solids){solidMatrix.multiplyMatrices(parentInverse,mesh.matrixWorld);
  for(let i=0;i<8;i++){corner.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).applyMatrix4(solidMatrix);poseBounds.expandByPoint(corner);}
 }
 return poseBounds;
}
/** Retain the existing single-hand pose. The two-hand path below never changes arm scale. */
function supportOneHand(player:T.Object3D,rest:ArmRest,hand:T.Object3D,x:number,y:number,z:number,blend:number){
 const arm=rest.node;arm.scale.copy(rest.scale);player.updateWorldMatrix(true,true);
 target.set(x,y,z);player.localToWorld(target);arm.parent!.worldToLocal(target);target.sub(arm.position);
 palm.copy(hand.position);const px=palm.x*arm.scale.x,pz=palm.z*arm.scale.z;
 if(Math.abs(palm.y)>.001)arm.scale.y=Math.sqrt(Math.max(.001,target.lengthSq()-px*px-pz*pz))/Math.abs(palm.y);
 palm.multiply(arm.scale).normalize();target.normalize();goalRotation.setFromUnitVectors(palm,target);goalScale.copy(arm.scale);
 arm.quaternion.slerpQuaternions(rest.rotation,goalRotation,blend);arm.scale.lerpVectors(rest.scale,goalScale,blend);
}
/** Rotate the native shoulder-to-palm vector forward, parallel to the avatar's +Z, at its original length. */
function raiseNativeArm(player:T.Object3D,rest:ArmRest,hand:T.Object3D,blend:number){
 const arm=rest.node;arm.scale.copy(rest.scale);player.updateWorldMatrix(true,true);
 parentInverse.copy(arm.parent!.matrixWorld).invert();target.set(0,0,1).transformDirection(player.matrixWorld).transformDirection(parentInverse);
 palm.copy(hand.position).multiply(rest.scale).normalize();goalRotation.setFromUnitVectors(palm,target);
 arm.quaternion.slerpQuaternions(rest.rotation,goalRotation,blend);
}
/** Cancel avatar height, buffs and idle breathing along the measuring axis: the same cm has the same world length. */
function cmCompensation(root:T.Object3D,axis:FishMeasureAxis){
 root.scale.setScalar(1);root.updateWorldMatrix(true,false);origin.set(0,0,0).applyMatrix4(root.matrixWorld);axisPoint.set(axis==='x'?1:0,0,axis==='z'?1:0).applyMatrix4(root.matrixWorld);
 return 1/Math.max(.001,axisPoint.distanceTo(origin));
}
function clear(player:T.Object3D,view:HeldFish){for(const h of view.hidden)h.node.visible=h.visible;for(const a of view.arms)a.node.scale.copy(a.scale);disposeDisplay(view.root);held.delete(player);}
/** World-space bounds of the actual fish, for the local camera and the existing player speech bubble. */
export function fishShowBounds(player:T.Object3D,bounds:T.Box3){const view=held.get(player);if(!view)return false;player.updateWorldMatrix(true,true);bounds.setFromObject(view.root);return !bounds.isEmpty();}
/** Cosmetic only: records, catches, rewards, tanks and inventory keep their existing rules. */
export function drawFishShow(player:T.Object3D,show:FishShow|null|undefined,_time:number,now=Date.now()){
 let view=held.get(player);const plan=show&&show.until>now?fishShowPlan(show.id,show.size):null;
 if(view&&(!plan||view.id!==show!.id||view.cm!==show!.size||view.ready!==fishKit.ready)){clear(player,view);view=undefined;}
 if(!plan||!show)return;
 const right=part(player,'arm-right'),left=part(player,'arm-left'),hand=part(player,'hand-left');if(!left||!right||!hand)return;
 if(!view){const shape=displayFish(show.id,plan.span,plan.axis),hidden=part(player,'hand-right')?.children.map(node=>({node,visible:node.visible}))??[];
  shape.root.name='held-show-fish';shape.root.userData.animated=true;shape.root.rotation.set(plan.pitch,plan.yaw,plan.roll,'YXZ');shape.root.updateMatrixWorld(true);
  if(shape.tail&&plan.tailPitch)shape.tail.rotation.x=plan.tailPitch;
  const solids:HeldFish['solids']=[];
  // Giant previews stay readable when the camera backs away; only these private materials opt out of world fog.
  shape.root.traverse(o=>{if(o instanceof T.Mesh){const source=o.material as T.Material,m=source.clone();m.userData={...source.userData,sharedKit:false};if('fog' in m)m.fog=false;o.material=m;if(!source.userData.sharedKit)source.dispose();if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();solids.push({mesh:o,bounds:o.geometry.boundingBox!});}});
  player.updateWorldMatrix(true,true);const head=part(player,'head')??player;box.setFromObject(head);box.getCenter(point);point.y=box.max.y;player.worldToLocal(point);const headTop=point.y;
  player.add(shape.root);
  view={id:show.id,cm:show.size,ready:fishKit.ready,...shape,hidden,twoHands:plan.twoHands,arms:[left,right].map(node=>({node,scale:node.scale.clone(),rotation:node.quaternion.clone()})),solids,headTop,gripMax:Math.max(.16,Math.min(.45,Math.abs(left.position.x))),axis:plan.axis};held.set(player,view);
 }
 const blend=fishShowBlend(show.until,now,FISH_SHOW_SECONDS);
 const motion=fishShowMotion(show.until,now);
 for(const h of view.hidden)h.node.visible=false;
 for(const a of view.arms)a.node.scale.copy(a.scale);
 // Both poses present the catch forward at chest/shoulder height, never over the head.
 view.root.rotation.set(plan.pitch+motion.pitch*blend,plan.yaw+motion.yaw*blend,plan.roll+motion.roll*blend,'YXZ');
 if(view.tail)view.tail.rotation.y=motion.tail*blend;
 const scale=cmCompensation(view.root,view.axis);view.root.scale.setScalar(scale*Math.max(.001,blend));
 let x=-view.gripMax,forward=.85,y=view.headTop*.72;
 const r=part(player,'hand-right');
 if(view.twoHands&&r){
  raiseNativeArm(player,view.arms[0],hand,blend);raiseNativeArm(player,view.arms[1],r,blend);
  player.updateWorldMatrix(true,true);hand.getWorldPosition(leftPalm);player.worldToLocal(leftPalm);r.getWorldPosition(rightPalm);player.worldToLocal(rightPalm);
  x=(leftPalm.x+rightPalm.x)/2;y=(leftPalm.y+rightPalm.y)/2;forward=Math.max(leftPalm.z,rightPalm.z);
 }else supportOneHand(player,view.arms[0],hand,x,y,forward,blend);
 const bounds=heldBounds(player,view),back=view.root.position.z-bounds.min.z,bottom=view.root.position.y-bounds.min.y,top=bounds.max.y-view.root.position.y;
 // Keep the rear surface ahead of the palms, including tiny fish; the hands never swallow the model.
 view.root.position.set(x,T.MathUtils.lerp(y*.7,Math.max(y,bottom+.18),blend)+motion.bob*blend,forward+back+FISH_SHOW_HAND_GAP);
 // Cached per pose, read without scanning the fish geometry in the speech callback.
 view.root.userData.showBubbleHeight=Math.max(view.headTop+.4,view.root.position.y+top+.35);
}
