import * as T from 'three';
import {fishShowBounds} from './fish-show-view.ts';

/** Temporary framing for cm-sized trophy fish; never writes the player's zoom, pitch or saved camera offset. */
export class FishShowCamera {
 private bounds=new T.Box3();private centre=new T.Vector3();private direction=new T.Vector3();
 private right=new T.Vector3();private up=new T.Vector3();private corner=new T.Vector3();
 private shift=new T.Vector3();private wanted=new T.Vector3();private look=new T.Vector3();private extra=0;
 private fog:T.Fog|null=null;private fogNear=0;private fogFar=0;
 private restoreFog(){if(this.fog){this.fog.near=this.fogNear;this.fog.far=this.fogFar;}}
 reset(){this.shift.set(0,0,0);this.extra=0;this.restoreFog();this.fog=null;}
 update(camera:T.PerspectiveCamera,target:T.Vector3,player:T.Object3D,dt:number,fog?:T.Fog|T.FogExp2|null){
  if(this.fog!==fog){this.restoreFog();this.fog=fog instanceof T.Fog?fog:null;if(this.fog){this.fogNear=this.fog.near;this.fogFar=this.fog.far;}}
  const distance=camera.position.distanceTo(target);this.direction.copy(camera.position).sub(target).normalize();
  this.wanted.set(0,0,0);let extra=0;
  if(fishShowBounds(player,this.bounds)){
   // Include the feet and leave headroom for the existing name/cm speech bubble.
   this.bounds.expandByPoint(player.getWorldPosition(this.corner));this.bounds.max.y+=.7;
   this.bounds.getCenter(this.centre);this.wanted.copy(this.centre).sub(target);
   this.right.set(1,0,0).applyQuaternion(camera.quaternion);this.up.set(0,1,0).applyQuaternion(camera.quaternion);
   const tanY=Math.tan(T.MathUtils.degToRad(camera.fov/2))/camera.zoom,tanX=tanY*camera.aspect;
   let required=0;
   for(let i=0;i<8;i++){
    this.corner.set(i&1?this.bounds.max.x:this.bounds.min.x,i&2?this.bounds.max.y:this.bounds.min.y,i&4?this.bounds.max.z:this.bounds.min.z).sub(this.centre);
    required=Math.max(required,this.corner.dot(this.direction)+Math.max(Math.abs(this.corner.dot(this.right))/(tanX*.75),Math.abs(this.corner.dot(this.up))/(tanY*.65),camera.near+1));
   }
   extra=Math.max(0,required-distance);
  }
  const blend=1-Math.exp(-Math.max(0,dt)*10);this.shift.lerp(this.wanted,blend);this.extra=T.MathUtils.lerp(this.extra,extra,blend);
  if(this.shift.lengthSq()<1e-10&&this.extra<1e-5){this.reset();return;}
  camera.position.add(this.shift).addScaledVector(this.direction,this.extra);this.look.copy(target).add(this.shift);camera.lookAt(this.look);
  // Moving the lens back must not fog out the fish holder or turn the nearby garden into a blank wall.
  if(this.fog){const backing=Math.max(0,this.extra+this.shift.dot(this.direction));this.fog.near=this.fogNear+backing;this.fog.far=this.fogFar+backing;}
 }
}
