import * as T from 'three';
import {findRoute,WORLD_BOUNDS} from './navigation.ts';
import type {Entity,World} from './world.ts';
import {part} from './part-cache.ts';
import {sitInCarriage} from './ghost-carriage.ts';
import {CURSED_COFFIN} from './halloween-content.ts';
import {coffinLid,COFFIN_OPEN_MS,COFFIN_ENTER_MS,furniturePoint,furnitureCapacity,furnitureExpired,isFurniture,readFurniturePose,type FurniturePose} from './furniture-rules.ts';

export function isRestFurniture(e:Entity){return e.kind==='decoration'&&isFurniture(e.mesh.userData.decorationId);}
function decoration(e:Entity){return{uid:e.mesh.userData.decorationUid as string,id:e.mesh.userData.decorationId as string,x:e.x,z:e.z,rotation:e.mesh.rotation.y};}
const coffinFits=new WeakMap<T.Object3D,{base:T.Vector3;factor:number;y:number}>();
function reset(player:T.Object3D){const fit=coffinFits.get(player);if(fit)player.scale.copy(fit.base);player.rotation.set(0,player.rotation.y,0,'XYZ');for(const name of ['leg-left','leg-right','arm-left','arm-right','head'])part(player,name)?.rotation.set(0,0,0);}
export function resetFurniturePose(player:T.Object3D){reset(player);coffinFits.delete(player);}
/** The same pose function draws local and remote passengers on every body model. */
export function drawFurniture(player:T.Object3D,e:Entity,p:FurniturePose,now=Date.now()){
 const d=decoration(e),at=furniturePoint(d,p.seat);reset(player);player.rotation.y=d.rotation;
 player.position.x=at.x;player.position.z=at.z;
 if(p.id===CURSED_COFFIN){
  const t=Math.max(0,Math.min(1,(now-p.since-COFFIN_OPEN_MS)/COFFIN_ENTER_MS));player.rotation.set(-Math.PI/2*(t*t*(3-2*t)),d.rotation,0,'YXZ');
  let fit=coffinFits.get(player);
  if(!fit){
   // Fit the actual visible avatar into the hollow compartment, including tall costumes.
   const copy=player.clone(true);copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.updateMatrixWorld(true);const bounds=new T.Box3();copy.traverseVisible(o=>{if(o instanceof T.Mesh&&!o.userData.outline){o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});const size=bounds.getSize(new T.Vector3()),factor=Math.min(1,1.72/Math.max(.1,size.y),.55/Math.max(.1,size.z),.99/Math.max(.1,size.x));fit={base:player.scale.clone(),factor,y:.55-bounds.min.z*factor};coffinFits.set(player,fit);
  }
  const blend=t*t*(3-2*t),from=p.from??at;player.position.x=from.x+(at.x-from.x)*blend;player.position.z=from.z+(at.z-from.z)*blend;player.scale.copy(fit.base).multiplyScalar(1+(fit.factor-1)*blend);player.position.y=fit.y*blend;part(player,'arm-left')?.rotation.set(0,0,-.12);part(player,'arm-right')?.rotation.set(0,0,.12);
 }else{sitInCarriage(player);const hip=part(player,'leg-left')?.position.y??.52;player.position.y=.705-hip*player.scale.y;}
}

export class FurnitureUse {
 pose:FurniturePose|null=null;entity:Entity|null=null;
 private world:World;private origin=new T.Vector3();private garden?:World['state'];private pending=false;private serial=0;private blockedUntil=0;
 constructor(world:World){this.world=world;}
 get active(){return !!this.pose;}
 async use(e:Entity){
  const w=this.world;if(this.pending||this.active||Date.now()<this.blockedUntil||!isRestFurniture(e)||w.resting||w.planet!=='home'||w.interior||w.boarded||w.state.hp<=0||w.jump.airborne||w.playerFlying||w.playerHidden||w.playerStun>0||w.movementLocked||w.pose||Math.hypot(e.x-w.position.x,e.z-w.position.z)>e.radius+1.75)return false;
  this.pending=true;const token=++this.serial,oldState=w.state,point=w.position.clone();
  try{
   let pose:FurniturePose|null;
   if(w.requestFurniture)pose=readFurniturePose(await w.requestFurniture(e.mesh.userData.decorationUid));
   else{const seats=new Set([...w.remotePlayers?.values()??[]].map(r=>r.pose.visual?.furniture).filter(p=>p&&p.uid===e.mesh.userData.decorationUid&&p.garden===w.furnitureGarden).map(p=>p!.seat));const seat=Array.from({length:furnitureCapacity(e.mesh.userData.decorationId)},(_,i)=>i).find(i=>!seats.has(i));pose=seat===undefined?null:{uid:e.mesh.userData.decorationUid,id:e.mesh.userData.decorationId,seat,garden:w.furnitureGarden,since:Date.now(),from:{x:point.x,z:point.z}};}
   if(!pose)return false;
   if(pose.uid!==e.mesh.userData.decorationUid||pose.id!==e.mesh.userData.decorationId||pose.garden!==w.furnitureGarden){if(w.requestFurniture)void w.requestFurniture(null);return false;}
   if(token!==this.serial||w.state!==oldState||w.planet!=='home'||!w.entities.includes(e)||w.jump.airborne||w.resting||w.state.hp<=0||w.position.distanceTo(point)>1){if(w.requestFurniture)void w.requestFurniture(null);return false;}
   this.pose=pose;this.entity=e;this.garden=w.state;this.origin.copy(w.position);w.fishShow=null;this.clearMovement();this.place();return true;
  }finally{if(token===this.serial)this.pending=false;}
 }
 private clearMovement(){const w=this.world;w.destination=null;w.route=[];w.selected=null;w.moving=false;w.marker.visible=false;w.ring.visible=false;w.jump.cancel();if(w.environment)w.environment.velocity={x:0,z:0};}
 private place(){if(!this.entity||!this.pose)return;const at=furniturePoint(decoration(this.entity),this.pose.seat);this.world.position.set(at.x,0,at.z);this.world.facing=this.entity.mesh.rotation.y;}
 async leave(){
  if(!this.pose||this.pose.leavingAt!==undefined)return false;
  // Open the lid before exiting. Mark immediately so repeated taps cannot start another enter/exit.
  const pose=this.pose;pose.leavingAt=Date.now();
  if(this.world.requestFurniture){const next=await this.world.requestFurniture(null);if(this.pose===pose&&next)this.pose=readFurniturePose(next);}
  return true;
 }
 /** Invalidate pending replies as well as an active seat when a world/profile is replaced. */
 cancel(notify=true){
  ++this.serial;this.pending=false;const w=this.world,had=!!this.pose,exit=had?this.exit():null;this.pose=null;this.entity=null;this.blockedUntil=Date.now()+500;
  if(had){if(exit){w.position.copy(exit);w.player.position.copy(exit);}resetFurniturePose(w.player);this.clearMovement();w.player.position.y=0;if(notify&&w.requestFurniture)void w.requestFurniture(null);}
 }
 reconcile(p:FurniturePose|null){if(!p&&this.pose)this.finish();}
 rebind(){if(!this.pose)return;const next=this.world.entities.find(e=>e.mesh.userData.decorationUid===this.pose!.uid&&isRestFurniture(e));if(!next||this.garden!==this.world.state||this.entity&&(next.x!==this.entity.x||next.z!==this.entity.z||next.mesh.rotation.y!==this.entity.mesh.rotation.y))this.finish();else{this.entity=next;this.place();}}
 private exit(){
  const w=this.world,e=this.entity;if(!e)return w.position.clone();
  // Search collision-free exits even when somebody placed more decorations next to the seat.
  for(let ring=0;ring<12;ring++)for(let i=0;i<24;i++){const a=e.mesh.rotation.y+i*Math.PI/12,r=e.radius+.75+ring*.45,x=e.x+Math.sin(a)*r,z=e.z+Math.cos(a)*r;if(!w.blocked(x,z)&&findRoute({x,z},{x:0,z:-4.8},w.obstacles,{bounds:WORLD_BOUNDS,maxIterations:2000}).length>0)return new T.Vector3(x,0,z);}
  if(!w.blocked(this.origin.x,this.origin.z))return this.origin.clone().setY(0);
  for(let ring=0;ring<16;ring++)for(let i=0;i<24;i++){const a=i*Math.PI/12,x=Math.sin(a)*ring*.5,z=-4.8+Math.cos(a)*ring*.5;if(!w.blocked(x,z))return new T.Vector3(x,0,z);}
  return this.origin.clone().setY(0);
 }
 private finish(){this.cancel();}
 update(active:boolean){
  if(!this.pose||!this.entity)return;const w=this.world,now=Date.now();
  if(w.state!==this.garden||w.planet!=='home'||w.interior||w.boarded||w.state.hp<=0||w.playerFlying||w.playerHidden||!w.entities.includes(this.entity)){this.finish();return;}
  const at=furniturePoint(decoration(this.entity),this.pose.seat);if(Math.hypot(w.position.x-at.x,w.position.z-at.z)>4){const p=w.position.clone();this.cancel();w.position.copy(p);return;}
  if(active&&(w.keys.size>0||w.joystickInput))void this.leave();
  if(furnitureExpired(this.pose,now)){this.finish();return;}this.clearMovement();this.place();
 }
 draw(){if(this.pose&&this.entity)drawFurniture(this.world.player,this.entity,this.pose);}
 snapshot(){return this.pose?{...this.pose}:null;}
}
/** One lid per coffin. Visitors and late joiners use the occupant's server-issued absolute start time. */
export function drawFurnitureLids(world:World,now=Date.now()){
 if(!world.furnitureEntities?.length)return;
 const poses=[world.furniture?.pose,...[...world.remotePlayers?.values()??[]].map(r=>r.pose.visual?.furniture)];
 for(const e of world.furnitureEntities){if(e.mesh.userData.decorationId!==CURSED_COFFIN)continue;const lid=e.mesh.getObjectByName('coffin-lid');if(!lid)continue;const pose=poses.find(p=>p&&p.uid===e.mesh.userData.decorationUid&&p.garden===world.furnitureGarden&&!furnitureExpired(p,now));lid.rotation.z=pose?coffinLid(pose,now)*Math.PI*.57:0;}
}
