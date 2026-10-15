import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {commandHash} from '../server/action-service.mjs';
import {createAccountStore} from '../server/account-store.mjs';
import {createCombatAuthority} from '../server/combat-authority.mjs';
import * as Game from '../src/model.ts';
import {enemyRoster} from '../src/enemy-roster.ts';
import {ENEMY_TYPES} from '../src/enemy-types.ts';
import {createEnvironmentLayout,terrainHeight} from '../src/environments.ts';

async function fixture(t,{planet='home',profile:configure=()=>{}}={}){
 const dataDir=await mkdtemp(path.join(tmpdir(),'cute-combat-authority-')),store=await createAccountStore({dataDir,databaseUrl:''}),profile=Game.newGame();profile.planet=planet;configure(profile);
 const account=await store.create({id:'actor',username:'actor',hash:'fixture-hash',salt:'fixture-salt',profile,friends:[],requests:[],profileRevision:0});
 const peer={account,active:true,visit:null,planet,room:'public:'+planet,pose:{x:planet==='home'?-30:30,z:1,facing:0,moving:false},socket:{}},peers=new Map([['actor',peer]]),room={id:peer.room,members:new Set(['actor']),host:'actor',enemies:[],killed:new Set()},rooms=new Map([[room.id,room]]);
 const messages=[],waiters=[];const emit=value=>{messages.push(structuredClone(value));for(const waiter of [...waiters])if(waiter.predicate(value)){clearTimeout(waiter.timer);waiters.splice(waiters.indexOf(waiter),1);waiter.resolve(structuredClone(value));}};
 const remember=value=>{Object.assign(account,value);const live=peers.get(value.id);if(live)live.account=account;return account;};
 let deaths=0;const authority=createCombatAuthority({store,peers,rooms,remember,onError:error=>t.diagnostic(error.stack),send:(_,value)=>emit(value),broadcast:(_,value)=>emit(value),onDeath:p=>{deaths++;p.planet='home';p.room='public:home';p.pose={x:0,z:0,facing:0,moving:false};}});
 t.after(async()=>{await authority.close();await store.close();});
 const next=(predicate,from=messages.length)=>{const found=messages.slice(from).find(predicate);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const waiter={predicate,resolve,timer:setTimeout(()=>reject(new Error('Missing authority event')),3000)};waiters.push(waiter);});};
 function spawn(type,x,z,extra={}){const definition=enemyRoster(planet).find(e=>e.type===type);assert.ok(definition,type);if(x===undefined){const at=planet==='home'?({forest:[-30,0],meadow:[0,30],swamp:[0,-30],canyon:[30,0]}[definition.zone]):[30,0];[x,z]=at;facingForSpawn(at);}z??=0;
 function facingForSpawn(at){peer.pose.x=at[0];peer.pose.z=at[1]+1;}authority.acceptSnapshots(room,[{id:definition.id,type,x,z,hp:1,...extra}]);return authority.state(room).enemies.get(definition.id);}
 return {store,account,peer,peers,room,rooms,authority,messages,next,spawn,deaths:()=>deaths};
}
test('basic attacks and skills obey server cooldowns across repeated packets and room changes',async t=>{
 const f=await fixture(t),enemy=f.spawn('mushroom'),engine=f.authority.engineFor(f.peer);f.authority.basic(f.peer,enemy.id);const hp=enemy.hp;
 for(let i=0;i<20;i++)f.authority.basic(f.peer,enemy.id);assert.equal(enemy.hp,hp);
 f.authority.skill(f.peer,0);const nextSkill=engine.nextSkill[0];f.authority.skill(f.peer,0);assert.equal(engine.nextSkill[0],nextSkill);assert.ok(nextSkill>Date.now());
 const other={id:'party:home',members:new Set(['actor']),host:'actor',enemies:[],killed:new Set()};f.rooms.set(other.id,other);f.peer.room=other.id;const migrated=f.authority.engineFor(f.peer);assert.equal(migrated,engine);assert.equal(migrated.nextSkill[0],nextSkill);assert.ok(migrated.nextBasic>Date.now());
 const profile=await f.next(m=>m.type==='profile'&&m.profile.counters.skills===1,0);assert.equal(profile.profile.counters.skills,1);
});
test('same-room reconnect rebinds combat to the replacement player pose',async t=>{
 const f=await fixture(t),enemy=f.spawn('mushroom');f.peer.pose.x=-100;const original=f.authority.engineFor(f.peer);const replacement={...f.peer,pose:{x:-30,z:1,facing:0,moving:false},socket:{}};f.peers.set('actor',replacement);
 assert.equal(f.authority.engineFor(replacement),original);f.authority.basic(replacement,enemy.id);assert.ok(enemy.hp<enemy.maxHp);assert.equal(f.peer.pose.x,-100);
});
test('automatic combat gear uses the owned sword when the saved hand holds a fishing rod',async t=>{
 const f=await fixture(t,{profile:p=>{p.bag.rod_basic=1;p.bag.sword_wood=1;p.gear.weapon='rod_basic';}}),enemy=f.spawn('mushroom');
 const engine=f.authority.engineFor(f.peer);f.authority.basic(f.peer,enemy.id);assert.ok(enemy.hp<enemy.maxHp);assert.equal(f.account.profile.gear.weapon,'rod_basic');assert.equal(engine.sim.projectiles.length,0);
});
test('boss crowd control resists charm and hard stun, while launch still interrupts',async t=>{
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_fairy';p.bag.dz_fairy=1;}}),boss=f.spawn('treant');const engine=f.authority.engineFor(f.peer);
 engine.sim.disguise('dz_fairy',2);assert.equal(boss.statuses.charm,undefined);assert.equal(boss.statuses.slow,4.8);
 boss.phase='windup';engine.sim.skill(2);engine.sim.update(.43);assert.ok(boss.liftVelocity>0);assert.equal(boss.phase,'chase');assert.ok(boss.stun>=.8);assert.ok(boss.statuses.slow>=.48);
});
test('magma turtle shell and recovery modifiers apply on the authoritative damage path',async t=>{
 t.mock.method(Math,'random',()=>.5); // The armor comparison measures ordinary hits, not a random critical.
 const f=await fixture(t,{planet:'lava'}),enemy=f.spawn('magmaturtle');const engine=f.authority.engineFor(f.peer),before=enemy.hp;
 f.authority.basic(f.peer,enemy.id);const armored=before-enemy.hp;assert.ok(armored>0&&armored<4);engine.nextBasic=0;enemy.phase='recover';const hp=enemy.hp;f.authority.basic(f.peer,enemy.id);assert.ok(hp-enemy.hp>armored*5);
});
test('pets deal real server damage without client hit packets and pause with inactive combat',async t=>{
 const f=await fixture(t,{profile:p=>{p.bag.pet_t_turtle=1;p.gear.pet='pet_t_turtle';}}),enemy=f.spawn('mushroom');enemy.z=5;f.peer.pose.z=0;
 const engine=f.authority.engineFor(f.peer);engine.sim.update(.05,false);assert.equal(engine.sim.projectiles.length,0);engine.sim.update(.4);assert.ok(enemy.hp<enemy.maxHp);
});

test('rejected hits against a pending defeat cannot grant vampire lifesteal',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{profile:p=>{p.bag.dz_vampire=1;p.gear.disguise='dz_vampire';p.hp=20;}}),enemy=f.spawn('mushroom'),engine=f.authority.engineFor(f.peer);engine.hpAt=Date.now()+100000;engine.sim.statuses.lifesteal=6;enemy.pending=true;enemy.hp=1;
 engine.sim.basic(enemy);assert.equal(engine.healthEvents.length,0);assert.equal(enemy.hp,1);
});

test('canonical Titan summon recalls existing eligible mobs with stacked attack and migration grace',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{planet:'candy'}),titan=f.spawn('titan_hydra',30,0),entries=enemyRoster('candy').filter(e=>!e.boss&&ENEMY_TYPES[e.type].speed>0).slice(0,6);
 f.authority.acceptSnapshots(f.room,entries.map((e,i)=>({id:e.id,type:e.type,x:42+i,z:0})));const state=f.authority.state(f.room),mobs=entries.map(e=>state.enemies.get(e.id)),ids=[...state.enemies.keys()];
 mobs[0].pending=true;mobs.forEach(e=>e.hp=1);const before=mobs.map(e=>({x:e.x,z:e.z,damage:e.damage}));
 const cast=count=>{titan.nextCastAt=0;f.authority.acceptSnapshots(f.room,[{id:titan.id,type:titan.type,x:30,z:0,phase:'windup',attackCount:count,skill:'summon',facing:0}]);assert.ok(titan.cast);titan.cast.startsAt=Date.now()-1;t.mock.timers.tick(50);};
 cast(2);cast(4);assert.deepEqual([...state.enemies.keys()],ids);
 for(let i=1;i<=4;i++){assert.equal(mobs[i].hp,mobs[i].maxHp);assert.ok(Math.abs(mobs[i].damage-before[i].damage*1.3*1.3)<1e-9);const packet=f.messages.findLast(m=>m.type==='enemyHealth'&&m.id===mobs[i].id);assert.equal(packet.chaseGrace,4);assert.equal(packet.phase,'chase');}
 for(const i of [0,5]){assert.equal(mobs[i].hp,1);assert.equal(mobs[i].x,before[i].x);assert.equal(mobs[i].damage,before[i].damage);}
});
test('pending damage survives reconnect and travel and lethal damage drops the bag at its original location',async t=>{
 const f=await fixture(t,{profile:p=>{p.hp=1;p.bag.wood=2;p.settings.keepBagOnDeath=false;}}),enemy=f.spawn('mushroom');
 await f.authority.internal('actor','fixtureJourney',[],records=>{Object.assign(records.get('actor'),{journeyPaid:true,flightDust:[{id:0,x:0,z:0}],flightPoint:{x:0,z:0},rideUntil:Date.now()+45000,ridePlanet:'home',fishingTicket:{id:'old-life'}});return {};});
 const from={...f.peer.pose};f.authority.damage(f.peer,enemy.id);
 const replacement={...f.peer,room:'party:home',pose:{x:0,z:0,facing:0,moving:false},socket:{}};f.peers.set('actor',replacement);f.rooms.set(replacement.room,{id:replacement.room,members:new Set(['actor']),host:'actor',enemies:[],killed:new Set()});f.authority.engineFor(replacement);
 await f.next(m=>m.type==='healthResult'&&m.died,0);const persisted=await f.store.get('actor');assert.equal(f.deaths(),1);assert.equal(persisted.profile.deathBags.at(-1).x,from.x);assert.equal(persisted.profile.deathBags.at(-1).z,from.z);assert.equal(persisted.lifeEpoch,1);assert.equal(persisted.profile.bag.wood,undefined);
 assert.equal(persisted.journeyPaid,false);for(const key of ['flightDust','flightPoint','rideUntil','ridePlanet','fishingTicket'])assert.equal(persisted[key],undefined,key);
});
test('old-life healing and damage cannot cross a reset epoch boundary',async t=>{
 const f=await fixture(t,{profile:p=>{p.hp=30;}}),enemy=f.spawn('mushroom');f.authority.damage(f.peer,enemy.id);const engine=f.authority.engineFor(f.peer);assert.ok(engine.healthEvents.length);
 f.account.adventureEpoch=1;f.account.lifeEpoch=1;f.authority.resetPeer(f.peer,{newLife:true,reason:'reset'});assert.equal(engine.healthEvents.length,0);assert.equal(engine.sim.projectiles.length,0);assert.equal(engine.nextSkill[0],0);
});

test('healing actions can await buffered and in-flight health before consuming an item',async t=>{
 const f=await fixture(t),enemy=f.spawn('mushroom'),engine=f.authority.engineFor(f.peer),hp=f.account.profile.hp;await f.authority.flushPeerHealth({account:{id:'absent'}});
 f.authority.damage(f.peer,enemy.id);const damage=-engine.healthEvents[0].amount;engine.nextBasic=12345;
 await Promise.all([f.authority.flushPeerHealth(f.peer),f.authority.flushPeerHealth(f.peer)]);
 assert.equal((await f.store.get('actor')).profile.hp,hp-damage);assert.equal(f.account.profile.hp,hp-damage);assert.equal(engine.healthEvents.length,0);assert.equal(engine.pendingHealth,null);assert.equal(engine.nextBasic,12345);
 await f.authority.internal('actor','fixtureHeal',[],records=>{const profile=records.get('actor').profile;profile.hp=Math.min(Game.maxHp(profile),profile.hp+damage);return {};});
 assert.equal(f.account.profile.hp,hp);await f.authority.flushPeerHealth(f.peer);assert.equal(f.account.profile.hp,hp,'settled damage is not applied again after healing');
});

test('a health batch keeps its original revision across lost acknowledgements and receipt eviction',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t),engine=f.authority.engineFor(f.peer),hp=f.account.profile.hp;
 engine.healthEvents.push({adventure:0,life:0,amount:-5,source:'test',at:Date.now(),planet:'home',x:-30,z:1});
 const original=f.store.command.bind(f.store);let lost=true;
 t.mock.method(f.store,'command',async spec=>{const committed=await original(spec);if(spec.actionType==='health'&&lost){lost=false;throw new Error('Lost acknowledgement after durable COMMIT');}return committed;});
 await assert.rejects(f.authority.flushPeerHealth(f.peer),/could not be saved/);
 const batch=engine.pendingHealth;assert.ok(batch);assert.equal(batch.originalRevision,0);assert.equal((await f.store.get('actor')).profile.hp,hp-5);
 for(let i=1;i<=513;i++)await original({actorId:'actor',requestId:randomUUID(),hash:commandHash({i}),expectedRevision:i,run:()=>true});
 await f.authority.flushPeerHealth(f.peer);
 assert.equal((await f.store.get('actor')).profile.hp,hp-5,'an evicted receipt cannot reapply the committed damage');
 assert.equal(f.account.profile.hp,hp-5,'the live peer reloads the canonical state');assert.equal(engine.pendingHealth,null);
 engine.healthEvents.push({adventure:0,life:0,amount:-2,source:'test',at:Date.now(),planet:'home',x:-30,z:1});await f.authority.flushPeerHealth(f.peer);
 assert.equal((await f.store.get('actor')).profile.hp,hp-7,'new damage can settle after the expired batch retires');
});

for(const resetAdventure of [false,true])test(`an expired lethal batch ${resetAdventure?'cannot respawn a newer adventure':'still reconciles death after other actions refreshed the cached life'}`,async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t),engine=f.authority.engineFor(f.peer);
 engine.healthEvents.push({adventure:0,life:0,amount:-10000,source:'test',at:Date.now(),planet:'home',x:-30,z:1});
 const original=f.store.command.bind(f.store);let lost=true;
 t.mock.method(f.store,'command',async spec=>{const committed=await original(spec);if(spec.actionType==='health'&&lost){lost=false;throw new Error('Lost acknowledgement after durable COMMIT');}return committed;});
 await assert.rejects(f.authority.flushPeerHealth(f.peer),/could not be saved/);
 for(let i=1;i<=513;i++){
  const result=await original({actorId:'actor',requestId:randomUUID(),hash:commandHash({i}),expectedRevision:i,run:records=>{if(resetAdventure)records.get('actor').adventureEpoch=1;return true;}});
  Object.assign(f.account,result.accounts[0]); // The server's ordinary afterCommit refreshes account caches.
 }
 assert.equal(f.account.lifeEpoch,1);assert.equal(f.deaths(),0);
 await f.authority.flushPeerHealth(f.peer);assert.equal(engine.pendingHealth,null);
 assert.equal(f.deaths(),resetAdventure?0:1);assert.equal(f.peer.pose.x,resetAdventure?-30:0);
 await f.authority.flushPeerHealth(f.peer);assert.equal(f.deaths(),resetAdventure?0:1,'the same batch cannot respawn twice');
});
test('untouched enemies take shared environmental damage without awarding a player a kill',async t=>{
 const f=await fixture(t,{planet:'lava'}),env=f.authority.state(f.room).environment;env.time=25;env.weather.time=25;let pool;for(let x=25;x<120&&!pool;x+=2)for(let z=-100;z<100;z+=2)if(env.lavaAt({x,z})){pool={x,z};break;}assert.ok(pool);const enemy=f.spawn('firelizard',pool.x,pool.z),before=enemy.hp;f.peer.pose={x:0,z:0};
 assert.ok(enemy);await f.next(m=>m.type==='enemyHealth'&&m.id===enemy.id&&m.hp<before,0);assert.equal(f.account.profile.counters.kills,0);
});
test('server lightning targets a live explorer and dragon phases raise shared nest lava',async t=>{
 const f=await fixture(t,{planet:'cloud'}),env=f.authority.state(f.room).environment,island=env.layout.islands.find(i=>i.id>0&&i.r>8);f.peer.pose.x=island.x;f.peer.pose.z=island.z;env.lightning.wait=0;
 const packet=await f.next(m=>m.type==='environment'&&m.snapshot.lightning.bolts.length>0,0);const bolt=packet.snapshot.lightning.bolts[0];assert.ok(Math.hypot(bolt.x-f.peer.pose.x,bolt.z-f.peer.pose.z)<10);assert.ok(Math.hypot(bolt.x,bolt.z)>20);
 const lava=await fixture(t,{planet:'lava'}),dragon=lava.spawn('dragon',30,0);dragon.hp=dragon.maxHp*.2;dragon.respawn=0;dragon.deadUntil=0;const sim=lava.authority.state(lava.room).environment;sim.weather.dragonSummoned=true;const start=sim.nestLevel;
 await lava.next(m=>m.type==='environment'&&m.snapshot.nestLevel>start,0);assert.equal(sim.dragonPhase,3);
});
test('Titan damage comes from a validated cast and preserves its move multiplier',async t=>{
 const f=await fixture(t,{profile:p=>{p.healthUp=100;p.hp=Game.maxHp(p);}}),enemy=f.spawn('titan_turtle',100,0);f.peer.pose={x:100,z:10,facing:0,moving:false};
 f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:100,z:0,phase:'windup',phaseTime:.01,attackCount:2,skill:'leap',facing:0,targetX:100,targetZ:10}]);
 assert.ok(enemy.cast);assert.ok(enemy.cast.startsAt>Date.now()+500,'host cannot shorten canonical windup');enemy.cast.startsAt=Date.now()-1;f.authority.damage(f.peer,enemy.id,'melee');assert.equal(f.authority.engineFor(f.peer).healthEvents.length,0,'host damage packets cannot duplicate the cast');
 const hit=await f.next(m=>m.type==='healthResult'&&m.delta<0,0);assert.equal(hit.delta,-Math.round(enemy.damage*2.2));
});

test('long Titan hazards keep running when the next skill starts and launches only cancel pending wind-ups',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{planet:'candy'}),enemy=f.spawn('titan_hydra');f.peer.pose={x:30,z:10,facing:0,moving:false};
 const cast=(skill,count)=>f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:30,z:0,phase:'windup',attackCount:count,skill,facing:0}]);
 cast('pools',2);const pools=enemy.cast;pools.startsAt=Date.now()-1;t.mock.timers.tick(50);assert.ok(pools.attack);
 enemy.nextCastAt=0;cast('orbs',4);const orbs=enemy.cast;assert.notEqual(orbs,pools);assert.equal(enemy.combatAttacks.length,2);
 const age=pools.attack.age;t.mock.timers.tick(50);assert.ok(pools.attack.age>age,'the first attack continues after a second wind-up');
 const engine=f.authority.engineFor(f.peer);f.peer.pose.z=1;engine.sim.skill(2);engine.sim.update(.43);
 assert.ok(enemy.combatAttacks.includes(pools),'already cast pools survive launch');assert.ok(!enemy.combatAttacks.includes(orbs),'launch interrupts the pending orb wind-up');
});

test('phase-three dragon rain is created by the authority and uses the enraged cooldown',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{planet:'lava'}),env=f.authority.state(f.room).environment;env.time=25;env.weather.time=25;
 let dry;for(let x=25;x<110&&!dry;x+=2)for(let z=-70;z<70;z+=2){const p={x,z},height=terrainHeight(env.layout,p);if(height>env.lavaLevel+.1&&height<.7){dry=p;break;}}assert.ok(dry);
 const dragon=f.spawn('dragon',dry.x,dry.z);dragon.hp=dragon.maxHp*.2;f.peer.pose={...dry,facing:0,moving:false};
 f.authority.acceptSnapshots(f.room,[{id:dragon.id,type:'dragon',...dry,phase:'windup',attackCount:2,skill:'rain',facing:0}]);
 assert.ok(env.fireRain.some(r=>r.id.startsWith('dragon:')),'dragon rain must be in shared server weather');
 const windup=1.3*.8,cooldown=ENEMY_TYPES.dragon.cooldown*.7*.6*.8;
 assert.equal(dragon.nextCastAt,Date.now()+(windup+cooldown)*1000,'phase-three cooldown has its extra 0.8 multiplier');
});

test('a lost health commit reply retries the same receipt instead of applying damage twice',async t=>{
 const f=await fixture(t),enemy=f.spawn('mushroom'),engine=f.authority.engineFor(f.peer),initialHp=f.account.profile.hp,requestIds=[];
 const command=f.store.command.bind(f.store);let droppedReply=false;
 f.store.command=async input=>{const committed=await command(input);if(input.actionType==='health'){requestIds.push(input.requestId);if(!droppedReply){droppedReply=true;throw new Error('Fixture: connection lost after commit');}}return committed;};
 f.authority.damage(f.peer,enemy.id);const damage=-engine.healthEvents[0].amount;
 await f.next(m=>m.type==='healthResult'&&m.delta<0,0);
 assert.equal(requestIds.length,2);assert.equal(requestIds[0],requestIds[1]);assert.equal((await f.store.get('actor')).profile.hp,initialHp-damage);
 assert.equal(f.account.profile.hp,initialHp-damage,'receipt replay refreshes the connected account');assert.ok(f.messages.some(m=>m.type==='profile'&&m.profile.hp===initialHp-damage));
});

test('environmental damage shares hit invulnerability and the knight armor defense bonus',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t),engine=f.authority.engineFor(f.peer);engine.hpAt=Date.now()+100000;engine.sim.statuses.armor=6;
 engine.environment.step=()=>({damage:20,heal:0});
 t.mock.timers.tick(50);assert.equal(engine.healthEvents.length,1);assert.equal(engine.healthEvents[0].amount,-9);
 t.mock.timers.tick(500);assert.equal(engine.healthEvents.length,1,'successive hazard ticks respect the 550 ms hit window');
 t.mock.timers.tick(50);assert.equal(engine.healthEvents.length,2);assert.equal(engine.healthEvents[1].amount,-9);
});

test('an explorer inside the safe zone takes no creature or hazard damage online',async t=>{
 const f=await fixture(t),enemy=f.spawn('mushroom'),engine=f.authority.engineFor(f.peer);engine.hpAt=Date.now()+100000;
 f.peer.pose={x:-5,z:0,facing:0,moving:false};f.authority.damage(f.peer,enemy.id,'shot');assert.equal(engine.healthEvents.length,0,'a shot reported inside the fence is ignored');
 f.peer.pose={x:-25,z:0,facing:0,moving:false};f.authority.damage(f.peer,enemy.id,'shot');assert.equal(engine.healthEvents.length,1,'outside the fence it hurts');assert.ok(engine.healthEvents[0].amount<0);
});

test('validated dinosaur execution ignores an armored turtle shell and heals only after one durable kill',async t=>{
 const f=await fixture(t,{planet:'lava',profile:p=>{p.level=50;p.bag.dz_dino=1;p.gear.disguise='dz_dino';p.hp=20;}}),enemy=f.spawn('magmaturtle');enemy.hp=enemy.maxHp*.39;enemy.phase='idle';
 f.authority.skill(f.peer,0);assert.equal(f.account.profile.hp,20);assert.equal(enemy.pending,true);
 f.authority.skill(f.peer,0);await f.next(m=>m.type==='executeResult'&&m.ok,0);
 assert.equal(enemy.hp,0);assert.equal(f.account.profile.hp,20+Game.maxHp(f.account.profile)*.25);assert.equal(f.account.profile.counters.kills,1);
});

test('boss warnings use the authoritative damaging marks, including Titan safe rings and stagger indices',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{planet:'candy'}),enemy=f.spawn('titan_hydra');f.peer.pose={x:30,z:10,facing:0,moving:false};
 f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:30,z:0,phase:'windup',phaseTime:0,attackCount:2,skill:'bombard',telegraphs:[{x:120,z:120,r:1,delay:0}]}]);
 assert.deepEqual(enemy.telegraphs,enemy.cast.marks);assert.ok(enemy.telegraphs.some(mark=>mark.k>0));assert.ok(enemy.phaseTime>1);
 const home=await fixture(t),turtle=home.spawn('titan_turtle',100,0);home.peer.pose={x:100,z:10,facing:0,moving:false};
 home.authority.acceptSnapshots(home.room,[{id:turtle.id,type:turtle.type,x:100,z:0,phase:'windup',attackCount:2,skill:'donut'}]);
 assert.equal(turtle.telegraphs.filter(mark=>mark.safe).length,1);assert.deepEqual(home.room.enemies.find(e=>e.id===turtle.id).telegraphs,turtle.cast.marks);
});

test('active Titan attack snapshots advance without host packets so migration retains the current hazard age',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{planet:'candy'}),enemy=f.spawn('titan_hydra');f.peer.pose={x:30,z:20,facing:0,moving:false};
 f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:30,z:0,phase:'windup',attackCount:2,skill:'orbs'}]);enemy.cast.startsAt=Date.now()-1;
 t.mock.timers.tick(300);const first=f.messages.filter(m=>m.type==='enemies').at(-1).enemies.find(e=>e.id===enemy.id).titanAttacks[0];assert.ok(first.age>0);
 t.mock.timers.tick(300);const latest=f.messages.filter(m=>m.type==='enemies').at(-1).enemies.find(e=>e.id===enemy.id).titanAttacks[0];assert.ok(latest.age>first.age);
 assert.deepEqual(f.room.enemies.find(e=>e.id===enemy.id).titanAttacks[0],latest);assert.equal(latest.orbs.length,5);assert.ok(latest.orbs.some((orb,i)=>orb.x!==first.orbs[i].x||orb.z!==first.orbs[i].z));
});

test('Scorpion Titan trophies provide their advertised lava immunity online',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 for(const id of ['hat_t_scorpion','pet_t_scorpion']){
  const f=await fixture(t,{planet:'lava',profile:p=>{p.level=Game.gearLevel(id);p.bag[id]=1;Game.equip(p,id);}}),engine=f.authority.engineFor(f.peer);engine.hpAt=Date.now()+100000;
  let observed;engine.environment.step=(_dt,_pose,_input,traits)=>{observed=traits;return {damage:traits.maxHp*.07*(1-traits.fireResistance),heal:0};};
  t.mock.timers.tick(50);assert.equal(observed.fireResistance,1,id);assert.equal(engine.healthEvents.length,0,id);
 }
});

test('online lava burns ordinary ground creatures but preserves the burrowing lava worm',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{planet:'lava'}),env=f.authority.state(f.room).environment;env.time=25;env.weather.time=25;f.peer.pose={x:0,z:0,facing:0,moving:false};
 let pool;for(let x=25;x<120&&!pool;x+=2)for(let z=-100;z<100;z+=2)if(env.lavaAt({x,z})){pool={x,z};break;}assert.ok(pool);
 const worm=f.spawn('lavaworm',pool.x,pool.z),slime=f.spawn('magmaslime',pool.x,pool.z),hp=worm.hp;t.mock.timers.tick(50);
 assert.equal(worm.hp,hp);assert.ok(slime.hp<slime.maxHp);
});

test('Hard difficulty: the room host save gives server creatures +25% health and +20% damage, Easy keeps the roster',async t=>{
 const roster=enemyRoster('home').find(e=>e.type==='mushroom');
 const hard=await fixture(t,{profile:p=>{p.settings.difficulty='hard';}}),h=hard.spawn('mushroom');
 assert.equal(h.maxHp,Math.round(roster.baseMaxHp*1.25));assert.equal(h.hp,h.maxHp);assert.ok(Math.abs(h.damage-roster.baseDamage*1.2)<1e-9);
 const easy=await fixture(t),e=easy.spawn('mushroom');assert.equal(e.maxHp,roster.baseMaxHp);assert.equal(e.damage,roster.baseDamage);
});
test('disguise freezes reach the server and the knight shield blocks only blows from in front',async t=>{
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_navy';p.bag.dz_navy=1;}}),enemy=f.spawn('wolf',0,34),boss=f.spawn('treant',2,33);const engine=f.authority.engineFor(f.peer);
 f.peer.pose.x=0;f.peer.pose.z=31;
 // The bosun's whistle stuns everything within 8 m, bosses too; clients hear it as a 'stun' status.
 const from=f.messages.length;assert.equal(engine.sim.disguise('dz_navy',2),true);assert.equal(enemy.stun,2.5);assert.equal(boss.stun,2.5);assert.ok(f.messages.slice(from).some(m=>m.type==='status'&&m.kind==='stun'&&m.id===enemy.id));
 f.account.profile.gear.disguise='dz_knight';f.account.profile.bag.dz_knight=1;f.authority.engineFor(f.peer);f.peer.pose.facing=0;assert.equal(engine.sim.disguise('dz_knight',0),true);
 engine.healthEvents=[];engine.damageAt=0;f.authority.damage(f.peer,enemy.id);assert.equal(engine.healthEvents.length,0,'blocked from the front');
 f.peer.pose.facing=Math.PI;engine.damageAt=0;f.authority.damage(f.peer,enemy.id);assert.ok(engine.healthEvents.some(e=>e.amount<0),'hurt from behind');
});
test('online summons: the server shares checked decoys, a reported blow hurts the clone (never the explorer) and its health goes home',async t=>{
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_ninja';p.bag.dz_ninja=1;}}),enemy=f.spawn('mushroom',-30,4);const engine=f.authority.engineFor(f.peer);
 f.peer.pose.facing=0;assert.equal(engine.sim.disguise('dz_ninja',0),true);
 const shared=f.authority.decoys(f.peer);assert.equal(shared.length,4);assert.ok(shared.every(d=>d.kind==='clone'&&d.taunt&&Math.hypot(d.x-f.peer.pose.x,d.z-f.peer.pose.z)<=6));
 const clone=engine.sim.allies[0],full=clone.hp;engine.healthEvents=[];engine.damageAt=0;const from=f.messages.length;
 f.authority.damage(f.peer,enemy.id,'melee',clone.id);
 assert.equal(engine.healthEvents.length,0,'the explorer is not hurt');assert.ok(clone.hp<full,'the clone is');
 const sent=f.messages.slice(from).find(m=>m.type==='decoyHp');assert.equal(sent?.id,clone.id);assert.equal(sent.hp,clone.hp);
 // A stale id lands on the nearest live clone the creature can reach; with none in reach nothing is hurt.
 f.authority.damage(f.peer,enemy.id,'melee',999);assert.equal(engine.healthEvents.length,0);
 for(const a of engine.sim.allies){a.x=-60;a.z=40;}const hps=engine.sim.allies.map(a=>a.hp);f.authority.damage(f.peer,enemy.id,'melee',engine.sim.allies[1].id);
 assert.deepEqual(engine.sim.allies.map(a=>a.hp),hps,'a summon far beyond the creature\'s reach is not hurt');assert.equal(engine.healthEvents.length,0);
 // Out of the lifetime, nothing is shared.
 engine.sim.update(9);assert.deepEqual(f.authority.decoys(f.peer),[]);
});
test("online knight: a shot reported against the raised shield hits the shooter back, not the explorer",async t=>{
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_knight';p.bag.dz_knight=1;}}),enemy=f.spawn('mushroom',-30,6);const engine=f.authority.engineFor(f.peer);
 f.peer.pose.facing=0;assert.equal(engine.sim.disguise('dz_knight',0),true);const hp=enemy.hp;engine.healthEvents=[];engine.damageAt=0;
 f.authority.damage(f.peer,enemy.id,'shot');assert.equal(engine.healthEvents.length,0,'blocked');
 engine.sim.update(.5);assert.ok(enemy.hp<hp,'the shooter is hit by its own shot');
 f.peer.pose.facing=Math.PI;const after=enemy.hp;engine.damageAt=0;f.authority.damage(f.peer,enemy.id,'shot');engine.sim.update(.5);assert.equal(enemy.hp,after,'from behind nothing bounces');assert.ok(engine.healthEvents.some(e=>e.amount<0));
});

test('swamp poison is server-owned, respects immunity and shields, and clears on reset',async t=>{
 const f=await fixture(t),enemy=f.spawn('swamp_octo',0,-31),engine=f.authority.engineFor(f.peer);f.peer.pose.x=0;f.peer.pose.z=-30;
 f.authority.damage(f.peer,enemy.id,'shot');assert.ok(engine.venom.step(1)>0);
 f.authority.resetPeer(f.peer,{newLife:true});assert.equal(engine.venom.step(1),0);
 engine.damageAt=0;engine.sim.statuses.shield=10;f.authority.damage(f.peer,enemy.id,'shot');assert.equal(engine.venom.step(1),0);
 engine.sim.statuses.shield=0;f.peer.account.profile.gear.outfit='outfit_jungle';
 // Use the catalog's actual poison-proof outfit instead of a client flag.
 const antidote=Object.keys(Game.ITEMS).find(id=>Game.ITEMS[id].antidote&&Game.ITEMS[id].slot);assert.ok(antidote);
 f.peer.account.profile.gear[Game.ITEMS[antidote].slot]=antidote;f.peer.account.profile.bag[antidote]=1;
 engine.damageAt=0;f.authority.damage(f.peer,enemy.id,'shot');assert.equal(engine.venom.step(1),0);
});

test('Mosslug shell immunity and Quake are enforced by canonical combat',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{profile:p=>{p.bag.sword_wood=1;p.gear.weapon='sword_wood';}}),enemy=f.spawn('mosslug'),sim=f.authority.engineFor(f.peer).sim;
 // A canonical heavy first blow makes the creature hide, independent of the host's damage claims.
 enemy.maxHp=100;enemy.hp=100;
 sim.basic(enemy);assert.equal(enemy.phase,'shell');const hidden=enemy.hp;
 f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:enemy.x,z:enemy.z,phase:'chase',hp:1}]);assert.equal(enemy.phase,'shell');
 sim.basic(enemy);assert.equal(enemy.hp,hidden);
 assert.equal(sim.skill(2),true);t.mock.timers.tick(500);assert.ok(enemy.hp<hidden);assert.notEqual(enemy.phase,'shell');
});

test('server rejects creature positions outside their habitat and cross-border damage reports',async t=>{
 const f=await fixture(t),enemy=f.spawn('mosslug'),home={x:enemy.x,z:enemy.z};
 f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:0,z:-30,phase:'chase'}]);assert.deepEqual({x:enemy.x,z:enemy.z},home);
 f.peer.pose={x:-29,z:-32,facing:0};enemy.x=-32;enemy.z=-30;const engine=f.authority.engineFor(f.peer);engine.damageAt=0;
 f.authority.damage(f.peer,enemy.id);assert.equal(engine.healthEvents.length,0);
});

test('pangolin armor protects the front, not the rear, and a roll collision stuns for two seconds',async t=>{
 const f=await fixture(t),enemy=f.spawn('pangolin',30,0,{phase:'roll'});f.peer.pose={x:30,z:1,facing:Math.PI};enemy.phase='roll';enemy.facing=0;
 const engine=f.authority.engineFor(f.peer);engine.sim.basic(enemy);assert.equal(enemy.hp,enemy.maxHp);
 f.peer.pose.z=-1;engine.sim.basic(enemy);assert.ok(enemy.hp<enemy.maxHp);
 f.peer.pose.z=1;engine.damageAt=0;f.authority.damage(f.peer,enemy.id);assert.equal(engine.sim.statuses.stun,2);assert.ok(f.messages.some(m=>m.type==='creatureStatus'&&m.kind==='stun'&&m.duration===2));assert.equal(engine.sim.basic(enemy),false);
});

test('explorer duck mark is authoritative: all incoming hits gain 20% for four seconds, including a teammate',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_explorer_duck';p.bag.dz_explorer_duck=1;}}),enemy=f.spawn('mushroom',-30,3),engine=f.authority.engineFor(f.peer);enemy.hp=enemy.maxHp=10000;
 f.authority.skill(f.peer,0);for(let i=0;i<12;i++)t.mock.timers.tick(50);
 assert.ok(enemy.statuses.compassMark>3.7&&enemy.statuses.compassMark<=4);assert.ok(f.messages.some(m=>m.type==='status'&&m.kind==='compassMark'&&m.duration===4));
 const other={...f.peer,account:{...f.account,id:'teammate'},pose:{...f.peer.pose},socket:{}};f.peers.set(other.account.id,other);f.room.members.add(other.account.id);
 let before=enemy.hp;f.authority.bomb(other,5,1);assert.ok(Math.abs(before-enemy.hp-Game.attack(other.account.profile)*1.2)<1e-7);
 for(let i=0;i<85;i++)t.mock.timers.tick(50);assert.equal(enemy.statuses.compassMark,0);
 before=enemy.hp;f.authority.bomb(other,5,1);assert.equal(before-enemy.hp,Game.attack(other.account.profile));
});
test('server clamps grapple aim, rejects duplicate casts and clears pending bird effects on disguise changes',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_explorer_duck';p.bag.dz_explorer_duck=1;}}),engine=f.authority.engineFor(f.peer),from={...f.peer.pose};
 f.authority.skill(f.peer,1,{x:1e12,z:from.z});const next=engine.nextSkill[1];for(let i=0;i<10;i++)f.authority.skill(f.peer,1,{x:1e12,z:from.z});assert.equal(engine.nextSkill[1],next);
 for(let i=0;i<14;i++)t.mock.timers.tick(50);assert.ok(Math.abs(f.peer.pose.x-from.x-14)<1e-6);assert.equal(f.peer.pose.z,from.z);
 f.authority.skill(f.peer,3,{x:from.x+10,z:from.z});assert.ok(engine.sim.busy);f.account.profile.gear.disguise='dz_penguin';f.authority.engineFor(f.peer);assert.equal(engine.sim.busy,false);const count=f.messages.filter(m=>m.visual?.look==='duck-fire').length;
 for(let i=0;i<30;i++)t.mock.timers.tick(50);assert.equal(f.messages.filter(m=>m.visual?.look==='duck-fire').length,count);assert.equal(engine.nextSkill[1],next,'changing disguise never resets cooldowns');
});
test('server net root prevents snapshots from moving a trapped creature until the root expires',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_explorer_duck';p.bag.dz_explorer_duck=1;}}),enemy=f.spawn('mushroom',-30,3);enemy.hp=enemy.maxHp=10000;
 f.authority.skill(f.peer,2);t.mock.timers.tick(50);assert.equal(enemy.statuses.root,2.5);
 const before=enemy.z;f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:enemy.x,z:before+1}]);assert.equal(enemy.z,before);
 for(let i=0;i<52;i++)t.mock.timers.tick(50);assert.equal(enemy.statuses.root,0);f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:enemy.x,z:before+1}]);assert.equal(enemy.z,before+1);
});

test('penguin storm weakens canonical melee and shots only while the creature is inside the moving field',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_penguin';p.bag.dz_penguin=1;}}),enemy=f.spawn('mushroom',-30,3),engine=f.authority.engineFor(f.peer);enemy.hp=enemy.maxHp=10000;enemy.damage=100;
 f.authority.skill(f.peer,2);const defense=Game.defense(f.account.profile)+engine.sim.defenseBonus,expected=Math.max(1,Math.round(100*.7*60/(defense+60)));
 for(const source of ['melee','shot']){engine.damageAt=0;engine.healthEvents=[];f.authority.damage(f.peer,enemy.id,source);assert.equal(-engine.healthEvents[0].amount,expected);}
 enemy.z=20;engine.damageAt=0;engine.healthEvents=[];f.authority.damage(f.peer,enemy.id,'shot');assert.equal(-engine.healthEvents[0].amount,Math.max(1,Math.round(100*60/(defense+60))));
 enemy.z=3;engine.sim.reset();engine.damageAt=0;engine.healthEvents=[];f.authority.damage(f.peer,enemy.id);assert.equal(-engine.healthEvents[0].amount,Math.max(1,Math.round(100*60/(defense+60))));
});
test('canonical storm blocks dash snapshots crossing the whole area and refuses the interrupted contact hit',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_penguin';p.bag.dz_penguin=1;}}),enemy=f.spawn('boar',-30,9),engine=f.authority.engineFor(f.peer);enemy.hp=enemy.maxHp=10000;f.authority.skill(f.peer,2);t.mock.timers.tick(500);
 enemy.phase='charge';f.authority.acceptSnapshots(f.room,[{id:enemy.id,type:enemy.type,x:-30,z:-3,phase:'charge'}]);assert.equal(enemy.phase,'recover');assert.ok(enemy.z>=f.peer.pose.z+4.8+enemy.radius);assert.ok(enemy.blizzardBlockedUntil>Date.now());engine.damageAt=0;engine.healthEvents=[];f.authority.damage(f.peer,enemy.id);assert.equal(engine.healthEvents.length,0);
});
test('a teammate storm provides the same protection and the requested cooldowns are enforced by authority',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_penguin';p.bag.dz_penguin=1;}}),engine=f.authority.engineFor(f.peer),enemy=f.spawn('mushroom',-30,3);enemy.hp=enemy.maxHp=10000;
 f.authority.skill(f.peer,2);assert.equal(engine.nextSkill[2]-Date.now(),10000);
 const friend={...f.peer,account:{...f.account,id:'friend'},pose:{...f.peer.pose},socket:{}};f.peers.set('friend',friend);f.room.members.add('friend');const other=f.authority.engineFor(friend);other.damageAt=0;f.authority.damage(friend,enemy.id);const defense=Game.defense(friend.account.profile);assert.equal(-other.healthEvents[0].amount,Math.max(1,Math.round(enemy.damage*.7*60/(defense+60))));
 engine.sim.reset();f.authority.skill(f.peer,1);assert.equal(engine.nextSkill[1]-Date.now(),6000);engine.sim.reset();f.authority.skill(f.peer,3);assert.equal(engine.nextSkill[3]-Date.now(),7000);
 f.account.profile.gear.disguise='dz_explorer_duck';f.account.profile.bag.dz_explorer_duck=1;f.authority.engineFor(f.peer);engine.nextSkill.fill(0);f.authority.skill(f.peer,1,{x:-26,z:1});assert.equal(engine.nextSkill[1]-Date.now(),5000);engine.sim.reset();f.authority.skill(f.peer,2);assert.equal(engine.nextSkill[2]-Date.now(),9000);
});

test('sorcerer portal authority validates early exit during cooldown and rejects incoming damage while hidden',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const f=await fixture(t,{profile:p=>{p.gear.disguise='dz_sorcerer';p.bag.dz_sorcerer=1;}}),enemy=f.spawn('mushroom'),e=f.authority.engineFor(f.peer);enemy.hp=10000;enemy.maxHp=10000;
 f.authority.skill(f.peer,1);const next=e.nextSkill[1];assert.equal(next,Date.now()+12000);assert.equal(e.sim.portalHidden,true);assert.equal(e.sim.invulnerable,true);const hp=f.account.profile.hp;f.authority.damage(f.peer,enemy.id,'melee');assert.equal(e.healthEvents.length,0);assert.equal(f.account.profile.hp,hp);
 f.authority.skill(f.peer,0);assert.equal(e.sim.portalHidden,true);assert.equal(e.nextSkill[0],0);f.authority.skill(f.peer,1);assert.equal(e.sim.portalHidden,false);assert.equal(e.nextSkill[1],next);assert.equal(e.sim.statuses.ambush,1);f.authority.skill(f.peer,1);assert.equal(e.sim.portalHidden,false,'cannot reopen until the original 12 s cooldown finishes');
});
