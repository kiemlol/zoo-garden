import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createAccountStore} from '../server/account-store.mjs';
import {createGameServer} from '../server/server.mjs';
import {createCombatAuthority} from '../server/combat-authority.mjs';
import {enemyRoster} from '../src/enemy-roster.ts';
import * as Game from '../src/model.ts';
import {CURSED_BENCH,CURSED_COFFIN,PATCHWORK_PET} from '../src/halloween-content.ts';
import {FURNITURE_LEAVE_MS} from '../src/furniture-rules.ts';

function connect(url,cookie){
 const socket=new WebSocket(url.replace('http:','ws:')+'/socket',{headers:{Cookie:cookie}}),queue=[],waiters=[];
 socket.on('message',raw=>{const m=JSON.parse(raw),i=waiters.findIndex(w=>w.predicate(m));if(i<0)queue.push(m);else{const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}});
 return{socket,send:m=>socket.send(JSON.stringify(m)),next(predicate){const i=queue.findIndex(predicate);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={predicate,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Missing furniture message: '+JSON.stringify(queue.filter(m=>['error','furnitureResult','poseFix'].includes(m.type)))));},5000)};waiters.push(w);});}};
}
test('online reservations synchronize two bench sitters, reject a third and forged poses, relay coffin time and release on disconnect',async t=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'zoo-halloween-network-')),store=await createAccountStore({dataDir,databaseUrl:''});
 const server=await createGameServer({host:'127.0.0.1',port:0,dataDir,accountStore:store,databaseUrl:'',databaseRequired:false}),clients=[];
 t.after(async()=>{clients.forEach(c=>c.socket.terminate());await server.close();await rm(dataDir,{recursive:true,force:true});});
 async function call(cookie,route,body){const r=await fetch(server.url+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200,route);return{data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function explorer(username,setup=false){const s=await call(null,'auth/register',{username,password:'Local-halloween-123',name:username}),id=s.data.account.id;if(setup)await store.command({actorId:id,requestId:randomUUID(),expectedRevision:s.data.revision,actionType:'testSetup',hash:'a'.repeat(64),run:records=>{records.get(id).profile.decorations=[{uid:'bench',id:CURSED_BENCH,x:3,z:0,rotation:0},{uid:'coffin',id:CURSED_COFFIN,x:3,z:4,rotation:0}];return true;}});const c={id,cookie:s.cookie,...connect(server.url,s.cookie)};clients.push(c);await c.next(m=>m.type==='joined');return c;}
 const owner=await explorer('halloween_owner',true),guest=await explorer('halloween_guest'),third=await explorer('halloween_third');
 for(const c of [guest,third]){await call(c.cookie,'friends/request',{id:owner.id});await call(owner.cookie,'friends/accept',{id:c.id});c.send({type:'visit',id:owner.id});await c.next(m=>m.type==='joined'&&m.visiting===owner.id);await c.next(m=>m.type==='visit'&&m.home?.id===owner.id);}
 async function pose(c,x,z,visual={}){await new Promise(r=>setTimeout(r,85));c.send({type:'pose',x,z,y:0,moving:false,visual});}
 async function use(c,uid){const requestId=randomUUID();c.send({type:'furnitureUse',uid,requestId});return c.next(m=>m.type==='furnitureResult'&&m.requestId===requestId);}
 for(const c of clients)await pose(c,2,0);
 const [a,b]=await Promise.all([use(owner,'bench'),use(guest,'bench')]);assert.deepEqual([a.pose.seat,b.pose.seat].sort(),[0,1]);assert.equal(a.pose.garden,owner.id);assert.match((await use(third,'bench')).error,/no free/);
 // Editing must not remove occupied seats, including a visitor's reservation.
 for(const type of ['moveDecoration','removeDecoration']){
  const session=await call(owner.cookie,'auth/session');const response=await fetch(server.url+'/api/actions',{method:'POST',headers:{'Content-Type':'application/json',Cookie:owner.cookie},body:JSON.stringify({rulesVersion:1,type,payload:{uid:'bench',x:8,z:5},expectedRevision:session.data.revision,requestId:randomUUID()})});assert.equal(response.status,409);assert.match(JSON.stringify(await response.json()),/Leave this decoration/);assert.equal((await store.get(owner.id)).profile.decorations.find(d=>d.uid==='bench').x,3);
 }
 const other=await third.next(m=>m.type==='pose'&&m.player.id===guest.id&&m.player.visual?.furniture?.seat===b.pose.seat);assert.equal(other.player.visual.furniture.since,b.pose.since);
 await pose(third,2,0,{furniture:{uid:'bench',id:CURSED_BENCH,seat:99,since:1,garden:owner.id}});const forged=await owner.next(m=>m.type==='pose'&&m.player.id===third.id&&m.player.visual?.furniture===null);assert.equal(forged.player.visual.furniture,null,'client cannot author furniture state');
 third.send({type:'join',planet:'home'});const roster=await third.next(m=>m.type==='joined');assert.equal(roster.players.find(p=>p.id===owner.id).visual.furniture.uid,'bench','late observers get current seat');
 // Revisit the owner after testing a fresh roster.
 third.send({type:'visit',id:owner.id});await third.next(m=>m.type==='visit'&&m.home?.id===owner.id);await pose(third,2,0);
 const left=await use(owner,null);assert.equal(left.pose,null);assert.equal((await use(owner,null)).pose,null,'duplicate exit stays cleared');assert.ok((await use(third,'bench')).pose,'another player can sit immediately');
 guest.socket.close();await third.next(m=>m.type==='leave'&&m.id===guest.id);await pose(owner,2,0);assert.ok((await use(owner,'bench')).pose,'disconnect frees a seat');await use(owner,null);await new Promise(r=>setTimeout(r,FURNITURE_LEAVE_MS+30));
 await pose(owner,3,2);const coffin=await use(owner,'coffin');assert.equal(coffin.pose.id,CURSED_COFFIN);const seen=await third.next(m=>m.type==='pose'&&m.player.id===owner.id&&m.player.visual?.furniture?.uid==='coffin');assert.equal(seen.player.visual.furniture.since,coffin.pose.since);await use(third,null);await new Promise(r=>setTimeout(r,FURNITURE_LEAVE_MS+30));await pose(third,3,2);assert.match((await use(third,'coffin')).error,/no free/);
 owner.socket.close();await third.next(m=>m.type==='leave'&&m.id===owner.id);assert.ok((await use(third,'coffin')).pose,'coffin also releases after disconnect');
});

test('server-owned pumpkin skill broadcasts three canonical transformations, expires and respects its cooldown and safe zone',async t=>{
 const dataDir=await mkdtemp(path.join(os.tmpdir(),'zoo-pumpkin-authority-')),store=await createAccountStore({dataDir,databaseUrl:''});
 const profile=Game.newGame();profile.level=45;profile.gear={pet2:PATCHWORK_PET};profile.bag[PATCHWORK_PET]=1;
 const account=await store.create({id:'pumpkin',username:'pumpkin',hash:'h',salt:'s',profile,friends:[],requests:[],profileRevision:0});
 const peer={account,active:true,visit:null,planet:'home',room:'home',pose:{x:-30,z:0,facing:0,moving:false},socket:{}},peers=new Map([['pumpkin',peer]]),room={id:'home',members:new Set(['pumpkin']),host:'pumpkin',enemies:[],killed:new Set()},rooms=new Map([['home',room]]),messages=[];
 const authority=createCombatAuthority({store,peers,rooms,remember:v=>v,onError:e=>assert.fail(e.stack),send(){},broadcast:(_,m)=>messages.push(m),onDeath(){}});
 t.after(async()=>{await authority.close();await store.close();await rm(dataDir,{recursive:true,force:true});});
 const definitions=enemyRoster('home').filter(e=>e.type==='mushroom').slice(0,4);assert.equal(definitions.length,4);
 authority.acceptSnapshots(room,definitions.map((d,i)=>({id:d.id,type:d.type,x:-30+i*.3,z:2,hp:1})));const enemies=definitions.map(d=>authority.state(room).enemies.get(d.id));assert.ok(enemies.every(Boolean));
 const engine=authority.engineFor(peer);engine.sim.update(.01);const spells=()=>messages.filter(m=>m.type==='status'&&m.kind==='pumpkin');assert.equal(spells().length,3);assert.ok(spells().every(m=>m.duration===3));assert.equal(enemies.filter(e=>e.statuses.pumpkin>0).length,3);assert.ok(enemies.every(e=>e.hp===e.maxHp),'spell deals no damage');
 // Host attempts cannot move a transformed creature or start its attack.
 const first=enemies.find(e=>e.statuses.pumpkin>0),at={x:first.x,z:first.z};authority.acceptSnapshots(room,[{id:first.id,type:first.type,x:first.x+1,z:first.z,phase:'windup',attackCount:10}]);assert.equal(first.x,at.x);assert.equal(first.z,at.z);
 await new Promise(r=>setTimeout(r,3150));assert.ok(enemies.every(e=>!(e.statuses.pumpkin>0)),'canonical timer expires even with no AI host updates');assert.equal(spells().length,3);engine.sim.update(7);assert.equal(spells().length,6);
 peer.pose={x:0,z:0,facing:0,moving:false};engine.sim.reset();const count=spells().length;engine.sim.update(10);assert.equal(spells().length,count,'no combat spell from the safe village');
});
