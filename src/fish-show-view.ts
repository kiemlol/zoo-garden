import * as T from 'three';
import {fishKit} from './assets.ts';
import {fishClass,isDisplayFish,type FishShow} from './aquarium.ts';
import {part} from './part-cache.ts';
import {displayFish,disposeDisplay} from './display-fish.ts';

interface HeldFish {id:string;ready:boolean;root:T.Group;tail:T.Object3D|null;hidden:{node:T.Object3D;visible:boolean}[];overhead:boolean;arms:{node:T.Object3D;scale:T.Vector3}[];grip:number}
const held=new WeakMap<T.Object3D,HeldFish>();
const headBox=new T.Box3(),point=new T.Vector3();
const target=new T.Vector3(),palm=new T.Vector3();
/** Extend this cosmetic pose from the shoulder so the palms actually support the fish, even on short-armed costumes. */
function support(player:T.Object3D,arm:T.Object3D,hand:T.Object3D,x:number,y:number,z:number){
 player.updateWorldMatrix(true,true);target.set(x,y,z);player.localToWorld(target);arm.parent!.worldToLocal(target);target.sub(arm.position);
 palm.copy(hand.position);const px=palm.x*arm.scale.x,pz=palm.z*arm.scale.z;
 if(Math.abs(palm.y)>.001)arm.scale.y=Math.sqrt(Math.max(.001,target.lengthSq()-px*px-pz*pz))/Math.abs(palm.y);
 palm.multiply(arm.scale).normalize();target.normalize();arm.quaternion.setFromUnitVectors(palm,target);
}
/** Cosmetic only, never equips or consumes the fish. The caller retains normal movement/combat rules. */
export function drawFishShow(player:T.Object3D,show:FishShow|null|undefined,time:number,now=Date.now()){
 let view=held.get(player);const active=show&&show.until>now&&isDisplayFish(show.id);
 if(view&&(!active||view.id!==show.id||view.ready!==fishKit.ready)){for(const h of view.hidden)h.node.visible=h.visible;for(const a of view.arms)a.node.scale.copy(a.scale);disposeDisplay(view.root);held.delete(player);view=undefined;}
 if(!active)return;
 const right=part(player,'arm-right'),left=part(player,'arm-left'),hand=part(player,'hand-left');if(!left||!right||!hand)return;
 if(!view){const overhead=fishClass(show.id)>0,length=overhead?Math.max(.85,Math.min(1.35,.8+show.size/600)):.4,shape=displayFish(show.id,length),hidden=part(player,'hand-right')?.children.map(node=>({node,visible:node.visible}))??[];
  shape.root.name='held-show-fish';shape.root.userData.animated=true;shape.root.rotation.y=Math.PI/2;
  if(overhead){player.updateWorldMatrix(true,true);const head=part(player,'head')??player;headBox.setFromObject(head);headBox.getCenter(point);point.y=headBox.max.y;player.worldToLocal(point);shape.root.position.set(0,point.y+.22,.48);player.add(shape.root);}
  else{shape.root.position.set(0,.08,.06);hand.add(shape.root);}
  view={id:show.id,ready:fishKit.ready,...shape,hidden,overhead,arms:[left,right].map(node=>({node,scale:node.scale.clone()})),grip:length*.23};held.set(player,view);
 }
 for(const h of view.hidden)h.node.visible=false;
 for(const a of view.arms)a.node.scale.copy(a.scale);
 if(view.overhead){const y=view.root.position.y-.06,z=view.root.position.z;const r=part(player,'hand-right');support(player,left,hand,-view.grip,y,z);if(r)support(player,right,r,view.grip,y,z);}
 else left.rotation.set(-1.55,0,-.35);
 if(view.tail)view.tail.rotation.y=Math.sin(time*7)*.12;
}
