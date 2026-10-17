import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.ts';
import {selectCatch,resolveMysteryCatch} from '../src/fishing.ts';
import {fishShowPlan,FISH_SHOW_MAX_SPAN} from '../src/fish-show-rules.ts';
import {MAX_FISH_SIZE_CM} from '../src/fish-size.ts';
import {fishClass} from '../src/aquarium.ts';

test('every catalog species and both catch selection paths obey the shared 800 cm ceiling',()=>{
 assert.equal(MAX_FISH_SIZE_CM,800);assert.deepEqual(M.FISH.fish_whale.size,[250,800]);
 for(const f of Object.values(M.FISH)){
  const [min,max]=f.size;assert.ok(min<=max&&max<=800,f.id);
  if(M.ITEMS[f.id].size)assert.ok(M.ITEMS[f.id].size![1]<=800);
  for(const roll of [0,.5,.999999,1]){
   assert.ok(selectCatch([{id:f.id,min,max,weight:1}],()=>roll).size<=800,f.id);
   const numbers=[0,roll];const giant=resolveMysteryCatch({id:f.id,max},()=>numbers.shift()!);assert.ok(giant.size<=800,f.id);
  }
 }
 // Defensive selection also covers a future/older pool with an oversized maximum.
 assert.equal(selectCatch([{id:'future',min:400,max:2000,weight:1}],()=>1).size,800);
 assert.equal(resolveMysteryCatch({id:'future',max:2000},()=>0).size,800);
});

test('shared offline/server grants cap new records, while loading clamps records and preserves aquarium residents',()=>{
 for(const giant of [false,true]){const s=M.newGame();assert.ok(giant?M.grantMysteryCatch(s,'fish_whale',3000,true):M.grantCatch(s,'fish_whale',3000,true));assert.equal(s.fishRecords.fish_whale,800);assert.equal(s.bag.fish_whale,1);}
 const old=M.newGame();old.fishRecords.fish_whale=1200;old.decorations=[{uid:'old-tank',id:'deco_aquarium_l',x:12,z:0,rotation:0,fish:[{id:'fish_whale',size:1200}]}];
 const loaded=M.parseSave(JSON.stringify(old))!;assert.equal(loaded.fishRecords.fish_whale,800);assert.equal(loaded.decorations[0].fish![0].size,1200);
 M.grantCatch(loaded,'fish_whale',2000);assert.equal(loaded.fishRecords.fish_whale,800,'a new catch stays within the global cap');
 assert.equal(fishShowPlan('fish_whale',loaded.fishRecords.fish_whale)!.span,FISH_SHOW_MAX_SPAN,'old giants use the same bounded showcase');
});

const expectedRanges={"fish_clown":[5,15],"fish_rainbow":[5,15],"fish_perch":[10,40],"fish_puffer":[10,45],"fish_jelly":[10,45],"fish_angler":[15,80],"fish_carp":[20,75],"fish_koi":[20,85],"fish_catfish":[25,90],"fish_icepike":[25,95],"fish_golden":[30,120],"fish_shark":[50,150],"fish_eel":[50,200],"fish_sunfish":[80,300],"fish_swordfish":[100,400],"fish_manta":[150,600],"fish_kraken":[150,700],"fish_whale":[250,800]};
test('requested ranges are explicit on every fish item and keep tank classes based on species maximum',()=>{
 for(const [id,range] of Object.entries(expectedRanges)){assert.deepEqual(M.ITEMS[id].size,range,id+' item');assert.deepEqual(M.FISH[id].size,range,id+' fish');assert.equal(fishClass(id),range[1]<50?0:range[1]<=150?1:2,id+' tank class');}
 assert.deepEqual(M.FISH.fish_guardian.size,[180,260],'unlisted guardian remains unchanged');
});

test('loading clamps each record to its own species range, rejects malformed records, and is idempotent',()=>{
 for(const [id,[min,max]] of Object.entries(expectedRanges))for(const [n,wanted] of [[min/2,min],[(min+max)/2,(min+max)/2],[max+200,max],[max,max]]){
  const raw=M.newGame();raw.bag[id]=2;raw.chest.wood=3;raw.fishRecords={[id]:n};const text=JSON.stringify(raw),s=M.parseSave(text)!;
  assert.equal(s.fishRecords[id],wanted,`${id}: ${n}`);assert.deepEqual(s.bag,raw.bag);assert.deepEqual(s.chest,raw.chest);assert.deepEqual(M.parseSave(JSON.stringify(s))!.fishRecords,s.fishRecords);assert.equal(raw.fishRecords[id],n,'input remains untouched');
 }
 const raw=M.newGame();raw.fishRecords={fish_puffer:129,fish_perch:0,fish_carp:-3,fish_clown:NaN,fish_koi:Infinity,unknown:10};
 assert.deepEqual(M.parseSave(JSON.stringify(raw))!.fishRecords,{fish_puffer:45});
});
