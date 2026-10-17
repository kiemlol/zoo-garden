import * as T from 'three';
import {fishKit} from './assets.ts';
import {FISH_SHOW_SECONDS,type FishShow} from './aquarium.ts';
import {fishShowPlan,fishShowBlend,FISH_SHOW_HAND_GAP,type FishMeasureAxis} from './fish-show-rules.ts';
import {part} from './part-cache.ts';
import {displayFish,disposeDisplay} from './display-fish.ts';

interface ArmRest {node:T.Object3D;scale:T.Vector3;rotation:T.Quaternion}
interface HeldFish {id:string;cm:number;ready:boolean;root:T.Group;tail:T.Object3D|null;hidden:{node:T.Object3D;visible:boolean}[];twoHands:boolean;arms:ArmRest[];dimensions:T.Vector3;back:number;bottom:number;top:number;headTop:number;gripMax:number;axis:FishMeasureAxis}
const held=new WeakMap<T.Object3D,HeldFish>();
const box=new T.Box3(),point=new T.Vector3(),origin=new T.Vector3(),axisPoint=new T.Vector3();
const target=new T.Vector3(),palm=new T.Vector3(),goalRotation=new T.Quaternion(),goalScale=new T.Vector3();
/** Stretch only as needed to support the belly, never spread the hands to the ends of a giant fish. */
function support(player:T.Object3D,rest:ArmRest,hand:T.Object3D,x:number,y:number,z:number,blend:number){
 const arm=rest.node;arm.scale.copy(rest.scale);player.updateWorldMatrix(true,true);
 target.set(x,y,z);player.localToWorld(target);arm.parent!.worldToLocal(target);target.sub(arm.position);
 palm.copy(hand.position);const px=palm.x*arm.scale.x,pz=palm.z*arm.scale.z;
 if(Math.abs(palm.y)>.001)arm.scale.y=Math.sqrt(Math.max(.001,target.lengthSq()-px*px-pz*pz))/Math.abs(palm.y);
 palm.multiply(arm.scale).normalize();target.normalize();goalRotation.setFromUnitVectors(palm,target);goalScale.copy(arm.scale);
 arm.quaternion.slerpQuaternions(rest.rotation,goalRotation,blend);arm.scale.lerpVectors(rest.scale,goalScale,blend);
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
export function drawFishShow(player:T.Object3D,show:FishShow|null|undefined,time:number,now=Date.now()){
 let view=held.get(player);const plan=show&&show.until>now?fishShowPlan(show.id,show.size):null;
 if(view&&(!plan||view.id!==show!.id||view.cm!==show!.size||view.ready!==fishKit.ready)){clear(player,view);view=undefined;}
 if(!plan||!show)return;
 const right=part(player,'arm-right'),left=part(player,'arm-left'),hand=part(player,'hand-left');if(!left||!right||!hand)return;
 if(!view){const shape=displayFish(show.id,plan.span,plan.axis),hidden=part(player,'hand-right')?.children.map(node=>({node,visible:node.visible}))??[];
  shape.root.name='held-show-fish';shape.root.userData.animated=true;shape.root.rotation.set(plan.pitch,plan.yaw,plan.roll,'YXZ');shape.root.updateMatrixWorld(true);
  if(shape.tail&&plan.tailPitch)shape.tail.rotation.x=plan.tailPitch;
  const bounds=new T.Box3().setFromObject(shape.root);
  // Reserve the whole tail sweep once, so wagging cannot close the visible palm gap.
  if(shape.tail){for(const angle of [-.08,-.04,.04,.08]){shape.tail.rotation.y=angle;shape.root.updateMatrixWorld(true);bounds.expandByObject(shape.root);}shape.tail.rotation.y=0;shape.root.updateMatrixWorld(true);}
  const dimensions=bounds.getSize(new T.Vector3()),back=-bounds.min.z,bottom=-bounds.min.y,top=bounds.max.y;
  // Giant previews stay readable when the camera backs away; only these private materials opt out of world fog.
  shape.root.traverse(o=>{if(o instanceof T.Mesh){const source=o.material as T.Material,m=source.clone();m.userData={...source.userData,sharedKit:false};if('fog' in m)m.fog=false;o.material=m;if(!source.userData.sharedKit)source.dispose();}});
  player.updateWorldMatrix(true,true);const head=part(player,'head')??player;box.setFromObject(head);box.getCenter(point);point.y=box.max.y;player.worldToLocal(point);const headTop=point.y;
  player.add(shape.root);
  view={id:show.id,cm:show.size,ready:fishKit.ready,...shape,hidden,twoHands:plan.twoHands,arms:[left,right].map(node=>({node,scale:node.scale.clone(),rotation:node.quaternion.clone()})),dimensions,back,bottom,top,headTop,gripMax:Math.max(.16,Math.min(.45,Math.abs(left.position.x))),axis:plan.axis};held.set(player,view);
 }
 const blend=fishShowBlend(show.until,now,FISH_SHOW_SECONDS);
 for(const h of view.hidden)h.node.visible=false;
 for(const a of view.arms)a.node.scale.copy(a.scale);
 // Both poses present the catch forward at chest/shoulder height, never over the head.
 const scale=cmCompensation(view.root,view.axis);view.root.scale.setScalar(scale*Math.max(.001,blend));
 const back=view.back*scale,bottom=view.bottom*scale;
 const forward=view.twoHands?.95:.85,y=view.headTop*.72;
 const grip=view.twoHands?Math.min(view.gripMax,view.dimensions.x*scale*.23):view.gripMax;
 const x=view.twoHands?0:-grip;
 // Keep the rear surface ahead of the palms, including tiny fish; the hands never swallow the model.
 view.root.position.set(x,T.MathUtils.lerp(y*.7,Math.max(y,bottom+.18),blend),forward+back+FISH_SHOW_HAND_GAP);
 support(player,view.arms[0],hand,-grip,y,forward,blend);
 const r=part(player,'hand-right');if(view.twoHands&&r)support(player,view.arms[1],r,grip,y,forward,blend);
 if(view.tail)view.tail.rotation.y=Math.sin(time*7)*.08*blend;
 // Cached per pose, read without scanning the fish geometry in the speech callback.
 view.root.userData.showBubbleHeight=Math.max(view.headTop+.4,view.root.position.y+view.top*view.root.scale.y+.35);
}
