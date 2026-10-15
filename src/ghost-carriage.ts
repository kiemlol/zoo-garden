import * as T from 'three';
import type {Entity,World} from './world.ts';
import {JumpState,SINGLE_AIR_TIME} from './jump-rules.ts';
import {part} from './part-cache.ts';
import {findRoute,WORLD_BOUNDS} from './navigation.ts';
import {GHOST_CARRIAGE,type CarriagePose} from './carriage-pose.ts';
export {GHOST_CARRIAGE} from './carriage-pose.ts';

export function isGhostCarriage(e:Entity){return e.kind==='decoration'&&e.mesh.userData.decorationId===GHOST_CARRIAGE;}
/** The two authored models have different seat cushions; points are local to the decoration wrapper. */
export function carriageSeat(mesh:T.Object3D){return mesh.localToWorld(new T.Vector3(...(mesh.userData.carriageSeat??[0,.78,-.35]) as [number,number,number]));}
export function sitInCarriage(player:T.Object3D){
  for(const [name,side]of [['leg-left',-1],['leg-right',1]] as const){const leg=part(player,name);if(leg)leg.rotation.set((leg.position.y>.05?-1:1)*Math.PI/2,0,side*.06);}
  part(player,'arm-left')?.rotation.set(-.55,0,-.15);
  part(player,'arm-right')?.rotation.set(-.55,0,.15);
  part(player,'head')?.rotation.set(0,0,0);
  player.rotation.x=player.rotation.z=0;
}
/** Remote passengers use the same sitting pose; transitions follow the relayed jump height and scale. */
export function drawCarriagePassenger(player:T.Object3D,pose:CarriagePose){
  if(pose.phase==='seated')sitInCarriage(player);
  else{const tuck=Math.sin(pose.progress*Math.PI);for(const name of ['arm-left','arm-right'])part(player,name)?.rotation.set(-1.8*tuck,0,0);for(const name of ['leg-left','leg-right'])part(player,name)?.rotation.set(.6*tuck,0,0);}
  player.scale.setScalar(pose.scale);player.position.y=pose.lift;
}
function visibleBounds(root:T.Object3D){
  const bounds=new T.Box3();root.updateWorldMatrix(true,true);
  root.traverseVisible(o=>{if(o instanceof T.Mesh){o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  return bounds;
}

/** Transient passenger state, mirrored through presence, never stored in a saved profile. */
export class GhostCarriageRide {
  private world:World;
  entity:Entity|null=null;
  seated=false;
  leaving=false;
  private start=new T.Vector3();private last=new T.Vector3();private startFacing=0;
  private normalScale=new T.Vector3(1,1,1);
  private fitPlayer?:T.Group;private scale=1;private hip=.52;private progress=0;
  private blockedUntil=0;private exit:T.Vector3|null=null;private exitY=0;
  private garden?:World['state'];
  constructor(world:World){this.world=world;}
  get active(){return this.entity!==null;}
  board(entity:Entity){
    const w=this.world;
    if(this.active||w.time<this.blockedUntil||!isGhostCarriage(entity)||!w.entities.includes(entity)||entity.mesh.parent!==w.root||!entity.mesh.visible||w.planet!=='home'||w.interior||w.boarded||w.state.hp<=0||w.movementLocked||w.playerStun>0||w.playerFlying||w.playerHidden||w.playerLift>0||w.environment?.airborne||w.jump?.airborne||w.pose||w.spinT>0||w.punchT>0)return false;
    if(Math.hypot(entity.x-w.position.x,entity.z-w.position.z)>entity.radius+1.45||w.blocked(w.position.x,w.position.z))return false;
    w.jump??=new JumpState();if(!w.jump.jump())return false;
    this.entity=entity;this.start.copy(w.position);this.last.copy(w.position);this.startFacing=w.facing;this.normalScale.copy(w.player.scale);
    this.progress=0;this.seated=false;this.leaving=false;this.exit=null;this.fitPlayer=undefined;this.garden=w.state;
    this.clearMovement();w.jumpFeedback(1);return true;
  }
  /** Only the explicit leave command or directional input starts a dismount. Repeated events are idempotent. */
  dismount(){
    if(!this.entity||this.leaving)return false;
    const exit=this.exitPoint();if(!exit)return false;
    const w=this.world;this.exit=exit;this.start.copy(w.position);this.exitY=w.player.position.y;
    w.jump.cancel();w.jump.jump();w.jump.velocity*=.65;
    this.seated=false;this.leaving=true;this.progress=0;this.clearMovement();return true;
  }
  /** Rebuilds and streamed art preserve a passenger on the same unchanged carriage. */
  rebind(){
    if(!this.entity)return;
    const old=this.entity,next=this.world.entities.find(e=>e.id===old.id&&isGhostCarriage(e));
    if(this.world.state!==this.garden||!next||Math.hypot(next.x-old.x,next.z-old.z)>.01||next.mesh.rotation.y!==old.mesh.rotation.y){this.leave();return;}
    this.entity=next;this.fitPlayer=undefined;this.world.position.copy(this.last);
  }
  snapshot():CarriagePose|null{
    if(!this.entity)return null;
    return {uid:this.entity.mesh.userData.decorationUid,phase:this.leaving?'leaving':this.seated?'seated':'boarding',scale:this.world.player.scale.x,progress:this.seated?1:this.progress,lift:this.world.player.position.y};
  }
  private clearMovement(){const w=this.world;w.destination=null;w.route=[];w.selected=null;w.moving=false;w.marker.visible=false;w.ring.visible=false;if(w.environment)w.environment.velocity={x:0,z:0};}
  /** Check the full collision map on exit, including newly placed objects, rather than trusting a cached spot. */
  private exitPoint(){
    const w=this.world,e=this.entity!;
    const anchor=!w.blocked(this.start.x,this.start.z)?this.start:{x:0,z:-4.8};
    const free=(x:number,z:number)=>!w.blocked(x,z)&&(w.blocked(anchor.x,anchor.z)||findRoute({x,z},anchor,w.obstacles,{bounds:WORLD_BOUNDS,maxIterations:2000}).length>0);
    const angle=Math.atan2(this.start.x-e.x,this.start.z-e.z);
    for(let ring=0;ring<16;ring++)for(let i=0;i<24;i++){
      const a=angle+i*Math.PI*2/24,r=e.radius+.75+ring*.5,x=e.x+Math.sin(a)*r,z=e.z+Math.cos(a)*r;
      if(free(x,z))return new T.Vector3(x,0,z);
    }
    if(!w.blocked(this.start.x,this.start.z))return this.start.clone().setY(0);
    // Even a carriage boxed in after boarding must have an escape to the village's open centre.
    for(let r=0;r<16;r++)for(let i=0;i<24;i++){const a=i*Math.PI/12,x=Math.sin(a)*r*.5,z=-4.8+Math.cos(a)*r*.5;if(!w.blocked(x,z))return new T.Vector3(x,0,z);}
    return null;
  }
  leave(keepPosition=false){
    if(!this.entity)return false;
    const w=this.world,exit=keepPosition?w.position.clone():this.exitPoint();
    if(!exit)return false;
    this.entity=null;this.seated=false;this.leaving=false;this.exit=null;this.fitPlayer=undefined;this.blockedUntil=w.time+.6;w.jump?.cancel();this.clearMovement();
    w.position.copy(exit);w.player.position.copy(exit);w.player.rotation.set(0,w.facing,0);
    w.player.scale.copy(this.normalScale);
    for(const name of ['leg-left','leg-right','arm-left','arm-right','head'])part(w.player,name)?.rotation.set(0,0,0);
    return true;
  }
  update(active:boolean){
    const e=this.entity;if(!e)return;const w=this.world;
    // Menus pause input, not the seat. Actual removal, defeat or relocation still releases stale state.
    const relocated=w.position.distanceTo(this.last)>4;
    if(w.state!==this.garden||!w.entities.includes(e)||e.mesh.parent!==w.root||!e.mesh.visible||w.interior||w.boarded||w.state.hp<=0||w.playerLift>0||w.playerFlying||w.playerHidden||relocated){this.leave(relocated);return;}
    if(active&&!this.leaving&&(w.keys.size>0||w.joystickInput))this.dismount();
    this.progress=this.seated?1:Math.min(1,w.jump.airTime/(SINGLE_AIR_TIME*(this.leaving?.65:1)));
    if(this.leaving){
      if(!w.jump.airborne){const exit=this.exit!;if(!w.blocked(exit.x,exit.z)){w.position.copy(exit);this.leave(true);}else this.leave();return;}
      const t=this.progress*this.progress*(3-2*this.progress);w.position.lerpVectors(this.start,this.exit!,t);w.position.y=0;this.last.copy(w.position);this.clearMovement();return;
    }
    if(!w.jump.airborne){this.seated=true;this.progress=1;}
    const seat=carriageSeat(e.mesh),t=this.progress*this.progress*(3-2*this.progress);
    w.position.lerpVectors(this.start,seat,t);w.position.y=0;
    w.facing=this.startFacing+Math.atan2(Math.sin(e.mesh.rotation.y-this.startFacing),Math.cos(e.mesh.rotation.y-this.startFacing))*t;
    this.last.copy(w.position);this.clearMovement();
  }
  /** Fit the actual seated silhouette, including worn gear, to 65% of the carriage's bounding-box height. */
  private fit(){
    const e=this.entity!,w=this.world,copy=w.player.clone(true);copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.scale.setScalar(1);sitInCarriage(copy);
    const height=visibleBounds(copy).getSize(new T.Vector3()).y;
    const carHeight=visibleBounds(e.mesh).getSize(new T.Vector3()).y;
    this.scale=carHeight*.65/Math.max(.1,height);this.hip=part(copy,'leg-left')?.position.y||.52;
    this.fitPlayer=w.player;
  }
  draw(){
    if(!this.entity)return;const w=this.world,p=w.player;
    if(this.fitPlayer!==p)this.fit();
    if(this.seated)sitInCarriage(p);
    if(this.leaving){const t=this.progress*this.progress*(3-2*this.progress);p.scale.multiplyScalar((this.scale+(this.normalScale.x-this.scale)*t)/Math.max(.001,p.scale.x));p.position.y=this.exitY*(1-t)+w.jump.height;return;}
    const t=this.progress*this.progress*(3-2*this.progress),normal=p.scale.x,scale=normal+(this.scale-normal)*t;
    if(this.seated)p.scale.setScalar(this.scale);else p.scale.multiplyScalar(scale/Math.max(.001,normal));p.rotation.y=w.facing;
    const seat=carriageSeat(this.entity.mesh),targetY=seat.y-this.hip*this.scale;
    p.position.y=this.start.y+(targetY-this.start.y)*t+(this.seated?0:w.jump.height);
  }
}
