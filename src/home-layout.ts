/** Shared by the save migration, authoritative placement checks and the visiting garden. */
export interface YardPoint { x: number; z: number }
export interface YardLayout {
  version: 1 | 2 | 3;
  stores: Record<'sell' | 'shop' | 'craft', YardPoint>;
  pinkTree: YardPoint;
  upgrade?: YardPoint;
  cook?: YardPoint;
}
export const YARD_WELL = { x: -5.2, z: -14.3 };
export const YARD_CHEST = { x: -3.05, z: -6.2 };
export const YARD_TREES = [[-13, -8], [3, -13], [14, 5], [-2, 15]] as const;
export const defaultYardLayout = (version: 1 | 2 | 3 = 3): YardLayout => ({ version, stores: {
  sell: { x: 10, z: -11 }, shop: { x: 6.4, z: -13.5 }, craft: { x: 13.4, z: -8.1 },
}, pinkTree: { x: -12, z: 9 }, ...(version>=2?{upgrade:version===2?{x:-3.4,z:-2.4}:{x:2.6,z:2.6},cook:{x:6,z:-7}}:{}) });
export const inwardFacing = ({ x, z }: YardPoint) => Math.atan2(-x, -z);
export function readYardLayout(raw: unknown): YardLayout | undefined {
  if (!raw || typeof raw !== 'object') return;
  const v = raw as Partial<YardLayout>;
  const point = (p: YardPoint | undefined) => !!p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x, p.z) <= 17;
  if ((v.version !== 1 && v.version !== 2 && v.version !== 3) || !v.stores || !['sell', 'shop', 'craft'].every(k => point(v.stores![k as keyof YardLayout['stores']])) || !point(v.pinkTree) || v.version>=2&&(!point(v.upgrade)||!point(v.cook))) return;
  return { version: v.version!, ...(v.version>=2?{upgrade:{x:v.upgrade!.x,z:v.upgrade!.z},cook:{x:v.cook!.x,z:v.cook!.z}}:{}), stores: { sell: { ...v.stores.sell }, shop: { ...v.stores.shop }, craft: { ...v.stores.craft } }, pinkTree: { ...v.pinkTree! } };
}
export const yardOf = (s?: { yardLayout?: YardLayout }) => { const yard=s?.yardLayout??defaultYardLayout();return {...yard,upgrade:yard.upgrade??{x:8.5,z:-7},cook:yard.cook??{x:1,z:10.5}}; };
export function homeClearance(s?: { yardLayout?: YardLayout }) {
  const yard = yardOf(s);
  return [
    { x: 0, z: -8, r: 3.2 }, { ...yard.stores.sell, r: 2 }, { ...yard.stores.shop, r: 2 },
    { ...yard.stores.craft, r: 1.7 }, { ...YARD_CHEST, r: .8 }, { ...YARD_WELL, r: 1.4 },
    { ...yard.upgrade, r: 1.5 }, { x: 13.5, z: -3, r: 2 }, { ...yard.cook, r: 1.4 },
    { x: -7.5, z: 11.2, r: 3.6 }, ...YARD_TREES.map(([x,z]) => ({ x,z,r:1.2 })), { ...yard.pinkTree, r: 1.2 },
  ];
}
/** The closest legal centre to an old decoration, keeping the requested model footprint clear. */
export function fitYardAnchor(layout: YardLayout, kind: keyof YardLayout['stores'] | 'pinkTree' | 'upgrade' | 'cook', anchor: YardPoint, occupied: {x:number;z:number;r:number}[] = []) {
  const radius = kind === 'pinkTree' ? 1.2 : kind === 'craft' ? 1.7 : kind==='upgrade'?1.5:kind==='cook'?1.4:2;
  const own = kind === 'pinkTree' ? layout.pinkTree : kind==='upgrade'||kind==='cook'?yardOf({yardLayout:layout})[kind]:layout.stores[kind];
  const obstacles = [...homeClearance({ yardLayout: layout }).filter(o => o.x !== own.x || o.z !== own.z), ...occupied];
  const valid = (p: YardPoint) => Math.hypot(p.x,p.z) + radius <= 17.4 && Math.abs(p.x) >= radius + .65 && Math.abs(p.z) >= radius + .65 && obstacles.every(o => Math.hypot(p.x-o.x,p.z-o.z) >= radius+o.r+.15);
  if (valid(anchor)) return { x: anchor.x, z: anchor.z };
  // Search in 20 cm steps; tie-breaks favour moving inward rather than toward the fence.
  const choices: YardPoint[] = [];
  for (let dx=-3;dx<=3.01;dx+=.2) for (let dz=-3;dz<=3.01;dz+=.2) choices.push({x:+(anchor.x+dx).toFixed(2),z:+(anchor.z+dz).toFixed(2)});
  choices.sort((a,b)=>Math.hypot(a.x-anchor.x,a.z-anchor.z)-Math.hypot(b.x-anchor.x,b.z-anchor.z)||Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  return choices.find(valid) ?? { ...own };
}
