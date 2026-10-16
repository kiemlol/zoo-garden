/** Social limits shared by the HUD and server. Daily allowances reset at midnight in Vietnam (UTC+7). */
export const CHAT_LIMIT=200, CHAT_INTERVAL=2000, DAILY_MAIL=10;
export const socialDay=(at=Date.now())=>new Date(at+7*3600000).toISOString().slice(0,10);
export function socialText(raw:unknown):string{
 if(typeof raw!=='string'||[...raw].length>CHAT_LIMIT)throw Object.assign(new Error('Tin nhắn tối đa 200 ký tự.'),{status:400});
 const value=raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
 if(!value)throw Object.assign(new Error('Write a message before sending.'),{status:400});
 // Small whole-word list; preserve ordinary words, punctuation and Vietnamese accents.
 return value.replace(/(^|[^\p{L}\p{N}])(fuck|shit|địt|đụ|lồn|cặc)(?=$|[^\p{L}\p{N}])/giu,(_all,prefix)=>prefix+'***');
}
export interface SocialPlayer {id:string;username?:string;name:string;color:string;level:number;gear:Record<string,string|undefined>;look?:string;likes?:number;stats?:{stars:number;pets:number;worlds:number};online?:boolean;planet?:string}
export interface SocialMessage {type:'chat'|'dm';id:string;name:string;message:string;at:number;to?:string;messageId?:string;planet?:string}
export interface SocialState {blocked:string[];inbox:SocialMessage[];dmLeft:number;day:string;likedToday?:string}
