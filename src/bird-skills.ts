/** Bird disguise balance shared by the solo simulation, authority and tooltips. Seconds/metres/× attack. */
export const BIRD={
 peck:{hits:5,gap:.09,range:3.2,power:.48,lift:5},
 dagger:{hits:5,gap:.1,range:3.4,power:.5,mark:4,bonus:.2},
 slide:{range:14,speed:24,power:1.7,knock:6,trail:3,width:1.25},
 blizzard:{time:4,radius:4.8,tick:1,power:.8,attackSlow:.5},
 fish:{count:3,range:15,flight:.65,gap:.14,radius:2.6,power:1.15,stun:1.5},
 grapple:{range:14,speed:26,power:1.5,knock:5},
 net:{life:6,radius:4.5,root:2.5,power:1.3},
 lantern:{range:15,flight:.7,radius:4,time:4,tick:1,power:.9},
} as const;
export const BIRD_LOOKS=['penguin-peck','penguin-slide','penguin-blizzard','frozen-fish','duck-dagger','duck-grapple','duck-net','duck-lantern','duck-fire','compass-mark'] as const;
export type BirdLook=typeof BIRD_LOOKS[number];
export const BIRD_SKILLS={
 dz_penguin:[
 {name:'Lightning Beak',icon:'🐧',cd:3,description:'Five rapid beak hits against one enemy within 3.2 m; the final hit launches it.'},
 {name:'Ice Belly Slide',icon:'🧊',cd:7,description:'Slide 14 m, knocking aside every enemy in the path. Ice slows movement by 50% for 3 s.'},
 {name:'Penguin Blizzard',icon:'❄️',cd:11,description:'A blizzard follows you for 4 s: damage each second within 4.8 m and 50% slower enemy attacks.'},
 {name:'Frozen Fish Bombs',icon:'🐟',cd:9,description:'Lob three frozen fish up to 15 m. Each explodes within 2.6 m and stuns for 1.5 s.'}],
 dz_explorer_duck:[
 {name:'Hunting Dagger',icon:'🗡️',cd:3,description:'Five dagger hits within 3.4 m. The final hit marks its target: 20% more incoming damage for 4 s.'},
 {name:'Explorer Grapple',icon:'🪝',cd:7,description:'Grapple to your aim point up to 14 m away, knocking aside enemies along the flight.'},
 {name:'Ancient Net Trap',icon:'🕸️',cd:10,description:'Leave a 4.5 m net for 6 s. Enemies entering it take damage and are rooted for 2.5 s.'},
 {name:'Oil Lantern Toss',icon:'🏮',cd:10,description:'Lob a lantern up to 15 m. Its 4 m fire zone burns enemies each second for 4 s.'}],
};
/** Aim at a selected spot, clamped to the cast range. No invalid network coordinates reach the simulation. */
export function birdLanding(from:{x:number;z:number},aim:{x:number;z:number}|null|undefined,angle:number,range:number){
 const valid=aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.z),dx=valid?aim.x-from.x:Math.sin(angle)*range,dz=valid?aim.z-from.z:Math.cos(angle)*range,d=Math.hypot(dx,dz),k=d>range?range/d:1;
 return {x:from.x+dx*k,z:from.z+dz*k};
}
