import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.ts';
import {applyGameAction,ActionError} from '../src/actions.ts';
import {aquarium,fishClass,fishFits,fishSize,readAquariumFish} from '../src/aquarium.ts';
import {aquariumPanel} from '../src/aquarium-ui.ts';
const fixture=(id='deco_aquarium')=>{const s=M.newGame();s.decorations=[{uid:'tank',id,x:12,z:0,rotation:0}];s.bag={fish_jelly:8,fish_icepike:8,fish_whale:8};return s;};
const action=(s:M.SaveState,type:string,payload:Record<string,unknown>)=>applyGameAction(s,{type,payload},{now:10000,random:()=>.25});

test('aquarium classes use species maximums, including both boundaries and records larger than their species',()=>{
 assert.equal(fishClass('fish_jelly'),0);assert.equal(fishClass('fish_icepike'),1);assert.equal(fishClass('fish_whale'),2);
 const size=M.FISH.fish_jelly.size;try{M.FISH.fish_jelly.size=[1,49.9];assert.equal(fishClass('fish_jelly'),0);M.FISH.fish_jelly.size=[1,50];assert.equal(fishClass('fish_jelly'),1);M.FISH.fish_jelly.size=[1,150];assert.equal(fishClass('fish_jelly'),1);M.FISH.fish_jelly.size=[1,150.1];assert.equal(fishClass('fish_jelly'),2);}finally{M.FISH.fish_jelly.size=size;}
 assert.equal(fishFits('deco_aquarium','boot'),false);assert.equal(fishFits('constructor','fish_jelly'),false);
 const s=fixture();s.fishRecords.fish_jelly=100;assert.equal(action(s,'putAquariumFish',{uid:'tank',id:'fish_jelly'}),true);assert.equal(s.decorations[0].fish![0].size,100,'record does not change species class');
});

test('all tanks enforce their capacity and allowed classes atomically, and fish can be returned exactly once',()=>{
 for(const [id,allowed] of [['deco_aquarium',['fish_jelly']],['deco_aquarium_m',['fish_jelly','fish_icepike']],['deco_aquarium_l',['fish_jelly','fish_icepike','fish_whale']]] as const){
  const s=fixture(id),spec=aquarium(id)!;
  for(let i=0;i<spec.capacity;i++){const fish=allowed[i%allowed.length],before=s.bag[fish]!;assert.equal(action(s,'putAquariumFish',{uid:'tank',id:fish}),true);assert.equal(s.bag[fish],before-1);}
  const full=structuredClone(s);assert.throws(()=>action(s,'putAquariumFish',{uid:'tank',id:allowed[0]}),/full/);assert.deepEqual(s,full);
  assert.equal(M.removeDecoration(s,'tank'),false,'packing cannot discard resident fish');
  for(let i=spec.capacity-1;i>=0;i--){assert.equal(action(s,'takeAquariumFish',{uid:'tank',index:i}),true);assert.throws(()=>action(s,'takeAquariumFish',{uid:'tank',index:i}),ActionError);}
  for(const fish of Object.keys(s.bag))assert.equal(s.bag[fish],8);assert.equal(s.decorations[0].fish!.length,0);assert.equal(M.removeDecoration(s,'tank'),true);
 }
 const s=fixture(),before=structuredClone(s);assert.throws(()=>action(s,'putAquariumFish',{uid:'tank',id:'fish_whale'}),/too large/);assert.deepEqual(s,before);
 const m=fixture('deco_aquarium_m');for(let i=0;i<4;i++)assert.equal(M.putAquariumFish(m,'tank','fish_icepike'),true);
 const l=fixture('deco_aquarium_l');for(let i=0;i<6;i++)assert.equal(M.putAquariumFish(l,'tank','fish_whale'),true);
});

test('saved resident fish round-trip without altering old decorations; malformed fish are bounded and discarded',()=>{
 const s=fixture('deco_aquarium_l');s.decorations.push({uid:'old',id:'deco_shell',x:10,z:2,rotation:.3});s.fishRecords.fish_whale=987.6;
 action(s,'putAquariumFish',{uid:'tank',id:'fish_whale'});assert.equal(s.decorations[0].fish![0].size,987.6);
 const loaded=M.parseSave(JSON.stringify(s))!;assert.deepEqual(loaded.decorations,s.decorations);assert.equal(Object.hasOwn(loaded.decorations[1],'fish'),false);
 assert.equal(fishSize('fish_jelly',{},()=>.25),18.8);assert.deepEqual(readAquariumFish('deco_shell',[{id:'fish_jelly',size:20}]),undefined);
 const fish=readAquariumFish('deco_aquarium',[null,{id:'fish_whale',size:600},{id:'fish_jelly',size:NaN},{id:'fish_jelly',size:-1},...Array.from({length:50},()=>({id:'fish_jelly',size:20,evil:true}))]);assert.deepEqual(fish,[{id:'fish_jelly',size:20},{id:'fish_jelly',size:20}]);
});

test('a full backpack leaves fish in the tank, and an invalid action never changes either inventory',()=>{
 const s=fixture();s.bag={fish_jelly:1};action(s,'putAquariumFish',{uid:'tank',id:'fish_jelly'});
 for(const id of Object.keys(M.ITEMS)){if(id==='fish_jelly')continue;if(!M.canAddItem(s,id))break;M.addItem(s,id);}
 const before=structuredClone(s);assert.throws(()=>action(s,'takeAquariumFish',{uid:'tank',index:0}),/backpack/i);assert.deepEqual(s,before);
 for(const payload of [{uid:'tank',index:-1},{uid:'tank',index:.5},{uid:'gone',index:0}]){assert.throws(()=>action(s,'takeAquariumFish',payload),ActionError);assert.deepEqual(s,before);}
});

test('the aquarium panel lists only eligible bag fish and exposes explicit capacity and take-out controls',()=>{
 const s=fixture(),art=()=>'';let html=aquariumPanel(s,'tank',art);assert.match(html,/data-item="fish_jelly"/);assert.doesNotMatch(html,/data-item="fish_whale"|data-item="fish_icepike"/);
 action(s,'putAquariumFish',{uid:'tank',id:'fish_jelly'});action(s,'putAquariumFish',{uid:'tank',id:'fish_jelly'});html=aquariumPanel(s,'tank',art);assert.match(html,/Bể đã đầy/);assert.match(html,/take-aquarium-fish/);assert.match(html,/data-item="fish_jelly" disabled/);
});

test('showing a fish is cosmetic, lasts six seconds, uses its record or a bounded roll and never spends the fish',()=>{
 const s=fixture();s.fishRecords.fish_icepike=123.4;const bag={...s.bag};assert.deepEqual(action(s,'showFish',{id:'fish_icepike'}),{id:'fish_icepike',size:123.4,until:16000});assert.deepEqual(s.bag,bag);assert.deepEqual(action(s,'showFish',{id:'fish_jelly'}),{id:'fish_jelly',size:18.8,until:16000});
 for(const id of ['boot','carrot','__proto__','fish_koi'])assert.throws(()=>action(s,'showFish',{id}),ActionError);
});
