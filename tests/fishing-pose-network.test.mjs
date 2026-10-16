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
test('server relays fishing poses and contextual rods to live/late observers, validates them and clears on cancel',async t=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'zoo-fishing-pose-')),store=await createAccountStore({dataDir,databaseUrl:''});
 const server=await createGameServer({host:'127.0.0.1',port:0,dataDir,accountStore:store,databaseUrl:'',databaseRequired:false}),clients=[];
 t.after(async()=>{clients.forEach(c=>c.socket.terminate());await server.close();await rm(dataDir,{recursive:true,force:true});});
 async function call(cookie,route,body){const r=await fetch(server.url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});assert.equal(r.status,200);return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function explorer(username){const session=await call(null,'auth/register',{username,password:'Fishing-test-local-123',name:username}),id=session.data.account.id;
  await store.command({actorId:id,requestId:randomUUID(),expectedRevision:session.data.revision,actionType:'testSetup',hash:'c'.repeat(64),run:records=>{const s=records.get(id).profile;s.bag.rod=1;s.bag.rod_gold=1;s.gear.weapon='sword_wood';return true;}});
  const c={id,cookie:session.cookie,...connect(server.url,session.cookie)};clients.push(c);await c.next(m=>m.type==='joined');return c;
 }
 const owner=await explorer('fishing_owner'),guest=await explorer('fishing_guest');await call(guest.cookie,'friends/request',{id:owner.id});await call(owner.cookie,'friends/accept',{id:guest.id});guest.send({type:'visit',id:owner.id});await guest.next(m=>m.type==='visit'&&m.home);await guest.next(m=>m.type==='joined'&&m.visiting===owner.id);
 async function send(fishing,expected=fishing,x=-7.5,z=7.5){await new Promise(r=>setTimeout(r,80));owner.send({type:'pose',x,z,y:0,moving:false,visual:{size:99,fishing}});return guest.next(m=>m.type==='pose'&&m.player.id===owner.id&&JSON.stringify(m.player.visual?.fishing)===JSON.stringify(expected));}
 const cast={phase:'cast',cast:.25,tension:0,rod:'rod_gold'};await send(cast);
 const wait={...cast,phase:'wait',cast:0};const seen=await send(wait);assert.equal(seen.player.visual.size,1,'fishing visual cannot change combat size');
 guest.send({type:'join',planet:'home'});const roster=await guest.next(m=>m.type==='joined');assert.deepEqual(roster.players.find(p=>p.id===owner.id).visual.fishing,wait,'late observer gets current pose and contextual rod');
 await send({...wait,phase:'fight',tension:.8});await send(null);
 for(const bad of [{...wait,tension:5},{...wait,cast:Infinity},{...wait,rod:'rod_steady'},{...wait,rod:'sword_wood'}]){await send(wait);await send(bad,null);}
 await send(wait);await send(wait,null,0,0); // A real owned rod and proximity to an actual pond are required.
});
