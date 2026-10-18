import * as T from 'three';
import { weaponKit, wearKit, festivalKit } from './assets.ts';
import { buildDecoration } from './decorations-art.ts';
import { HALLOWEEN_PRIZES } from './halloween-gacha-config.ts';
import { toonMaterial } from './toon.ts';
import { assetUrl } from './asset-url.ts';
/** Dedicated 512px renders: never enlarge the inventory's 128px thumbnails for this full-screen page. */
export const gachaIconUrl = (id: string) => assetUrl(`icons/gacha/${id}.webp`);
export async function buildGachaItem(id: string): Promise<T.Group | null> {
  if (!HALLOWEEN_PRIZES.some(p => p.id === id)) return null;
  if (id === 'rod_key') { await weaponKit.load(); return weaponKit.instance(id); }
  if (id === 'dress_pumpkin' || id === 'boots_pumpkin') { await wearKit.load(); return wearKit.instance(id); }
  if (id === 'deco_ghost_carriage') { await festivalKit.load(); return festivalKit.instance(id); }
  if (id !== 'energy') return buildDecoration(id);
  const group = new T.Group(), shape = new T.Shape();
  const points = [[.12,.85],[-.4,-.1],[-.03,-.02],[-.16,-.85],[.43,.17],[.05,.09]];
  points.forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
  const bolt = new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025}),toonMaterial({color:'#ffcf46',emissive:'#f4b428',emissiveIntensity:.18}));
  group.add(bolt); group.name='gacha-energy'; return group;
}
