import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildGachaPumpkin, poseGachaPumpkin, PUMPKIN_OPEN_SECONDS } from '../src/gacha-pumpkin.ts';
import { dropTree } from '../src/dispose-tree.ts';

test('gift pumpkin is a small hollow toon model with a separately moving lid and no image textures', () => {
 const model = buildGachaPumpkin(); let triangles = 0;
 assert.equal(model.root.getObjectByName('pumpkin-body'), model.body); assert.equal(model.root.getObjectByName('pumpkin-lid'), model.lid);
 model.root.traverse(o => { if (!(o instanceof T.Mesh)) return; triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3; const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) assert.equal((m as T.MeshToonMaterial).map, null); });
 assert.ok(triangles < 6500, `budget ${triangles}`);
 const bounds = new T.Box3().setFromObject(model.root); assert.ok(bounds.getSize(new T.Vector3()).x < 2.2); assert.ok(bounds.getSize(new T.Vector3()).y < 2);
 dropTree(model.root);
});

test('opening squashes DOWN before the lid flies UP; reset after interruption restores the whole model', () => {
 const model = buildGachaPumpkin();
 poseGachaPumpkin(model, .15); assert.ok(model.body.scale.y < 1); assert.ok(model.lid.position.y < 0);
 poseGachaPumpkin(model, .7); assert.ok(model.lid.position.y > .8); assert.ok(Math.abs(model.lid.rotation.z) > .05);
 for (const t of [0, .15, .3, .7, PUMPKIN_OPEN_SECONDS, 5]) { poseGachaPumpkin(model, t); model.root.updateMatrixWorld(true); assert.ok([...model.lid.matrixWorld.elements, ...model.body.matrixWorld.elements].every(Number.isFinite)); }
 assert.equal(model.lid.visible, false); poseGachaPumpkin(model, 0);
 assert.equal(model.lid.visible, true); assert.equal(model.lid.position.y, 0); assert.deepEqual(model.body.scale.toArray(), [1,1,1]); assert.equal(model.root.scale.x, 1); dropTree(model.root);
});
