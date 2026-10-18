import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
import{heroKit,heroKitFor,wearKit,useHeroLoader}from'../src/assets.ts';
import{World}from'../src/world.ts';
import{newGame,parseSave}from'../src/model.ts';
import{DEFAULT_LOOK,shapeOf,type LookId}from'../src/looks.ts';
import{hatCoversHair,hairModel}from'../src/hair-art.ts';
import{avatarFallback}from'../src/avatar-fallback.ts';
import{figureLook,wardrobeDraft,wardrobeHtml}from'../src/wardrobe-ui.ts';
const disk=async(url:string)=>{const b=readFileSync(new URL('../public/assets/models/'+url.split('/').pop()!.split('?')[0],import.meta.url));return(await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;};
useHeroLoader(disk);for(const kit of[heroKit,wearKit]){(kit as unknown as{loadScene:typeof disk}).loadScene=disk;await kit.load();}
const styles=['original','ponytail','buns','waves','rainbow'] as const;
test('every replacement hairstyle is complete from the front, sides and back, with finite normals and a mobile triangle budget',()=>{
 for(const style of styles)for(const hat of[false,true]){const hair=hairModel(style,hat),b=new T.Box3().setFromObject(hair);let tris=0;
  assert.ok(b.min.z<-.38&&b.max.z>.48&&b.min.x<-.47&&b.max.x>.47,style+' covers front, nape and both temples');
  hair.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');tris+=(o.geometry.index?.count??p.count)/3;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.01);}}});
  assert.ok(tris<11000,`${style}: ${tris} triangles`);
 }
});
test('ordinary hats retain the actual selected hair on all four figures; only enclosing hoods hide it and removal restores it',async()=>{
 const w=Object.assign(Object.create(World.prototype),{state:newGame(),refreshAvatars(){}}) as World;
 for(const shape of['normal','long','baby','sturdy']){const look=figureLook(DEFAULT_LOOK,shape);await heroKitFor(look).load();
  for(const hair of styles){const plain=w.lookAvatar('#fff',{},look,{hair,face:'original'});assert.ok(plain.getObjectByName('custom-hair'));
   for(const hat of['hat_straw','hat_santa','hat_cat','hat_bunny','hat_halo','crown','hat_bear','hat_leather','hat_frog','hat_space']){const hero=w.lookAvatar('#fff',{hat},look,{hair,face:'original'});assert.equal(!!hero.getObjectByName('custom-hair'),!hatCoversHair(hat),shape+' '+hair+' '+hat);assert.equal(hero.userData.appearance.hair,hair,'a hat never rewrites the saved style');}
   assert.ok(w.lookAvatar('#fff',{},look,{hair,face:'original'}).getObjectByName('custom-hair'));
  }
 }
});
test('figure choices preserve old ears/hood/ownership and the new wardrobe exposes exactly four figures and five replacement hair choices',()=>{
 const s=newGame();s.looks={owned:['grown','tall','tiny','cat','fox'],style:'girl-grown-cat-fox'};const before=JSON.stringify(s),draft=wardrobeDraft(s);
 for(const shape of['normal','long','baby','sturdy']){const id=figureLook(draft.look,shape);assert.equal(shapeOf(id),shape);assert.ok(id.endsWith('-cat-fox'));}
 assert.equal(JSON.stringify(s),before);assert.deepEqual(parseSave(before)!.looks,s.looks);
 const figures=wardrobeHtml(s,draft,'body'),hair=wardrobeHtml(s,draft,'hair');assert.equal((figures.match(/data-wardrobe-figure=/g)??[]).length,4);assert.equal((hair.match(/data-wardrobe-cosmetic=/g)??[]).length,5);assert.doesNotMatch(figures,/data-look-option="(boy|girl|slim|teen|grown)"/);
});
test('a missing body asset uses the replacement anatomy and exact hand sockets, without the retired hair, backpack or sprout',()=>{
 const c=avatarFallback('#73c0e0');for(const part of['body','head','arm-left','arm-right','leg-left','leg-right','hand-left','hand-right'])assert.ok(c.getObjectByName(part));
 assert.equal(c.getObjectByName('head-leaf'),undefined);assert.equal(c.getObjectByName('backpack'),undefined);c.updateMatrixWorld(true);assert.ok(Math.abs(c.getObjectByName('hand-right')!.getWorldPosition(new T.Vector3()).y-.8092)<1e-6);
});
test('legacy sleeves acquire an elbow ring and follow the new bend without moving palms or changing shared source art',async()=>{
 const{fitAvatarPiece}=await import('../src/avatar-fit.ts'),{DEFAULT_PIVOTS,shapeProfile}=await import('../src/looks.ts'),look='sturdy-chibi-none-bare',profile=shapeProfile(look),source=new T.BoxGeometry(.26,.30,.26),before=Array.from(source.getAttribute('position').array);
 const sleeve=()=>{const m=new T.Mesh(source,new T.MeshBasicMaterial());m.position.set(...DEFAULT_PIVOTS['arm-right']);m.position.y-=.15;return m;},a=sleeve(),b=sleeve();assert.ok(fitAvatarPiece(a,'arm-right',look));assert.ok(fitAvatarPiece(b,'arm-right',look));assert.equal(a.geometry,b.geometry,'fitted sleeves reuse their cached geometry');assert.deepEqual(Array.from(source.getAttribute('position').array),before,'the old authoring mesh stays immutable');
 const length=profile.pivots['arm-right'][1]-profile.pivots['hand-right'][1],elbow=-length*.48,p=a.geometry.getAttribute('position'),xs:number[]=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-elbow)<1e-5)xs.push(p.getX(i));assert.ok(xs.length>=4,'a formerly straight sleeve now has a cross section at the elbow');assert.ok(Math.abs((Math.min(...xs)+Math.max(...xs))/2-.12)<1e-5,'the sleeve follows the bare arm bend');
});
