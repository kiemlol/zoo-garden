import type {GameBridge} from './game-bridge.ts';
import {ITEMS} from './content.ts';
import {t} from './i18n.ts';
import type {SaveState} from './model.ts';
import type {LookId} from './looks.ts';
import {DEFAULT_LOOK} from './looks.ts';
import {MirrorPreview,restPose} from './mirror-preview.ts';
import {weaponKit,wearKit,petKit,disguiseKit,heroKit} from './assets.ts';
import {CHAT_LIMIT,DAILY_MAIL,socialDay,type SocialPlayer,type SocialMessage,type SocialState} from './social-rules.ts';
import './chat-ui.css';
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
const button=(label:string,run:()=>void,cls='')=>{const n=node('button',cls,label);n.type='button';n.addEventListener('click',run);return n;};
interface Hooks {game:GameBridge;send:(m:Record<string,unknown>)=>boolean;api:<T>(route:string,value?:unknown)=>Promise<T>;friend:(id:string)=>boolean;friendAction:(action:string,id:string)=>Promise<void>;player:(id:string)=>SocialPlayer|undefined;notice:(s:string)=>void}
interface Pending {id:string;type:'chat'|'dm';text:string;to?:string;planet:string;waiting:boolean;timer?:number}
/** One HUD, one composer and one private-mail view; all network authority stays on the server. */
export class PlayerChat {
 readonly root=node('section','player-social');
 readonly toggle=node('button','icon-button player-chat-toggle','💬');
 private invite=node('aside','player-play-invite');private bar=node('div','player-chat-bar');private latest=node('button','player-chat-latest','Chạm để trò chuyện…');
 private composer=node('section','player-chat-composer');private history=node('div','player-chat-history');
 private input=node('input','player-chat-input');private chatSend!:HTMLButtonElement;
 private card=node('section','player-mini-card');private profile=node('section','player-profile');private mail=node('section','player-mail');
 private mailInput=node('textarea','player-mail-input');private mailCount=node('span','player-mail-count');private mailQuota=node('span','player-mail-quota');private mailSend!:HTMLButtonElement;
 private mailTitle=node('h3');private mailLog=node('div','player-mail-log');private mailAvatar=node('div','player-social-avatar');
 private self:SocialPlayer|null=null;private connected=false;private planet='';private unread=0;private unreadChat=0;private unreadMail=new Map<string,string>();
 private state:SocialState={blocked:[],inbox:[],dmLeft:DAILY_MAIL,day:socialDay()};private messages:SocialMessage[]=[];
 private selected:SocialPlayer|null=null;private recipient:SocialPlayer|null=null;private detail=false;
 private miniPreview=new MirrorPreview({width:140,height:140});private fullPreview=new MirrorPreview({width:420,height:460});private mailPreview=new MirrorPreview({width:90,height:90});
 private pending:Pending|null=null;private lastSent=0;private profileClock=0;private serial=0;private frameClock=0;
 private resizeTimers:number[]=[];private draftMail=new Map<string,string>();
 constructor(private h:Hooks){
  this.root.hidden=true;this.toggle.id='chat-button';this.toggle.type='button';this.toggle.title='Tin nhắn';this.toggle.setAttribute('aria-label','Tin nhắn');
  this.toggle.addEventListener('click',()=>this.openChat());const slot=document.querySelector('#social-slot');(slot??document.body).append(this.toggle);this.toggle.classList.add('social-inline-toggle');
  this.latest.type='button';this.latest.addEventListener('click',()=>this.openChat());this.bar.append(button('💬 Thường',()=>this.openChat(),'player-channel'),this.latest,button('▴',()=>this.openChat(),'player-chat-expand'));this.root.append(this.bar);
  const title=node('header','','💬 Thường');title.append(button('✕',()=>this.closeComposer(),'player-social-close'));this.history.setAttribute('role','log');this.history.setAttribute('aria-label','Lịch sử chat Thường');
  const form=node('form','player-chat-form');this.input.maxLength=CHAT_LIMIT;this.input.placeholder='Nhập tin nhắn…';this.input.setAttribute('aria-label','Tin nhắn Thường');
  this.input.addEventListener('focus',()=>this.stopMovement());this.input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();this.submit('chat');}});this.chatSend=node('button','player-chat-send','✓');this.chatSend.type='submit';this.chatSend.setAttribute('aria-label','Gửi tin nhắn');
  form.append(this.input,button('×',()=>{this.input.value='';this.input.focus();},'player-chat-clear'),this.chatSend,button('✕',()=>this.closeComposer(),'player-chat-cancel'));
  form.addEventListener('submit',e=>{e.preventDefault();this.submit('chat');});this.composer.append(title,this.history,form);this.invite.hidden=true;this.root.append(this.composer,this.card,this.profile,this.mail,this.invite);document.body.append(this.root);
  for(const p of [this.composer,this.card,this.profile,this.mail]){p.hidden=true;p.dataset.playerPanel='';p.addEventListener('pointerdown',e=>e.stopPropagation());p.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();if(!this.mail.hidden)this.closeMail();else if(!this.profile.hidden||!this.card.hidden)this.closePlayer();else this.closeComposer();}});}
  this.mail.setAttribute('role','dialog');this.mail.setAttribute('aria-label','Thư riêng');this.card.setAttribute('role','dialog');this.card.setAttribute('aria-label','Thông tin người chơi');this.profile.setAttribute('role','dialog');this.profile.setAttribute('aria-label','Hồ sơ người chơi');
  const mailHead=node('header','player-mail-head');mailHead.append(this.mailAvatar,this.mailTitle,button('✕',()=>this.closeMail(),'player-social-close'),this.mailCount);
  this.mailInput.maxLength=CHAT_LIMIT;this.mailInput.placeholder='Vui lòng nhập nội dung.';this.mailInput.setAttribute('aria-label','Nội dung thư riêng');this.mailInput.addEventListener('input',()=>this.refreshMail());this.mailInput.addEventListener('focus',()=>this.stopMovement());
  this.mailInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();this.submit('dm');}});
  const mailForm=node('form','player-mail-form'),mailBody=node('div','player-mail-body'),mailButtons=node('footer');this.mailSend=node('button','player-mail-send','Gửi');this.mailSend.type='submit';const sendWrap=node('div','player-mail-send-wrap');sendWrap.append(this.mailQuota,this.mailSend);
  mailButtons.append(button('🎁 Quà tặng',()=>this.h.notice('Quà tặng trong thư sẽ có sau.'),'player-mail-extra'),button('🖌 Chủ đề',()=>this.h.notice('Chủ đề thư sẽ có sau.'),'player-mail-extra'),sendWrap);
  mailBody.append(this.mailInput,node('span','player-mail-pencil','✎'));mailForm.append(mailBody,mailButtons);mailForm.addEventListener('submit',e=>{e.preventDefault();this.submit('dm');});this.mail.append(mailHead,this.mailLog,mailForm);
  const resize=()=>this.scheduleLayout();for(const type of ['resize','orientationchange','gameviewportresize'])window.addEventListener(type,resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
  const observer=new ResizeObserver(resize);document.querySelectorAll('#hud .skills,#hud .movement-joystick,#hud .move-pad,#hud .home-button').forEach(el=>observer.observe(el));
  h.game.onFrame(dt=>{this.frameClock+=dt;if(this.frameClock<.2)return;this.frameClock=0;this.root.hidden=!this.self||!!document.querySelector('#hud[hidden]');this.toggle.hidden=!this.self;this.refreshAvailability();if(this.state.day!==socialDay()){this.state.day=socialDay();this.state.dmLeft=DAILY_MAIL;delete this.state.likedToday;this.refreshMail();if(this.selected)this.renderPlayer();}this.profileClock+=.2;if(this.selected&&this.profileClock>=1){this.profileClock=0;const fresh=this.h.player(this.selected.id);if(fresh&&JSON.stringify([fresh.gear,fresh.look,fresh.color])!==JSON.stringify([this.selected.gear,this.selected.look,this.selected.color])){this.selected={...this.selected,...fresh};this.renderPlayer();}this.drawPreviews();}});
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&!e.repeat&&this.self&&!(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')&&!document.querySelector('dialog[open],#dialog-layer:not([hidden]),[data-player-panel]:not([hidden])')){e.preventDefault();this.openChat();}});
  this.toggle.hidden=true;this.layout();
 }
 private stopMovement(){const w=this.h.game.getWorld();w.keys.clear();w.joystickInput=null;w.destination=null;w.route=[];w.moving=false;}
 session(account:SocialPlayer|null,state?:SocialState){const changed=this.self?.id!==account?.id;this.self=account;this.root.hidden=!account;this.toggle.hidden=!account;if(changed){this.invite.hidden=true;this.unread=0;this.unreadChat=0;this.unreadMail.clear();this.messages=[];this.clearPending();this.input.value='';this.draftMail.clear();this.closeComposer();this.closePlayer();this.closeMail();this.h.game.clearPlayerSpeech?.();this.state={blocked:[],inbox:[],dmLeft:DAILY_MAIL,day:socialDay()};}if(state)this.setState(state);this.badge();}
 setState(state:SocialState){this.state=state;this.unreadMail.clear();for(const m of state.inbox)if(this.self&&m.to===this.self.id&&!state.blocked.includes(m.id)){let read=0;try{read=Number(localStorage.getItem(`zoo-mail-read-${this.self.id}-${m.id}`)||0);}catch{}if(m.at>read)this.unreadMail.set(m.messageId??m.id+':'+m.at,m.id);}this.badge();this.refreshMail();this.drawHistory();}
 private readMail(id:string){for(const [key,sender]of this.unreadMail)if(sender===id)this.unreadMail.delete(key);const at=Math.max(Date.now(),...this.state.inbox.filter(m=>m.id===id).map(m=>m.at));try{localStorage.setItem(`zoo-mail-read-${this.self?.id}-${id}`,String(at));}catch{}this.badge();}

 online(ready:boolean){this.connected=ready;if(!ready)this.h.game.clearPlayerSpeech?.();if(!ready&&this.pending){this.pending.waiting=false;if(this.pending.timer)clearTimeout(this.pending.timer);}this.refreshAvailability();}
 enterPlanet(planet:string){if(this.planet&&this.planet!==planet){this.messages=[];this.input.value='';if(this.pending?.type==='chat')this.clearPending();this.h.game.clearPlayerSpeech?.();this.drawHistory();}this.planet=planet;}
 private clearPending(){if(this.pending?.timer)clearTimeout(this.pending.timer);this.pending=null;this.refreshAvailability();}
 receive(m:any):boolean{
  if(m.type==='chat'||m.type==='dm'){
   if(!this.self||typeof m.message!=='string'||typeof m.id!=='string'||this.state.blocked.includes(m.id))return true;
   if(m.type==='chat'&&m.planet&&m.planet!==this.planet)return true;
   const entry=m as SocialMessage;
   if(m.type==='chat'){this.messages.push(entry);this.messages=this.messages.slice(-60);this.h.game.sayPlayer?.(m.id,m.message,m.id===this.self.id);this.drawHistory();}
   else{if(!this.state.inbox.some(old=>old.messageId===m.messageId))this.state.inbox=[...this.state.inbox,entry].slice(-100);this.refreshMail();this.drawHistory();}
   if(m.id!==this.self.id){if(m.type==='chat'&&this.composer.hidden)this.unreadChat++;if(m.type==='dm'){if(!this.mail.hidden&&this.recipient?.id===m.id)this.readMail(m.id);else this.unreadMail.set(m.messageId??m.id+':'+m.at,m.id);}this.badge();}return true;
  }
  if(m.type==='chatAck'||m.type==='dmAck'){
   if(m.type==='dmAck'&&Number.isFinite(m.dmLeft)){this.state.dmLeft=m.dmLeft;this.state.day=m.day??socialDay();}
   const p=this.pending;if(p&&p.id===m.requestId){if(p.type==='chat'&&this.input.value===p.text)this.input.value='';if(p.type==='dm'){this.draftMail.delete(p.to!);if(this.recipient?.id===p.to&&this.mailInput.value===p.text)this.mailInput.value='';}this.clearPending();}this.refreshMail();return true;
  }
  if(m.type==='error'&&this.pending&&this.pending.id===m.requestId){this.pending.waiting=false;if(this.pending.timer)clearTimeout(this.pending.timer);this.refreshAvailability();this.h.notice(m.message);return true;}
  if(m.type==='playerLikes'){if(this.selected&&this.selected.id===m.id){this.selected.likes=m.likes;this.renderPlayer();}return true;}
  if(m.type==='playInvite'){if(!this.state.blocked.includes(m.player?.id)){this.invite.replaceChildren(node('span','',`${m.player.name} mời bạn chơi cùng tại ${m.planet}.`),button('Xem lời mời',()=>{this.invite.hidden=true;void this.openPlayer(m.player.id);}),button('✕',()=>{this.invite.hidden=true;}));this.invite.hidden=false;}return true;}return false;
 }
 private submit(type:'chat'|'dm'){
  const input=type==='chat'?this.input:this.mailInput,text=input.value.trim(),to=type==='dm'?this.recipient?.id:undefined;
  if(!this.self||!this.connected){this.h.notice('Chat đang kết nối lại. Nội dung đang gõ được giữ.');return;}
  if(this.pending?.waiting||!text)return;if([...text].length>CHAT_LIMIT){this.h.notice('Tin nhắn tối đa 200 ký tự.');return;}
  if(type==='dm'&&(!to||!this.h.friend(to))){this.h.notice('Chỉ có thể gửi thư cho bạn bè.');return;}
  if(type==='dm'&&this.remaining()<=0){this.h.notice('Đã hết 10 thư miễn phí hôm nay. Lượt mới lúc 0h.');return;}
  if(Date.now()-this.lastSent<2000){this.h.notice('Vui lòng đợi 2 giây giữa hai tin nhắn.');return;}
  const old=this.pending,id=old&&old.text===text&&old.type===type&&old.to===to&&old.planet===this.planet?old.id:crypto.randomUUID();
  this.clearPending();const p:Pending={id,type,text,to,planet:this.planet,waiting:true};this.pending=p;
  if(!this.h.send(type==='chat'?{type,message:text,requestId:id}:{type,to,text,requestId:id})){p.waiting=false;this.h.notice('Chat đang kết nối lại. Nội dung đang gõ được giữ.');}
  else {this.lastSent=Date.now();p.timer=window.setTimeout(()=>{if(this.pending===p){p.waiting=false;this.refreshAvailability();this.h.notice('Chưa xác nhận gửi. Nội dung được giữ để thử lại.');}},10000);}this.refreshAvailability();
 }
 private badge(){this.unread=this.unreadChat+this.unreadMail.size;this.toggle.dataset.badge=this.unread?String(Math.min(99,this.unread)):'';this.toggle.setAttribute('aria-label',`Tin nhắn${this.unread?', '+this.unread+' chưa đọc':''}`);}
 openChat(){this.closeMail();if(!this.self){this.h.notice('Hãy đăng nhập online để trò chuyện.');return;}this.closePlayer();this.composer.hidden=false;this.unreadChat=0;this.badge();this.drawHistory();this.scheduleLayout();this.input.focus();this.stopMovement();}
 private closeComposer(){this.composer.hidden=true;this.input.blur();}
 private drawHistory(){const entries=this.messages.filter(m=>!this.state.blocked.includes(m.id));this.history.replaceChildren(...entries.map(m=>{const row=node('p');row.append(button(m.name,()=>{if(m.id!==this.self?.id)this.openPlayer(m.id);},'player-chat-name'),document.createTextNode(' : '+m.message));return row;}));const partners=new Map<string,SocialMessage>();for(const m of this.state.inbox){const id=m.id===this.self?.id?m.to:m.id;if(id&&!this.state.blocked.includes(id))partners.set(id,m);}for(const [id,m]of partners){const person=this.h.player(id)??{id,name:m.name,color:'#ffffff',level:1,gear:{}};this.history.append(button('✉ '+person.name+' : '+m.message,()=>this.openMail(person),'player-mail-thread'));}this.history.scrollTop=this.history.scrollHeight;const last=entries.at(-1);this.latest.replaceChildren();if(last)this.latest.append(node('strong','',last.name),document.createTextNode(' : '+last.message));else this.latest.textContent='Chạm để trò chuyện…';}
 async openPlayer(id:string,full=false){if(!this.self||id===this.self.id)return;const generation=++this.serial;this.closeComposer();this.selected=this.h.player(id)??{id,name:'Đang tải…',color:'#ffffff',level:1,gear:{}};this.detail=full;this.renderPlayer();this.stopMovement();try{const result=await this.h.api<{player:SocialPlayer}>('social/profile/'+encodeURIComponent(id));if(this.serial===generation&&this.selected?.id===id){this.selected=result.player;this.renderPlayer();}}catch(e){if(this.serial===generation)this.h.notice((e as Error).message);}}
 private closePlayer(){this.serial++;this.selected=null;this.card.hidden=true;this.profile.hidden=true;}
 private renderPlayer(){const p=this.selected;if(!p)return;this.card.hidden=this.detail;this.profile.hidden=!this.detail;const panel=this.detail?this.profile:this.card;panel.replaceChildren();
  const header=node('header');header.append(button(p.name,()=>{this.detail=true;this.renderPlayer();},'player-social-name'),button('✕',()=>this.closePlayer(),'player-social-close'));panel.append(header);
  const avatar=node('div','player-social-avatar'),avatarWrap=node('div','player-avatar-wrap'),level=node('span','player-level',String(p.level)),heart=button('♥ +1',()=>void this.like(),'player-like');heart.disabled=this.state.day===socialDay()&&this.state.likedToday!==undefined;avatarWrap.append(avatar,level,heart);panel.append(avatarWrap,node('p','player-likes',`♥ ${p.likes??0}`));
  if(this.detail){
   const counts=node('p','player-profile-stats',`⭐ ${p.stats?.stars??0}   🐾 ${p.stats?.pets??0}   🌎 ${p.stats?.worlds??0}`);counts.title='Boss đã đánh bại · Thú cưng đã sưu tập · Hành tinh đã khám phá';panel.append(counts,node('p','player-handle','@'+(p.username??p.name)));
   const preview=node('div','player-full-preview');panel.append(preview);const worn=node('p','player-worn-summary');worn.textContent=Object.values(p.gear).filter(Boolean).map(id=>t(ITEMS[id!]?.name??'Trang bị')).join(' · ');panel.append(worn);
  }
  const main=node('div','player-primary-actions');main.append(button('Nhóm chơi',()=>void this.action('social/invite','Đã gửi lời mời chơi cùng.'),'player-invite'),button(this.h.friend(p.id)?'✓ Bạn bè':'Thêm bạn',()=>void this.h.friendAction('request',p.id).then(()=>this.renderPlayer()),'player-add'));(main.lastChild as HTMLButtonElement).disabled=this.h.friend(p.id);panel.append(main);
  const actions=node('div','player-small-actions');actions.append(button('🍎 Quà',()=>this.h.notice('Hãy dùng Gửi quà trong danh sách bạn bè.')),button('✉ Thư',()=>this.openMail(p)),button(this.state.blocked.includes(p.id)?'⊘ Bỏ chặn':'⊘ Chặn',()=>void this.block()),button('♟ BÁO CÁO',()=>void this.action('social/report','Đã gửi báo cáo.')));panel.append(actions);
  if(this.detail){const footer=node('footer','player-profile-footer');footer.append(button(this.h.friend(p.id)?'Xóa bạn':'Thêm bạn',()=>void this.h.friendAction(this.h.friend(p.id)?'remove':'request',p.id).then(()=>this.renderPlayer())),button('✉ Thư',()=>this.openMail(p)),button('☆',()=>{try{const key=`zoo-favourite-${this.self!.id}-${p.id}`;localStorage.getItem(key)?localStorage.removeItem(key):localStorage.setItem(key,'1');this.renderPlayer();}catch{}},'player-favourite'));panel.append(footer);try{panel.querySelector('.player-favourite')!.textContent=localStorage.getItem(`zoo-favourite-${this.self!.id}-${p.id}`)?'★':'☆';}catch{}}
  else panel.append(button('Xem hồ sơ đầy đủ',()=>{this.detail=true;this.renderPlayer();},'player-full-link'));
  this.drawPreviews();this.scheduleLayout();
 }
 private async action(route:string,message:string){if(!this.selected)return;try{await this.h.api(route,{id:this.selected.id});this.h.notice(message);}catch(e){this.h.notice((e as Error).message);}}
 private async like(){if(!this.selected)return;const id=this.selected.id;try{const result=await this.h.api<{likes:number;social:SocialState}>('social/like',{id});this.state=result.social;if(this.selected?.id===id)this.selected.likes=result.likes;this.renderPlayer();}catch(e){this.h.notice((e as Error).message);}}
 private async block(){if(!this.selected)return;const id=this.selected.id;try{this.state=await this.h.api<SocialState>('social/block',{id,blocked:!this.state.blocked.includes(id)});this.setState(this.state);this.messages=this.messages.filter(m=>!this.state.blocked.includes(m.id));this.h.game.clearPlayerSpeech?.(id);this.renderPlayer();this.drawHistory();}catch(e){this.h.notice((e as Error).message);}}
 openMail(p:SocialPlayer){if(!this.h.friend(p.id)){this.h.notice('Chỉ có thể gửi thư cho bạn bè.');return;}if(this.recipient)this.draftMail.set(this.recipient.id,this.mailInput.value);this.recipient=p;this.mailTitle.textContent=p.name;this.mailInput.value=this.draftMail.get(p.id)??'';this.mail.hidden=false;this.profile.classList.add('mail-behind');this.card.classList.add('mail-behind');this.readMail(p.id);this.refreshMail();this.drawPreviews();this.scheduleLayout();this.mailInput.focus();this.stopMovement();}
 private closeMail(){if(this.recipient)this.draftMail.set(this.recipient.id,this.mailInput.value);this.mail.hidden=true;this.mailInput.blur();this.profile.classList.remove('mail-behind');this.card.classList.remove('mail-behind');this.scheduleLayout();}
 private remaining(){return this.state.day===socialDay()?this.state.dmLeft:DAILY_MAIL;}
 private refreshMail(){this.mailCount.textContent=`${[...this.mailInput.value].length}/${CHAT_LIMIT}`;this.mailQuota.textContent=`Miễn phí ${this.remaining()}/${DAILY_MAIL}`;this.refreshAvailability();if(!this.recipient)return;const id=this.recipient.id;this.mailLog.replaceChildren(...this.state.inbox.filter(m=>(m.id===id||m.to===id)&&!this.state.blocked.includes(m.id===this.self?.id?m.to??'':m.id)).slice(-12).map(m=>node('p',m.id===this.self?.id?'mail-self':'',`${m.name}: ${m.message}`)));this.mailLog.scrollTop=this.mailLog.scrollHeight;}
 private refreshAvailability(){if(this.chatSend)this.chatSend.disabled=!this.connected||!!this.pending?.waiting;if(this.mailSend)this.mailSend.disabled=!this.connected||!!this.pending?.waiting||this.remaining()<=0||!!this.recipient&&!this.h.friend(this.recipient.id);}
 private drawPreviews(){const w=this.h.game.getWorld(),p=this.selected;
  const draw=(preview:MirrorPreview,slot:HTMLElement|null,person:SocialPlayer)=>{const gear=person.gear as SaveState['gear'],look=(person.look??DEFAULT_LOOK) as LookId,key=JSON.stringify([person.color,gear,look,w.equipmentArt(gear,look),weaponKit.ready,wearKit.ready,petKit.ready,disguiseKit.ready,heroKit.ready]);preview.show(slot,key,()=>restPose(w.lookAvatar(person.color,gear,look)));};
  if(p){if(this.detail){draw(this.miniPreview,this.profile.querySelector('.player-social-avatar'),p);draw(this.fullPreview,this.profile.querySelector('.player-full-preview'),p);}else draw(this.miniPreview,this.card.querySelector('.player-social-avatar'),p);}if(!this.mail.hidden&&this.recipient)draw(this.mailPreview,this.mailAvatar,this.recipient);
 }
 private scheduleLayout(){this.resizeTimers.forEach(clearTimeout);this.resizeTimers=[0,100,300,600].map(ms=>window.setTimeout(()=>this.layout(),ms));}
 /** Measure after rotation and keyboard settling; reserve both thumb controls in either handedness. */
 private layout(){const visual=window.visualViewport,left=(visual?.offsetLeft??0)+10,top=(visual?.offsetTop??0)+10,width=(visual?.width??innerWidth)-20,bottom=(visual?.offsetTop??0)+(visual?.height??innerHeight)-10;
  const controls=Array.from(document.querySelectorAll<HTMLElement>('#hud .movement-joystick,#hud .skills,#hud .move-pad,#hud .home-button')).filter(el=>!el.hidden&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.top>top);
  let floor=bottom,x=left,w=width;const low=controls.filter(r=>r.bottom>bottom-250);
  if(width>650){const middle=left+width/2,l=Math.max(left,...low.filter(r=>r.left<middle).map(r=>r.right+12)),r=Math.min(left+width,...low.filter(r=>r.left>=middle).map(r=>r.left-12));if(r-l>=280){x=l;w=r-l;}else floor=Math.min(bottom,...low.map(r=>r.top-12));}
  else if(low.length)floor=Math.min(bottom,...low.map(r=>r.top-12));
  const h=Math.max(60,floor-top);for(const [key,value]of Object.entries({'--chat-x':x,'--chat-top':top,'--chat-w':w,'--chat-h':h,'--chat-floor':floor}))this.root.style.setProperty(key,value+'px');
 }
}
