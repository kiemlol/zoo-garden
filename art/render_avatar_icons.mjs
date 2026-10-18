/** Render the actual runtime avatar, including procedural hair, into installed wardrobe icons.
 * Run Vite and Chromium --remote-debugging-port=9231 first, then node art/render_avatar_icons.mjs.
 * Optional env: AVATAR_CDP_URL, AVATAR_GAME_URL. Uses a temporary HTML entry, removed even on failure.
 */
import WebSocket from 'ws';
import {writeFile,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),entry='.avatar-icons.html',origin=process.env.AVATAR_GAME_URL??'http://127.0.0.1:5173',cdpOrigin=process.env.AVATAR_CDP_URL??'http://127.0.0.1:9231';
let ws,browser,targetId,sequence=0;const pending=new Map();
async function connect(url){const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.on('message',raw=>{const r=JSON.parse(raw);if(r.id){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});return socket;}
const call=(socket,method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
try{
 await writeFile(root+entry,'<!doctype html><html><body>Rendering wardrobe icons</body></html>');
 browser=await connect((await(await fetch(cdpOrigin+'/json/version')).json()).webSocketDebuggerUrl);({targetId}=await call(browser,'Target.createTarget',{url:origin+'/'+entry}));
 const tab=(await(await fetch(cdpOrigin+'/json/list')).json()).find(t=>t.id===targetId);ws=await connect(tab.webSocketDebuggerUrl);
 const result=await call(ws,'Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
 const T=await import('/node_modules/.vite/deps/three.js'),A=await import('/src/assets.ts'),{World}=await import('/src/world.ts'),{newGame}=await import('/src/model.ts'),{previewRenderer}=await import('/src/mirror-preview.ts'),{HAIR_STYLES,FACE_STYLES}=await import('/src/appearance.ts'),L=await import('/src/looks.ts'),{dropTree}=await import('/src/dispose-tree.ts');
 const world=Object.assign(Object.create(World.prototype),{state:newGame(),refreshAvatars(){}});await Promise.all([A.heroKit.load(),...['boy-tiny-none-bare','boy-tall-none-bare','sturdy-chibi-none-bare',...L.ROWS.ears.map(e=>'boy-chibi-'+e+'-bare'),...L.ROWS.deco.map(d=>'boy-chibi-none-'+d)].map(id=>A.heroKitFor(id).load())]);
 const scene=new T.Scene(),sun=new T.DirectionalLight('#fff8ef',2.2);sun.position.set(2.5,6,7);scene.add(new T.HemisphereLight('#ffffff','#958889',2.2),sun);const renderer=previewRenderer(),camera=new T.PerspectiveCamera(30,1,.01,60),out=[];
 function shot(hero,name,pixels,headOnly){hero.rotation.y=-.14;scene.add(hero);hero.updateMatrixWorld(true);const b=new T.Box3();(headOnly?hero.getObjectByName('head'):hero).traverseVisible(o=>{if(o.isMesh&&!o.userData.outline){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});const at=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3()),distance=Math.max(size.x,size.y)*1.12/(2*Math.tan(Math.PI/12))+size.z*.4;camera.position.set(at.x,at.y+.025*distance,at.z+distance);camera.lookAt(at);renderer.setSize(pixels,pixels,false);renderer.render(scene,camera);const c=document.createElement('canvas');c.width=c.height=pixels;c.getContext('2d').drawImage(renderer.domElement,0,0);out.push({name,url:c.toDataURL('image/webp',.95)});dropTree(hero);}
 for(const[kind,styles]of[['hair',HAIR_STYLES],['face',FACE_STYLES]])for(const id of Object.keys(styles))shot(world.lookAvatar('#fff9eb',{},L.DEFAULT_LOOK,{hair:kind==='hair'?id:'original',face:kind==='face'?id:'original'}),'appearance/'+kind+'-'+id,256,true);
 for(const row of Object.keys(L.ROWS))for(const option of L.ROWS[row]){const look=L.swapOption(L.DEFAULT_LOOK,option);await A.heroKitFor(look).load();shot(world.lookAvatar('#fff9eb',{},look),'looks/'+option,128,row==='ears'||row==='deco');}
 shot(world.lookAvatar('#fff9eb',{},L.DEFAULT_LOOK),'items/hero',160,false);return out;
 })()`});
 if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
 for(const{ name,url }of result.result.value){const path=root+'public/assets/icons/'+name+'.webp';await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,Buffer.from(url.split(',')[1],'base64'));}console.log('Rendered '+result.result.value.length+' avatar icons.');
}finally{if(targetId&&browser)await call(browser,'Target.closeTarget',{targetId}).catch(()=>{});ws?.close();browser?.close();await rm(root+entry,{force:true});}
