import * as T from 'three';
import {inkSkillKit} from './assets.ts';
import {INK,INK_LOOKS} from './ink-skills.ts';
import type {CombatEffect} from './combat.ts';

/** Authored brush/dragon models and bounded procedural ink strokes, on the combat simulation clock. */
export class InkSkillView {
 private active:{root:T.Group;age:number;life:number;owner:string;domain:boolean;tick:(age:number)=>void}[]=[];
 private scene:T.Scene;private ground:(x:number,z:number)=>number;private actor:(owner:string,at:CombatEffect)=>T.Object3D|null;private targets:()=>readonly {x:number;z:number;hp:number}[];
 constructor(scene:T.Scene,ground:(x:number,z:number)=>number,actor:(owner:string,at:CombatEffect)=>T.Object3D|null,autoload=true,targets:()=>readonly {x:number;z:number;hp:number}[]=()=>[]){this.scene=scene;this.ground=ground;this.actor=actor;this.targets=targets;if(autoload)void inkSkillKit.load();}
 private mesh(root:T.Object3D,geometry:T.BufferGeometry,color='#15171b',opacity=1){const m=new T.Mesh(geometry,new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity>=1}));root.add(m);return m;}
 private prop(name:string){const g=inkSkillKit.instance(name);if(g)return g;const fallback=new T.Group();if(name==='ink_brush'){const shaft=this.mesh(fallback,new T.CylinderGeometry(.06,.05,1,8),'#4b4540');shaft.position.y=.5;const nib=this.mesh(fallback,new T.ConeGeometry(.14,.5,10));nib.position.y=1.25;}else{const path=Array.from({length:20},(_,i)=>new T.Vector3(Math.sin(i*.3)*.5,1.7-i*.08,0));this.mesh(fallback,new T.TubeGeometry(new T.CatmullRomCurve3(path),32,.12,8,false));}return fallback;}
 private dispose(root:T.Group){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();if(!o.geometry.userData.sharedKit)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.sharedKit)m.dispose();}});}
 clear(){for(const a of this.active)this.dispose(a.root);this.active=[];}
 play(e:CombatEffect,owner='self'){
  if(!(INK_LOOKS as readonly string[]).includes(e.look??''))return false;if(e.quiet)return true;
  if(e.look==='ink-domain-end'){for(const a of this.active)if(a.owner===owner&&a.domain)a.life=a.age;return true;}
  const root=new T.Group();root.name='spell-'+e.look;root.position.set(e.x,this.ground(e.x,e.z)+(e.y??0),e.z);this.scene.add(root);
  const look=e.look!,life=Math.max(.05,e.duration??.5),radius=e.radius,actor=this.actor(owner,e),follow=()=>{if(actor)root.position.copy(actor.position);};let tick=(_age:number)=>{};
  if(look==='ink-domain'){
   const ring=this.mesh(root,new T.TorusGeometry(radius,.09,5,96));ring.rotation.x=Math.PI/2;ring.position.y=.07;
   const inner=this.mesh(root,new T.TorusGeometry(radius-.18,.025,4,96),'#e6e4dc');inner.rotation.x=Math.PI/2;inner.position.y=.08;
   const wall=this.mesh(root,new T.CylinderGeometry(radius,radius,2,96,1,true),'#25272c',.12);wall.position.y=1;
   const splashes=new T.InstancedMesh(new T.CircleGeometry(.14,7),new T.MeshBasicMaterial({color:'#17191d',side:T.DoubleSide}),48),dummy=new T.Object3D();root.add(splashes);
   for(let i=0;i<48;i++){const a=i*Math.PI/24;dummy.position.set(Math.cos(a)*(radius-.08),.08,Math.sin(a)*(radius-.08));dummy.rotation.set(-Math.PI/2,0,a);dummy.scale.set(1.5+(i%3)*.4,.5+(i%5)*.12,1);dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix);}
   tick=age=>{ring.geometry.setDrawRange(0,Math.floor(Math.min(1,age/.45)*(ring.geometry.index?.count??0)/3)*3);wall.scale.y=.9+.1*Math.sin(age*4);};
  }else if(look==='ink-brush'){
   const victim=this.targets().filter(t=>t.hp>0&&Math.hypot(t.x-(e.toX??e.x),t.z-(e.toZ??e.z))<1).sort((a,b)=>Math.hypot(a.x-(e.toX??e.x),a.z-(e.toZ??e.z))-Math.hypot(b.x-(e.toX??e.x),b.z-(e.toZ??e.z)))[0];const brush=this.prop('ink_brush');root.add(brush);brush.scale.setScalar(.65);brush.rotation.set(Math.PI/2,0,0);const end=new T.Vector3(e.toX??e.x,this.ground(e.toX??e.x,e.toZ??e.z),e.toZ??e.z).sub(root.position),dir=end.clone().normalize();brush.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);tick=age=>{const t=Math.min(1,age/life);if(victim)end.set(victim.x-root.position.x,this.ground(victim.x,victim.z)-root.position.y,victim.z-root.position.z);brush.position.copy(end).multiplyScalar(t);brush.position.y+=1.1+Math.sin(t*Math.PI)*.25;};
  }else if(look==='ink-dragon-draw'||look==='ink-dragon'){
   const dragon=this.prop('ink_dragon');root.add(dragon);dragon.scale.setScalar(3);const drawing=look==='ink-dragon-draw',pieces:T.Mesh[]=[];
   if(drawing)dragon.traverse(o=>{if(o instanceof T.Mesh){o.geometry=o.geometry.clone();o.geometry.userData.sharedKit=false;pieces.push(o);}});
   const eye=this.mesh(dragon,new T.SphereGeometry(.045,10,6),'#ffffff');eye.position.set(-.15,1.9,.23);eye.visible=false;const nib=drawing?this.prop('ink_brush'):null;if(nib){root.add(nib);nib.scale.setScalar(.65);}
   const breath=this.mesh(root,new T.ConeGeometry(.65,3,12),'#16181e',.62);breath.rotation.x=Math.PI/2;breath.visible=false;
   tick=age=>{follow();if(drawing){const t=Math.min(1,age/INK.dragon.draw);for(const m of pieces){const count=m.geometry.index?.count??m.geometry.getAttribute('position').count;m.geometry.setDrawRange(0,Math.floor(count*t/3)*3);}dragon.position.set(0,1,0);dragon.rotation.y=age*.5;eye.visible=t>.85;if(nib){nib.visible=t>.65;nib.position.set(-.45,5.6+(t-.65)*.4,.7);nib.rotation.z=-.25;}}
    else{const a=age*2.2;dragon.position.set(Math.cos(a)*radius*.35,1.1+Math.sin(age*3)*.25,Math.sin(a)*radius*.35);dragon.rotation.y=-a+Math.PI/2;dragon.rotation.z=Math.sin(age*2)*.08;const pulse=age%1;breath.visible=Math.floor(age)%2===1&&pulse<.65;breath.position.set(Math.cos(a)*(radius*.55),1.5,Math.sin(a)*(radius*.55));breath.rotation.z=-a;breath.scale.setScalar(.7+Math.sin(pulse*Math.PI)*.4);}
   };
  }else if(look==='ink-rush'){
   const streak=this.mesh(root,new T.SphereGeometry(1,12,6));streak.scale.set(.5,.15,1.5);tick=age=>{follow();root.position.y+=.15;root.rotation.y=e.facing??0;streak.scale.x=.45+Math.sin(age*45)*.07;};
  }else if(look==='ink-trail'){
   const dx=(e.toX??e.x)-e.x,dz=(e.toZ??e.z)-e.z,d=Math.hypot(dx,dz),trail=this.mesh(root,new T.PlaneGeometry(radius*2,Math.max(.01,d)),'#17191c',.83);trail.rotation.x=-Math.PI/2;root.rotation.y=Math.atan2(dx,dz);trail.position.set(0,.055,d/2);
   tick=age=>{(trail.material as T.MeshBasicMaterial).opacity=.83*Math.min(1,(life-age)/.5);};
  }else if(look==='ink-pool'){
   const pool=this.mesh(root,new T.CircleGeometry(radius,64),'#1b1d22',.7);pool.rotation.x=-Math.PI/2;pool.position.y=.055;tick=age=>{(pool.material as T.MeshBasicMaterial).opacity=.7*Math.min(1,(life-age)/.6);};
  }else{
   const rain=look==='ink-rain',drops=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:'#181a1e'}),48),dummy=new T.Object3D();root.add(drops);
   tick=age=>{const t=age/life;for(let i=0;i<48;i++){const a=i*2.399,r=radius*Math.sqrt((i+.5)/48),k=rain?1:t;dummy.position.set(Math.cos(a)*r*k,rain?Math.max(.05,5*(1-t)+(i%5)*.15):Math.sin(t*Math.PI)*(1+i%3*.4),Math.sin(a)*r*k);dummy.scale.setScalar(.055+(i%4)*.025);if(rain)dummy.scale.y*=2;dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);}drops.instanceMatrix.needsUpdate=true;};
  }
  tick(0);this.active.push({root,age:0,life,owner,domain:look==='ink-domain',tick});while(this.active.length>40){const index=this.active.findIndex(a=>!a.domain),a=this.active.splice(index<0?0:index,1)[0];this.dispose(a.root);}return true;
 }
 update(dt:number){for(const a of this.active){a.age+=dt;if(a.age<a.life)a.tick(a.age);else this.dispose(a.root);}this.active=this.active.filter(a=>a.age<a.life);}
}
