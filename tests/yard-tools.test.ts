import {test} from 'node:test';import assert from 'node:assert/strict';
import * as M from '../src/model.ts';
import {defaultYardLayout,homeClearance,yardOf} from '../src/home-layout.ts';
import {planCast,planForwardCast,CAST} from '../src/fishing.ts';
import {showContextPrompt} from '../src/context-prompt.ts';
import {decorationPanel,decorationControls} from '../src/decoration-ui.ts';
const reload=(s:M.SaveState)=>M.parseSave(JSON.stringify(s))!;
const deco=(uid:string,id:string,x:number,z:number,fish?:M.Decoration['fish']):M.Decoration=>({uid,id,x,z,rotation:Math.PI/4,...(fish?{fish}:{})});

test('utility migration uses the large tank anchor, preserves its residents and runs only once',()=>{
 const s=M.newGame();s.yardLayout=defaultYardLayout(1);s.decorations=[deco('tank','deco_aquarium_l',-4.6,-3.3,[{id:'fish_clown',size:12}]),deco('statue','deco_golem',-6.8,-1.7)];
 // Use a registered statue id when the content spelling differs.
 s.decorations[1].id=Object.keys(M.ITEMS).find(id=>M.ITEMS[id].type==='decor'&&/statue/i.test(M.ITEMS[id].name))??'deco_lamp';
 const r=reload(s),tank=r.decorations.find(d=>d.uid==='tank')!;
 assert.deepEqual(r.yardLayout!.upgrade,{x:-4.6,z:-3.3});assert.deepEqual(r.yardLayout!.cook,{x:6,z:-7});assert.equal(r.yardLayout!.version,2);assert.deepEqual(r.yardLayout!.stores,s.yardLayout.stores);
 assert.ok(tank);assert.ok(tank.z>=s.decorations[0].z,'prefer the visible yard in front');assert.notDeepEqual([tank.x,tank.z],[-4.6,-3.3]);assert.ok(Math.hypot(tank.x+4.6,tank.z+3.3)<6);assert.deepEqual(tank.fish,s.decorations[0].fish);assert.equal(tank.rotation,Math.PI/4);assert.equal(r.bag.deco_aquarium_l,undefined);
 assert.ok(M.decorSpotOk(r,tank.x,tank.z,tank.id,tank.uid));assert.ok(Math.abs(tank.x)>2.2&&Math.abs(tank.z)>2.2);assert.deepEqual(reload(r),r);
});
test('new utility footprints return colliding belongings even with a full bag, retaining fish counts',()=>{
 const s=M.newGame();s.yardLayout=defaultYardLayout(1);s.bag=Object.fromEntries(Object.keys(M.ITEMS).slice(0,M.bagCapacity(s)+5).map(id=>[id,1]));s.decorations=[deco('conflict','deco_aquarium',6,-7,[{id:'fish_clown',size:14}]),deco('safe','deco_lamp',11,6.5)];
 const r=reload(s);assert.equal(r.decorations.length,1);assert.equal(r.decorations[0].uid,'safe');assert.equal(r.bag.deco_aquarium,(s.bag.deco_aquarium??0)+1);assert.equal(r.bag.fish_clown,(s.bag.fish_clown??0)+1);assert.equal(r.fishRecords.fish_clown,14);assert.deepEqual(reload(r).bag,r.bag);
 for(const p of [yardOf(r).cook,yardOf(r).upgrade])assert.equal(M.decorSpotOk(r,p.x,p.z,'deco_lamp'),false);
});
test('moving an owned tank needs no bag copy and retains its identity, fish and inventory; invalid moves are atomic',()=>{
 const s=M.newGame();s.decorations=[deco('tank','deco_aquarium_l',4,4,[{id:'fish_clown',size:13}])];const before=structuredClone(s);
 assert.equal(M.moveDecoration(s,'tank',8,5,Math.PI/2),true);assert.deepEqual(s.bag,before.bag);assert.deepEqual(s.decorations[0],{...before.decorations[0],x:8,z:5,rotation:Math.PI/2});
 const moved=structuredClone(s);assert.equal(M.moveDecoration(s,'tank',yardOf(s).cook.x,yardOf(s).cook.z),false);assert.deepEqual(s,moved);assert.deepEqual(reload(s).decorations,s.decorations);
});
test('packing a filled tank is atomic with a full bag and keeps records when it succeeds',()=>{
 const s=M.newGame();s.decorations=[deco('tank','deco_aquarium',4,4,[{id:'fish_clown',size:14},{id:'fish_clown',size:13}])];s.bag=Object.fromEntries(Object.keys(M.ITEMS).filter(id=>!['deco_aquarium','fish_clown'].includes(id)).slice(0,M.bagCapacity(s)+5).map(id=>[id,1]));const before=structuredClone(s);
 assert.equal(M.removeDecoration(s,'tank'),false);assert.deepEqual(s,before);s.bag={};assert.equal(M.removeDecoration(s,'tank'),true);assert.equal(s.bag.deco_aquarium,1);assert.equal(s.bag.fish_clown,2);assert.equal(s.fishRecords.fish_clown,14);assert.equal(M.removeDecoration(s,'tank'),false);
});
test('casts keep the old distance at every legal heading and never clamp or turn a dry heading toward the pond',()=>{
 const water={x:0,z:0,r:10},player={x:0,z:10.6};
 for(const tap of [{x:0,z:0},{x:1,z:7},{x:-2,z:-3}])for(const angle of [Math.PI-.2,Math.PI,Math.PI+.2]){
  const old=planCast(water,player,tap),next=planForwardCast(water,player,angle,tap)!;assert.ok(next);const length=Math.hypot(old.cast.x-player.x,old.cast.z-player.z);assert.ok(Math.abs(Math.hypot(next.cast.x-player.x,next.cast.z-player.z)-length)<1e-10);assert.ok(Math.abs((next.cast.x-player.x)*Math.cos(angle)-(next.cast.z-player.z)*Math.sin(angle))<1e-10);assert.ok(Math.hypot(next.cast.x,next.cast.z)<=water.r-CAST.edgeGap+1e-8);
 }
 assert.equal(planForwardCast(water,player,0),null);assert.equal(planForwardCast(water,player,NaN),null);assert.equal(CAST.min,1.8);assert.equal(CAST.max,7);
});
test('only redundant nearby prompts disappear; leave controls and existing store/combat prompts remain',()=>{
 for(const kind of ['decoration','pen','animal','fish','plot','home']){assert.equal(showContextPrompt(kind),false);assert.equal(showContextPrompt(kind,true),true);}
 for(const kind of ['enemy','sell','shop','cook','upgrade','craft'])assert.equal(showContextPrompt(kind),true);
 assert.equal(showContextPrompt(undefined),false);
});
test('decoration panels expose owner editing and retain furniture use, while visitors cannot edit or pack',()=>{
 const s=M.newGame();s.decorations=[deco('tank','deco_aquarium_l',4,4),deco('bench','deco_cursed_bench',7,4),deco('car','deco_ghost_carriage',10,5)];
 assert.match(decorationControls(s,'tank'),/edit-decor/);assert.match(decorationControls(s,'tank'),/pack-decor/);assert.equal(decorationControls(s,'tank',true),'');
 assert.match(decorationPanel(s,'bench',()=>''),/use-decor/);assert.match(decorationPanel(s,'bench',()=>'',true),/use-decor/);assert.doesNotMatch(decorationPanel(s,'bench',()=>'',true),/edit-decor|pack-decor/);assert.match(decorationPanel(s,'car',()=>''),/use-decor/);assert.doesNotMatch(decorationPanel(s,'car',()=>'',true),/use-decor/);
});
