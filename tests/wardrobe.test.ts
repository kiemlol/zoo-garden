import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyGameAction} from '../src/actions.ts';
import {newGame,parseSave,activeStats} from '../src/model.ts';
import {HAIR_STYLES,FACE_STYLES,appearanceOf,readAppearance,type HairStyle,type FaceStyle} from '../src/appearance.ts';
import {wardrobeDraft,wardrobeGear,wardrobeHtml} from '../src/wardrobe-ui.ts';
import {HeroLibrary,heroKitFor,useHeroLoader,heroKit} from '../src/assets.ts';
import {DEFAULT_LOOK,ROWS,fitOf,type LookId} from '../src/looks.ts';
import {applyAppearance,appearanceModel} from '../src/appearance-art.ts';
import {World} from '../src/world.ts';
import {portraitKey} from '../src/hero-portrait.ts';
const action=(s:ReturnType<typeof newGame>,payload:Record<string,unknown>)=>applyGameAction(s,{type:'dressAvatar',payload},{now:Date.now(),random:()=>.5});
const payload=(s:ReturnType<typeof newGame>)=>{const draft=wardrobeDraft(s);return{look:draft.look,appearance:draft.appearance,gear:wardrobeGear(draft)};};
const loader=new GLTFLoader();if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class extends Event{} as typeof ProgressEvent;
const disk=async(url:string)=>{const file=url.split('/').pop()!.split('?')[0],buf=readFileSync(new URL('../public/assets/models/'+file,import.meta.url));return(await loader.parseAsync(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),'/')).scene;};
const triangles=(root:T.Object3D)=>{let n=0;root.traverse(o=>{if(o instanceof T.Mesh)n+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});return n;};

test('old saves keep the authored hair/face; new cosmetics round-trip and invalid persisted ids fall back safely',()=>{
 const s=newGame();assert.deepEqual(appearanceOf(s),{hair:'original',face:'original'});assert.equal(parseSave(JSON.stringify(s))!.appearance,undefined);
 s.appearance={hair:'rainbow',face:'wink'};assert.deepEqual(parseSave(JSON.stringify(s))!.appearance,s.appearance);
 assert.deepEqual(readAppearance({hair:'constructor',face:'__proto__'}),{hair:'original',face:'original'});
 assert.deepEqual(readAppearance(null),appearanceOf(newGame()));
});
test('the complete outfit commits atomically, buys only missing looks and preserves weapons/pets/inventory',()=>{
 const s=newGame();s.energy=1000;s.level=50;s.bag={hat_straw:1,boots_cowboy:1,sword_wood:1,pet_dragon:1};s.gear={weapon:'sword_wood',pet:'pet_dragon'};
 const bag={...s.bag},p=payload(s);p.look='slim-grown-bunny-bare';p.appearance={hair:'buns',face:'tears'};p.gear.hat='hat_straw';p.gear.boots='boots_cowboy';
 assert.ok(action(s,p));assert.equal(s.energy,1000-160-150);assert.equal(s.gear.weapon,'sword_wood');assert.equal(s.gear.pet,'pet_dragon');assert.deepEqual(s.bag,bag);assert.deepEqual(s.appearance,p.appearance);
 const balance=s.energy;assert.ok(action(s,p));assert.equal(s.energy,balance,'owned options are free');
 const before=JSON.stringify(s),bad={...p,look:'slim-tiny-bunny-panda',gear:{...p.gear,outfit:'not-owned'}};
 assert.throws(()=>action(s,bad));assert.equal(JSON.stringify(s),before,'a rejected item rolls back both the look purchase and every slot');
 for(const a of [{hair:'bogus',face:'wink'},{hair:'buns',face:'constructor'}]){assert.throws(()=>action(s,{...p,appearance:a}));assert.equal(JSON.stringify(s),before);}
 assert.throws(()=>action(s,{...p,gear:{...p.gear,weapon:'sword_lava'}}));assert.equal(JSON.stringify(s),before);
});
test('hair and expressions alone leave combat stats and the wardrobe inventory unchanged',()=>{
 const s=newGame(),before=activeStats(s),bag={...s.bag};const p=payload(s);p.appearance={hair:'rainbow',face:'sparkle'};assert.ok(action(s,p));assert.deepEqual(activeStats(s),before);assert.deepEqual(s.bag,bag);assert.equal(s.energy,0);
});
test('a replaceable head preserves all original triangles and every rig/hand anchor',async()=>{
 for(const file of ['hero.glb','hero-girl.glb','hero-tiny.glb','hero-girl-grown.glb']){
  const kit=new HeroLibrary(file,disk);await kit.load();assert.ok(kit.ready,file);
  const original=kit.instance('#abcdef')!,components=kit.instance('#abcdef',true)!;
  assert.equal(triangles(components),triangles(original),file+' loses no authored skin, hair, cheeks or eye highlights');
  assert.ok(components.getObjectByName('base-hair'));assert.ok(components.getObjectByName('base-face'));
  for(const name of ['head','body','arm-left','arm-right','leg-left','leg-right','hand-left','hand-right']){original.updateMatrixWorld(true);components.updateMatrixWorld(true);assert.ok(original.getObjectByName(name)!.getWorldPosition(new T.Vector3()).distanceTo(components.getObjectByName(name)!.getWorldPosition(new T.Vector3()))<1e-9,name);}
 }
});
test('all hairstyles replace old hair on every body/height; all faces replace eyes/mouth without changing the rig',async()=>{
 useHeroLoader(disk);
 for(const body of ROWS.body)for(const height of ROWS.height){const id=`${body}-${height}-none-bare` as LookId,kit=id===DEFAULT_LOOK?new HeroLibrary('hero.glb',disk):heroKitFor(id);await kit.load();assert.ok(kit.ready,id);
  for(const hair of Object.keys(HAIR_STYLES).filter(id=>id!=='original') as HairStyle[]){const hero=kit.instance('#4aa8ff',true)!;applyAppearance(hero,{hair,face:'wink'},id);assert.equal(hero.getObjectByName('base-hair')!.visible,false,id+' '+hair);assert.equal(hero.getObjectByName('base-face')!.visible,false);assert.deepEqual(hero.getObjectByName('custom-hair')!.scale.toArray(),fitOf(id).head?.scale??[1,1,1]);assert.ok(hero.getObjectByName('hand-right'));}
 }
 const kit=new HeroLibrary('hero.glb',disk);await kit.load();
 for(const face of Object.keys(FACE_STYLES).filter(id=>id!=='original') as FaceStyle[]){const hero=kit.instance('#fff',true)!;applyAppearance(hero,{hair:'original',face},DEFAULT_LOOK);assert.equal(hero.getObjectByName('base-hair')!.visible,true);assert.equal(hero.getObjectByName('base-face')!.visible,false);assert.ok(hero.getObjectByName('custom-face'));assert.ok(triangles(appearanceModel('face',face))<1600);}
 const hood=kit.instance('#fff',true)!;applyAppearance(hood,{hair:'waves',face:'happy'},DEFAULT_LOOK,{hood:true});assert.equal(hood.getObjectByName('base-hair')!.visible,false);assert.equal(hood.getObjectByName('custom-hair'),undefined,'hood covers hair without extra wig clipping');
 const costume=kit.instance('#fff',true)!;applyAppearance(costume,{hair:'rainbow',face:'tears'},DEFAULT_LOOK,{disguise:true});assert.equal(costume.getObjectByName('base-hair')!.visible,true);assert.equal(costume.getObjectByName('custom-face'),undefined,'authored costume face stays intact');
});
test('wardrobe uses owned clothing tiles, keeps full wardrobe categories, and all cosmetic icons are crisp 256px',()=>{
 const s=newGame();s.bag.hat_straw=1;const draft=wardrobeDraft(s),html=wardrobeHtml(s,draft,'hat');assert.match(html,/data-wardrobe-item="hat_straw"/);assert.doesNotMatch(html,/data-wardrobe-item="hat_wizard"/);assert.match(html,/data-wardrobe-tab="face"/);assert.match(html,/data-wardrobe-tab="body"/);assert.match(html,/data-wardrobe-action="zoom"/);
 draft.appearance.hair='rainbow';assert.equal(s.appearance,undefined,'a preview is not a save');
 for(const [kind,styles]of [['hair',HAIR_STYLES],['face',FACE_STYLES]] as const)for(const id of Object.keys(styles)){
  const image=readFileSync(new URL(`../public/assets/icons/appearance/${kind}-${id}.webp`,import.meta.url));assert.equal(image.toString('ascii',12,16),'VP8X');assert.deepEqual([1+image.readUIntLE(24,3),1+image.readUIntLE(27,3)],[256,256]);
 }
});
test('HUD portraits invalidate for cosmetic changes, not only for a new hat',()=>{
 const spec={color:'#fff',look:DEFAULT_LOOK,gear:{}};assert.notEqual(portraitKey(spec),portraitKey({...spec,appearance:{hair:'rainbow',face:'happy'}}));assert.notEqual(portraitKey({...spec,appearance:{hair:'rainbow',face:'happy'}}),portraitKey({...spec,appearance:{hair:'rainbow',face:'wink'}}));
});
test('a remote avatar rebuilds when canonical cosmetics change, even if its gear and look stay the same',async()=>{
 (heroKit as unknown as {loadScene:typeof disk}).loadScene=disk;await heroKit.load();
 const w=Object.create(World.prototype) as World;Object.assign(w,{scene:new T.Scene(),state:newGame(),time:0,planet:'home',networkRole:'peer',remoteRoot:new T.Group(),remotePlayers:new Map(),friendIds:new Set()});
 const pose={x:0,z:0,look:DEFAULT_LOOK,color:'#fff',gear:{},appearance:{hair:'rainbow' as const,face:'happy' as const}};w.addRemotePlayer('ann',pose);const first=w.remotePlayers.get('ann')!.mesh;assert.equal(first.getObjectByName('base-hair')!.visible,false);assert.equal(first.userData.appearance.face,'happy');
 w.updateRemotePlayer('ann',{...pose,appearance:{hair:'buns',face:'tears'}});const next=w.remotePlayers.get('ann')!.mesh;assert.notEqual(next,first);assert.equal(next.userData.appearance.hair,'buns');assert.equal(next.userData.appearance.face,'tears');
 w.removeRemotePlayer('ann');
});
