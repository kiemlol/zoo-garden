import type {FurniturePose} from './furniture-rules.ts';
import {PlayerChat} from './chat-ui.ts';
import type {SocialState,SocialPlayer} from './social-rules.ts';
import type { GameBridge, NetworkDrop } from './game-bridge.ts';
import { newGame, cropProgress, ITEMS, PLANETS, type SaveState, type PlanetId, type Difficulty } from './model.ts';
import type { LookId } from './looks.ts';
import './online.css';
import { t, onLanguageChange, getLanguage, switchLanguage } from './i18n.ts';
import {gameplayKey} from './gameplay-controls.ts';
import type {GameIntent,ActionReply} from './actions.ts';

interface GuestEntry { at:number;by:string;name:string;kind:'visit'|'water'|'gift'|'steal'|'message';what?:string;count?:number;text?:string }
interface Explorer { id:string;username?:string;name:string;color:string;level:number;gear:SaveState['gear'];look?:LookId;online?:boolean;x?:number;z?:number;y?:number;facing?:number;moving?:boolean;space?:string;planet?:string;difficulty?:string;likes?:number;stats?:SocialPlayer['stats'] }
interface Home extends Explorer { yardLayout?:SaveState['yardLayout']; discovered?:PlanetId[]; plots:SaveState['plots'];farm?:SaveState['farm'];placed?:unknown[];decorations?:unknown[];helper?:unknown;friends?:unknown[] }
interface EnemyState { id:string;x:number;z:number;hp:number;maxHp:number;[key:string]:unknown }
interface NetworkWorld {
  furnitureGarden:string;requestFurniture?: (uid:string|null)=>Promise<FurniturePose|null>;furniture?:{cancel(notify?:boolean):void;reconcile(p:FurniturePose|null):void};
  updateRemotePlayers(players:Explorer[]):void;clearRemotePlayers():void;
  setNetworkRole(role:'host'|'peer'|null):void;
  /** The host's difficulty while someone else hosts the room (creature scale, the Settings note); null otherwise. */
  roomDifficulty:Difficulty|null;
  enemySnapshots():EnemyState[];applyEnemySnapshots(enemies:EnemyState[]):void;
  environmentSnapshot():{time:number;lamps:[number,number][]};applyEnvironmentSnapshot(snapshot:{time:number;lamps:[number,number][]}):void;
  onRemoteDamage:(id:string,amount:number,source?:string,enemyId?:string)=>void;
  onEnvironmentAction:(action:{kind:'light-pillar'|'collect-ore';id:string;index?:number})=>void;
  applyEnvironmentAction(action:{kind:'light-pillar'|'collect-ore';id:string;index?:number}):{ok:boolean;rewards?:{id:string;count:number}[]};
  grantEnvironmentReward(eventId:string,rewards:{id:string;count:number}[]):unknown;
}
interface Session { authorityVersion?:number;account:Explorer|null;profile?:SaveState;revision?:number;friends?:Explorer[];requests?:Explorer[];social?:SocialState }
interface ActionJob extends GameIntent {requestId:string;expectedRevision:number;rulesVersion:1;submitted?:boolean;retries?:number}
const el = <K extends keyof HTMLElementTagNameMap>(tag:K,className='',text='') => {const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};
// Header of the native panels as in the bottom-sheet panels: icon tile, kicker, title. Kept local so each file loads standalone.
const headerParts = (icon: string, kicker: string, heading: HTMLElement) => { const tile = el('span', 'social-icon', icon); tile.setAttribute('aria-hidden', 'true'); const text = el('div', 'social-title'); text.append(el('span', 'social-kicker eyebrow', t(kicker)), heading); return [tile, text]; };
const button=(label:string,action:()=>void,className='')=>{const node=el('button',className,t(label));node.type='button';node.addEventListener('click',action);return node;};

function initSoloEdition() {
  const dialog=el('dialog','social-dialog');dialog.id='online-dialog';
  const close=button('✕',()=>dialog.close(),'social-close');
  const header=el('header','social-header'),heading=el('h2');header.append(...headerParts('🌱','JUST YOU AND YOUR GARDEN',heading),close);dialog.addEventListener('keydown', event => { if (event.key === 'Escape' && dialog.open) { event.preventDefault(); dialog.close(); } });
  const content=el('div','social-content'),intro=el('p','social-intro'),details=el('p','social-small'),keepPlaying=button('Keep playing',()=>dialog.close(),'social-primary');
  content.append(intro,details,keepPlaying);dialog.append(header,content);document.body.append(dialog);
  const slot=document.querySelector('#social-slot');
  const toggle=button('🌱',()=>dialog.showModal(),'social-toggle');toggle.id='online-button';toggle.dataset.staticHost='true';
  if(slot){slot.append(toggle);toggle.classList.add('social-inline-toggle');}else document.body.append(toggle);
  const refresh=()=>{
    dialog.setAttribute('aria-label',t('Solo adventure'));close.setAttribute('aria-label',t('Close solo information'));
    heading.textContent=t('Solo adventure');intro.textContent=t('Explore, grow your garden, and complete every adventure on your own. Your progress saves in this browser.');
    details.textContent=t('This GitHub Pages edition plays solo. Accounts, friends, and shared worlds are available in the multiplayer edition.');
    keepPlaying.textContent=t('Keep playing');toggle.textContent=slot?'🌱':`🌱 ${t('Solo adventure')}`;toggle.title=t('Solo adventure');toggle.setAttribute('aria-label',t('About this solo adventure'));
  };
  refresh();onLanguageChange(refresh);
  // If this edition was built with the address of a multiplayer server (VITE_ONLINE_URL), the title screen's "Play online" link shows only while that server answers; otherwise it stays hidden and nothing says "multiplayer".
  const server=String(import.meta.env.VITE_ONLINE_URL||'').replace(/\/+$/,''),link=document.querySelector<HTMLAnchorElement>('#online-link');
  if(server&&link){
    const check=async()=>{
      const abort=new AbortController(),timer=window.setTimeout(()=>abort.abort(),4000);
      try{const reply=await fetch(`${server}/api/health`,{headers:{'ngrok-skip-browser-warning':'1'},cache:'no-store',signal:abort.signal}),info=await reply.json();
        link.hidden=!(reply.ok&&info?.ok);if(!link.hidden)link.textContent=`🌐 ${t('Play online with friends')}${Number.isFinite(info.online)&&info.online>0?` · ${t('{n} online',{n:info.online})}`:''} →`;}
      catch{link.hidden=true;}finally{clearTimeout(timer);}
    };
    void check();window.setInterval(()=>{if(!document.hidden)void check();},60_000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  }
}

export function initOnline(game:GameBridge) {
  // Static hosting has no account API or WebSocket server. Leave local saves intact.
  if(import.meta.env.VITE_STATIC_HOST==='true'){initSoloEdition();return;}
  const serviceBase=import.meta.env.BASE_URL;
  let account:Explorer|null=null,friends:Explorer[]=[],requests:Explorer[]=[],sent:Explorer[]=[],visitLog:GuestEntry[]=[],unreadLog=0,socket:WebSocket|null=null;
  let host:string|null=null,planet='',visiting:string|null=null,offline:SaveState|null=null,roomEpoch=0;
  let reconnect:number|undefined,saveTimer:number|undefined,saving:Promise<void>|null=null,stopped=false,revision=0,sessionEpoch=0;
  let actionQueue:ActionJob[]=[];const waiting=new Map<string,{resolve:(reply:ActionReply)=>void;reject:(error:Error)=>void}>();
  const pendingSave=()=>actionQueue.length>0;
  let poseClock=0,enemyClock=0,tab:'world'|'friends'|'diary'|'account'='world',register=false,status='Play together',authBusy=false;
  let authSubmit:HTMLButtonElement|null=null;
  let restoring=true;
  const authErrors=new Map<string,string>();
  const title=document.querySelector<HTMLElement>('#title-screen');
  title?.classList.add('account-entry');
  const players=new Map<string,Explorer>(),rewardIds=new Set<string>();
  let chatRoom:string|null=null;
  let sharingLoot=false;
  const toggle=button(`👥 ${t('Play together')}`,()=>{render();dialog.showModal();},'social-toggle');toggle.id='online-button';const socialSlot=document.querySelector('#social-slot');if(socialSlot){socialSlot.append(toggle);toggle.classList.add('social-inline-toggle');}else document.body.append(toggle);toggle.setAttribute('aria-label',t('Play together'));
  const dialog=el('dialog','social-dialog');dialog.id='online-dialog';dialog.setAttribute('aria-label',t('Play together'));document.body.append(dialog);
  const header=el('header','social-header'),heading=el('h2','',t('Play together')),close=button('✕',()=>{if(!authBusy)dialog.close();},'social-close');close.setAttribute('aria-label',t('Close online menu'));header.append(...headerParts('👥','MEET BEYOND THE GATE',heading),close);dialog.addEventListener('keydown', event => { if (event.key === 'Escape' && dialog.open) { event.preventDefault(); if(!authBusy)dialog.close(); } });
  dialog.addEventListener('cancel',event=>{if(authBusy)event.preventDefault();});
  const language=el('select','auth-language');language.setAttribute('aria-label',t('Language'));
  for(const [value,label]of [['en','English'],['vi','Tiếng Việt']]){const option=el('option','',label);option.value=value;language.append(option);}language.value=getLanguage();
  language.addEventListener('change',()=>void switchLanguage(language.value==='vi'?'vi':'en'));header.append(language);
  const tabs=el('nav','social-tabs'),content=el('div','social-content'),notice=el('p','social-notice');notice.setAttribute('role','status');dialog.append(header,tabs,notice,content);
  dialog.addEventListener('close',()=>{if(!account){sessionEpoch++;restoring=false;title?.classList.remove('account-entry');}});
  dialog.addEventListener('click',event=>{if(!authBusy&&event.target===dialog&&event.clientX&&(event.clientX<dialog.getBoundingClientRect().left||event.clientX>dialog.getBoundingClientRect().right))dialog.close();});
  const world=()=>game.getWorld() as ReturnType<GameBridge['getWorld']> & NetworkWorld;
  let noticeSource='',noticeParams:Record<string,string|number>={},saveStatusSource='';
  function setNotice(message:string,params:Record<string,string|number>={}){noticeSource=message;noticeParams=params;notice.textContent=t(message,params);}
  function announce(message:string,params:Record<string,string|number>={}){setNotice(message,params);game.showNotice(t(message,params));}
  function setSaveStatus(message:string){saveStatusSource=message;const label=document.querySelector('#save-status');if(label)label.textContent=t(message);}
  async function api<T>(path:string,data?:unknown,method=data?'POST':'GET'):Promise<T>{
    // A fetch that never reaches the server (offline, DNS, server down) rejects with the browser's own English text ("Failed to fetch",
    // "Load failed"): say it in the game's words instead. No status, so flushSave keeps the action for a retry as before.
    const abort=new AbortController(),timer=path.startsWith('auth/')?window.setTimeout(()=>abort.abort(),15000):undefined;
    let response:Response;try{response=await fetch(`${serviceBase}api/${path}`,{method,signal:abort.signal,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});}catch{throw new Error('Connection interrupted. Please try again.');}finally{if(timer!==undefined)clearTimeout(timer);}
    let value:{error?:string};try{value=await response.json();}catch{throw Object.assign(new Error(response.status>=500?'The game server is having trouble. Please try again shortly.':'Online play needs the game server. Your offline adventure is ready to play.'),{status:response.status});}
    if(!response.ok)throw Object.assign(new Error(response.status>=500?'The game server is having trouble. Please try again shortly.':value.error||'Connection interrupted. Please try again.'),{status:response.status});return value as T;
  }
  const furnitureRequests=new Map<string,(p:FurniturePose|null)=>void>();
  const send=(value:unknown)=>{if(socket?.readyState===WebSocket.OPEN){try{socket.send(JSON.stringify(value));return true;}catch{return false;}}return false;};
  const playerChat=new PlayerChat({game,send,api,friend:id=>friends.some(f=>f.id===id),friendAction:async(action,id)=>{await friendAction(action,id);},player:id=>players.get(id)??friends.find(f=>f.id===id),notice:message=>announce(message)});
  function clearChat(room:string|null=null){chatRoom=room;playerChat.enterPlanet(room??'');playerChat.online(false);}
  function sendRoom(value:{type:string;planet?:string;id?:string}){if(!send(value))return false;if(value.type==='join'&&value.planet!==chatRoom)playerChat.online(false);return true;}
  function messageForm(friendId:string,_box:HTMLElement){const person=players.get(friendId)??friends.find(f=>f.id===friendId);if(person){dialog.close();playerChat.openMail(person);}}
  /** Gifts: pick things from your bag to hand a friend (server: friends only, a daily limit; it lands in their chest). */
  function giftPicker(friendId:string,box:HTMLElement){
    box.replaceChildren(el('h4','',t('Give from your bag')));
    const bag=Object.entries(game.getState().bag).filter(([id,n])=>(n??0)>0&&ITEMS[id]&&!ITEMS[id].penned).sort((a,b)=>(b[1]??0)-(a[1]??0)).slice(0,16);
    if(!bag.length){box.append(el('p','social-small',t('Your bag is empty.')));return;}
    const list=el('div','social-actions');
    for(const [id,n] of bag)list.append(button(`${t(ITEMS[id].name)} ×${n}`,async()=>{try{await queueAction({type:'giftFriend',payload:{ownerId:friendId,item:id,count:1}});announce('Gift sent!');giftPicker(friendId,box);}catch(error){announce((error as Error).message);}}));
    box.append(list);
  }
  function openPlayer(id:string){dialog.close();void playerChat.openPlayer(id);}
  world().onRemotePlayerClick=openPlayer;
  /** One line for the guest diary and for the toast when a friend does something at your home. */
  function guestLine(e:GuestEntry){const what=e.what&&ITEMS[e.what]?t(ITEMS[e.what].name):'';
    return e.kind==='water'?t('{name} watered your {item}!',{name:e.name,item:what}):e.kind==='gift'?t('{name} sent you a gift: {count} {item}',{name:e.name,count:e.count??1,item:what}):e.kind==='steal'?t('{name} picked your {item}!',{name:e.name,item:what}):e.kind==='message'?`${e.name}: ${e.text??''}`:t('{name} is visiting your garden',{name:e.name});}
  const ago=(at:number)=>{const s=Math.max(0,(Date.now()-at)/1000);return s<60?t('just now'):s<3600?t('{n} min ago',{n:Math.floor(s/60)}):s<86400?t('{n} h ago',{n:Math.floor(s/3600)}):t('{n} d ago',{n:Math.floor(s/86400)});};
  function refreshButton(){const label=account?t(status):t('Play together');toggle.textContent=socialSlot?'👥':`👥 ${label}`;toggle.dataset.badge=String(requests.length+unreadLog||'');world().friendIds=new Set(friends.map(f=>f.id));toggle.title=label;toggle.setAttribute('aria-label',t('Play together'));dialog.setAttribute('aria-label',t(account?'Your online world':'Welcome to ZooPet'));close.setAttribute('aria-label',t(account?'Close online menu':'Play offline on this device'));toggle.dataset.online=String(!!account);}
  function expireSession(){
    if(!account)return;game.setDungeonSender?.(null);sessionEpoch++;stopped=true;if(reconnect)clearTimeout(reconnect);if(saveTimer)clearTimeout(saveTimer);
    clearChat();const previous=socket;socket=null;previous?.close();account=null;host=null;visiting=null;players.clear();playerChat.session(null);rejectActions('Your session ended. Pending actions remain on this device.');
    authority(null);world().clearRemotePlayers();game.setVisiting(null);game.setPersistence(null);game.setActionHandler(null);const previousOffline=offline||game.getOfflineState();if(previousOffline)game.applyState(previousOffline);offline=null;
    status='Play together';setSaveStatus('● Offline adventure restored');refreshButton();render();if(!dialog.open)dialog.showModal();announce('Your online session ended. Sign in again to continue; pending online progress is kept on this device.');
  }
  /** Mirrors the host's difficulty into the world (server.mjs presence carries it). */
  function syncRoomDifficulty(){const d=host&&host!==account?.id?players.get(host)?.difficulty:null;world().roomDifficulty=d==='easy'||d==='normal'||d==='hard'?d:null;}
  function renderPlayers(){
    world().furnitureGarden=visiting??account?.id??'local';
    syncRoomDifficulty();
    const local=game.getPresence();
    world().updateRemotePlayers([...players.values()].filter(player=>player.id!==account?.id&&player.planet===local.planet));
  }
  function authority(next:string|null,enemies?:EnemyState[]){
    const becomingHost=next===account?.id&&host!==next;host=next;syncRoomDifficulty();
    if(enemies?.length&&(becomingHost||host!==account?.id))world().applyEnemySnapshots(enemies);
    const role=account&&socket?.readyState===WebSocket.OPEN?(host===account.id?'host':'peer'):null;
    world().setNetworkRole(role);
    if(!role){world().furniture?.cancel(false);world().requestFurniture=account?async()=>null:undefined;for(const resolve of furnitureRequests.values())resolve(null);furnitureRequests.clear();world().localPlayerId=account?.id??'local';world().onRemoteDamage=()=>{};world().onEnvironmentAction=()=>{};game.setNetworkHooks({role:null});return;}
    world().requestFurniture=uid=>new Promise(resolve=>{
      const requestId=crypto.randomUUID();const timer=window.setTimeout(()=>{furnitureRequests.delete(requestId);resolve(null);if(uid!==null)send({type:'furnitureUse',uid:null});},4000);
      furnitureRequests.set(requestId,p=>{clearTimeout(timer);resolve(p);});
      if(!send({type:'furnitureUse',uid,requestId})){clearTimeout(timer);furnitureRequests.delete(requestId);resolve(null);}
    });
    world().localPlayerId=account?.id??'local';
    world().onRemoteDamage=(id,_amount,source,enemyId)=>{if(role==='host'&&enemyId)send({type:'damage',id,source,enemyId});};
    world().onEnvironmentAction=action=>{send({type:'environmentAction',action});};
    game.setNetworkHooks({role,hit:()=>true,status:()=>true,moveTarget:()=>true,reportDamage:(enemyId,source)=>{if(role==='host')send({type:'damage',id:account?.id,source,enemyId});},reportDecoy:(owner,decoy,enemyId,source)=>{if(role==='host')send({type:'damage',id:owner??account?.id,source,enemyId,decoy});},visitCrop:index=>{
      const plot=world().state.plots[index];if(!visiting||!plot?.crop)return;
      // A growing crop is watered (it ripens sooner for the owner); a ripe one can be picked as before.
      if(cropProgress(plot)<1){void queueAction({type:'waterFriend',payload:{ownerId:visiting,index,generation:plot.generation}}).then(reply=>{const r=(reply as {result?:{xp?:number;left?:number}}).result;if(r?.xp)announce('💧 You watered the plant: 10% less remaining growing time. +{xp} XP · {count} waterings left in this garden today.',{xp:r.xp,count:r.left??0});else announce('You watered the plant. It will ripen a little sooner!');}).catch(error=>announce(error.message));return;}
      void queueAction({type:'stealCrop',payload:{ownerId:visiting,index,generation:plot.generation}}).catch(error=>announce(error.message));
    }});
  }

  function rememberActions(){if(!account)return;try{localStorage.setItem(`cute-game-actions-${account.id}`,JSON.stringify(actionQueue));}catch{/* Server receipts also make same-ID retries safe. */}}
  function rejectActions(message:string){for(const waiter of waiting.values())waiter.reject(new Error(message));waiting.clear();actionQueue=[];}
  function queueAction(intent:GameIntent):Promise<ActionReply>{
    if(!account||stopped)return Promise.reject(new Error('Reconnect before changing your online adventure.'));
    const job:ActionJob={...structuredClone(intent),requestId:`r${revision}-${crypto.randomUUID()}`,expectedRevision:revision,rulesVersion:1};actionQueue.push(job);rememberActions();setSaveStatus('◌ Saving online…');
    const answer=new Promise<ActionReply>((resolve,reject)=>waiting.set(job.requestId,{resolve,reject}));void flushSave();return answer;
  }
  async function shareNearbyLoot(){
    if(!account||visiting||sharingLoot)return;sharingLoot=true;const actorId=account.id,epoch=sessionEpoch,room=chatRoom;
    try{
      const result=await api<{drops:NetworkDrop[]}>('drops');if(account?.id!==actorId||sessionEpoch!==epoch||chatRoom!==room||visiting)return;
      const here=game.getPresence(),now=Date.now(),own=(result.drops||[]).filter(drop=>drop.owner===actorId&&drop.room===room&&drop.planet===here.planet&&drop.expiresAt>now&&drop.releaseAt>now&&Math.hypot(drop.x-here.x,drop.z-here.z)<=12);
      if(!own.length){announce('There is no protected loot of yours nearby.');return;}
      let count=0;for(const drop of own){if(account?.id!==actorId||sessionEpoch!==epoch||chatRoom!==room||visiting)return;await queueAction({type:'releaseDrop',payload:{ownerId:drop.ownerId,id:drop.id}});count++;}
      if(account?.id===actorId&&sessionEpoch===epoch)announce('Shared {count} nearby loot drops.',{count});
    }catch(error){if(account?.id===actorId&&sessionEpoch===epoch)announce((error as Error).message);}finally{sharingLoot=false;}
  }
  // Progress reaches the server only as an explicit intent, never a profile snapshot.
  function queueSave(_state:SaveState){if(actionQueue.length)void flushSave();}
  let retryMs=500; // a failed save is retried quickly at first, then backs off to 5 s
  async function flushSave(){
    if(saving)return saving;if(!actionQueue.length||!account||stopped)return;
    const accountId=account.id,epoch=sessionEpoch;
    saving=(async()=>{while(actionQueue.length&&account?.id===accountId&&sessionEpoch===epoch&&!stopped){const job=actionQueue[0];
      try{if(!job.submitted){job.expectedRevision=revision;job.submitted=true;rememberActions();}const {submitted,retries,...body}=job;void submitted;void retries;const reply=await api<ActionReply>('actions',body);if(account?.id!==accountId||sessionEpoch!==epoch)return;
        if(reply.revision>=revision){revision=reply.revision;game.applyAuthoritativeState(reply.profile);}actionQueue.shift();rememberActions();retryMs=500;waiting.get(job.requestId)?.resolve(reply);waiting.delete(job.requestId);
        // A new unsubmitted intent follows the revision returned by the preceding transaction.
        rememberActions();
        status=socket?.readyState===WebSocket.OPEN?'Online':'Reconnecting';setSaveStatus(actionQueue.length?'◌ Saving online…':'● Saved online');refreshButton();
      }catch(error){if(account?.id!==accountId||sessionEpoch!==epoch)return;const statusCode=(error as {status?:number}).status;
        if(statusCode===401){expireSession();return;}
        if(statusCode===409||statusCode===410||statusCode===426){try{const fresh=await api<Session>('auth/session');if(account?.id!==accountId||sessionEpoch!==epoch)return;if(!fresh.account){expireSession();return;}if(fresh.account.id!==accountId){begin(fresh);return;}revision=fresh.revision||0;if(fresh.profile)game.applyAuthoritativeState(fresh.profile);
          // Someone else changed this account meanwhile (a visitor watered a crop, say): the action itself is fine, so retry it on the new revision instead of dropping it (the server replays it if the first try had gone through).
          if(statusCode===409){job.retries=(job.retries??0)+1;if(job.retries<=3){job.expectedRevision=revision;rememberActions();continue;}}}catch{break;}}
        if(statusCode&&statusCode<500){actionQueue.shift();rememberActions();waiting.get(job.requestId)?.reject(error as Error);waiting.delete(job.requestId);continue;}
        status='Action pending';setSaveStatus('○ Action pending — reconnect to finish');refreshButton();break;
      }
    }})().finally(()=>{saving=null;if(actionQueue.length&&account&&!stopped){if(sessionEpoch!==epoch)void flushSave();else {saveTimer=window.setTimeout(()=>void flushSave(),retryMs);retryMs=Math.min(5000,retryMs*2);}}});
    return saving;
  }
  function connect(){
    if(!account||stopped)return;playerChat.online(false);const socketUrl=new URL(`${serviceBase}socket`,location.href);socketUrl.protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(socketUrl);
    const connection=socket;
    function joined(message:any){
      const nextRoom=typeof message.room==='string'?message.room:message.planet;chatRoom=nextRoom;playerChat.enterPlanet(message.planet);playerChat.online(true);
      world().furniture?.cancel(false);if(visiting)game.setVisiting(null);players.clear();for(const player of message.players||[])players.set(player.id,player);planet=message.planet;visiting=typeof message.visiting==='string'?message.visiting:null;
      // A visit changes the room, never the owner's saved adventure planet.
      if(message.enemies?.length)world().applyEnemySnapshots(message.enemies);game.clearNetworkDrops();const dropEpoch=++roomEpoch;void api<{drops:NetworkDrop[]}>('drops').then(result=>{if(socket===connection&&roomEpoch===dropEpoch&&chatRoom===nextRoom&&!visiting&&account)for(const drop of result.drops||[])if(drop.room===nextRoom)game.spawnNetworkDrop(drop,account.id);}).catch(()=>{});if(message.environment)world().applyEnvironmentSnapshot(message.environment);authority(message.host,message.enemies);renderPlayers();status='Online';refreshButton();if(dialog.open)render();
    }
    socket.addEventListener('open',()=>{if(socket!==connection)return;status='Online';refreshButton();send({type:'active',active:!document.hidden});void flushSave();game.setDungeonSender?.(value=>socket===connection&&send(value));});
    socket.addEventListener('message',event=>{
      if(socket!==connection)return;let message:any;try{message=JSON.parse(event.data);}catch{return;}
      if(playerChat.receive(message))return;
      if(message.type==='furnitureResult'){const done=furnitureRequests.get(message.requestId);if(done){furnitureRequests.delete(message.requestId);done(message.pose??null);}else world().furniture?.reconcile(message.pose??null);if(message.error)announce(message.error);return;}
      if(message.type==='welcome'){friends=message.friends||[];requests=message.requests||[];sent=message.sent||[];visitLog=message.visitLog||[];if(message.social)playerChat.setState(message.social);refreshButton();}
      else if(message.type==='joined')joined(message);
      else if(message.type==='authority'){if(message.environment)world().applyEnvironmentSnapshot(message.environment);authority(message.host,message.enemies);}
      else if(message.type==='enter'||message.type==='pose'){if(message.player?.id){const merged=message.delta&&players.has(message.player.id)?{...players.get(message.player.id),...message.player}:message.player;for(const key of Object.keys(merged))if(merged[key]===null)delete (merged as Record<string,unknown>)[key];players.set(message.player.id,merged);}renderPlayers();}
      else if(message.type==='leave'){players.delete(message.id);game.clearPlayerSpeech?.(message.id);renderPlayers();}
      // The server dropped a pose that outran its movement budget (server/pose-budget.mjs): go back to its spot, so the proximity rules agree with the screen again.
      else if(message.type==='poseFix'){const w=world();if(message.planet===w.planet&&(message.visit??null)===visiting&&Number.isFinite(message.x)&&Number.isFinite(message.z)){w.position.set(message.x,w.position.y,message.z);w.destination=null;w.route=[];w.selected=null;}}
      else if(message.type==='enemies')world().applyEnemySnapshots(message.enemies);
      else if(message.type==='profile'&&message.authorityVersion===1&&message.profile&&message.revision>=revision){revision=message.revision;game.applyAuthoritativeState(message.profile);}
      else if(message.type==='enemyHealth')world().applyAuthoritativeEnemyHealth(message);
      else if(message.type==='colossus'||message.type==='colossusHit')dispatchEvent(new CustomEvent('zoo-colossus',{detail:message}));// colossus.ts
      else if(message.type==='environment')world().applyEnvironmentSnapshot(message.snapshot);
      else if(message.type==='gardenEvent'){
        if(message.blocked){
          const current=world(),farm=current.farmView;
          const target=()=>{if(world()!==current||current.farmView!==farm||current.planet!=='home'||!(visiting===message.ownerId||!visiting&&account?.id===message.ownerId))return null;const local=message.by===account?.id,thief=local?current.position:players.get(message.by);if(!thief||!Number.isFinite(thief.x)||!Number.isFinite(thief.z)||!local&&players.get(message.by)?.space!==`home:${message.ownerId}`)return null;return{x:thief.x!,z:thief.z!};};
          const thief=target();if(thief)farm?.guardBite(thief,target);
          if(message.by===account?.id)announce('The guard dog protected this garden. You lost {damage} HP.',{damage:message.damage||0});
        }
        else if(!message.blocked&&message.by===account?.id)announce('Crop collected. {count} visits left here today.',{count:message.remaining||0});
      }
      else if(message.type==='dropSpawn'&&message.drop)game.spawnNetworkDrop(message.drop,account!.id);
      else if(message.type==='dropClaimed')game.removeNetworkDrop(message.id);
      else if(message.type==='dropReleased')game.releaseNetworkDrop(message.id);
      else if(message.type==='creatureStatus'&&(message.kind==='stun'||message.kind==='slip')){const current=world(),duration=Math.min(2,Math.max(0,Number(message.duration)||0));if(message.kind==='stun')current.playerStun=Math.max(current.playerStun??0,duration);else current.playerSlip=Math.max(current.playerSlip??0,duration);}
      else if(message.type==='healthResult')game.applyAuthorityHealth(message.delta||0,!!message.died);
      else if(message.type==='decoyHp'&&Number.isFinite(message.id)&&Number.isFinite(message.hp))game.applyDecoyHp(message.id,message.hp,String(message.kind),Number(message.x)||0,Number(message.z)||0);
      else if(typeof message.type==='string'&&message.type.startsWith('dg'))game.dungeonMessage?.(message);
      else if(message.type==='friends'){const before=requests.length;friends=message.friends||[];requests=message.requests||[];sent=message.sent||[];visitLog=message.visitLog||visitLog;if(requests.length>before)announce('You have a new friend request!');refreshButton();if(dialog.open&&tab==='friends')render();}
      else if(message.type==='guestNotice'&&message.entry){const e=message.entry as GuestEntry;visitLog=[e,...visitLog].slice(0,30);unreadLog++;refreshButton();announce(guestLine(e));if(dialog.open&&tab==='diary'){unreadLog=0;render();}}
      else if(message.type==='visit'){
        playerChat.online(true);visiting=message.home?.id||null;
        if(message.home){const home=message.home as Home;const state={...newGame(home.name,home.color),discovered:home.discovered??['home'],plots:home.plots,yardLayout:home.yardLayout,gear:home.gear,...(home.farm?{farm:home.farm}:{}),...(home.placed?{placed:home.placed}:{}),...(home.decorations?{decorations:home.decorations}:{}),...(home.helper?{helper:home.helper}:{}),...(home.friends?{friends:home.friends}:{})};game.setVisiting(home.name,state as SaveState);}
        else game.setVisiting(null);renderPlayers();announce(visiting?"Visiting {name}'s garden":'Back in your garden',{name:message.home?.name||''});if(dialog.open)render();
      }else if(message.type==='home'&&message.home?.id===visiting)game.setVisiting(message.home.name,{discovered:message.home.discovered,plots:message.home.plots,yardLayout:message.home.yardLayout,decorations:message.home.decorations,farm:message.home.farm,helper:message.home.helper,friends:message.home.friends} as Partial<SaveState>);
      else if(message.type==='effect'){if(message.visual)game.applyRemoteEffect(message.visual,message.by);else world().burst(message.x,message.z,message.color,8);}
      else if(message.type==='error')announce(message.message||'That action was unavailable.');
    });
    socket.addEventListener('close',event=>{
      if(socket!==connection)return;game.setDungeonSender?.(null);playerChat.online(false);authority(null);world().clearRemotePlayers();players.clear();
      if(!account||stopped)return;if(event.code===4001){stopped=true;rejectActions('This online adventure is active in another tab.');if(saveTimer)clearTimeout(saveTimer);game.setPersistence(()=>{});status='Open in another tab';announce('This online adventure is active in another tab. Close it there, then reconnect here.');}
      else{status='Reconnecting';reconnect=window.setTimeout(connect,2500);const epoch=sessionEpoch;void api<Session>('auth/session').then(session=>{if(socket===connection&&sessionEpoch===epoch&&account&&!session.account)expireSession();}).catch(()=>{});}refreshButton();
    });
    socket.addEventListener('error',()=>{if(socket!==connection)return;playerChat.online(false);status='Reconnecting';refreshButton();});
  }
  function begin(session:Session){
    if(!session.account||!session.profile)throw new Error('The server could not restore your adventure. Please try again.');if(session.authorityVersion!==1)throw new Error('This server needs the current game rules.');sessionEpoch++;authErrors.clear();
    if(account?.id!==session.account.id){rememberActions();rejectActions('Your session ended. Pending actions remain on this device.');clearChat();visiting=null;}
    const previous=socket;socket=null;previous?.close();if(reconnect)clearTimeout(reconnect);if(saveTimer)clearTimeout(saveTimer);
    if(!account)offline=structuredClone(game.getState());account=session.account;playerChat.session(account,session.social);friends=session.friends||[];requests=session.requests||[];stopped=false;
    revision=session.revision||0;try{const raw=localStorage.getItem(`cute-game-actions-${account.id}`),cached=raw?JSON.parse(raw):null;if(Array.isArray(cached))actionQueue=cached.filter(job=>job&&typeof job.requestId==='string'&&typeof job.type==='string'&&job.rulesVersion===1&&Number.isSafeInteger(job.expectedRevision)).slice(0,100);}catch{/* Keep this account's in-memory queue if storage is unavailable. */}
    game.setPersistence(queueSave);game.setActionHandler(queueAction);game.applyState(session.profile);connect();render();dialog.close();title?.classList.remove('account-entry');void game.enterGame?.();void flushSave();announce('Welcome, {name}. Your online adventure is ready.',{name:account.name});
  }
  async function signOut(){
    const originalEpoch=sessionEpoch;await flushSave();if(sessionEpoch!==originalEpoch)return;if(pendingSave()){announce('Your latest progress is still waiting to save. Reconnect before signing out.');return;}
    stopped=true;const epoch=sessionEpoch;
    try{await api('auth/logout',{});if(sessionEpoch!==epoch)return;}catch(error){if(sessionEpoch!==epoch)return;if((error as {status?:number}).status===401){expireSession();return;}stopped=false;announce((error as Error).message);return;}
    sessionEpoch++;
    clearChat();stopped=true;if(reconnect)clearTimeout(reconnect);if(saveTimer)clearTimeout(saveTimer);socket?.close();socket=null;account=null;host=null;visiting=null;players.clear();playerChat.session(null);authority(null);world().clearRemotePlayers();
    game.setVisiting(null);game.setPersistence(null);game.setActionHandler(null);const state=offline||game.getOfflineState();if(state)game.applyState(state);setSaveStatus('● Saved on this device');status='Play together';refreshButton();render();if(!dialog.open)dialog.showModal();announce('Your offline adventure is restored.');
  }
  async function reconnectOnline(){
    const epoch=++sessionEpoch;if(reconnect)clearTimeout(reconnect);stopped=true;const previous=socket;socket=null;previous?.close();
    try{const session=await api<Session>('auth/session');if(sessionEpoch!==epoch)return;if(!session.account){expireSession();return;}begin(session);}
    catch(error){if(sessionEpoch===epoch)announce((error as Error).message);}
  }
  function labeledInput(label:string,type='text',name=label){const wrapper=el('label','social-field',t(label));const input=el('input');input.type=type;input.name=name;input.required=true;wrapper.append(input);return{wrapper,input};}
  function renderAuth(){
    const brand=el('div','auth-brand');
    const icon=el('img');icon.src=`${serviceBase}icon-192.png`;icon.alt='';icon.width=56;icon.height=56;
    brand.append(icon,el('span','auth-wordmark','ZooPet'),el('p','',t('Your little world of adventure')));
    content.append(brand);
    const modes=el('nav','auth-modes');modes.setAttribute('aria-label',t('Account access'));
    const switchMode=(next:boolean)=>{if(authBusy||register===next)return;register=next;authErrors.clear();content.querySelector('.social-auth')?.remove();render();};
    for(const [next,label]of [[false,'Sign in'],[true,'Create account']]as const){const item=button(label,()=>switchMode(next));item.setAttribute('aria-pressed',String(register===next));item.disabled=restoring;modes.append(item);}
    content.append(modes,el('p','social-intro',t(register?'Make a home, meet friends, and explore the same world.':'Welcome back. Your garden is waiting for you.')));
    const form=el('form','social-auth');form.noValidate=true;
    const fields=new Map<string,ReturnType<typeof labeledInput>&{error:HTMLElement}>();
    function field(label:string,type:string,name:string){
      const f=labeledInput(label,type,name),error=el('small','auth-field-error');f.input.id=`auth-${name}`;error.id=`auth-${name}-error`;error.setAttribute('aria-live','polite');f.input.setAttribute('aria-describedby',error.id);if(authErrors.has(name)){error.textContent=t(authErrors.get(name)!);f.input.setAttribute('aria-invalid','true');}
      f.input.addEventListener('input',()=>{error.textContent='';authErrors.delete(name);f.input.removeAttribute('aria-invalid');setNotice('');});
      if(type==='password'){
        const row=el('span','auth-password');const reveal=button('Show password',()=>{const show=f.input.type==='password';f.input.type=show?'text':'password';reveal.textContent=t(show?'Hide':'Show');reveal.setAttribute('aria-label',t(show?'Hide password':'Show password'));reveal.setAttribute('aria-pressed',String(show));});
        reveal.textContent=t('Show');reveal.setAttribute('aria-label',t('Show password'));reveal.setAttribute('aria-controls',f.input.id);reveal.setAttribute('aria-pressed','false');row.append(f.input,reveal);f.wrapper.append(row);
      }
      f.wrapper.append(error);fields.set(name,{...f,error});form.append(f.wrapper);return f.input;
    }
    const username=field('Username','text','username');username.autocomplete='username';username.autocapitalize='none';username.spellcheck=false;username.minLength=3;username.maxLength=24;username.pattern='[a-zA-Z0-9_]{3,24}';
    let display:HTMLInputElement|undefined;
    if(register){display=field('Explorer name','text','display-name');display.setAttribute('autocomplete','nickname');display.maxLength=20;display.value=game.getState().name;}
    const password=field('Password','password','password');password.autocomplete=register?'new-password':'current-password';password.minLength=4;password.maxLength=128;
    const confirm=register?field('Confirm password','password','confirm-password'):undefined;if(confirm){confirm.autocomplete='new-password';confirm.maxLength=128;}
    const submit=el('button','social-primary',t(restoring?'Restoring your session…':register?'Create account':'Sign in'));submit.type='submit';submit.disabled=authBusy||restoring;authSubmit=submit;form.append(submit);
    const invalid=(name:string,message:string)=>{const f=fields.get(name)!;authErrors.set(name,message);f.error.textContent=t(message);f.input.setAttribute('aria-invalid','true');};
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(authBusy||restoring)return;setNotice('');authErrors.clear();for(const f of fields.values()){f.error.textContent='';f.input.removeAttribute('aria-invalid');}
      if(!/^[a-zA-Z0-9_]{3,24}$/.test(username.value.trim()))invalid('username','Use 3–24 letters, numbers or underscores.');
      if(display&&(!display.value.trim()||display.value.trim().length>20))invalid('display-name','Use a character name of 1–20 characters.');
      if(password.value.length<4||password.value.length>128)invalid('password','Use a password of 4–128 characters.');
      if(confirm&&confirm.value!==password.value)invalid('confirm-password','Passwords do not match.');
      const first=Array.from(fields.values()).find(f=>f.error.textContent);if(first){first.input.focus();return;}
      authBusy=true;submit.disabled=true;submit.textContent=t('Signing in…');form.setAttribute('aria-busy','true');for(const b of Array.from(modes.querySelectorAll('button')))b.disabled=true;
      const epoch=++sessionEpoch;
      try{const session=await api<Session>(`auth/${register?'register':'login'}`,{username:username.value.trim(),password:password.value,name:display?.value.trim(),color:game.getState().color});if(epoch!==sessionEpoch)return;begin(session);password.value='';if(confirm)confirm.value='';}
      catch(error){if(epoch!==sessionEpoch)return;const code=(error as {status?:number}).status;const message=(error as Error).message;if(code===409)invalid('username',message);else if(code===401)invalid('password',message);else setNotice(message);}
      finally{authBusy=false;submit.disabled=false;submit.textContent=t(register?'Create account':'Sign in');form.removeAttribute('aria-busy');for(const b of Array.from(modes.querySelectorAll('button')))b.disabled=false;}
    });
    const swap=button(register?'Already have an account? Sign in':'New here? Create an adventure',()=>switchMode(!register),'social-link');
    const solo=button('Play offline on this device',()=>{if(authBusy)return;sessionEpoch++;restoring=false;dialog.close();title?.classList.remove('account-entry');},'auth-solo');
    content.append(form,swap,solo,el('p','social-small',t('Offline progress saves in this browser. Offline play does not join multiplayer.')));
    if(serverDown)setNotice('The game server is not reachable right now.');
  }
  function personRow(person:Explorer,actions:HTMLElement[]){const row=el('div','social-person');const badge=el('span','social-avatar','●');badge.style.color=person.color;const name=el('span','',t('{name} · Lv {level}{online}',{name:person.name,level:person.level,online:person.online?t(' · online'):''}));row.append(badge,name,...actions);return row;}
  async function friendAction(action:string,id:string){try{const list=await api<{friends:Explorer[];requests:Explorer[];sent?:Explorer[]}>(`friends/${action}`,{id});friends=list.friends;requests=list.requests;sent=list.sent??sent;refreshButton();render();}catch(error){announce((error as Error).message);}}
  // A failed probe leaves the form and the existing offline option available.
  let serverDown=false;
  function render(){
    if(!account&&content.querySelector('.social-auth'))return;
    content.replaceChildren();tabs.replaceChildren();authSubmit=null;setNotice('');heading.textContent=t(account?'Your online world':'Welcome to ZooPet');
    dialog.classList.toggle('account-auth',!account);
    if(!account){renderAuth();return;}
    for(const [id,label]of [['world','🌍 World'],['friends',`${t('👥 Friends')}${requests.length?` (${requests.length})`:''}`],['diary',`${t('📒 Guest diary')}${unreadLog?` (${unreadLog})`:''}`],['account','🏡 Account']]as const){const item=button(label,()=>{tab=id;if(id==='diary'){unreadLog=0;refreshButton();}render();});item.setAttribute('aria-pressed',String(tab===id));tabs.append(item);}
    if(tab==='world'){
      content.append(el('p','social-intro',t(visiting?'Tap a ripe crop to try collecting it. A guard dog protects this garden if one lives here.':PLANETS?.[game.getState().planet]?.name??game.getState().planet)));
      const actions=el('div','social-actions');if(visiting)actions.append(button('Return to my garden',()=>send({type:'leaveVisit'})));else actions.append(button('Share nearby loot',()=>void shareNearbyLoot()));actions.append(button('💬 Trò chuyện',()=>{dialog.close();playerChat.openChat();}));content.append(actions);
      const roster=el('div','social-roster');roster.append(el('h3','',t('Explorers in this world ({count})',{count:players.size})));for(const player of players.values())roster.append(personRow(player,player.id===account.id?[]:[button('View explorer',()=>openPlayer(player.id))]));content.append(roster);
    }else if(tab==='diary'){
      content.append(el('p','social-intro',t('Friends who visit, water, or give gifts at your home show up here.')));
      if(!visitLog.length)content.append(el('p','social-small',t('No one has visited yet. Invite a friend to come and water your plants!')));
      for(const e of visitLog){const row=el('div','social-person');row.append(el('span','social-avatar',e.kind==='water'?'💧':e.kind==='gift'?'🎁':e.kind==='steal'?'🕵️':e.kind==='message'?'💬':'👋'),el('span','',guestLine(e)),el('small','social-small',ago(e.at)));content.append(row);}
    }else if(tab==='friends'){
      const add=el('form','social-inline'),input=el('input');input.placeholder=t('Friend’s username');input.setAttribute('aria-label',t('Friend username'));input.name='friend-username';input.maxLength=24;const submit=el('button','',t('Send request'));submit.type='submit';add.append(input,submit);add.addEventListener('submit',async event=>{event.preventDefault();try{await api('friends/request',{username:input.value});announce('Friend request sent.');input.value='';}catch(error){announce((error as Error).message);}});content.append(add);
      if(requests.length){content.append(el('h3','',t('Friend requests')));for(const friend of requests)content.append(personRow(friend,[button('Accept',()=>void friendAction('accept',friend.id)),button('Decline',()=>void friendAction('decline',friend.id))]));}
      if(sent.length){content.append(el('h3','',t('Waiting for a reply')));for(const person of sent)content.append(personRow(person,[button('Cancel request',()=>void friendAction('cancel',person.id),'social-link')]));}
      content.append(el('h3','',t('Your friends')));if(!friends.length)content.append(el('p','social-small',t('Add a friend by username to visit each other’s gardens.')));
      for(const friend of friends){const gifts=el('div','social-gifts');content.append(personRow(friend,[button('Visit garden',()=>{sendRoom({type:'visit',id:friend.id});dialog.close();}),button('Send a gift',()=>giftPicker(friend.id,gifts)),button('Message',()=>messageForm(friend.id,gifts)),button('Remove friend',()=>void friendAction('remove',friend.id),'social-link')]));content.append(gifts);}
    }else{
      content.append(el('h3','',account.name),el('p','',t('Username: {username}',{username:account.username||''})),el('p','social-small',t('Your progress saves to this server. Returning to offline play restores the adventure you left there.')),button('Save now',async()=>{queueSave(game.getState());await flushSave();if(account)announce(pendingSave()?'Save pending. Please keep this page open.':'Online adventure saved.');}),button('Reconnect',reconnectOnline),button('Sign out and play offline',()=>void signOut(),'social-primary'));
    }
  }
  game.onFrame(dt=>{
    if(!account||socket?.readyState!==WebSocket.OPEN)return;poseClock+=dt;enemyClock+=dt;const presence=game.getPresence();
    if(!visiting&&presence.planet!==planet){game.setVisiting(null);planet=presence.planet;sendRoom({type:'join',planet});return;}
    if(poseClock>=.1){poseClock=0;send({type:'pose',...presence});renderPlayers();}
    // The elected browser supplies AI positions/telegraphs; the server replaces HP,
    // damage and rewards with canonical combat values before relaying the snapshot.
    if(host===account.id&&enemyClock>=.15){enemyClock=0;send({type:'enemies',enemies:world().enemySnapshots()});}
  });
  game.onAction(action=>{if(!account)return;if(action.kind==='basic')send({type:'basic',targetId:action.targetId,requestId:crypto.randomUUID()});else if(action.kind==='skill')send({type:'skill',index:action.index,aim:action.aim,requestId:crypto.randomUUID()});if(account)send({type:'effect',effect:action.special||action.kind,visual:action.effect,x:action.x,z:action.z,color:action.kind==='skill'?'#d1a6ff':'#fff2a0'});});
  document.addEventListener('visibilitychange',()=>{send({type:'active',active:!document.hidden});if(document.hidden)void flushSave();});
  window.addEventListener('pagehide',rememberActions);
  onLanguageChange(()=>{
    // Keep partially typed credentials and chat drafts while relabeling an open menu.
    const drafts=Array.from(content.querySelectorAll<HTMLInputElement>('input')).map(input=>({name:input.name,value:input.value,focused:document.activeElement===input,start:input.selectionStart,end:input.selectionEnd}));
    const previousNotice=noticeSource,previousParams=noticeParams;refreshButton();language.value=getLanguage();language.setAttribute('aria-label',t('Language'));
    if(dialog.open){
      if(!account&&!authBusy)content.querySelector('.social-auth')?.remove();
      render();
      for(const draft of drafts){const input=Array.from(content.querySelectorAll<HTMLInputElement>('input')).find(node=>node.name===draft.name);if(input){input.value=draft.value;if(draft.focused){input.focus();if(draft.start!==null&&draft.end!==null)input.setSelectionRange(draft.start,draft.end);}}}
      setNotice(previousNotice,previousParams);
    }
    if(saveStatusSource)setSaveStatus(saveStatusSource);
  });
  refreshButton();
  render();dialog.showModal();
  const initialEpoch=sessionEpoch;void api<Session>('auth/session').then(session=>{if(sessionEpoch===initialEpoch&&session.account)begin(session);}).catch(error=>{if(sessionEpoch===initialEpoch){serverDown=!(error as {status?:number}).status;setNotice((error as Error).message);}}).finally(()=>{
    restoring=false;if(authSubmit){authSubmit.disabled=authBusy;authSubmit.textContent=t(register?'Create account':'Sign in');}for(const b of Array.from(content.querySelectorAll<HTMLButtonElement>('.auth-modes button')))b.disabled=authBusy;
  });
}
