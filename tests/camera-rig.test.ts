import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {defaultCameraZoom,cameraOffset,clampZoom,followBlend,groundAt,lightAxes,shadowBox,viewFootprint} from '../src/camera-rig.ts';

const near=(a:number,b:number,eps=.05)=>assert.ok(Math.abs(a-b)<=eps,`${a} should be ${b} ±${eps}`);
const DESKTOP=1440/900,PHONE=390/844,LANDSCAPE=844/390;

test('camera zoom is 87% indoors, 80% landscape and 110% portrait, with the original portrait calibration',()=>{
  for(const aspect of [DESKTOP,LANDSCAPE,1])near(defaultCameraZoom(aspect,false),.8,1e-12);
  for(const aspect of [PHONE,.9])near(defaultCameraZoom(aspect,false),1.1,1e-12);
  for(const aspect of [DESKTOP,PHONE,LANDSCAPE,.9]){
    near(defaultCameraZoom(aspect,true),.87,1e-12);
    for(const zoom of [.8,.87,1.1])near(cameraOffset(aspect,zoom).length(),Math.hypot(17,13.5)*zoom*(aspect<.8?1.3:1),1e-9);
  }
  assert.deepEqual(cameraOffset(DESKTOP).toArray(),[0,17,13.5]);
  near(cameraOffset(PHONE,1.1).length(),Math.hypot(17,13.5)*1.1*1.3,1e-9);
});

test('ground projection matches the actual lens and resolved zoom in both orientations',()=>{
  const raycaster=new T.Raycaster(),hit=new T.Vector3(),ground=new T.Plane(new T.Vector3(0,1,0),0);
  for(const aspect of [DESKTOP,PHONE,.9])for(const indoor of [false,true]){
    const zoom=defaultCameraZoom(aspect,indoor),lens=new T.PerspectiveCamera(40,aspect,.5,300);
    lens.position.copy(cameraOffset(aspect,zoom));lens.lookAt(0,0,0);lens.updateMatrixWorld();
    for(const [x,y]of [[-1,0],[1,0],[0,-1],[0,1],[0,0]]){
      raycaster.setFromCamera(new T.Vector2(x,y),lens);raycaster.ray.intersectPlane(ground,hit);
      const point=groundAt(aspect,zoom,x,y);near(point.x,hit.x,1e-9);near(point.z,hit.z,1e-9);
    }
  }
});

test('the camera follows at 9/s, 5/s in cut-scenes, and zoom reaches 0.65-1.5 by wheel and 0.6-1.6 by pinch',()=>{
  near(followBlend(.1,false),1-Math.exp(-.9),1e-12);near(followBlend(.1,true),1-Math.exp(-.5),1e-12);
  assert.deepEqual([clampZoom(.2,'wheel'),clampZoom(3,'wheel'),clampZoom(1.1,'wheel')],[.65,1.5,1.1]);
  assert.deepEqual([clampZoom(.2,'pinch'),clampZoom(3,'pinch')],[.6,1.6]);
});

test('light axes are the ones three gives the shadow camera, wherever the sun target is',()=>{
  const offset=new T.Vector3(-15,35,18),sun=new T.DirectionalLight();sun.target.position.set(3,0,-2);sun.position.copy(sun.target.position).add(offset);
  sun.updateMatrixWorld();sun.target.updateMatrixWorld();sun.shadow.updateMatrices(sun);
  const x=new T.Vector3(),y=new T.Vector3(),z=new T.Vector3();sun.shadow.camera.matrixWorld.extractBasis(x,y,z);
  const [ax,ay]=lightAxes(offset);near(x.distanceTo(ax),0,1e-9);near(y.distanceTo(ay),0,1e-9);
});

test('the shadow box holds every surface in view up to 6 m tall, and is far smaller than the old square box',()=>{
  const axes=lightAxes(new T.Vector3(-15,35,18)),caster=new T.Raycaster(),hit=new T.Vector3();
  for(const aspect of [DESKTOP,PHONE,LANDSCAPE])for(const zoom of [.6,1,1.6]){
    const box=shadowBox(viewFootprint(aspect,zoom),axes),lens=new T.PerspectiveCamera(40,aspect,.5,300);
    lens.position.copy(cameraOffset(aspect,zoom));lens.lookAt(0,0,0);lens.updateMatrixWorld();
    // What a pixel shows at height h (the ground, a back, a roof, a tree top) must be inside the box.
    for(let i=0;i<=20;i++)for(let j=0;j<=20;j++)for(const h of [0,2,4,6]){
      caster.setFromCamera(new T.Vector2(i/10-1,j/10-1),lens);
      if(!caster.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-h),hit))continue;
      const a=hit.dot(axes[0]),b=hit.dot(axes[1]);
      assert.ok(a>=box.left&&a<=box.right&&b>=box.bottom&&b<=box.top,`aspect ${aspect.toFixed(2)} zoom ${zoom} h ${h}: ${a.toFixed(1)},${b.toFixed(1)} outside`);
    }
    if(zoom!==1)continue;
    // The orthographic camera's box: max(26, span x aspect x 0.8) each way from the explorer.
    const span=aspect<.8?21*Math.max(.82,Math.min(1.35,.6/aspect)):21,old=(2*Math.max(26,span*Math.max(1,aspect)*.8))**2;
    assert.ok((box.right-box.left)*(box.top-box.bottom)<old*.75,`aspect ${aspect.toFixed(2)}: ${((box.right-box.left)*(box.top-box.bottom)).toFixed(0)} m² vs ${old.toFixed(0)} m²`);
  }
});
