/** Ink painter balance shared by solo combat, the server and tooltips. Seconds/metres/× attack. */
export const INK={
 domain:{radius:8,time:10,grow:.8,weaken:.4,bonus:.5,slow:.2},
 brush:{count:5,gap:.06,range:16,speed:26,power:.55,burst:2.3,burstPower:.9},
 rush:{range:13,speed:25,trail:4,width:1.15,slow:.3},
 dragon:{draw:.8,time:5,radius:6,tick:1,power:.85,knock:3,blind:1.2,pool:4},
} as const;
export const INK_LOOKS=['ink-domain','ink-domain-end','ink-brush','ink-burst','ink-rush','ink-trail','ink-dragon-draw','ink-dragon','ink-rain','ink-pool'] as const;
export const INK_SKILLS=[
 {name:'Divine Brushstrokes',icon:'🖌️',cd:4,description:'Launch five brushes in sequence at a target up to 16 m away. Each must land before the next launches. The fifth bursts in a 2.3 m ink splash.'},
 {name:'Ink Dash',icon:'〰️',cd:6,description:'Become a black ink streak and dash 13 m forward. The ink trail lasts 4 s and slows enemies by 30%.'},
 {name:'Awaken the Ink Dragon',icon:'🐉',cd:15,description:'Draw an ink dragon over 0.8 s, then dot its eyes. It circles you for 5 s, alternating tail knockbacks and blinding ink breath in 6 m. It dissolves into ink rain and leaves a slowing pool for 4 s.'},
 {name:'Ink Wash Domain',icon:'⚫',cd:20,description:'Draw an 8 m ink domain for 10 s. Creatures, trees, rocks and ground turn monochrome; players keep their colours. Its barrier keeps monsters on their original side. Inside, enemies deal 40% less damage and move 20% slower; you deal 50% more damage.'},
];
/** Radius follows the same outward wash in combat, navigation, the server and rendering. */
export function inkDomainRadius(age:number,radius:number=INK.domain.radius){const t=Math.max(0,Math.min(1,age/INK.domain.grow));return radius*(1-(1-t)**3);}
export interface InkDomain {x:number;z:number;radius:number}
interface Point{x:number;z:number;radius?:number}
export function inInkDomain(p:Point,fields:readonly InkDomain[]){return fields.some(f=>Math.hypot(p.x-f.x,p.z-f.z)<=f.radius);}
export const inkDamageFactor=(p:Point,fields:readonly InkDomain[])=>inInkDomain(p,fields)?1-INK.domain.weaken:1;
/** Swept containment in both directions, including a dash whose endpoints both lie outside. */
export function inkBoundary(from:Point,to:Point,fields:readonly InkDomain[]){
 if(!fields.length)return {x:to.x,z:to.z};
 let first=1;const dx=to.x-from.x,dz=to.z-from.z,a=dx*dx+dz*dz;if(a<1e-12)return {x:from.x,z:from.z};
 for(const f of fields){if(f.radius<=0)continue;const x=from.x-f.x,z=from.z-f.z,inside=Math.hypot(x,z)<=f.radius,r=Math.max(.1,f.radius+(inside?-1:1)*(from.radius??0));
  const c=x*x+z*z-r*r;if(inside&&c>0&&Math.hypot(to.x-f.x,to.z-f.z)>=Math.hypot(x,z)){first=0;continue;}const b=2*(x*dx+z*dz),disc=b*b-4*a*c;
  if(inside&&Math.hypot(to.x-f.x,to.z-f.z)<=r)continue;
  if(!inside&&c<0){if(x*dx+z*dz>=0)continue;first=0;continue;}
  if(disc<0)continue;const t=(-b+(inside?1:-1)*Math.sqrt(disc))/(2*a);if(t>=0&&t<=first)first=Math.max(0,t-1e-5);
  else if(inside&&c>0&&x*dx+z*dz>0)first=0;
 }
 return {x:from.x+dx*first,z:from.z+dz*first};
}
