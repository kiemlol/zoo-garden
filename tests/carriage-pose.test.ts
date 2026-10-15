import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GHOST_CARRIAGE,validateCarriagePose} from '../src/carriage-pose.ts';

const garden=[{uid:'decor-1',id:GHOST_CARRIAGE,x:4,z:-4,rotation:Math.PI/2}],at={x:3.65,z:-4};
const seated={uid:'decor-1',phase:'seated',scale:.62,progress:1,lift:.2};
test('carriage presence is bounded and tied to a real carriage in the current garden',()=>{
  assert.deepEqual(validateCarriagePose(seated,garden,at,'home'),seated);
  for(const change of [{uid:'decor-2'},{phase:'flying'},{scale:99},{scale:NaN},{lift:Infinity},{lift:3},{progress:.5}])assert.equal(validateCarriagePose({...seated,...change},garden,at,'home'),null);
  assert.equal(validateCarriagePose(seated,garden,{x:30,z:0},'home'),null);
  assert.equal(validateCarriagePose(seated,garden,at,'ice'),null);
  assert.equal(validateCarriagePose(seated,[],at,'home'),null);
  assert.equal(validateCarriagePose(seated,[{...garden[0],id:'deco_bench'}],at,'home'),null);
  for(const phase of ['boarding','leaving'])assert.ok(validateCarriagePose({...seated,phase,progress:.5,lift:2},garden,{x:6,z:-4},'home'));
});
