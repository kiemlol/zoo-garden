import {randomUUID} from 'node:crypto';
import {commandHash} from './action-service.mjs';
import {DAILY_MAIL,socialDay,socialText} from '../src/social-rules.ts';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const data=account=>account.social??={likes:0,blocked:[],inbox:[]};
export const likesOf=account=>Math.max(0,Number(account.social?.likes)||0);
export const blocks=(a,b)=>!!a?.social?.blocked?.includes(b?.id);
export function socialState(account,now=Date.now()){
 const s=account.social??{};
 const legacy=(account.visitLog??[]).filter(e=>e.kind==='message'&&typeof e.text==='string').map(e=>({type:'dm',id:e.by,to:account.id,name:e.name,message:e.text,at:e.at,messageId:`legacy:${e.by}:${e.at}`}));
 return {blocked:s.blocked??[],inbox:[...legacy,...(s.inbox??[])].slice(-100).filter(m=>!s.blocked?.includes(m.id===account.id?m.to:m.id)),dmLeft:Math.max(0,DAILY_MAIL-(s.mailDay===socialDay(now)?s.mailCount??0:0)),day:socialDay(now),likedToday:s.likeDay===socialDay(now)?s.likeTarget:undefined};
}
/** Account metadata is committed with locks on both people; game-profile revisions stay unchanged. */
export function createPlayerSocial({store,accounts,remember,now=()=>Date.now()}){
 async function transact(actorId,targetId,type,run,checkAccess){
  for(let attempt=0;;attempt++)try{
   const current=await store.get(actorId);if(!current)fail(404,'Không tìm thấy người chơi.');
   const out=await store.command({actorId,relatedIds:targetId?[targetId]:[],requestId:randomUUID(),hash:commandHash({type,actorId,targetId}),expectedRevision:current.profileRevision||0,actionType:type,keepRevision:true,receipt:false,outbox:false,checkAccess,
    run:records=>{checkAccess?.();const actor=records.get(actorId),target=targetId?records.get(targetId):null;if(targetId&&!target)fail(404,'Không tìm thấy người chơi.');return run(actor,target);}});
   out.accounts.forEach(remember);return out.reply.result;
  }catch(error){if(error.status!==409||attempt>=2||!error.message.includes('newer adventure'))throw error;}
 }
 return {
  async like(actorId,targetId,checkAccess){
   if(actorId===targetId)fail(403,'Không thể tự thích mình.');
   return transact(actorId,targetId,'playerLike',(actor,target)=>{const a=data(actor),b=data(target),day=socialDay(now());if(a.likeDay===day)fail(409,'Bạn đã dùng lượt thích hôm nay.');if(blocks(actor,target)||blocks(target,actor))fail(403,'Người chơi này đang bị chặn.');a.likeDay=day;a.likeTarget=targetId;b.likes=likesOf(target)+1;return {id:targetId,likes:b.likes};},checkAccess);
  },
  async block(actorId,targetId,blocked,checkAccess){
   if(actorId===targetId)fail(403,'Không thể chặn chính mình.');
   return transact(actorId,targetId,'playerBlock',(actor)=>{const a=data(actor);a.blocked=[...new Set(a.blocked??[])].filter(id=>id!==targetId);if(blocked){if(a.blocked.length>=500)fail(409,'Danh sách chặn đã đầy.');a.blocked.push(targetId);}return socialState(actor,now());},checkAccess);
  },
  async dm(actorId,targetId,raw,requestId,checkAccess){
   const message=socialText(raw);
   return transact(actorId,targetId,'playerMail',(actor,target)=>{
    if(actorId===targetId||!actor.friends.includes(targetId)||!target.friends.includes(actorId))fail(403,'Chỉ có thể gửi thư cho bạn bè.');
    if(blocks(actor,target)||blocks(target,actor))fail(403,'Không thể gửi thư cho người chơi đã chặn.');
    const a=data(actor),b=data(target),prior=(a.inbox??[]).find(m=>m.messageId===requestId&&m.id===actorId);
    if(prior){if(prior.to!==targetId||prior.message!==message)fail(409,'Mã thư này đã được sử dụng.');return {entry:prior,replayed:true,...socialState(actor,now())};}
    const day=socialDay(now());if(a.mailDay!==day){a.mailDay=day;a.mailCount=0;}if((a.mailCount??0)>=DAILY_MAIL)fail(429,'Đã hết 10 thư miễn phí hôm nay. Lượt mới lúc 0h.');
    a.mailCount=(a.mailCount??0)+1;
    const entry={type:'dm',id:actorId,to:targetId,name:actor.profile.name,message,at:now(),messageId:requestId};
    a.inbox=[...(a.inbox??[]),entry].slice(-100);b.inbox=[...(b.inbox??[]),entry].slice(-100);
    return {entry,replayed:false,...socialState(actor,now())};
   },checkAccess);
  }
 };
}
