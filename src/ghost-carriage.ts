import * as T from 'three';
import type {Entity,World} from './world.ts';
import {JumpState,SINGLE_AIR_TIME} from './jump-rules.ts';
import {part} from './part-cache.ts';
import {findRoute,WORLD_BOUNDS} from './navigation.ts';

export const GHOST_CARRIAGE='deco_ghost_carriage';
export function isGhostCarriage(e:Entity){return e.kind==='decoration'&&e.mesh.userData.decorationId===GHOST_CARRIAGE;}
/** The two authored models have different seat cushions; points are local to the decoration wrapper. */
export function carriageSeat(mesh:T.Object3D){return mesh.localToWorld(new T.Vector3(...(mesh.userData.carriageSeat??[0,.78,-.35]) as [number,number,number]));}
function sit(player:T.Object3D){
  for(const [name,side]of [['leg-left',-1],['leg-right',1]] as const){const leg=part(player,name);if(leg)leg.rotation.set((leg.position.y>.05?-1:1)*Math.PI/2,0,side*.06);}
  part(player,'arm-left')?.rotation.set(-.55,0,-.15);
  part(player,'arm-right')?.rotation.set(-.55,0,.15);
  part(player,'head')?.rotation.set(0,0,0);
  player.rotation.x=player.rotation.z=0;
}
function visibleBounds(root:T.Object3D){
  const bounds=new T.Box3();root.updateWorldMatrix(true,true);
  root.traverseVisible(o=>{if(o instanceof T.Mesh){o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  return bounds;
}

/** Local, transient passenger state. The avatar stays in the world's animation tree, never in a saved profile. */
export class GhostCarriageRide {
  private world:World;
  entity:Entity|null=null;
  seated=false;
  private start=new T.Vector3();private last=new T.Vector3();private startFacing=0;
  private normalScale=new T.Vector3(1,1,1);
  private fitPlayer?:T.Group;private scale=1;private hip=.52;private progress=0;
  constructor(world:World){this.world=world;}
  get active(){return this.entity!==null;}
  board(entity:Entity){
    const w=this.world;
    if(this.active||!isGhostCarriage(entity)||!w.entities.includes(entity)||entity.mesh.parent!==w.root||!entity.mesh.visible||w.planet!=='home'||w.interior||w.boarded||w.state.hp<=0||w.movementLocked||w.playerStun>0||w.playerFlying||w.playerHidden||w.playerLift>0||w.environment?.airborne||w.jump?.airborne||w.pose||w.spinT>0||w.punchT>0)return false;
    if(Math.hypot(entity.x-w.position.x,entity.z-w.position.z)>entity.radius+1.45||w.blocked(w.position.x,w.position.z))return false;
    w.jump??=new JumpState();if(!w.jump.jump())return false;
    this.entity=entity;this.start.copy(w.position);this.last.copy(w.position);this.startFacing=w.facing;this.normalScale.copy(w.player.scale);
    this.progress=0;this.seated=false;this.fitPlayer=undefined;
    this.clearMovement();w.jumpFeedback(1);return true;
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
    this.entity=null;this.seated=false;this.fitPlayer=undefined;w.jump?.cancel();this.clearMovement();
    w.position.copy(exit);w.player.position.copy(exit);w.player.rotation.set(0,w.facing,0);
    w.player.scale.copy(this.normalScale);
    for(const name of ['leg-left','leg-right','arm-left','arm-right','head'])part(w.player,name)?.rotation.set(0,0,0);
    return true;
  }
  update(active:boolean){
    const e=this.entity;if(!e)return;const w=this.world;
    // Dialogs, replacement art, world changes, defeat and external teleports cancel rather than leaving a frozen passenger.
    const relocated=w.position.distanceTo(this.last)>4;
    if(!active||!w.entities.includes(e)||e.mesh.parent!==w.root||!e.mesh.visible||w.interior||w.boarded||w.state.hp<=0||w.playerLift>0||w.playerFlying||w.playerHidden||relocated||w.keys.size>0||w.joystickInput){this.leave(relocated);return;}
    this.progress=this.seated?1:Math.min(1,w.jump.airTime/SINGLE_AIR_TIME);
    if(!w.jump.airborne){this.seated=true;this.progress=1;}
    const seat=carriageSeat(e.mesh),t=this.progress*this.progress*(3-2*this.progress);
    w.position.lerpVectors(this.start,seat,t);w.position.y=0;
    w.facing=this.startFacing+Math.atan2(Math.sin(e.mesh.rotation.y-this.startFacing),Math.cos(e.mesh.rotation.y-this.startFacing))*t;
    this.last.copy(w.position);this.clearMovement();
  }
  /** Fit the actual seated silhouette, including worn gear, to 65% of the carriage's bounding-box height. */
  private fit(){
    const e=this.entity!,w=this.world,copy=w.player.clone(true);copy.position.set(0,0,0);copy.rotation.set(0,0,0);copy.scale.setScalar(1);sit(copy);
    const height=visibleBounds(copy).getSize(new T.Vector3()).y;
    const carHeight=visibleBounds(e.mesh).getSize(new T.Vector3()).y;
    this.scale=carHeight*.65/Math.max(.1,height);this.hip=part(copy,'leg-left')?.position.y||.52;
    this.fitPlayer=w.player;
  }
  draw(){
    if(!this.entity)return;const w=this.world,p=w.player;
    if(this.fitPlayer!==p)this.fit();
    if(this.seated)sit(p);
    const t=this.progress*this.progress*(3-2*this.progress),normal=p.scale.x,scale=normal+(this.scale-normal)*t;
    if(this.seated)p.scale.setScalar(this.scale);else p.scale.multiplyScalar(scale/Math.max(.001,normal));p.rotation.y=w.facing;
    const seat=carriageSeat(this.entity.mesh),targetY=seat.y-this.hip*this.scale;
    p.position.y=this.start.y+(targetY-this.start.y)*t+(this.seated?0:w.jump.height);
  }
}
