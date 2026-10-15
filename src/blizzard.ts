import {BIRD} from './bird-skills.ts';
export interface BlizzardField{x:number;z:number;radius:number}
interface Point{x:number;z:number;radius?:number}
export function inBlizzard(p:Point,fields:readonly BlizzardField[]){return fields.some(f=>Math.hypot(p.x-f.x,p.z-f.z)<=f.radius+(p.radius??0));}
export function blizzardDamageFactor(p:Point,fields:readonly BlizzardField[]){return inBlizzard(p,fields)?1-BIRD.blizzard.weaken:1;}
export function isCreatureDash(e:{phase?:string}){return ['charge','roll','titan-leap'].includes(e.phase??'');}
/** First contact of a swept creature with any storm; fast dashes cannot tunnel through the field. */
export function blizzardDashContact(from:Point,to:Point,fields:readonly BlizzardField[]){
 const dx=to.x-from.x,dz=to.z-from.z,a=dx*dx+dz*dz;let first=Infinity;
 for(const f of fields){const x=from.x-f.x,z=from.z-f.z,r=f.radius+(from.radius??0),c=x*x+z*z-r*r;if(c<=0){first=0;break;}if(a<1e-12)continue;const b=2*(x*dx+z*dz),disc=b*b-4*a*c;if(disc<0)continue;const t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1)first=Math.min(first,t);}
 if(!Number.isFinite(first))return null;const safe=Math.max(0,first-1e-5);return {x:from.x+dx*safe,z:from.z+dz*safe};
}
export function interruptBlizzardDash(e:{x:number;z:number;phase?:string;phaseTime?:number;cooldown?:number;skill?:string;targetX?:number;targetZ?:number;telegraphs?:unknown[];knockVX?:number;knockVZ?:number;titanLift?:number},at:{x:number;z:number}){
 e.x=at.x;e.z=at.z;e.phase='recover';e.phaseTime=BIRD.blizzard.recovery;e.cooldown=Math.max(e.cooldown??0,BIRD.blizzard.recovery);e.skill=undefined;e.targetX=e.x;e.targetZ=e.z;e.telegraphs=[];e.knockVX=e.knockVZ=0;e.titanLift=0;
}
