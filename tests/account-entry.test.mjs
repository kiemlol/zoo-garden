import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const url=process.env.HUD_LAYOUT_URL;
const skip=!url&&'set HUD_LAYOUT_URL to a running dev server with the account API';
async function browser(){const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');return pw.chromium.launch({args:['--enable-unsafe-swiftshader']});}
async function ready(page){await page.routeWebSocket(u=>new URL(u).searchParams.has('token'),()=>{});await page.addInitScript(()=>localStorage.setItem('zoo-garden-graphics',JSON.stringify({setting:'low'})));await page.goto(url,{waitUntil:'load'});await page.waitForSelector('.social-auth',{timeout:60000});await page.waitForFunction(()=>!document.querySelector('.social-auth button[type=submit]').disabled);}
async function dismissIntro(page){await page.waitForTimeout(700);const pass=page.locator('[data-action=welcome-pass]');if(await pass.isVisible())await pass.click();const close=page.locator('#dialog-layer [data-action=close]');if(await close.isVisible())await close.click();}
async function signOut(page){await dismissIntro(page);await page.locator('#online-button').click();await page.getByRole('button',{name:'🏡 Account',exact:true}).click();await page.getByRole('button',{name:'Sign out and play offline',exact:true}).click();await page.waitForSelector('.social-auth');}

test('real registration, validation, duplicate account, login, logout, session restoration and expiry', {skip,timeout:180000},async()=>{
 const b=await browser();try{
 const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await ready(p);const username=`qa_${randomUUID().replaceAll('-','').slice(0,15)}`,password=randomUUID();
 await p.locator('.auth-modes').getByRole('button',{name:'Create account',exact:true}).click();
 await p.locator('#auth-username').fill(username);await p.locator('#auth-display-name').fill('Vườn QA');await p.locator('#auth-password').fill(password);await p.locator('#auth-confirm-password').fill('mismatch');
 let requests=0;p.on('request',r=>{if(r.url().endsWith('/api/auth/register'))requests++;});
 await p.locator('.social-auth button[type=submit]').click();assert.equal(requests,0);await p.waitForSelector('#auth-confirm-password[aria-invalid=true]');
 await p.locator('#auth-confirm-password').fill(password);await p.locator('.social-auth button[type=submit]').click();await p.waitForSelector('#hud:not([hidden])');assert.equal(requests,1);
 assert.equal(await p.locator('#player-name').textContent(),'Vườn QA');assert.equal(await p.locator('#online-dialog').evaluate(d=>d.open),false);
 await signOut(p);await p.locator('.auth-modes').getByRole('button',{name:'Create account',exact:true}).click();await p.locator('#auth-username').fill(username);await p.locator('#auth-display-name').fill('Other name');await p.locator('#auth-password').fill(password);await p.locator('#auth-confirm-password').fill(password);await p.locator('.social-auth button[type=submit]').click();await p.waitForSelector('#auth-username[aria-invalid=true]');assert.equal(await p.locator('#auth-password').inputValue(),password);
 await p.locator('.auth-modes').getByRole('button',{name:'Sign in',exact:true}).click();await p.locator('#auth-username').fill(username);await p.locator('#auth-password').fill('wrong-password');await p.locator('.social-auth button[type=submit]').click();await p.waitForSelector('#auth-password[aria-invalid=true]');assert.equal(await p.locator('#auth-username').inputValue(),username);
 await p.locator('.auth-password button').click();assert.equal(await p.locator('#auth-password').getAttribute('type'),'text');await p.locator('.auth-password button').click();
 let logins=0;await p.route('**/api/auth/login',async route=>{logins++;await new Promise(r=>setTimeout(r,300));await route.continue();});
 await p.locator('#auth-password').fill(password);await p.locator('.social-auth').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await p.waitForFunction(()=>document.querySelector('#online-button')?.dataset.online==='true');assert.equal(logins,1);
 await p.reload();await p.waitForSelector('#hud:not([hidden])',{timeout:60000});assert.equal(await p.locator('#player-name').textContent(),'Vườn QA');await dismissIntro(p);
 await p.evaluate(()=>fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));await p.waitForSelector('#online-dialog[open] .social-auth');await p.waitForFunction(()=>document.querySelector('.social-notice').textContent.includes('session ended'));
 const unauthorized=await p.evaluate(async()=>{const r=await fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'settings',payload:{name:'Forged'}})});return r.status;});assert.equal(unauthorized,401);assert.deepEqual(errors,[]);
 }finally{await b.close();}
});

test('network, server and invalid-session responses preserve form and never enter the game', {skip,timeout:120000},async()=>{
 const b=await browser();try{const p=await b.newPage();await ready(p);await p.locator('#auth-username').fill('qa_missing');await p.locator('#auth-password').fill('test-password');
 for(const kind of ['network','server','invalid']){
 await p.route('**/api/auth/login',route=>kind==='network'?route.abort('failed'):route.fulfill({status:kind==='server'?503:200,contentType:'application/json',body:kind==='server'?JSON.stringify({error:'Account storage unavailable'}):JSON.stringify({account:null})}));
 await p.locator('.social-auth button[type=submit]').click();await p.waitForFunction(()=>!!document.querySelector('.social-notice').textContent);
 assert.equal(await p.locator('#auth-username').inputValue(),'qa_missing');assert.equal(await p.locator('#auth-password').inputValue(),'test-password');assert.equal(await p.locator('#hud').isVisible(),false);assert.equal(await p.locator('.social-auth button[type=submit]').isDisabled(),false);await p.unroute('**/api/auth/login');
 }
 }finally{await b.close();}
});

test('account form fits all viewport sizes, scrolls with a keyboard, and retains input across rotation', {skip,timeout:120000},async()=>{
 const b=await browser();try{const p=await b.newPage({viewport:{width:320,height:568},hasTouch:true,isMobile:true});await ready(p);await p.locator('.auth-modes').getByRole('button',{name:'Create account',exact:true}).click();await p.locator('#auth-username').fill('rotation_qa');await p.locator('.auth-language').selectOption('vi');await p.waitForFunction(()=>document.documentElement.lang==='vi');assert.ok((await p.locator('#auth-confirm-password').locator('..').locator('..').textContent()).includes('Nhập lại mật khẩu'));
 for(const [width,height]of [[320,568],[430,932],[667,320],[844,390],[768,1024],[1440,900],[320,568]]){
 await p.setViewportSize({width,height});await p.waitForTimeout(120);const r=await p.locator('#online-dialog').evaluate(d=>{const b=d.getBoundingClientRect();return{x:b.x,y:b.y,r:b.right,b:b.bottom,scroll:d.scrollHeight,client:d.clientHeight}});assert.ok(r.x>=-1&&r.y>=-1&&r.r<=width+1&&r.b<=height+1,JSON.stringify(r));assert.equal(await p.locator('#auth-username').inputValue(),'rotation_qa');await p.locator('.social-auth button[type=submit]').scrollIntoViewIfNeeded();assert.ok(await p.locator('.social-auth button[type=submit]').isVisible());}
 // Simulate the VisualViewport contract; an actual iOS keyboard still needs device QA.
 await p.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>280});visualViewport.dispatchEvent(new Event('resize'));});
 const d=await p.locator('#online-dialog').evaluate(d=>({height:d.getBoundingClientRect().height,scroll:d.scrollHeight,client:d.clientHeight}));assert.ok(d.height<=256&&d.scroll>d.client);await p.locator('#auth-confirm-password').focus();await p.locator('.social-auth button[type=submit]').scrollIntoViewIfNeeded();
 const button=await p.locator('.social-auth button[type=submit]').boundingBox();assert.ok(button.y>=0&&button.y+button.height<=280);await p.screenshot({path:'/tmp/zoopet-keyboard.png'});
 }finally{await b.close();}
});
