import {furnitureCapacity,furnitureExpired} from '../src/furniture-rules.ts';

/** Reservations live only on connected peers, never in the saved decoration or profile. */
export function currentFurniture(peer,garden,now=Date.now()){
 const s=peer.furniture;if(!s)return null;
 const d=garden?.decorations?.find(d=>d.uid===s.pose.uid&&d.id===s.pose.id);
 if(peer.planet!=='home'||peer.account.profile.hp<=0||!d||s.pose.garden!==(peer.visit??peer.account.id)||d.x!==s.x||d.z!==s.z||d.rotation!==s.rotation||furnitureExpired(s.pose,now)||Math.hypot(peer.pose.x-d.x,peer.pose.z-d.z)>5){peer.furniture=null;return null;}
 return s.pose;
}
/** Synchronous acquisition is atomic across simultaneous WebSocket messages from different explorers. */
export function useFurniture(peer,peers,garden,uid,now=Date.now()){
 const existing=currentFurniture(peer,garden,now);
 if(uid===null){if(existing&&existing.leavingAt===undefined)existing.leavingAt=now;return {pose:existing};}
 if(existing)return {pose:existing};
 const d=typeof uid==='string'&&garden?.decorations?.find(d=>d.uid===uid),capacity=d&&furnitureCapacity(d.id);
 if(!capacity||peer.planet!=='home'||!peer.active||peer.account.profile.hp<=0||peer.pose.visual?.carriage||peer.pose.visual?.flight||peer.pose.visual?.bat||Math.abs(peer.pose.y??0)>.15||Math.hypot(peer.pose.x-d.x,peer.pose.z-d.z)>(d.id==='deco_cursed_coffin'?3.5:3.3))return {pose:null,error:'Move closer and stand on the ground to use this furniture.'};
 const gardenId=peer.visit??peer.account.id;
 const occupied=new Set([...peers.values()].filter(other=>other!==peer&&other.room===peer.room&&other.furniture?.pose.garden===gardenId&&other.furniture.pose.uid===uid&&currentFurniture(other,garden,now)).map(other=>other.furniture.pose.seat));
 const seat=Array.from({length:capacity},(_,i)=>i).find(i=>!occupied.has(i));
 if(seat===undefined)return {pose:null,error:'This furniture has no free place.'};
 const pose={uid,id:d.id,seat,garden:gardenId,since:now,from:{x:peer.pose.x,z:peer.pose.z}};peer.furniture={pose,x:d.x,z:d.z,rotation:d.rotation};
 return {pose};
}
