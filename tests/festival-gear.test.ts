import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as M from '../src/model.ts';
import {FESTIVAL_ITEMS,FESTIVAL_RECIPES} from '../src/festival-content.ts';
import {applyGameAction} from '../src/actions.ts';
import {previewGear} from '../src/try-on.ts';
import {KitLibrary,heroKit,wearKit,festivalKit} from '../src/assets.ts';
import {World} from '../src/world.ts';
import {buildDecoration} from '../src/decorations-art.ts';
import {loadVietnamese,setLanguage,t} from '../src/i18n.ts';

async function scene(file:string){const bytes=readFileSync(new URL('../public/assets/models/'+file,import.meta.url));return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'')).scene;}

test('all four wildlife drops feed playable, material-priced festival recipes',()=>{
 for(const material of ['rainbow_slime','moss_shell','lava_scale','rolling_shell'])assert.ok(FESTIVAL_RECIPES.some(r=>(r.materials[material]??0)>0));
 for(const recipe of FESTIVAL_RECIPES){
  const s=M.newGame();s.level=50;s.energy=100000;const index=M.RECIPES.findIndex(r=>r.result===recipe.result);assert.ok(index>=0);
  for(const[id,n]of Object.entries(recipe.materials))s.bag[id]=n;const material=Object.keys(recipe.materials)[0];s.bag[material]!--;
  const before=JSON.stringify(s);assert.equal(M.craft(s,index),false);assert.equal(JSON.stringify(s),before,'missing material does not charge energy or consume anything');s.bag[material]!++;
  const energy=s.energy;assert.equal(applyGameAction(s,{type:'craft',payload:{index}},{now:1800000000000,random:()=>.5}),true);
  assert.equal(s.energy,energy-recipe.energy);assert.equal(s.bag[recipe.result],1);for(const id of Object.keys(recipe.materials))assert.equal(s.bag[id],undefined,id+' consumed');
 }
});

test('glasses and hair equip independently, survive saves and try-on preserves the other slot',()=>{
 const s=M.newGame();s.level=50;for(const id of Object.keys(FESTIVAL_ITEMS))s.bag[id]=1;
 assert.equal(M.equip(s,'hair_flex'),true);assert.equal(M.equip(s,'glasses_flex'),true);assert.equal(M.equip(s,'outfit_flex'),true);assert.equal(M.equip(s,'boots_flex'),true);
 assert.deepEqual(s.gear,{hat:'hair_flex',glasses:'glasses_flex',outfit:'outfit_flex',boots:'boots_flex'});
 const parsed=M.parseSave(JSON.stringify(s));assert.ok(parsed);assert.deepEqual(parsed.gear,s.gear);
 assert.deepEqual(previewGear(s.gear,'hair_pumpkin'),{...s.gear,hat:'hair_pumpkin'});
 assert.equal(M.equip(s,'glasses_flex','hat'),false);assert.equal(M.unequip(s,'glasses'),true);assert.equal(s.gear.hat,'hair_flex');
});

test('festival GLB contains fitting animated wearables, all icons and detailed carriage geometry',async()=>{
 const kit=new KitLibrary(['fixture'],async()=>await scene('festival-gear.glb'));await kit.load();
 const parts:Record<string,string[]>={hair_pumpkin:['head'],dress_pumpkin:['body','arm-left','arm-right'],boots_pumpkin:['leg-left','leg-right'],hair_flex:['head'],glasses_flex:['head'],outfit_flex:['body','arm-left','arm-right','leg-left','leg-right'],boots_flex:['leg-left','leg-right']};
 for(const[id,wanted]of Object.entries(parts)){assert.ok(kit.instance(id),id);assert.deepEqual([...new Set(kit.parts(id)!.map(p=>p.tag))].sort(),wanted.sort(),id+' follows body pivots');assert.ok(readFileSync(new URL('../public/assets/icons/items/'+id+'.webp',import.meta.url)).byteLength>200);}
 const car=kit.instance('deco_ghost_carriage')!;assert.ok(car);car.updateMatrixWorld(true);const b=new T.Box3().setFromObject(car);assert.ok(b.max.y>1.6&&b.min.y>=-.03);assert.ok(b.max.z-b.min.z>2.7);assert.ok(b.max.x-b.min.x>1.4);
 const manifest=JSON.parse(readFileSync(new URL('../art/festival-gear-manifest.json',import.meta.url),'utf8'));assert.ok(manifest.models.deco_ghost_carriage.triangles<6000);assert.equal(manifest.models.outfit_flex.parts.length,5);
});

test('runtime dresses head, sleeves and legs, hides the base shirt and renders a placeable carriage',async()=>{
 const scenes=new Map([['festival-gear.glb',await scene('festival-gear.glb')],['hero.glb',await scene('hero.glb')]]);
 // Load the actual singleton kits through local fixture scenes instead of fetching.
 (heroKit as any).loadScene=async()=>scenes.get('hero.glb');(wearKit as any).loadScene=async()=>scenes.get('festival-gear.glb');(festivalKit as any).loadScene=async()=>scenes.get('festival-gear.glb');await Promise.all([heroKit.load(),wearKit.load(),festivalKit.load()]);
 const w=Object.create(World.prototype) as any,avatar=w.avatar('#66aaff',{hat:'hair_flex',glasses:'glasses_flex',outfit:'outfit_flex',boots:'boots_flex'});
 const head=avatar.getObjectByName('head');assert.ok(head.children.some((o:T.Object3D)=>o.name.startsWith('hair_flex')));assert.ok(head.children.some((o:T.Object3D)=>o.name.startsWith('glasses_flex')));
 avatar.traverse((o:T.Object3D)=>{if(o instanceof T.Mesh&&/^Hero shirt/.test((o.material as T.Material).name))assert.equal(o.visible,false);});
 for(const role of ['arm-left','arm-right','leg-left','leg-right'])assert.ok(avatar.getObjectByName(role).children.some((o:T.Object3D)=>o.name.startsWith('outfit_flex')||o.name.startsWith('boots_flex')),role);
 const car=buildDecoration('deco_ghost_carriage');assert.equal(car.userData.decorationId,'deco_ghost_carriage');assert.equal(car.userData.fallback,undefined);
 const s=M.newGame();s.bag.deco_ghost_carriage=1;assert.equal(M.placeDecoration(s,'deco_ghost_carriage',-10,-5),true);assert.equal(s.bag.deco_ghost_carriage,undefined);assert.equal(s.decorations[0].id,'deco_ghost_carriage');
});

test('festival names and descriptions are translated in Vietnamese',async()=>{
 await loadVietnamese();setLanguage('vi');try{for(const item of Object.values(FESTIVAL_ITEMS)){assert.notEqual(t(item.name),item.name);assert.notEqual(t(item.desc),item.desc);}assert.equal(t('Glasses'),'Kính');}finally{setLanguage('en');}
});
