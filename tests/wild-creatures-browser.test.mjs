import test from 'node:test';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const url=process.env.HUD_LAYOUT_URL;
test('Mosslug and pangolin art, loot, hide, roll and stun work in a real browser', {skip:!url&&'set HUD_LAYOUT_URL and provide Playwright',timeout:120000}, async()=>{
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({... (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'}));localStorage.setItem('cute-game-tutorial','done');});
 await page.goto(url);await page.waitForSelector('.auth-solo',{timeout:60000});await page.locator('.auth-solo').click();await page.locator('[data-action=start]').click({force:true});const decline=page.locator('[data-action="welcome-pass"]');if(await decline.isVisible())await decline.click();
 await page.waitForFunction(()=>!!window.__zoo?.world,{timeout:60000});
 await page.evaluate(async()=>{const {creatureKit}=await import('/src/creature-art.ts');await creatureKit.load();await (await import('/src/assets.ts')).weaponKit.load();__zoo.world.refreshArt();__zoo.world.renderer.setPixelRatio(.6);__zoo.world.state.level=30;for(const e of __zoo.world.enemies){e.hp=0;e.respawn=999999;}const e=__zoo.world.enemies.find(e=>e.type==='mosslug');e.hp=e.maxHp;e.x=e.homeX=-32;e.z=e.homeZ=0;e.cooldown=999;e.stun=0;__zoo.world.position.set(-30,0,1);__zoo.world.selected=null;__zoo.world.destination=null;__zoo.world.route=[];__zoo.drops.spawn('rainbow_slime',1,-32,4);__zoo.drops.spawn('moss_shell',1,-34,4);});
 await page.waitForFunction(()=>__zoo.world.enemies.find(e=>e.type==='mosslug').mesh.userData.creatureArt&&!!__zoo.world.scene.getObjectByName('loot-rainbow_slime'));
 await page.screenshot({path:'/tmp/mosslug-game.png'});
 const shell=await page.evaluate(()=>{const e=__zoo.world.enemies.find(e=>e.type==='mosslug');__zoo.world.damageEnemy(e,e.maxHp*.1);return e.phase;});assert.equal(shell,'shell');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__zoo.world.enemies.find(e=>e.type==='mosslug').mesh.getObjectByName('creature-head').visible),false);await page.screenshot({path:'/tmp/mosslug-shell-game.png'});
 await page.evaluate(()=>{const w=__zoo.world;for(const e of w.enemies){e.hp=0;e.respawn=999999;}const e=w.enemies.find(e=>e.type==='pangolin');e.hp=e.maxHp;e.x=e.homeX=40;e.z=e.homeZ=0;e.phase='idle';e.stun=0;e.cooldown=0;e.mesh.userData.rollCooldown=0;w.position.set(45,0,0);w.selected=null;w.destination=null;w.route=[];__zoo.drops.spawn('lava_scale',1,42,4);__zoo.drops.spawn('rolling_shell',1,44,4);});
 await page.waitForFunction(()=>__zoo.world.enemies.find(e=>e.type==='pangolin').phase==='roll-windup');await page.screenshot({path:'/tmp/pangolin-windup-game.png'});
 await page.waitForFunction(()=>__zoo.world.enemies.find(e=>e.type==='pangolin').phase==='roll');await page.screenshot({path:'/tmp/pangolin-roll-game.png'});
 await page.waitForFunction(()=>__zoo.world.playerStun>0&&__zoo.combat.locksMovement,null,{timeout:10000});assert.ok(await page.evaluate(()=>__zoo.combat.locksMovement));
 await page.waitForFunction(()=>__zoo.world.enemies.find(e=>e.type==='pangolin').phase==='recover');await page.screenshot({path:'/tmp/pangolin-rest-game.png'});
 assert.deepEqual(errors,[]);console.log('Browser: both GLB creatures load, 3D loot appears, shell hides head, roll telegraphs and runs, collision stuns, recovery works; no page errors.');
}finally{await browser.close();}

});
