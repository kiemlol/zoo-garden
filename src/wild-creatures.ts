import type {Point} from './navigation.ts';
import {zoneAt} from './environments.ts';
export const MOSSLUG={hide:2.8,hideCooldown:7,trailLife:7,trailRadius:.85,slip:1.6} as const;
export const PANGOLIN={windup:1,rollTime:1.8,rollSpeed:10,rest:3,cooldown:8,stun:2,swipeGap:.65} as const;
export interface SlimePatch extends Point {life:number}
/** The whole footprint stays inside its home sector, including knockback and rolls. */
export function inHabitat(home:Point,point:Point,radius=0){
 const zone=zoneAt(home);return zoneAt(point)===zone&&(!radius||[[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([x,z])=>zoneAt({x:point.x+x,z:point.z+z})===zone));
}
export function shellBlocks(type:string|undefined,phase:string|undefined,quake:boolean,basic:boolean,enemy:Point,facing:number,attacker:Point){
 if(type==='mosslug'&&phase==='shell')return !quake;
 if(type==='pangolin'&&phase==='roll'&&basic){const dx=attacker.x-enemy.x,dz=attacker.z-enemy.z;return dx*Math.sin(facing)+dz*Math.cos(facing)>0;}
 return false;
}
export function slimeAt(patches:readonly SlimePatch[],point:Point){return patches.some(p=>p.life>0&&Math.hypot(p.x-point.x,p.z-point.z)<MOSSLUG.trailRadius);}
