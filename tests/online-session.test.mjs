import * as socialRules from '../src/social-rules.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {newGame,parseSave} from '../src/model.ts';
import {VI_ONLINE} from '../src/locales/vi-online.ts';
import {gameplayKey} from '../src/gameplay-controls.ts';

class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners=new Map();this.attributes=new Map();this.dataset={};this.classList={add:(v)=>{if(!this.className?.split(' ').includes(v))this.className=((this.className??'')+' '+v).trim();},remove:(v)=>{this.className=(this.className??'').split(' ').filter(c=>c!==v).join(' ');},toggle:(v,on)=>{on?this.classList.add(v):this.classList.remove(v);}};this.open=false;this.style={setProperty(){}};this.value='';this.selectionStart=null;this.selectionEnd=null;}
  append(...children){for(const child of children)child.parent=this;this.children.push(...children);}
  prepend(...children){this.children.unshift(...children);}
  closest(){return ['input','textarea','select'].includes(this.tagName)?this:null;}
  replaceChildren(...children){this.children=[...children];}
  removeAttribute(name){this.attributes.delete(name);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  setAttribute(name,value){this.attributes.set(name,value);}
  addEventListener(name,handler){this.listeners.set(name,handler);}
  querySelectorAll(selector){return elements(this).slice(1).filter(n=>selector.split(',').some(sel=>{sel=sel.trim();if(sel.includes(':not('))return sel.startsWith('[data-player-panel]')&&'playerPanel'in n.dataset&&!n.hidden;if(sel.startsWith('.'))return(n.className??'').split(' ').includes(sel.slice(1));if(sel.startsWith('#'))return n.id===sel.slice(1);return n.tagName===sel;}));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  blur(){if(this.ownerDocument?.activeElement===this)this.ownerDocument.activeElement=null;}
  get lastChild(){return this.children.at(-1);}
  getBoundingClientRect(){return {left:0,top:0,right:0,bottom:0,width:0,height:0};}
  focus(){this.ownerDocument.activeElement=this;}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  click(){return this.listeners.get('click')?.({target:this});}
}
const elements=root=>[root,...root.children.flatMap(elements)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const source=(await readFile(new URL('../src/online.ts',import.meta.url),'utf8')).replace(/^import '\.\/[^']+\.css';\r?$/gm,'').replaceAll('import.meta.env',JSON.stringify({VITE_STATIC_HOST:'false',BASE_URL:'/'}));
const chatSource=(await readFile(new URL('../src/chat-ui.ts',import.meta.url),'utf8')).replace(/^import '\.\/[^']+\.css';\r?$/gm,'');
const chatCompiled=ts.transpileModule(chatSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sessionFor=(id='alice')=>{const profile=newGame(id);return {authorityVersion:1,account:{id,username:id,name:id,color:profile.color,gear:{},level:1},profile,revision:0,friends:[],requests:[]};};

test('online progress submits serialized intents and never an optimistic profile snapshot',async()=>{
  const app=await fixture();app.bridge.getState().energy=999999;
  await Promise.all([app.bridge.perform({type:'buy',payload:{id:'rod'}}),app.bridge.perform({type:'settings',payload:{settings:{sound:false}}})]);
  const sent=app.requests.filter(r=>r.url.endsWith('/actions')).map(r=>JSON.parse(r.options.body));
  assert.equal(sent.length,2);assert.deepEqual(sent.map(v=>v.expectedRevision),[0,1]);assert.notEqual(sent[0].requestId,sent[1].requestId);
  assert.deepEqual(sent[0].payload,{id:'rod'});assert.ok(sent.every(v=>!('profile'in v)&&v.rulesVersion===1));assert.equal(app.bridge.getState().energy,0);
  assert.equal(app.requests.filter(r=>r.url.endsWith('/profile')).length,0);
});
test('an uncertain action keeps the exact receipt identity and revision when retried',async()=>{
  const app=await fixture({failFirstAction:true}),pending=app.bridge.perform({type:'buy',payload:{id:'rod'}});await flush();
  const first=app.requests.find(r=>r.url.endsWith('/actions')).options.body;
  app.socket.message({type:'profile',authorityVersion:1,revision:5,profile:newGame('Newer')});app.fire(500);await pending;
  const sent=app.requests.filter(r=>r.url.endsWith('/actions'));assert.equal(sent.length,2);assert.equal(sent[1].options.body,first);
  assert.equal(app.bridge.getState().name,'Newer','an older replay profile cannot replace newer server state');
});

test('conflict retries preserve the original revision in the immutable action ID',async()=>{
  let first=true;
  const app=await fixture({responseFor(url,options,session){if(url.endsWith('/actions')&&first){first=false;session.revision=9;return{ok:false,status:409,json:async()=>({error:'A newer adventure is already saved.'})};}}});
  await app.bridge.perform({type:'settings',payload:{settings:{sound:false}}});
  const sent=app.requests.filter(r=>r.url.endsWith('/actions')).map(r=>JSON.parse(r.options.body));
  assert.equal(sent.length,2);assert.match(sent[0].requestId,/^r0-[a-f0-9-]{36}$/);assert.equal(sent[1].requestId,sent[0].requestId);assert.deepEqual(sent.map(value=>value.expectedRevision),[0,9]);
});

for(const status of [410,426])test(`expired receipt (${status}) refreshes the adventure and removes the action without resending`,async()=>{
  const app=await fixture({responseFor(url,options,session){if(url.endsWith('/actions')){session.revision=600;session.profile.name='Latest saved';return{ok:false,status,json:async()=>({error:'This action cannot be retried safely.'})};}}});
  await assert.rejects(app.bridge.perform({type:'giftFriend',payload:{ownerId:'bob',item:'carrot',count:1}}),/cannot be retried safely/);
  assert.equal(app.requests.filter(r=>r.url.endsWith('/actions')).length,1);
  assert.equal(app.bridge.getState().name,'Latest saved');
  assert.deepEqual(JSON.parse(app.storage.get('cute-game-actions-alice')),[]);
});

test('previously submitted legacy browser jobs retain their identity and never invent an origin revision',async()=>{
  const oldId=randomUUID(),job={type:'giftFriend',payload:{ownerId:'bob',item:'carrot',count:1},requestId:oldId,rulesVersion:1,expectedRevision:514,submitted:true,retries:2};
  const app=await fixture({initialActions:[job],responseFor(url){if(url.endsWith('/actions'))return{ok:false,status:426,json:async()=>({error:'Reconnect to use server-approved actions.'})};}});
  const sent=app.requests.filter(r=>r.url.endsWith('/actions')).map(r=>JSON.parse(r.options.body));
  assert.equal(sent.length,1);assert.equal(sent[0].requestId,oldId);assert.equal(sent[0].expectedRevision,514);assert.equal(sent[0].originalRevision,undefined);
  assert.deepEqual(JSON.parse(app.storage.get('cute-game-actions-alice')),[]);
});
test('Enter opens chat but composition and typing keep their normal Enter behavior',async()=>{
  const app=await fixture();app.dialog.close();const key=app.document.listeners.get('keydown');let prevented=0;
  key({code:'Enter',key:'Enter',isComposing:true,target:app.body,preventDefault(){prevented++;}});assert.equal(app.dialog.open,false);
  key({code:'Enter',key:'Enter',target:app.input,preventDefault(){prevented++;}});assert.equal(app.dialog.open,false);
  key({code:'Enter',key:'Enter',target:app.body,preventDefault(){prevented++;}});assert.equal(app.all().find(n=>n.className==='player-chat-composer').hidden,false);assert.equal(app.document.activeElement,app.input);assert.equal(prevented,1);
});
test('selecting an explorer offers a friend request addressed by immutable player ID',async()=>{
  const app=await fixture();app.socket.message({type:'enter',player:{id:'bob',name:'Fern <3',planet:'home'}});
  app.bridge.getWorld().onRemotePlayerClick('bob');await app.button('Thêm bạn').click();
  const sent=app.requests.find(r=>r.url.endsWith('/friends/request'));assert.deepEqual(JSON.parse(sent.options.body),{id:'bob'});
});

async function fixture({failFirstAction=false,responseFor,initialActions,friendIds=[]}={}){
  let session=sessionFor(),state=newGame('Offline'),language='en',timerId=0,clock=Date.now();session.friends=friendIds.map(id=>sessionFor(id).account);
  const document=new Element(),window=new Element(),body=new Element(),slot=new Element(),timers=new Map(),sockets=[],requests=[],notices=[],visits=[],languageListeners=[],storage=new Map(),spawned=[];
  if(initialActions)storage.set('cute-game-actions-alice',JSON.stringify(initialActions));
  document.body=body;document.createElement=tag=>Object.assign(new Element(tag),{ownerDocument:document});document.createTextNode=textContent=>Object.assign(new Element('text'),{textContent});document.querySelector=selector=>selector==='#social-slot'?slot:document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);
  const setTimeout=(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout=id=>timers.delete(id);
  window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
  const i18n={getLanguage:()=>language,switchLanguage:value=>{language=value;for(const fn of languageListeners)fn();},t:(text,params={})=>(language==='vi'?VI_ONLINE[text]||text:text).replace(/\{(\w+)\}/g,(match,key)=>key in params?String(params[key]):match),onLanguageChange:fn=>{languageListeners.push(fn);return()=>{};}};
  class Socket extends Element {
    static OPEN=1;readyState=1;sent=[];failSend=false;
    constructor(url){super();this.url=String(url);sockets.push(this);}
    send(raw){if(this.failSend||this.readyState!==1)throw new Error('Socket closed');this.sent.push(JSON.parse(raw));}
    message(data){this.listeners.get('message')?.({data:JSON.stringify(data)});}
    close(code=1000){this.readyState=3;this.listeners.get('close')?.({code});}
  }
  const world=new Proxy({keys:new Set(),joystickInput:null,avatarArt:()=>'',lookAvatar:()=>null},{get:(object,key)=>Reflect.get(object,key)??(()=>{})}),bridge={getState:()=>state,getPresence:()=>({planet:state.planet,x:0,z:0}),getWorld:()=>world,getOfflineState:()=>newGame('Offline'),setPersistence(){},setActionHandler(fn){this.perform=fn;},applyAuthoritativeState(value){state=value;},clearNetworkDrops(){spawned.length=0;},spawnNetworkDrop(drop){spawned.push(drop);},removeNetworkDrop(){},releaseNetworkDrop(){},applyAuthorityHealth(){},setNetworkHooks(){},applyState:value=>{state=value;},showNotice:text=>notices.push(text),setVisiting:(...args)=>visits.push(args),onFrame(fn){this.frame=fn;},onAction(){}};
  const exports={},chatExports={};const context={exports,document,window,AbortController,clearTimeout,setTimeout,URL,structuredClone,crypto:{randomUUID},location:{href:'https://game.example/',protocol:'https:'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},WebSocket:Socket,innerWidth:1280,innerHeight:900,Date:class extends Date{static now(){return clock;}},ResizeObserver:class{observe(){}},require:name=>name==='./chat-ui.ts'?chatExports:name==='./social-rules.ts'?socialRules:name==='./mirror-preview.ts'?{MirrorPreview:class{show(){}},restPose:v=>v}:name==='./assets.ts'?Object.fromEntries(['weaponKit','wearKit','petKit','disguiseKit','heroKit'].map(k=>[k,{ready:false}])):name==='./looks.ts'?{DEFAULT_LOOK:'girl-tall-none-bare'}:name==='./i18n.ts'?i18n:name==='./gameplay-controls.ts'?{gameplayKey}:{newGame,parseSave},fetch:async(url,options)=>{requests.push({url,options});if(url.endsWith('/actions')&&failFirstAction){failFirstAction=false;throw new Error('Connection reset');}const response=await responseFor?.(url,options,session);if(response)return response;return {ok:true,json:async()=>url.includes('/auth/')?structuredClone(session):url.endsWith('/actions')?{ok:true,authorityVersion:1,profile:structuredClone(session.profile),revision:++session.revision,result:true}:{ok:true}};}};
  vm.runInNewContext(chatCompiled,{...context,exports:chatExports});vm.runInNewContext(compiled,context);
  exports.initOnline(bridge);await flush();slot.children[0].click();
  const all=()=>elements(body),find=name=>all().find(node=>node.name===name),button=label=>{const node=all().find(node=>node.tagName==='button'&&node.textContent===label);assert.ok(node,`Missing button ${label}`);return node;};
  const join=({planet='home',socket=sockets.at(-1)}={})=>socket.message({type:'joined',host:session.account?.id,planet,room:planet,players:session.account?[session.account]:[]});
  join();
  return {body,document,sockets,requests,notices,visits,bridge,all,find,button,join,storage,spawned,
    get socket(){return sockets.at(-1);},get chatBadge(){return slot.children.find(n=>n.id==='chat-button');},get input(){return all().find(n=>n.className==='player-chat-input');},get sendButton(){return all().find(node=>node.className==='player-chat-send');},get log(){return all().find(node=>node.className==='player-chat-history');},get dialog(){return all().find(node=>node.tagName==='dialog');},
    get chatPackets(){return sockets.flatMap(socket=>socket.sent).filter(message=>message.type==='chat');},
    draft(value){const input=all().find(n=>n.className==='player-chat-input');assert.ok(input);input.value=value;input.listeners.get('input')?.();},
    submit(){clock+=2001;const form=all().find(node=>node.tagName==='form'&&node.className==='player-chat-form');assert.ok(form);form.listeners.get('submit')({preventDefault(){}});},
    fire(delay){const entry=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(entry,`Missing timer ${delay}`);timers.delete(entry[0]);clock+=delay;entry[1].fn();},
    setLanguage(value){language=value;for(const fn of languageListeners)fn();},
    setSession(value){session=value;},
    async signIn(id){session=sessionFor(id);find('username').value=id;find('password').value='test-password';const form=all().find(node=>node.className==='social-auth');await form.listeners.get('submit')({preventDefault(){}});await flush();join();if(!find('world-chat'))button('🌍 World').click();},
  };
}

test('chat keeps its draft until a matching sender acknowledgement, without double submission',async()=>{
  const app=await fixture();assert.equal(app.socket.url,'wss://game.example/socket');app.draft('Xin chào 🌿');app.submit();
  const sent=app.chatPackets[0];assert.match(sent.requestId,/^[\da-f-]{36}$/i);assert.equal(sent.message,'Xin chào 🌿');assert.equal(app.input.value,'Xin chào 🌿');assert.equal(app.sendButton.disabled,true);
  app.submit();assert.equal(app.chatPackets.length,1);
  app.socket.message({type:'chat',id:'alice',name:'alice',message:'Xin chào 🌿'});assert.equal(app.input.value,'Xin chào 🌿','an echo is not a delivery acknowledgement');
  app.socket.message({type:'chatAck',requestId:randomUUID()});assert.equal(app.sendButton.disabled,true);
  app.socket.message({type:'chatAck',requestId:sent.requestId});assert.equal(app.input.value,'');assert.equal(app.sendButton.disabled,false);app.submit();assert.equal(app.chatPackets.length,1);
});

test('editing a pending draft, changing language or switching tabs does not lose the next message',async()=>{
  const app=await fixture();app.draft('First');app.submit();const first=app.chatPackets[0];app.draft('Second <b>not markup</b>');
  app.setLanguage('vi');assert.equal(app.sendButton.textContent,'✓');assert.equal(app.sendButton.disabled,true);assert.equal(app.input.value,'Second <b>not markup</b>');
  app.setLanguage('en');app.button('👥 Friends').click();app.socket.message({type:'chatAck',requestId:first.requestId});app.button('🌍 World').click();
  assert.equal(app.input.value,'Second <b>not markup</b>');app.submit();assert.equal(app.chatPackets.length,2);assert.notEqual(app.chatPackets[1].requestId,first.requestId);
});

test('chat rejection and timeout retain text and retry the same request ID without automatic resends',async()=>{
  const app=await fixture();app.draft('Please keep me');app.submit();const first=app.chatPackets[0];
  app.socket.message({type:'error',requestId:first.requestId,message:'Please wait a moment before trying again.'});assert.equal(app.input.value,first.message);assert.equal(app.sendButton.disabled,false);
  app.submit();assert.equal(app.chatPackets[1].requestId,first.requestId);app.setLanguage('vi');app.fire(10000);
  assert.equal(app.chatPackets.length,2);assert.equal(app.input.value,first.message);assert.equal(app.sendButton.disabled,false);assert.match(app.notices.at(-1),/Chưa xác nhận/);
  app.submit();assert.equal(app.chatPackets[2].requestId,first.requestId);app.socket.message({type:'chatAck',requestId:first.requestId});assert.equal(app.input.value,'');
});

test('a late acknowledgement after timeout clears only its own unedited draft',async()=>{
  const app=await fixture();app.draft('Slow delivery');app.submit();const first=app.chatPackets[0];app.fire(10000);app.socket.message({type:'chatAck',requestId:first.requestId});assert.equal(app.input.value,'');app.submit();assert.equal(app.chatPackets.length,1);
});

test('disconnect preserves a draft and requires a confirmed room before an idempotent manual retry',async()=>{
  const app=await fixture();app.draft('Across reconnect');app.submit();const first=app.chatPackets[0],oldSocket=app.socket;oldSocket.close();await flush();
  assert.equal(app.input.value,first.message);assert.equal(app.sendButton.disabled,true);app.submit();assert.equal(app.chatPackets.length,1);
  app.fire(2500);assert.notEqual(app.socket,oldSocket);assert.equal(app.sendButton.disabled,true);app.join();assert.equal(app.input.value,first.message);assert.equal(app.sendButton.disabled,false);assert.equal(app.chatPackets.length,1);
  app.submit();assert.equal(app.chatPackets[1].requestId,first.requestId);oldSocket.message({type:'chatAck',requestId:first.requestId});assert.equal(app.sendButton.disabled,true,'old socket acknowledgement cannot clear a current delivery');app.socket.message({type:'chatAck',requestId:first.requestId});assert.equal(app.input.value,'');
});

test('send exceptions retain text and release the pending button',async()=>{
  const app=await fixture();app.draft('Socket failed');app.socket.failSend=true;app.submit();assert.equal(app.chatPackets.length,0);assert.equal(app.input.value,'Socket failed');assert.equal(app.sendButton.disabled,false);app.socket.failSend=false;app.submit();assert.equal(app.chatPackets.length,1);
});

test('planet changes clear history, drafts and pending acknowledgements; same planet rejoin keeps them',async()=>{
 const app=await fixture();app.socket.message({type:'chat',id:'bob',name:'Bob',message:'Home message'});app.draft('Home draft');app.submit();const first=app.chatPackets[0];
 app.join({planet:'ocean'});assert.equal(app.input.value,'');assert.equal(app.log.children.length,0);app.draft('Ocean draft');app.socket.message({type:'chatAck',requestId:first.requestId});assert.equal(app.input.value,'Ocean draft');app.join({planet:'ocean'});assert.equal(app.input.value,'Ocean draft');assert.equal(app.sendButton.disabled,false);
});

test('sign-out and expired accounts erase chats before another player signs in',async()=>{
  for(const expire of [false,true]){
    const app=await fixture();app.socket.message({type:'chat',id:'bob',name:'Secret name',message:'Private history'});app.draft('Private draft');app.submit();const oldSocket=app.socket,oldId=app.chatPackets[0].requestId;
    if(expire){app.setSession({account:null});oldSocket.close();await flush();}else{app.button('🏡 Account').click();app.button('Sign out and play offline').click();await flush();}
    assert.ok(app.find('username'));await app.signIn('bob');assert.equal(app.input.value,'');assert.equal(app.log.children.length,0);
    app.draft('Bob draft');oldSocket.message({type:'chatAck',requestId:oldId});oldSocket.message({type:'chat',id:'bob',name:'Late',message:'Previous session'});assert.equal(app.input.value,'Bob draft');assert.equal(app.log.children.length,0);
  }
});

test('garden visits forward farm and helper snapshots initially and on live updates',async()=>{
  const app=await fixture(),home={...sessionFor('friend').account,plots:[],decorations:[],farm:{expanded:true,animals:[{id:'cow-1',kind:'cow'}]},helper:{owned:true,level:2}};
  app.socket.message({type:'visit',home});assert.equal(app.visits.at(-1)[0],'friend');assert.deepEqual(structuredClone(app.visits.at(-1)[1].farm),home.farm);assert.deepEqual(structuredClone(app.visits.at(-1)[1].helper),home.helper);
  const update={...home,farm:{...home.farm,animals:[]},helper:{owned:true,level:3}};app.socket.message({type:'home',home:update});assert.deepEqual(structuredClone(app.visits.at(-1)[1].farm),update.farm);assert.deepEqual(structuredClone(app.visits.at(-1)[1].helper),update.helper);
  const count=app.visits.length;app.socket.message({type:'home',home:{...update,id:'other'}});assert.equal(app.visits.length,count);
});

test('planet reconnect keeps the draft and reuses its delivery id',async()=>{
 const app=await fixture();app.draft('Kept draft');app.submit();const first=app.chatPackets[0];app.socket.close();await flush();app.fire(2500);app.join();assert.equal(app.input.value,'Kept draft');app.submit();assert.equal(app.chatPackets[1].requestId,first.requestId);
});

test('an account change discovered by reconnect cannot reveal the previous account transcript',async()=>{
  const app=await fixture();app.socket.message({type:'chat',id:'bob',name:'Alice friend',message:'Alice conversation'});app.draft('Alice draft');app.submit();const first=app.chatPackets[0],oldSocket=app.socket;
  app.button('🏡 Account').click();app.setSession(sessionFor('bob'));await app.button('Reconnect').click();await flush();app.join();app.button('🌍 World').click();
  assert.equal(app.log.children.length,0);assert.equal(app.input.value,'');app.draft('Bob draft');oldSocket.message({type:'chatAck',requestId:first.requestId});assert.equal(app.input.value,'Bob draft');
});

test('switching accounts preserves the old pending queue without executing it as the new account',async()=>{
  const app=await fixture({failFirstAction:true});
  const pending=app.bridge.perform({type:'buy',payload:{id:'rod'}}).catch(error=>error.message);await flush();
  const original=JSON.parse(app.requests.find(r=>r.url.endsWith('/actions')).options.body);
  app.button('🏡 Account').click();app.setSession(sessionFor('bob'));await app.button('Reconnect').click();await flush();app.join();
  assert.match(await pending,/session ended/);assert.equal(app.requests.filter(r=>r.url.endsWith('/actions')).length,1);
  assert.equal(JSON.parse(app.storage.get('cute-game-actions-alice'))[0].requestId,original.requestId);
  await app.bridge.perform({type:'settings',payload:{settings:{sound:false}}});
  const sent=app.requests.filter(r=>r.url.endsWith('/actions')).map(r=>JSON.parse(r.options.body));
  assert.deepEqual(sent.map(job=>job.type),['buy','settings']);assert.equal(app.bridge.getState().name,'bob');
});

test('same-account reconnect ignores its old in-flight response and retries the durable receipt before new work',async()=>{
  let release,first=true;
  const app=await fixture({responseFor:(url)=>{if(url.endsWith('/actions')&&first){first=false;return new Promise(resolve=>{release=resolve;});}}});
  const pending=app.bridge.perform({type:'buy',payload:{id:'rod'}});await flush();
  app.button('🏡 Account').click();await app.button('Reconnect').click();await flush();
  const second=app.bridge.perform({type:'settings',payload:{settings:{sound:false}}});
  release({ok:true,json:async()=>({ok:true,authorityVersion:1,profile:newGame('Stale response'),revision:100,result:true})});
  await Promise.all([pending,second]);
  const sent=app.requests.filter(r=>r.url.endsWith('/actions')).map(r=>JSON.parse(r.options.body));
  assert.equal(sent.length,3);assert.equal(sent[0].requestId,sent[1].requestId);assert.deepEqual(sent.map(job=>job.expectedRevision),[0,0,1]);assert.equal(app.bridge.getState().name,'alice');
});

test('a delayed drop listing from a previous planet cannot leak into the newly joined room',async()=>{
  const responses=[];
  const app=await fixture({responseFor:url=>url.endsWith('/drops')?new Promise(resolve=>responses.push(resolve)):undefined});
  await flush();app.join({planet:'ocean'});await flush();
  responses[0]({ok:true,json:async()=>({drops:[{id:'public-drop',room:'home'}]})});await flush();assert.equal(app.spawned.length,0);
  responses[1]({ok:true,json:async()=>({drops:[{id:'ocean-drop',room:'ocean'}]})});await flush();assert.equal(app.spawned[0].id,'ocean-drop');
});

test('returning to the same room accepts only the new drop snapshot, not a delayed earlier listing',async()=>{
  const responses=[],app=await fixture({responseFor:url=>url.endsWith('/drops')?new Promise(resolve=>responses.push(resolve)):undefined});
  await flush();app.join({planet:'ocean'});await flush();app.join();await flush();
  responses[2]({ok:true,json:async()=>({drops:[{id:'current-drop',room:'home'}]})});await flush();
  responses[0]({ok:true,json:async()=>({drops:[{id:'old-claimed-drop',room:'home'}]})});await flush();
  assert.deepEqual(app.spawned.map(drop=>drop.id),['current-drop']);responses[1]({ok:true,json:async()=>({drops:[]})});await flush();
});

test('visiting a garden from another planet preserves the canonical return destination',async()=>{
  const app=await fixture();app.bridge.getState().planet='lava';
  app.socket.message({type:'joined',host:'alice',planet:'home',party:null,room:'home',visiting:'friend',players:[]});
  app.bridge.frame(.2);assert.equal(app.bridge.getState().planet,'lava');assert.equal(app.socket.sent.filter(message=>message.type==='join').length,0);
  app.socket.message({type:'visit',home:{...sessionFor('friend').account,plots:[]}});
  app.socket.message({type:'visit',home:null});app.bridge.frame(.2);
  assert.equal(app.bridge.getState().planet,'lava');assert.equal(app.socket.sent.at(-1).type,'join');assert.equal(app.socket.sent.at(-1).planet,'lava');
});

test('only the elected host publishes enemy AI snapshots, at a bounded rate, including after host migration',async()=>{
  const app=await fixture(),snapshots=[{id:'home:enemy:0',type:'slime',x:25,z:0,hp:12,maxHp:12}];app.bridge.getWorld().enemySnapshots=()=>snapshots;
  for(let i=0;i<60;i++)app.bridge.frame(1/60);
  const packets=()=>app.socket.sent.filter(message=>message.type==='enemies');
  assert.ok(packets().length>=5&&packets().length<=7);assert.deepEqual(packets()[0].enemies,snapshots);
  const count=packets().length;app.socket.message({type:'authority',host:'bob'});for(let i=0;i<60;i++)app.bridge.frame(1/60);assert.equal(packets().length,count);
  app.socket.message({type:'authority',host:'alice'});app.bridge.frame(.02);assert.equal(packets().length,count+1);
});

test('the share-loot control releases only the current owners protected nearby drops',async()=>{
  const now=Date.now(),drop={id:'mine',owner:'alice',ownerId:'alice',room:'home',planet:'home',item:'bone',count:1,x:2,z:0,releaseAt:now+10000,expiresAt:now+30000};
  const app=await fixture({responseFor:url=>url.endsWith('/drops')?{ok:true,json:async()=>({drops:[drop,{...drop,id:'other',owner:'bob'},{...drop,id:'far',x:40},{...drop,id:'public',releaseAt:0}]})}:undefined});
  app.button('Share nearby loot').click();app.button('Share nearby loot').click();await flush();
  const sent=app.requests.filter(r=>r.url.endsWith('/actions')).map(r=>JSON.parse(r.options.body));
  assert.equal(sent.length,1);assert.equal(sent[0].type,'releaseDrop');assert.deepEqual(sent[0].payload,{ownerId:'alice',id:'mine'});assert.match(app.notices.at(-1),/Shared 1/);
  app.setLanguage('vi');assert.ok(app.button('Chia sẻ đồ rơi gần đây'));
});

test('garden owners see their dog chase the visiting thief without receiving the thief damage notice',async()=>{
  const app=await fixture(),bites=[],world=app.bridge.getWorld();world.planet='home';world.position={x:0,z:0};world.farmView={guardBite:point=>bites.push(point)};
  app.socket.message({type:'enter',player:{id:'bob',name:'Bob',planet:'home',space:'home:alice',x:2,z:4}});const notices=app.notices.length;
  app.socket.message({type:'gardenEvent',ownerId:'alice',by:'bob',blocked:true,damage:18});
  assert.deepEqual(structuredClone(bites),[{x:2,z:4}]);assert.equal(app.notices.length,notices);
  app.socket.message({type:'gardenEvent',ownerId:'other',by:'bob',blocked:true,damage:18});assert.equal(bites.length,1);
});

test('an older reconnect response cannot replace the account loaded by a newer reconnect attempt',async()=>{
  let release,sessionCalls=0;const app=await fixture({responseFor:url=>{if(url.endsWith('/auth/session')&&++sessionCalls===2)return new Promise(resolve=>{release=resolve;});}});
  app.button('🏡 Account').click();const reconnect=app.button('Reconnect'),first=reconnect.click();await flush();app.setSession(sessionFor('bob'));await reconnect.click();
  release({ok:true,json:async()=>sessionFor('alice')});await first;assert.equal(app.bridge.getState().name,'bob');
});

test('private mail from two friends keeps the other conversation unread after reading just one thread',async()=>{
 const app=await fixture({friendIds:['bob','carol']}),now=Date.now();
 for(const [i,id]of ['bob','carol'].entries())app.socket.message({type:'dm',id,to:'alice',name:id,message:'Mail '+id,messageId:'mail-'+id,at:now+i});
 assert.equal(app.chatBadge.dataset.badge,'2');app.chatBadge.click();
 app.button('✉ bob : Mail bob').click();assert.equal(app.chatBadge.dataset.badge,'1');
 assert.equal(app.all().find(n=>n.className==='player-mail').hidden,false);assert.equal(app.all().find(n=>n.className==='player-mail-quota').textContent,'Miễn phí 10/10');
});

test('new HUD receives quota acknowledgements, preserves a rejected mail draft, and disables sending at zero',async()=>{
 const app=await fixture({friendIds:['bob']});app.socket.message({type:'dm',id:'bob',to:'alice',name:'bob',message:'Hello',messageId:'greeting',at:Date.now()});app.chatBadge.click();app.button('✉ bob : Hello').click();
 const input=app.all().find(n=>n.className==='player-mail-input'),form=app.all().find(n=>n.className==='player-mail-form');input.value='Private draft';form.listeners.get('submit')({preventDefault(){}});
 const sent=app.socket.sent.find(m=>m.type==='dm');assert.equal(sent.to,'bob');app.socket.message({type:'error',requestId:sent.requestId,message:'Try again'});assert.equal(input.value,'Private draft');
 app.socket.message({type:'dmAck',requestId:sent.requestId,dmLeft:0,day:socialRules.socialDay()});assert.equal(input.value,'');assert.equal(app.all().find(n=>n.className==='player-mail-send').disabled,true);assert.equal(app.all().find(n=>n.className==='player-mail-quota').textContent,'Miễn phí 0/10');
});
