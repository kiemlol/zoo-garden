import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import * as M from '../src/model.ts';
import {FishingSimulation,lineBreakChance,lineRoll,lineSnaps,catchBonus} from '../src/fishing.ts';
import {ContextGearSelection} from '../src/context-gear.ts';
import {weaponModelName} from '../src/assets.ts';
import {iconPath} from '../src/item-icons.ts';
import {createAccountStore} from '../server/account-store.mjs';
import {createActionService} from '../server/action-service.mjs';
import {ACTION_RULES_VERSION} from '../src/actions.ts';

const editions=['rod_key','rod_key_test'];
const recipeIndex=M.RECIPES.findIndex(r=>r.result==='rod_key'&&r.station==='forge');
const recipe=M.RECIPES[recipeIndex];

test('both special key rods lead every other rod in fishing quality and line strength without changing old rods',()=>{
 assert.deepEqual(M.ITEMS.rod_key_test.weapon,M.ITEMS.rod_key.weapon);
 for(const id of editions){
  const rod=M.ITEMS[id].weapon;
  assert.equal(M.isSpecial(id),true);assert.equal(rod.steady,true);
  for(const [otherId,item] of Object.entries(M.ITEMS))if(item.weapon?.kind==='rod'&&!editions.includes(otherId)){
   assert.ok(rod.quality>item.weapon.quality,otherId);assert.ok(lineBreakChance(rod)<lineBreakChance(item.weapon),otherId);
   const simulate=w=>new FishingSimulation({...w,bait:false,choose:()=>null,random:()=>.5});
   assert.ok(simulate(rod).nextWait()<simulate(item.weapon).nextWait(),otherId);
   assert.ok(simulate(rod).biteWindow>simulate(item.weapon).biteWindow,otherId);
   assert.ok(catchBonus(false,rod.quality)>catchBonus(false,item.weapon.quality),otherId);
   const s=M.newGame();s.bag={[otherId]:1,[id]:1};assert.equal(new ContextGearSelection().forFishing(s),id);
  }
 }
 assert.deepEqual(['rod','rod_gold','rod_steady','rod_lava'].map(id=>[M.ITEMS[id].weapon.quality,lineBreakChance(M.ITEMS[id].weapon)]),[[.3,.6],[.7,.3],[.9,.1],[1.1,.1]]);
 assert.equal(weaponModelName('rod_key_test'),'rod_key');assert.equal(iconPath('rod_key_test'),iconPath('rod_key'));
});

test('offline: premium purchase, more expensive crafting, material consumption and 1-energy trial stay distinct',()=>{
 const s=M.newGame();s.bag={};s.energy=9999;assert.equal(M.buy(s,'rod_key'),false);s.energy=10000;assert.equal(M.buy(s,'rod_key'),true);assert.equal(s.energy,0);
 assert.equal(M.shopPrice(s,'rod_key_test'),1);assert.equal(M.specialPrice('rod_key_test'),1);assert.equal(M.buy(s,'rod_key_test'),false);
 s.energy=1;assert.equal(M.buy(s,'rod_key_test'),true);assert.equal(s.energy,0);assert.equal(M.equip(s,'rod_key_test'),true);assert.equal(s.gear.weapon,'rod_key_test');
 assert.equal(M.ITEMS.rod_key_test.noTrade,true);M.unequip(s,'weapon');assert.equal(M.sell(s,'rod_key_test'),0);assert.equal(s.energy,0);
 assert.ok(M.ITEMS.rod_key.sell>M.ITEMS.rod_lava.sell);
 const lava=M.RECIPES.find(r=>r.result==='rod_lava'&&r.station==='forge');assert.ok(recipe.energy>lava.energy);assert.ok(Object.keys(recipe.materials).length>Object.keys(M.ITEMS.rod.materials).length);
 const c=M.newGame();c.bag={...recipe.materials};c.energy=recipe.energy;c.worldRewards.lava.braziers=[0,1,2];
 c.bag.gear--;assert.equal(M.craft(c,recipeIndex),false);assert.equal(c.energy,recipe.energy);c.bag.gear++;
 assert.equal(M.craft(c,recipeIndex),true);assert.equal(c.energy,0);assert.equal(c.bag.rod_key,1);for(const id of Object.keys(recipe.materials))assert.equal(c.bag[id]??0,0,id);
});

test('online: server enforces each price/recipe and uses the same 1% line rule for both editions and catch proofs',async t=>{
 let now=2_000_000_000_000;t.mock.method(Date,'now',()=>now);
 const dir=await mkdtemp(join(tmpdir(),'zoo-key-economy-')),store=await createAccountStore({dataDir:dir,databaseUrl:''});
 t.after(async()=>{await store.close();await rm(dir,{recursive:true,force:true});});
 const peer={planet:'home',room:'home',pose:{x:-7.5,z:15.3}},execute=createActionService({store,getPeer:()=>peer,mysteryRandom:()=>.99});
 async function account(id,energy,bag={}){const profile=M.newGame(id);profile.energy=energy;profile.bag=bag;profile.worldRewards.lava.braziers=[0,1,2];await store.create({id,username:id,hash:'h',salt:'s',friends:[],requests:[],profile});}
 async function act(id,type,payload,requestId=randomUUID()){return execute(id,{rulesVersion:ACTION_RULES_VERSION,requestId,expectedRevision:(await store.get(id)).profileRevision||0,type,payload});}
 await account('trial',1);const bought=await act('trial','buy',{id:'rod_key_test',price:0});assert.equal(bought.profile.energy,0);assert.equal(bought.profile.bag.rod_key_test,1);
 await assert.rejects(act('trial','buy',{id:'rod_key_test',price:0}),e=>e.status===409);
 await account('premium',10000);const premium=await act('premium','buy',{id:'rod_key',price:1});assert.equal(premium.profile.energy,0);assert.equal(premium.profile.bag.rod_key,1);
 await account('short',9999);await assert.rejects(act('short','buy',{id:'rod_key',price:1}),e=>e.status===409);
 await account('crafter',recipe.energy,{...recipe.materials});const made=await act('crafter','craft',{index:recipeIndex,cost:0});assert.equal(made.profile.energy,0);assert.equal(made.profile.bag.rod_key,1);for(const id of Object.keys(recipe.materials))assert.equal(made.profile.bag[id]??0,0,id);
 for(const [actor,rodId] of [['trial','rod_key_test'],['premium','rod_key']]){
  const start=await act(actor,'fishStart',{rodId,water:'home',cast:{x:-7.5,z:13.5}}),ticket=(await store.get(actor)).fishingTicket;
  assert.equal(ticket.breakChance,.01);assert.equal(ticket.steady,true);
  const simulation=new FishingSimulation({...M.ITEMS[rodId].weapon,bait:false,choose:()=>null,lineSeed:start.result.lineSeed});assert.equal(simulation.breakChance,ticket.breakChance);
  // Exercise a real strain from the server seed and compare its authoritative roll.
  simulation.phase='hooked';simulation.tension=1;simulation.update(.025,true);assert.equal(simulation.strains,1);assert.equal(simulation.snapped,lineSnaps(ticket.seed,0,ticket.breakChance));
  const snaps=lineRoll(ticket.seed,0)<.01,proof={elapsed:20,hookAt:1,strains:1,samples:[{t:2,held:true,tension:.3,progress:.2},{t:5,held:true,tension:1,progress:.4,strain:true},{t:9,held:true,tension:.5,progress:.6},{t:20,held:true,tension:.4,progress:1}]};now+=20000;
  if(snaps)await assert.rejects(act(actor,'fishFinish',{ticketId:ticket.id,telemetry:proof}),e=>e.status===409);
  else {const done=await act(actor,'fishFinish',{ticketId:ticket.id,telemetry:proof});assert.equal(done.result.id,ticket.outcome.id);assert.equal((await store.get(actor)).fishingTicket,undefined);}
 }
});
