import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {createAccountStore} from '../server/account-store.mjs';
import {createGameServer} from '../server/server.mjs';
import {createPlayerSocial,socialState} from '../server/player-social.mjs';
import {rememberAccount} from '../server/account-cache.mjs';
import {socialDay,socialText} from '../src/social-rules.ts';
import {newGame} from '../src/model.ts';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function socket(url,cookie){const ws=new WebSocket(url.replace('http:','ws:')+'/socket',{headers:{Cookie:cookie}}),queue=[],waiters=[];ws.on('message',raw=>{const m=JSON.parse(raw),i=waiters.findIndex(w=>w.p(m));if(i<0)queue.push(m);else{const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}});return{ws,queue,send:m=>ws.send(JSON.stringify(m)),next(p){const i=queue.findIndex(p);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={p,resolve,timer:setTimeout(()=>reject(Error('Missing social packet: '+JSON.stringify(queue.map(m=>[m.type,m.message])))),5000)};waiters.push(w);});}};}
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'zoo-social-')),store=await createAccountStore({dataDir:dir,databaseUrl:''}),server=await createGameServer({port:0,host:'127.0.0.1',dataDir:dir,databaseUrl:'',accountStore:store}),clients=[];t.after(async()=>{clients.forEach(c=>c.ws.terminate());await server.close();await rm(dir,{recursive:true,force:true});});
 const call=async(cookie,route,value)=>{const r=await fetch(server.url+'/api/'+route,{method:value?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:value?JSON.stringify(value):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 async function player(name,planet='home'){const a=await call(null,'auth/register',{username:name,password:'Social-fixture-123',name}),id=a.data.account.id;assert.equal(a.status,200);if(planet!=='home'){await store.command({actorId:id,requestId:randomUUID(),expectedRevision:0,hash:'a'.repeat(64),actionType:'fixture',run:r=>{const p=r.get(id).profile;p.planet=planet;p.discovered.push(planet);return true;}});await call(a.cookie,'auth/session');}const c={id,cookie:a.cookie,...socket(server.url,a.cookie)};clients.push(c);c.joined=await c.next(m=>m.type==='joined');return c;}
 return{dir,store,server,call,player};}

test('public chat is planet-scoped, filtered, bounded, rate-limited and survives obsolete party packets without a new room',async t=>{
 const h=await fixture(t),a=await h.player('chat_a'),b=await h.player('chat_b'),c=await h.player('chat_c','ocean');assert.equal(a.joined.room,'home');assert.equal(c.joined.room,'ocean');
 a.send({type:'party'});a.send({type:'join',planet:'home',party:'OLD123'});
 const requestId=randomUUID();a.send({type:'chat',requestId,message:'Hello shit — xin chào'});assert.equal((await b.next(m=>m.type==='chat')).message,'Hello *** — xin chào');await a.next(m=>m.type==='chatAck');
 a.send({type:'chat',requestId:randomUUID(),message:'Spam'});assert.match((await a.next(m=>m.type==='error')).message,/wait/);
 a.send({type:'chat',requestId:randomUUID(),message:'x'.repeat(201)});assert.match((await a.next(m=>m.type==='error')).message,/200/);await pause(100);assert.equal(c.queue.some(m=>m.type==='chat'),false);assert.equal(b.queue.some(m=>m.type==='party'),false);
});

test('likes are atomic, persistent and one per sender/day; blocking affects both chat and private mail',async t=>{
 const h=await fixture(t),a=await h.player('like_a'),b=await h.player('like_b'),c=await h.player('like_c');const before=(await h.call(a.cookie,'auth/session')).data.revision;
 const results=await Promise.all([h.call(a.cookie,'social/like',{id:b.id}),h.call(a.cookie,'social/like',{id:c.id})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await h.call(a.cookie,'auth/session')).data.revision,before);
 assert.equal((await h.call(a.cookie,'social/like',{id:a.id})).status,400);assert.equal((await h.store.list()).reduce((sum,x)=>sum+(x.social?.likes??0),0),1);
 await h.call(a.cookie,'friends/request',{id:b.id});await h.call(b.cookie,'friends/accept',{id:a.id});assert.equal((await h.call(b.cookie,'social/block',{id:a.id})).status,200);
 a.send({type:'chat',requestId:randomUUID(),message:'blocked text'});await a.next(m=>m.type==='chatAck');await c.next(m=>m.type==='chat');await pause(100);assert.equal(b.queue.some(m=>m.type==='chat'),false);
 await pause(2010);a.send({type:'dm',requestId:randomUUID(),to:b.id,text:'blocked mail'});assert.match((await a.next(m=>m.type==='error')).message,/chặn/);assert.equal((await h.call(b.cookie,'social/state')).data.inbox.length,0);
});

test('private mail only reaches its two friends, persists for offline inboxes and acknowledges retries once',async t=>{
 const h=await fixture(t),a=await h.player('mail_a'),b=await h.player('mail_b'),c=await h.player('mail_c');await h.call(a.cookie,'friends/request',{id:b.id});await h.call(b.cookie,'friends/accept',{id:a.id});
 const entry={type:'dm',requestId:randomUUID(),to:b.id,text:'Thư riêng <b>plain text</b>'};a.send(entry);const received=await b.next(m=>m.type==='dm');assert.equal(received.message,entry.text);assert.equal((await a.next(m=>m.type==='dmAck')).dmLeft,9);
 a.send(entry);assert.equal((await a.next(m=>m.type==='dmAck')).dmLeft,9);await pause(80);assert.equal(b.queue.some(m=>m.type==='dm'),false);assert.equal(c.queue.some(m=>m.type==='dm'),false);
 const inbox=(await h.call(b.cookie,'auth/session')).data.social.inbox;assert.equal(inbox.length,1);assert.equal(inbox[0].id,a.id);assert.equal((await h.call(a.cookie,'auth/session')).data.revision,0);
 c.send({type:'dm',requestId:randomUUID(),to:b.id,text:'Not a friend'});assert.match((await c.next(m=>m.type==='error')).message,/bạn bè/);
});

test('a planet accepts more than 24 explorers into the same roster and chat',async t=>{
 const h=await fixture(t),players=[];for(let i=0;i<26;i++)players.push(await h.player('crowd_'+i));assert.equal(players.at(-1).joined.players.length,26);assert.equal(players.at(-1).joined.room,'home');
 players[0].send({type:'chat',message:'Hello everyone',requestId:randomUUID()});for(const p of players)assert.equal((await p.next(m=>m.type==='chat')).message,'Hello everyone');
});

test('daily mail budget and likes reset exactly at Vietnam midnight, survive reload, and do not modify game saves',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'zoo-social-day-'));let store=await createAccountStore({dataDir:dir,databaseUrl:''});t.after(async()=>{await store.close();await rm(dir,{recursive:true,force:true});});
 for(const id of ['alice','bob'])await store.create({id,username:id,hash:'h',salt:'s',friends:[id==='alice'?'bob':'alice'],requests:[],profile:newGame(id)});
 let at=Date.parse('2026-10-16T16:59:59.000Z');const accounts=new Map();let service=createPlayerSocial({store,accounts,remember:v=>rememberAccount(accounts,v),now:()=>at});
 assert.equal(socialDay(at),'2026-10-16');await service.like('alice','bob');await assert.rejects(service.like('alice','bob'),e=>e.status===409);
 for(let i=0;i<10;i++)await service.dm('alice','bob','Thư '+i,randomUUID());await assert.rejects(service.dm('alice','bob','Hết lượt',randomUUID()),e=>e.status===429);
 assert.equal(socialState(await store.get('alice'),at).dmLeft,0);assert.equal((await store.get('alice')).profileRevision||0,0);
 await store.close();store=await createAccountStore({dataDir:dir,databaseUrl:''});service=createPlayerSocial({store,accounts,remember:v=>rememberAccount(accounts,v),now:()=>at});assert.equal(socialState(await store.get('alice'),at).dmLeft,0);
 at+=1000;assert.equal(socialDay(at),'2026-10-17');await service.like('alice','bob');assert.equal((await store.get('bob')).social.likes,2);await service.dm('alice','bob','Ngày mới',randomUUID());assert.equal(socialState(await store.get('alice'),at).dmLeft,9);
});

test('chat validation counts unicode characters and filters banned words without treating text as HTML',()=>{assert.equal(socialText('✨'.repeat(200)).length,200);assert.throws(()=>socialText('✨'.repeat(201)),/200/);assert.equal(socialText('shirt shit địt!'),'shirt *** ***!');assert.equal(socialText('<img onerror=x>'),'<img onerror=x>');});

test('profile reads expose canonical appearance only; invitations reach their target and reports are logged',async t=>{
 const h=await fixture(t),a=await h.player('profile_a'),b=await h.player('profile_b','ocean'),logs=[];t.mock.method(console,'info',value=>logs.push(JSON.parse(value)));
 const view=await h.call(a.cookie,'social/profile/'+b.id);assert.equal(view.status,200);assert.equal(view.data.player.planet,'ocean');assert.deepEqual(view.data.player.gear,(await h.store.get(b.id)).profile.gear);for(const key of ['bag','energy','hash','salt','social'])assert.equal(view.data.player[key],undefined);
 assert.equal((await h.call(null,'social/profile/'+b.id)).status,401);
 assert.equal((await h.call(a.cookie,'social/invite',{id:b.id})).status,200);assert.equal((await b.next(m=>m.type==='playInvite')).player.id,a.id);
 assert.equal((await h.call(a.cookie,'social/report',{id:b.id,reason:'Kiểm thử báo cáo'})).status,200);assert.equal(logs[0].type,'player-report');assert.equal(logs[0].by,a.id);assert.equal(logs[0].target,b.id);
 await h.call(b.cookie,'social/block',{id:a.id});assert.equal((await h.call(a.cookie,'social/invite',{id:b.id})).status,403);
});
