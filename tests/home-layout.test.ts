import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import * as M from '../src/model.ts';
import {World} from '../src/world.ts';
import {HOUSE} from '../src/house.ts';
import {defaultYardLayout,readYardLayout,homeClearance,YARD_CHEST,YARD_WELL,inwardFacing} from '../src/home-layout.ts';
const reload=(s:unknown)=>M.parseSave(JSON.stringify(s))!;
function oldGarden(){const s=M.newGame();delete s.yardLayout;s.plots=Array.from({length:12},(_,i)=>({crop:null,plantedAt:0,...M.previousBed(i)}));return s;}
const decoration=(uid:string,id:string,x:number,z:number):M.Decoration=>({uid,id,x,z,rotation:0});

test('yard migration moves the twelve beds into a clear 3 by 4 block without changing crops, turns or upgrades',()=>{
 const s=oldGarden();Object.assign(s.plots[3],{crop:'carrot',plantedAt:12345,growDuration:50000,generation:'crop-1',level:2,choice:'carrot'});
 const r=reload(s);assert.ok(r.yardLayout);assert.equal(r.plots.length,12);
 assert.equal(new Set(r.plots.map(p=>p.x)).size,3);assert.equal(new Set(r.plots.map(p=>p.z)).size,4);
 for(let i=0;i<12;i++){const {x,z,...crop}=r.plots[i],{x:oldX,z:oldZ,...before}=s.plots[i];assert.deepEqual(crop,before);assert.deepEqual({x,z},M.defaultBed(i));assert.ok(M.bedClear(x!,z!,0,r));}
 assert.deepEqual(reload(r),r,'loading the migrated save twice is idempotent');
});
test('replacement shops and pink tree use saved anchors; displaced items return exactly once even into a full bag',()=>{
 const s=oldGarden();s.bag=Object.fromEntries(Object.keys(M.ITEMS).slice(0,60).map(id=>[id,1]));
 const yard=defaultYardLayout();s.decorations=[decoration('coffin','deco_cursed_coffin',yard.stores.craft.x,yard.stores.craft.z),decoration('tree','deco_cursed_tree',yard.stores.shop.x,yard.stores.shop.z),decoration('teddy','deco_undying_teddy',-12,9),decoration('well','deco_aquarium',YARD_WELL.x,YARD_WELL.z),decoration('chest','deco_aquarium',YARD_CHEST.x,YARD_CHEST.z),decoration('pen','deco_aquarium',M.PEN.x,M.PEN.z),decoration('bed','deco_aquarium',M.defaultBed(0).x,M.defaultBed(0).z),decoration('market','deco_aquarium',yard.stores.sell.x,yard.stores.sell.z),decoration('untouched','deco_cursed_bench',4,3)];
 s.decorations[3].fish=[{id:'fish_clown',size:14},{id:'fish_clown',size:12}];s.fishRecords.fish_clown=9;
 const r=reload(s);assert.deepEqual(r.yardLayout,yard);assert.deepEqual(r.decorations,[s.decorations.at(-1)]);
 for(const id of ['deco_cursed_coffin','deco_cursed_tree','deco_undying_teddy'])assert.equal(r.bag[id],(s.bag[id]??0)+1);
 assert.equal(r.bag.deco_aquarium,(s.bag.deco_aquarium??0)+5);assert.equal(r.bag.fish_clown,(s.bag.fish_clown??0)+2);assert.equal(r.fishRecords.fish_clown,14);
 assert.deepEqual(reload(r),r,'no duplicate compensation on reconnect');
 for(const o of homeClearance(r)){if(['sell','shop','craft'].some(k=>r.yardLayout!.stores[k as 'sell'].x===o.x&&r.yardLayout!.stores[k as 'sell'].z===o.z))assert.equal(M.decorSpotOk(r,o.x,o.z,'deco_aquarium'),false);}
 for(const x of [2.6,6.8,11])assert.equal(M.decorSpotOk(r,x,6.5,'deco_aquarium'),true,'the old store row is free');
});
test('an anchor too close to scenery moves only enough to fit the full storefront',()=>{
 const s=oldGarden();s.decorations=[decoration('coffin','deco_cursed_coffin',13,-9.5)];const r=reload(s),p=r.yardLayout!.stores.craft;
 assert.ok(Math.hypot(p.x-13,p.z+9.5)<2);assert.ok(Math.hypot(p.x-10,p.z+11)>=1.7+2+.15);assert.equal(r.bag.deco_cursed_coffin,1);
});
test('animals and species pens follow the moved pen without altering production or released animals',()=>{
 const s=oldGarden();s.farm={built:true,penLevel:1,nextId:4,speciesPens:{chicken:{x:-9.6,z:-4.5}},animals:[{uid:1,kind:'chicken',bornAt:10,acquiredAt:10,cycleAt:60010,timerVersion:2,home:{x:-9.6,z:-4.5}},{uid:2,kind:'cow',bornAt:10,acquiredAt:10,cycleAt:120010,timerVersion:2,home:{x:9,z:9}},{uid:3,kind:'duck',bornAt:10,acquiredAt:10,cycleAt:90010,timerVersion:2}]};
 const r=reload(s);assert.deepEqual(r.farm.animals[0].home,{x:-8.6,z:-8.5});assert.deepEqual(r.farm.speciesPens?.chicken,{x:-8.6,z:-8.5});assert.equal(r.farm.animals[0].pen,true);assert.equal(r.farm.animals[0].cycleAt,60010);assert.deepEqual(r.farm.animals[1].home,{x:9,z:9});assert.equal(r.farm.animals[2].home?.z,-8.5);
});
test('the cottage cannot become a green-button target; tapping it walks to the actual door only',()=>{
 const root=new T.Group(),house=new T.Group(),ring=new T.Mesh(),marker=new T.Mesh();root.add(house);
 const home={id:'home:home:0',kind:'home',name:'home',icon:'',mesh:house,x:0,z:-8,radius:3.2};let destination:unknown=null,interactions=0;
 const w=Object.assign(Object.create(World.prototype),{entities:[home],root,planet:'home',position:new T.Vector3(0,0,-5),selected:home,ring,marker,onInteract:()=>interactions++,walkTo:(x:number,z:number)=>{destination={x,z};}}) as World;
 assert.equal(w.nearest(),undefined);assert.equal(w.interactNearest(),false);w.select(home);assert.deepEqual(destination,{x:HOUSE.outdoorDoor.x,z:HOUSE.outdoorDoor.z+.85});assert.equal(interactions,0);
 assert.ok(Number.isFinite(inwardFacing(defaultYardLayout().stores.sell)));assert.ok(readYardLayout(defaultYardLayout()));
});
