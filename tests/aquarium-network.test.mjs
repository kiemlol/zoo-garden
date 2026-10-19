import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createAccountStore} from '../server/account-store.mjs';
import {createGameServer} from '../server/server.mjs';

function connect(url,cookie){
  const socket=new WebSocket(url.replace('http:','ws:')+'/socket',{headers:{Cookie:cookie}}),queue=[],waiters=[];
  socket.on('message',raw=>{const message=JSON.parse(raw);const i=waiters.findIndex(w=>w.predicate(message));if(i<0)queue.push(message);else{const waiter=waiters.splice(i,1)[0];clearTimeout(waiter.timer);waiter.resolve(message);}});
  return {socket,send:message=>socket.send(JSON.stringify(message)),next(predicate){const i=queue.findIndex(predicate);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const waiter={predicate,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error('Missing fishing presence: '+JSON.stringify(queue.filter(m=>['pose','error','visit','joined'].includes(m.type)).map(m=>({type:m.type,player:m.player,error:m.error,message:m.message})))));},5000)};waiters.push(waiter);});}};
}
test('aquarium actions are authoritative, survive reload and update visitors; fish shows reach live and late observers',async t=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'zoo-aquarium-')),store=await createAccountStore({dataDir,databaseUrl:''});
 const server=await createGameServer({host:'127.0.0.1',port:0,dataDir,accountStore:store,databaseUrl:'',databaseRequired:false}),clients=[];
 t.after(async()=>{clients.forEach(c=>c.socket.terminate());await server.close();await rm(dataDir,{recursive:true,force:true});});
 async function call(cookie,route,body){const r=await fetch(server.url+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function explorer(username){const session=await call(null,'auth/register',{username,password:'Aquarium-test-local-123',name:username}),id=session.data.account.id;
  await store.command({actorId:id,requestId:randomUUID(),expectedRevision:session.data.revision,actionType:'testSetup',hash:'c'.repeat(64),run:records=>{const s=records.get(id).profile;s.bag={fish_jelly:4,fish_whale:2};s.fishRecords.fish_jelly=23.4;s.decorations=[{uid:'tank',id:'deco_aquarium',x:3,z:0,rotation:0}];return true;}});
  const c={id,cookie:session.cookie,...connect(server.url,session.cookie)};clients.push(c);await c.next(m=>m.type==='joined');return c;
 }
 const owner=await explorer('aquarium_owner'),guest=await explorer('aquarium_guest');
 await call(guest.cookie,'friends/request',{id:owner.id});await call(owner.cookie,'friends/accept',{id:guest.id});guest.send({type:'visit',id:owner.id});await guest.next(m=>m.type==='visit'&&m.home);await guest.next(m=>m.type==='joined'&&m.visiting===owner.id);
 async function action(c,type,payload,request){const session=await call(c.cookie,'auth/session'),revision=session.data.revision;return call(c.cookie,'actions',{rulesVersion:1,type,payload,expectedRevision:revision,requestId:request??`r${revision}-${randomUUID()}`});}
 const put=await action(owner,'putAquariumFish',{uid:'tank',id:'fish_jelly'});assert.equal(put.status,200);assert.equal(put.data.profile.bag.fish_jelly,3);assert.deepEqual(put.data.profile.decorations[0].fish,[{id:'fish_jelly',size:23.4}]);
 const home=await guest.next(m=>m.type==='home'&&m.home.decorations[0].fish?.length===1);assert.deepEqual(home.home.decorations[0].fish,put.data.profile.decorations[0].fish);
 assert.equal((await action(guest,'putAquariumFish',{uid:'tank',id:'fish_jelly'})).status,409,'visiting cannot mutate a tank');
 assert.equal((await action(owner,'putAquariumFish',{uid:'tank',id:'fish_whale'})).status,409,'wrong species size rejected on server');
 const replaySession=await call(owner.cookie,'auth/session'),revision=replaySession.data.revision,requestId=`r${revision}-${randomUUID()}`,packet={rulesVersion:1,type:'putAquariumFish',payload:{uid:'tank',id:'fish_jelly'},expectedRevision:revision,requestId};
 const first=await call(owner.cookie,'actions',packet),retry=await call(owner.cookie,'actions',packet);assert.equal(first.status,200);assert.equal(retry.status,200);assert.equal(retry.data.replayed,true);assert.equal((await call(owner.cookie,'auth/session')).data.profile.decorations[0].fish.length,2,'retry never adds a third fish');
 assert.equal((await action(owner,'removeDecoration',{uid:'missing'})).status,409,'unknown tank changes nothing');
 const take=await action(owner,'takeAquariumFish',{uid:'tank',index:0});assert.equal(take.status,200);assert.equal(take.data.profile.bag.fish_jelly,3);
 const show=await action(owner,'showFish',{id:'fish_jelly'});assert.equal(show.status,200);assert.equal(show.data.result.size,23.4);const seen=await guest.next(m=>m.type==='pose'&&m.player.id===owner.id&&m.player.visual?.fishShow?.until===show.data.result.until);assert.deepEqual(seen.player.visual.fishShow,show.data.result);
 guest.send({type:'join',planet:'home'});const roster=await guest.next(m=>m.type==='joined');assert.deepEqual(roster.players.find(p=>p.id===owner.id).visual.fishShow,show.data.result,'late observer keeps show pose');
 await new Promise(r=>setTimeout(r,80));owner.send({type:'pose',x:0,z:0,visual:{fishShow:{id:'fish_whale',size:999999,until:Date.now()+999999}}});const checked=await guest.next(m=>m.type==='pose'&&m.player.id===owner.id);assert.deepEqual(checked.player.visual.fishShow,show.data.result,'client cannot forge species, size or duration');
 assert.equal((await action(owner,'showFish',{id:'fish_koi'})).status,409,'unowned fish rejected');
 const loaded=await call(owner.cookie,'auth/session');assert.equal(loaded.data.profile.decorations[0].fish.length,1);assert.equal(loaded.data.profile.decorations[0].fish[0].size,23.4);
 guest.send({type:'visit',id:owner.id});await guest.next(m=>m.type==='visit'&&m.home);
 const moved=await action(owner,'moveDecoration',{uid:'tank',x:8,z:4,rotation:Math.PI/2});assert.equal(moved.status,200,JSON.stringify(moved.data));assert.equal(moved.data.profile.decorations[0].uid,'tank');assert.equal(moved.data.profile.decorations[0].fish[0].size,23.4);assert.equal(moved.data.profile.bag.deco_aquarium,undefined,'moving consumes no spare copy');
 const movedHome=await guest.next(m=>m.type==='home'&&m.home.decorations[0]?.x===8);assert.deepEqual(movedHome.home.decorations,moved.data.profile.decorations);
 const packed=await action(owner,'removeDecoration',{uid:'tank'});assert.equal(packed.status,200,JSON.stringify(packed.data));assert.equal(packed.data.profile.bag.deco_aquarium,1);assert.equal(packed.data.profile.bag.fish_jelly,4);assert.equal(packed.data.profile.decorations.length,0);assert.equal((await action(owner,'removeDecoration',{uid:'tank'})).status,409,'packing cannot duplicate items');
});
