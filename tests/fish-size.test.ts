import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.ts';
import {selectCatch,resolveMysteryCatch} from '../src/fishing.ts';
import {fishShowPlan,FISH_SHOW_MAX_SPAN} from '../src/fish-show-rules.ts';
import {MAX_FISH_SIZE_CM} from '../src/fish-size.ts';

test('every catalog species and both catch selection paths obey the shared 800 cm ceiling',()=>{
 assert.equal(MAX_FISH_SIZE_CM,800);assert.deepEqual(M.FISH.fish_whale.size,[400,800]);
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

test('shared offline/server grants cap new records, while loading preserves existing catches and residents',()=>{
 for(const giant of [false,true]){const s=M.newGame();assert.ok(giant?M.grantMysteryCatch(s,'fish_whale',3000,true):M.grantCatch(s,'fish_whale',3000,true));assert.equal(s.fishRecords.fish_whale,800);assert.equal(s.bag.fish_whale,1);}
 const old=M.newGame();old.fishRecords.fish_whale=1200;old.decorations=[{uid:'old-tank',id:'deco_aquarium_l',x:12,z:0,rotation:0,fish:[{id:'fish_whale',size:1200}]}];
 const loaded=M.parseSave(JSON.stringify(old))!;assert.equal(loaded.fishRecords.fish_whale,1200);assert.equal(loaded.decorations[0].fish![0].size,1200);
 M.grantCatch(loaded,'fish_whale',2000);assert.equal(loaded.fishRecords.fish_whale,1200,'a new capped catch cannot erase an old record');
 assert.equal(fishShowPlan('fish_whale',loaded.fishRecords.fish_whale)!.span,FISH_SHOW_MAX_SPAN,'old giants use the same bounded showcase');
});
