import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chooseOffline,dismissWelcome} from './browser-start.mjs';
const url=process.env.HUD_LAYOUT_URL;
test('hybrid art, poison shots, lava rod and real loot work in the game after rotation',{skip:!url&&'set HUD_LAYOUT_URL',timeout:120000},async()=>{
 const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');const b=await pw.chromium.launch();
 try{
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));localStorage.setItem('cute-game-tutorial','done');});
 await p.goto(url);await chooseOffline(p);await p.locator('[data-action=start]').click({force:true});await dismissWelcome(p);
 await p.evaluate(async()=>{const {creatureKit}=await import('/src/creature-art.ts');await creatureKit.load();__zoo.world.renderer.setPixelRatio(.4);__zoo.world.refreshArt();__zoo.state.level=20;for(const e of __zoo.world.enemies){e.hp=0;e.respawn=999999;}const e=__zoo.world.enemies.find(e=>e.type==='swamp_octo');e.hp=e.maxHp;e.x=e.homeX=3;e.z=e.homeZ=-27;e.cooldown=0;e.respawn=0;e.phase='idle';__zoo.world.position.set(0,0,-24);__zoo.world.destination=null;__zoo.world.route=[];__zoo.state.hp=500;window.__shotCount=0;const damage=__zoo.world.onDamage;__zoo.world.onDamage=(...args)=>{if(args[1]==='shot')window.__shotCount++;return damage(...args);};});
 await p.waitForFunction(()=>__zoo.world.enemies.find(e=>e.type==='swamp_octo').mesh.userData.creatureArt);
 await p.waitForFunction(()=>window.__shotCount>0,null,{timeout:15000});await p.evaluate(()=>__zoo.world.selected=__zoo.world.enemies.find(e=>e.type==='swamp_octo'));await p.screenshot({path:'/tmp/swamp-live-landscape.png'});
 const hit=await p.evaluate(()=>{const e=__zoo.world.enemies.find(e=>e.type==='swamp_octo');e.hp=0;e.respawn=999999;return __zoo.state.hp;});await p.waitForTimeout(4200);assert.ok(await p.evaluate(()=>__zoo.state.hp)<hit,'actual poison projectile leaves ticking damage');
 await p.screenshot({path:'/tmp/swamp-game-landscape.png'});
 await p.evaluate(async()=>{__zoo.world.position.set(0,0,0);__zoo.world.selected=null;const M=await import('/src/model.ts');__zoo.state.bag.rod_lava=1;M.equip(__zoo.state,'rod_lava');__zoo.world.refreshPlayer();const {weaponKit}=await import('/src/assets.ts');await weaponKit.load();__zoo.world.refreshPlayer();const pond=__zoo.world.entities.find(e=>e.pond&&e.kind==='fish');__zoo.world.position.set(pond.x+pond.radius+1,0,pond.z);__zoo.drops.spawn('venom_ink',1,__zoo.world.position.x+4,__zoo.world.position.z);__zoo.drops.spawn('jelly_resin',1,__zoo.world.position.x-4,__zoo.world.position.z);});
 await p.waitForFunction(()=>!!__zoo.world.scene.getObjectByName('loot-venom_ink')&&!!__zoo.world.scene.getObjectByName('loot-jelly_resin'));
 await p.waitForFunction(()=>__zoo.state.gear.weapon==='rod_lava'&&!!__zoo.world.player.getObjectByName('rod-tip'));assert.ok(await p.evaluate(()=>__zoo.world.player.getObjectByName('rod-tip').position.length()>0));
 await p.screenshot({path:'/tmp/swamp-loot-landscape.png'});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__zoo.world.zoom),1.1);await p.screenshot({path:'/tmp/swamp-loot-portrait.png'});
 await p.evaluate(()=>__zoo.drops.sim.clear());await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>!!__zoo.world.scene.getObjectByName('loot-venom_ink')||!!__zoo.world.scene.getObjectByName('loot-jelly_resin')),false);
 assert.deepEqual(errors,[]);
 }finally{await b.close();}
});
