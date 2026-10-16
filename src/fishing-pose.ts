import type {Object3D} from 'three';
import {part} from './part-cache.ts';

/** Visual state only: catches, tension rules and rewards stay in the fishing simulation. */
export interface FishingPose {phase:'cast'|'wait'|'fight';cast:number;tension:number;rod:string}
export function readFishingPose(raw:unknown):FishingPose|null{
 if(!raw||typeof raw!=='object')return null;const p=raw as FishingPose;
 if(!['cast','wait','fight'].includes(p.phase)||!Number.isFinite(p.cast)||p.cast<0||p.cast>.5||!Number.isFinite(p.tension)||p.tension<0||p.tension>1||typeof p.rod!=='string'||!['rod','rod_gold','rod_steady'].includes(p.rod))return null;
 return {phase:p.phase,cast:p.cast,tension:p.tension,rod:p.rod};
}
/** Same hand, cast and reeling pose for local and online avatars. Return the body's lean. */
export function drawFishingPose(player:Object3D,pose:FishingPose,time:number){
 player.rotation.order='YXZ';
 const right=part(player,'arm-right'),left=part(player,'arm-left');let lean=0;
 right?.rotation.set(-.75,0,.1);left?.rotation.set(-.8,0,.5);
 if(pose.phase==='cast'){const t=Math.min(1,1-pose.cast/.5);if(right)right.rotation.x=-2.4+t*1.7;if(left)left.rotation.x=-2.2+t*1.4;}
 if(pose.phase==='fight'){const n=pose.tension;lean=-.25-n*.2;if(right)right.rotation.x=-1+Math.sin(time*40)*n*.08;if(left)left.rotation.x=-.9+Math.sin(time*12)*.35;part(player,'leg-left')?.rotation.set(.3,0,0);}
 // Tilt around the palm, never translate the grip. Counter the reeling lean so the tip stays toward the water.
 const hand=part(player,'hand-right');if(hand)hand.rotation.x=Math.PI/9-lean;
 return lean;
}
