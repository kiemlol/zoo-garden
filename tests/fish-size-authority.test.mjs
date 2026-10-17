import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import crypto from 'node:crypto';
import {syncBuiltinESMExports} from 'node:module';
import * as M from '../src/model.ts';
import {createAccountStore} from '../server/account-store.mjs';
import {createActionService} from '../server/action-service.mjs';

test('server tickets enforce 800 cm for ordinary and mystery whales without trusting client size',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'zoo-fish-size-')),store=await createAccountStore({dataDir:dir,databaseUrl:''}),old=M.FISH_WEIGHTS.home;
 t.after(async()=>{M.FISH_WEIGHTS.home=old;t.mock.restoreAll();syncBuiltinESMExports();await store.close();await rm(dir,{recursive:true,force:true});});
 // Force the ordinary upper edge and the mystery's fish branch, not its random treasure branch.
 let roll=.999999;t.mock.method(crypto,'randomInt',(min,max)=>min+Math.floor((max-min)*roll));syncBuiltinESMExports();
 M.FISH_WEIGHTS.home=[['fish_whale',1]];
 const profile=M.newGame('size-test');profile.bag.rod=1;profile.gear.weapon='rod';
 await store.create({id:'size-test',username:'size_test',hash:'h',salt:'s',friends:[],requests:[],profile});
 const peer={planet:'home',room:'home',pose:{x:-7.5,z:15.3}};
 for(const mystery of [false,true]){
  roll=mystery?.1:.999999;
  const execute=createActionService({store,getPeer:()=>peer,mysteryRandom:()=>mystery?0:1});
  async function action(type,payload){return execute('size-test',{rulesVersion:1,requestId:randomUUID(),expectedRevision:(await store.get('size-test')).profileRevision||0,type,payload});}
  const start=await action('fishStart',{rodId:'rod',water:'home',cast:{x:-7.5,z:13.5},size:99999});
  const ticket=(await store.get('size-test')).fishingTicket;
  assert.equal(start.result.pick.id,'fish_whale');assert.equal(start.result.pick.mystery,mystery);
  assert.ok(start.result.pick.size>=400&&start.result.pick.size<=800);
  assert.ok(ticket.outcome.size>=400&&ticket.outcome.size<=800);
  if(mystery)assert.equal(ticket.outcome.size,800);
  await action('fishCancel',{ticketId:start.result.ticketId});
 }
});
