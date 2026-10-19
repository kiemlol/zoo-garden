import {CURSED_BENCH,CURSED_COFFIN} from './halloween-content.ts';

export interface FurnitureDecoration {uid:string;id:string;x:number;z:number;rotation:number}
export interface FurniturePose {
 uid:string;id:typeof CURSED_BENCH|typeof CURSED_COFFIN;seat:number;garden:string;since:number;leavingAt?:number;from?:{x:number;z:number};
}
export const COFFIN_OPEN_MS=500,COFFIN_ENTER_MS=400,COFFIN_WAIT_MS=2000,COFFIN_CLOSE_MS=600,FURNITURE_LEAVE_MS=800;
export const furnitureCapacity=(id:string)=>id===CURSED_BENCH?2:id===CURSED_COFFIN?1:0;
export const isFurniture=(id:unknown):id is FurniturePose['id']=>id===CURSED_BENCH||id===CURSED_COFFIN;
export function furniturePoint(d:FurnitureDecoration,seat:number){const x=d.id===CURSED_BENCH?(seat===0?-.58:.58):0,z=d.id===CURSED_COFFIN?.82:.06;return{x:d.x+Math.cos(d.rotation)*x+Math.sin(d.rotation)*z,z:d.z-Math.sin(d.rotation)*x+Math.cos(d.rotation)*z};}
const smooth=(v:number)=>{const x=Math.max(0,Math.min(1,v));return x*x*(3-2*x);};
/** Absolute deadlines make the lid agree for the occupant, observers and late joiners. */
export function coffinLid(p:FurniturePose,now:number){
 if(p.id!==CURSED_COFFIN)return 0;
 if(p.leavingAt!==undefined)return smooth((now-p.leavingAt)/COFFIN_OPEN_MS);
 const age=now-p.since,closeAt=COFFIN_OPEN_MS+COFFIN_ENTER_MS+COFFIN_WAIT_MS;
 return age<COFFIN_OPEN_MS?smooth(age/COFFIN_OPEN_MS):age<closeAt?1:1-smooth((age-closeAt)/COFFIN_CLOSE_MS);
}
export function furnitureExpired(p:FurniturePose,now:number){return p.leavingAt!==undefined&&now>=p.leavingAt+(p.id===CURSED_COFFIN?FURNITURE_LEAVE_MS:0);}
/** Validate relayed state before touching a scene; clients cannot author reservation times or seat indexes. */
export function readFurniturePose(raw:unknown):FurniturePose|null{
 if(!raw||typeof raw!=='object')return null;const p=raw as FurniturePose;
 if(!isFurniture(p.id)||typeof p.uid!=='string'||!p.uid||p.uid.length>80||typeof p.garden!=='string'||!p.garden||p.garden.length>100||!Number.isInteger(p.seat)||p.seat<0||p.seat>=furnitureCapacity(p.id)||!Number.isFinite(p.since)||p.since<=0||p.leavingAt!==undefined&&(!Number.isFinite(p.leavingAt)||p.leavingAt<p.since))return null;
 if(p.from&&(!Number.isFinite(p.from.x)||!Number.isFinite(p.from.z)||Math.hypot(p.from.x,p.from.z)>160))return null;
 return {uid:p.uid,id:p.id,seat:p.seat,garden:p.garden,since:p.since,...(p.from?{from:{x:p.from.x,z:p.from.z}}:{}),...(p.leavingAt!==undefined?{leavingAt:p.leavingAt}:{})};
}
