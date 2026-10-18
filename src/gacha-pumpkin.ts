import * as T from 'three';
import { toonMaterial } from './toon.ts';
/** A hollow, lobed jack-o'-lantern with its own detachable lid. Procedural game art, no image textures. */
export interface GachaPumpkin { root: T.Group; body: T.Group; lid: T.Group; glow: T.Mesh }
export const PUMPKIN_OPEN_SECONDS = 1.15;
export function buildGachaPumpkin(): GachaPumpkin {
  const root = new T.Group(), body = new T.Group(), lid = new T.Group();
  root.name = 'halloween-gift-pumpkin'; body.name = 'pumpkin-body'; lid.name = 'pumpkin-lid'; root.add(body, lid);
  const orange = toonMaterial({ color: '#ee8c28' }), amber = toonMaterial({ color: '#f7a63b' }), inside = toonMaterial({ color: '#713c32', side: T.DoubleSide });
  const green = toonMaterial({ color: '#778d45' }), leafMat = toonMaterial({ color: '#a5b957' });
  const gold = toonMaterial({ color: '#ffe5a0', emissive: '#ffbc52', emissiveIntensity: .65 });
  const dark = toonMaterial({ color: '#65373b' });
  const mesh = (geometry: T.BufferGeometry, material: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m; };
  // The shell ends at the seam; unlike overlapping spheres this leaves a real opening when the lid flies off.
  const surface = (top: number, bottom: number, material: T.Material, parent: T.Object3D, shrink = 1) => {
    const vertices: number[] = [], indices: number[] = [], rings = 12, segments = 64;
    for (let j = 0; j <= rings; j++) {
      const theta = top + (bottom - top) * j / rings;
      for (let i = 0; i <= segments; i++) {
        const a = i / segments * Math.PI * 2, radius = Math.sin(theta) * (.92 + .065 * Math.cos(a * 8)) * shrink;
        vertices.push(Math.sin(a) * radius, .78 + Math.cos(theta) * .72, Math.cos(a) * radius);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) { const k = j * (segments + 1) + i; indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2); }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(geometry, material, parent);
  };
  surface(.94, Math.PI - .08, orange, body);
  const inner = surface(.94, Math.PI - .1, inside, body, .91); inner.position.y = -.015;
  const rimVertices: number[] = [], rimIndices: number[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2, r = Math.sin(.94) * (.92 + .065 * Math.cos(a * 8));
    for (const radius of [r, r * .91]) rimVertices.push(Math.sin(a) * radius, 1.197, Math.cos(a) * radius);
    if (i < 64) { const k = i * 2; rimIndices.push(k, k + 2, k + 1, k + 2, k + 3, k + 1); }
  }
  const rimGeometry = new T.BufferGeometry(); rimGeometry.setAttribute('position', new T.Float32BufferAttribute(rimVertices, 3)); rimGeometry.setIndex(rimIndices); rimGeometry.computeVertexNormals(); mesh(rimGeometry, amber, body);

  surface(.08, .94, amber, lid);
  // The underside follows the lobes too: a round disk would poke through the narrow grooves as dark specks.
  const underside: number[] = [0, 1.199, 0], undersideIndices: number[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2, r = Math.sin(.94) * (.92 + .065 * Math.cos(a * 8)) * .96;
    underside.push(Math.sin(a) * r, 1.199, Math.cos(a) * r); if (i < 64) undersideIndices.push(0, i + 2, i + 1);
  }
  const undersideGeometry = new T.BufferGeometry(); undersideGeometry.setAttribute('position', new T.Float32BufferAttribute(underside, 3)); undersideGeometry.setIndex(undersideIndices); undersideGeometry.computeVertexNormals(); mesh(undersideGeometry, inside, lid);
  const stem = mesh(new T.CylinderGeometry(.085, .13, .32, 7), green, lid, -.035, 1.62); stem.rotation.z = -.24;
  const leaf = mesh(new T.SphereGeometry(.18, 10, 6), leafMat, lid, .18, 1.66, .02); leaf.scale.set(1.3, .18, .63); leaf.rotation.z = .3;
  const vine = mesh(new T.TorusGeometry(.1, .02, 5, 14, Math.PI * 1.6), green, lid, -.2, 1.62, .02); vine.rotation.y = .3;
  function plaque(points: number[][], material: T.Material, z: number, y: number, x = 0, scale = 1) {
    const shape = new T.Shape(points.map(p => new T.Vector2(p[0] * scale, p[1] * scale)));
    const geometry = new T.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: false, steps: 1 }), positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i) + x, py = positions.getY(i) + y, sin = Math.sqrt(Math.max(0, 1 - ((py - .78) / .72) ** 2));
      let a = Math.asin(T.MathUtils.clamp(px / Math.max(.01, sin * .92), -.95, .95)), radius = 0;
      for (let j = 0; j < 4; j++) { radius = sin * (.92 + .065 * Math.cos(a * 8)); a = Math.asin(T.MathUtils.clamp(px / Math.max(.01, radius), -.95, .95)); }
      positions.setZ(i, Math.sqrt(Math.max(.01, radius * radius - px * px)) + z + positions.getZ(i));
    }
    geometry.computeVertexNormals(); return mesh(geometry, material, body, x, y);

  }
  // Dark bevels and warm inset eyes/mouth make the face readable at the small gift-box size.
  const eye = [[-.12, -.07], [.12, -.07], [.015, .13]];
  for (const side of [-1, 1]) {
    plaque(eye, dark, .012, .89, side * .29, 1.22);
    plaque(eye, gold, .035, .891, side * .29);
  }
  const mouth = [[-.4, .07], [-.29, -.09], [-.16, -.12], [-.08, -.055], [0, -.14], [.13, -.13], [.22, -.05], [.3, -.07], [.4, .07], [.19, .005], [.1, .065], [0, -.005], [-.12, .06], [-.22, -.005]];
  plaque(mouth, dark, .012, .55, 0, 1.1); plaque(mouth, gold, .035, .55);
  const glow = mesh(new T.CircleGeometry(.73, 32), new T.MeshBasicMaterial({ color: '#ffe8a6', transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }), body, 0, 1.21); glow.rotation.x = -Math.PI / 2; glow.name = 'pumpkin-magic';
  return { root, body, lid, glow };
}
const smooth = (a: number) => { const t = T.MathUtils.clamp(a, 0, 1); return t * t * (3 - 2 * t); };
/** Absolute elapsed seconds: squash DOWN first, then launch the separate lid UP; no allocations in the animation. */
export function poseGachaPumpkin(model: GachaPumpkin, seconds: number) {
  const t = Math.max(0, seconds), squash = Math.sin(Math.min(1, t / .3) * Math.PI);
  const lift = smooth((t - .26) / .78), fade = smooth((t - .88) / .27);
  model.body.scale.set(1 + squash * .1, 1 - squash * .19, 1 + squash * .1);
  model.lid.scale.set(1 + squash * .1, 1, 1 + squash * .1);
  model.lid.position.set(lift * -.18, -squash * .2 + lift * 2.3, lift * -.13);
  model.lid.rotation.set(lift * -.32, lift * .23, lift * -.35);
  model.lid.visible = t < PUMPKIN_OPEN_SECONDS;
  model.root.scale.setScalar(1 - fade * .12);
  (model.glow.material as T.MeshBasicMaterial).opacity = Math.sin(lift * Math.PI * .9) * .8;
}
