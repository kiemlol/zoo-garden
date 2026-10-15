export const GHOST_CARRIAGE='deco_ghost_carriage';
/** Visual passenger state; never changes equipment stats or saved progress. */
export interface CarriagePose {
  uid:string;phase:'boarding'|'seated'|'leaving';scale:number;progress:number;lift:number;
}

/** Only relay a bounded passenger pose near a real carriage in the current garden. */
export function validateCarriagePose(raw:unknown,decorations:readonly {uid:string;id:string;x:number;z:number;rotation:number}[],at:{x:number;z:number},planet:string):CarriagePose|null{
  if(planet!=='home'||!raw||typeof raw!=='object')return null;
  const p=raw as CarriagePose;
  if(typeof p.uid!=='string'||!p.uid||p.uid.length>80||!['boarding','seated','leaving'].includes(p.phase)||![p.scale,p.progress,p.lift].every(Number.isFinite)||p.scale<.1||p.scale>2||p.progress<0||p.progress>1||p.lift<0||p.lift>4)return null;
  const car=decorations.find(d=>d.uid===p.uid&&d.id===GHOST_CARRIAGE);if(!car)return null;
  const x=car.x-Math.sin(car.rotation)*.35,z=car.z-Math.cos(car.rotation)*.35;
  if(p.phase==='seated'?(Math.hypot(at.x-x,at.z-z)>.5||p.lift>1.2||p.progress!==1):Math.hypot(at.x-car.x,at.z-car.z)>5)return null;
  return {uid:p.uid,phase:p.phase,scale:p.scale,progress:p.progress,lift:p.lift};
}
