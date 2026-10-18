import {readFileSync} from 'node:fs';
import {HALLOWEEN_PRIZES} from '../src/halloween-gacha-config.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewPixels, GachaTurn, GACHA_TURN_SPEED, gachaCameraDistance, GACHA_CAMERA_PITCH } from '../src/gacha-preview-rules.ts';

test('preview resolution uses device pixels and preserves aspect ratio even at the mobile GPU cap', () => {
 assert.deepEqual(previewPixels(290,290,3),{width:580,height:580});
 assert.deepEqual(previewPixels(600,300,3),{width:1024,height:512});
 assert.deepEqual(previewPixels(200,400,2),{width:400,height:800});
 assert.deepEqual(previewPixels(0,0,0),{width:1,height:1});
});
test('the real model turns clockwise at a frame-rate independent speed, freezes for drag/reduced motion and ignores other pointers', () => {
 const a=new GachaTurn(),b=new GachaTurn();assert.ok(GACHA_TURN_SPEED<0);
 for(let i=0;i<60;i++)a.tick(1/60,i*1000/60,false);for(let i=0;i<30;i++)b.tick(1/30,i*1000/30,false);
 assert.ok(Math.abs(a.angle-b.angle)<1e-9);const angle=a.angle;assert.equal(a.tick(1,2000,true),angle);
 assert.equal(a.down(4,100),true);assert.equal(a.down(5,150),false);assert.equal(a.move(5,200),false);assert.equal(a.up(5,2500),false);
 assert.equal(a.tick(.1,2500,false),angle);a.move(4,150);assert.ok(a.angle>angle);a.move(4,50);assert.ok(a.angle<angle);
 a.up(4,3000);const paused=a.angle;assert.equal(a.tick(.1,4100,false),paused);assert.ok(a.tick(.1,4300,false)<paused);
 a.down(6,100);a.cancel(5000);assert.equal(a.down(7,100),true,'cancel releases captured pointer');
});


test('spinning envelopes keep all corners visible in portrait and landscape; still rewards use a tighter fit',()=>{
 const pitch=GACHA_CAMERA_PITCH,tan=Math.tan(Math.PI/12);
 for(const size of [{x:4,y:2,z:2},{x:.6,y:3,z:.3},{x:2,y:2,z:2}])for(const aspect of [.55,1,2]){
  const d=gachaCameraDistance(size,aspect,null);
  assert.ok(gachaCameraDistance(size,aspect,-.5)<=d*1.001);
  for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/16)for(const ix of [-1,1])for(const iy of [-1,1])for(const iz of [-1,1]){
   const x=ix*size.x/2*Math.cos(yaw)+iz*size.z/2*Math.sin(yaw),z=iz*size.z/2*Math.cos(yaw)-ix*size.x/2*Math.sin(yaw),y=iy*size.y/2,depth=d-(y*Math.sin(pitch)+z*Math.cos(pitch));
   assert.ok(Math.abs(x)/(depth*tan*aspect)<1);assert.ok(Math.abs(y*Math.cos(pitch)-z*Math.sin(pitch))/(depth*tan)<1);
  }
 }
});


test('all ten gacha rewards have dedicated 512px icons instead of upscaled inventory thumbnails',()=>{
 let bytes=0;
 for(const prize of HALLOWEEN_PRIZES){
  const image=readFileSync(new URL(`../public/assets/icons/gacha/${prize.id}.webp`,import.meta.url));bytes+=image.length;
  assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');
  assert.equal(image.toString('ascii',12,16),'VP8X');assert.deepEqual([1+image.readUIntLE(24,3),1+image.readUIntLE(27,3)],[512,512],prize.id);
 }
 assert.ok(bytes<200*1024,'ten icons stay within a small offline/mobile download');
});
