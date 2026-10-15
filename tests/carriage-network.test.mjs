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
  return {socket,send:message=>socket.send(JSON.stringify(message)),next(predicate){const i=queue.findIndex(predicate);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const waiter={predicate,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error('Missing carriage presence: '+JSON.stringify(queue.filter(m=>['pose','error','visit','joined'].includes(m.type)).map(m=>({type:m.type,player:m.player,error:m.error,message:m.message})))));},5000)};waiters.push(waiter);});}};
}
test('two online players see boarding, sitting, late roster state and dismount; forged rides are rejected',async t=>{
  const dataDir=await mkdtemp(path.join(os.tmpdir(),'zoo-carriage-network-')),store=await createAccountStore({dataDir,databaseUrl:''});
  const server=await createGameServer({host:'127.0.0.1',port:0,dataDir,accountStore:store,databaseUrl:'',databaseRequired:false}),clients=[];
  t.after(async()=>{clients.forEach(c=>c.socket.terminate());await server.close();await rm(dataDir,{recursive:true,force:true});});
  async function call(cookie,route,body){const r=await fetch(server.url+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200);return {data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
  async function explorer(username,carriage){
    const session=await call(null,'auth/register',{username,password:'Carriage-test-local-123',name:username}),id=session.data.account.id;
    if(carriage)await store.command({actorId:id,requestId:randomUUID(),expectedRevision:session.data.revision,actionType:'testSetup',hash:'a'.repeat(64),run:records=>{records.get(id).profile.decorations=[{uid:'decor-1',id:'deco_ghost_carriage',x:4,z:-4,rotation:0}];return true;}});
    const c={id,cookie:session.cookie,...connect(server.url,session.cookie)};clients.push(c);await c.next(m=>m.type==='joined');return c;
  }
  const owner=await explorer('carriage_owner',true),guest=await explorer('carriage_guest',false);
  await call(guest.cookie,'friends/request',{id:owner.id});await call(owner.cookie,'friends/accept',{id:guest.id});
  guest.send({type:'visit',id:owner.id});const visit=await guest.next(m=>m.type==='visit'&&m.home);assert.equal(visit.home.decorations.length,1,'server garden contains the carriage');await guest.next(m=>m.type==='joined'&&m.visiting===owner.id);
  const pose=(phase,extra={})=>({uid:'decor-1',phase,scale:.62,progress:phase==='seated'?1:.5,lift:phase==='seated'?.2:1,...extra});
  async function sendRide(carriage,x=4,z=-4.35){await new Promise(r=>setTimeout(r,80));owner.send({type:'pose',x,z,y:carriage?.lift??0,moving:false,visual:{size:99,carriage}});return guest.next(m=>m.type==='pose'&&m.player.id===owner.id&&m.player.visual&&m.player.visual.carriage?.phase===carriage?.phase);}
  assert.equal((await sendRide(pose('boarding'),3,-4)).player.visual.carriage.phase,'boarding');
  const sitting=await sendRide(pose('seated'));assert.equal(sitting.player.visual.carriage.scale,.62);assert.equal(sitting.player.visual.size,1,'rider scale never changes authoritative combat size');
  guest.send({type:'join',planet:'home'});const roster=await guest.next(m=>m.type==='joined');assert.equal(roster.players.find(p=>p.id===owner.id).visual.carriage.phase,'seated','a new observer receives the current passenger');
  assert.equal((await sendRide(pose('leaving'),5,-4)).player.visual.carriage.phase,'leaving');
  assert.equal((await sendRide(null,6.3,-4)).player.visual.carriage,null,'explicit null clears the remote pose');
  for(const malformed of [pose('seated',{uid:'decor-999'}),pose('seated',{scale:50}),pose('seated',{lift:20})]){
    await sendRide(pose('seated'));await new Promise(r=>setTimeout(r,80));owner.send({type:'pose',x:4,z:-4.35,y:0,visual:{carriage:malformed}});
    const rejected=await guest.next(m=>m.type==='pose'&&m.player.id===owner.id&&m.player.visual?.carriage===null);assert.equal(rejected.player.visual.carriage,null);
  }
});
