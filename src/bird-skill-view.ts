import * as T from 'three';
import { birdSkillKit } from './assets.ts';
import { BIRD_LOOKS } from './bird-skills.ts';
import type { CombatEffect } from './combat.ts';

/** Visuals consume the same from/to/lifetime as combat, including effects from other players. No damage here. */
export class BirdSkillView {
 private active:{root:T.Group;age:number;life:number;tick:(t:number,age:number)=>void;dispose:()=>void}[]=[];
 private scene:T.Scene;private ground:(x:number,z:number)=>number;private explorerAt:(x:number,z:number)=>T.Object3D|null;private targets:()=>readonly {x:number;z:number;hp:number}[];
 constructor(scene:T.Scene,ground:(x:number,z:number)=>number,explorerAt:(x:number,z:number)=>T.Object3D|null,targets:()=>readonly {x:number;z:number;hp:number}[],autoload=true){this.scene=scene;this.ground=ground;this.explorerAt=explorerAt;this.targets=targets;if(autoload)void birdSkillKit.load();}
 play(e:CombatEffect){
  if(!(BIRD_LOOKS as readonly string[]).includes(e.look??''))return false;
  if(e.quiet)return true;
  const root=new T.Group(),look=e.look!,life=Math.max(.05,e.duration??.3),origin=new T.Vector3(e.x,this.ground(e.x,e.z)+(e.y??0),e.z),end=new T.Vector3(e.toX??e.x,this.ground(e.toX??e.x,e.toZ??e.z),e.toZ??e.z),angle=e.facing??Math.atan2(end.x-origin.x,end.z-origin.z);
  const resources:{dispose():void}[]=[],own=<R extends {dispose():void}>(r:R)=>{resources.push(r);return r;};
  const mat=(color:string,opacity=1)=>own(new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:T.DoubleSide}));
  const mesh=(g:T.BufferGeometry,c:string,opacity=1,parent:T.Object3D=root)=>{const m=new T.Mesh(own(g),mat(c,opacity));parent.add(m);return m;};
  const instances=(g:T.BufferGeometry,color:string,n:number,opacity:number)=>{const m=new T.InstancedMesh(own(g),mat(color,opacity),n);m.frustumCulled=false;root.add(m);return m;};
  const dummy=new T.Object3D();
  const ball=(c:string,r:number,x:number,y:number,z:number,parent:T.Object3D=root)=>{const m=mesh(new T.SphereGeometry(r,8,5),c,1,parent);m.position.set(x,y,z);return m;};
  const lines=(points:number[],color:string,opacity=1)=>{const g=own(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(points,3));const m=new T.LineSegments(g,own(new T.LineBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false})));root.add(m);return m;};
  root.position.copy(origin);this.scene.add(root);
  let tick:(t:number,age:number)=>void=()=>{};
  if(look==='frozen-fish'||look==='duck-lantern'){
   const prop=new T.Group();root.add(prop);
   if(look==='duck-lantern'){
    const model=birdSkillKit.instance('explorer_lantern');if(model){model.scale.setScalar(.7);prop.add(model);}else{ball('#8577ff',.24,0,.35,0,prop);const handle=mesh(new T.TorusGeometry(.16,.025,5,12),'#414454',1,prop);handle.position.y=.75;}
   }else{
    const fish=ball('#9edfff',.28,0,0,0,prop);fish.scale.set(.6,.9,1.7);
    const tail=mesh(new T.ConeGeometry(.24,.32,3),'#65a9e9',1,prop);tail.rotation.x=Math.PI/2;tail.position.z=-.52;
    for(const side of [-1,1]){ball('#ffffff',.075,side*.15,.075,.27,prop);ball('#26304a',.035,side*.20,.075,.29,prop);}
    const fin=mesh(new T.ConeGeometry(.12,.25,3),'#effcff',1,prop);fin.position.y=.26;
   }
   const delta=end.clone().sub(origin);tick=(t,age)=>{root.position.copy(origin).addScaledVector(delta,t);root.position.y=origin.y*(1-t)+end.y*t+1.2*(1-t)+Math.sin(t*Math.PI)*3.4;prop.rotation.set(age*7,angle,age*2);};
  }else if(look==='duck-dagger'||look==='penguin-peck'){
   const model=look==='duck-dagger'?birdSkillKit.instance('explorer_dagger'):null;
   if(model){model.scale.setScalar(.9);model.rotation.z=-Math.PI/2;root.add(model);}
   else{const beak=mesh(new T.ConeGeometry(.24,.65,4),'#ffcc48');beak.rotation.x=Math.PI/2;beak.position.z=.5;}
   const slash=mesh(new T.TorusGeometry(e.radius*.55,.025,4,20,Math.PI*.8),look==='duck-dagger'?'#cd98ff':'#e7fbff',.7);slash.rotation.x=Math.PI/2;slash.position.y=.8;
   tick=t=>{root.position.y=origin.y+1.05;root.rotation.y=angle+(t-.5)*2.4;root.position.x=origin.x+Math.sin(angle)*.4;root.position.z=origin.z+Math.cos(angle)*.4;root.scale.setScalar(.8+Math.sin(t*Math.PI)*.3);};
  }else if(look==='duck-grapple'){
   const from=origin.clone(),delta=end.clone().sub(origin),rope=lines([0,1.2,0,delta.x,.35,delta.z],'#d1b58c');
   const hook=mesh(new T.TorusGeometry(.22,.045,6,14,Math.PI*1.6),'#c5c8d9');hook.position.copy(delta);hook.position.y=.4;hook.rotation.y=angle;
   tick=t=>{const a=rope.geometry.getAttribute('position') as T.BufferAttribute;a.setXYZ(0,delta.x*t,1.2+Math.sin(t*Math.PI),delta.z*t);a.needsUpdate=true;};
  }else if(look==='penguin-slide'){
   const d=end.clone().sub(origin),length=d.length();root.position.addScaledVector(d,.5);root.rotation.y=Math.atan2(d.x,d.z);
   const ice=mesh(new T.PlaneGeometry(e.radius*2,Math.max(.3,length)+.25),'#90d9ff',.45);ice.rotation.x=-Math.PI/2;ice.position.y=.055;
   for(let j=0;j<3;j++){const shine=mesh(new T.PlaneGeometry(.035,Math.max(.15,length)),'#eeffff',.6);shine.rotation.x=-Math.PI/2;shine.position.set((j-1)*.5,.065,0);}
   tick=t=>{root.scale.x=1+(1-t)*.08;root.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshBasicMaterial).opacity=(1-t)*.5;});};
  }else if(look==='penguin-blizzard'){
   const snow=instances(new T.OctahedronGeometry(.1),'#e6fbff',18,.8);
   const wind=mesh(new T.TorusGeometry(e.radius*.85,.045,4,36,Math.PI*1.7),'#b2eeff',.45);wind.rotation.x=Math.PI/2;
   tick=(t,age)=>{wind.rotation.z=age*8;wind.position.y=.3+t*.5;for(let i=0;i<snow.count;i++){const a=i*2.4+age*8,r=e.radius*(.3+(i%7)/10);dummy.position.set(Math.sin(a)*r,.2+(i%5)*.4+t*.5,Math.cos(a)*r);dummy.rotation.set(age*5,i,t*6);dummy.scale.setScalar(.7+(i%3)*.35);dummy.updateMatrix();snow.setMatrixAt(i,dummy.matrix);}snow.instanceMatrix.needsUpdate=true;};
  }else if(look==='duck-net'){
   const points:number[]=[];for(let i=-Math.floor(e.radius);i<=Math.floor(e.radius);i++){const n=Math.sqrt(e.radius*e.radius-i*i);points.push(i,.08,-n,i,.08,n,-n,.08,i,n,.08,i);}lines(points,'#bc9e70',.7);
   const rim=mesh(new T.TorusGeometry(e.radius,.04,5,40),'#d1b886',.8);rim.rotation.x=-Math.PI/2;rim.position.y=.1;
   for(let i=0;i<8;i++){const a=i*Math.PI/4;const peg=mesh(new T.ConeGeometry(.1,.3,5),'#65504c');peg.position.set(Math.sin(a)*e.radius,.15,Math.cos(a)*e.radius);}
   tick=t=>{root.scale.y=1+Math.sin(t*Math.PI*24)*.06;};
  }else if(look==='duck-fire'){
   const pool=mesh(new T.CircleGeometry(e.radius,36),'#64478f',.25);pool.rotation.x=-Math.PI/2;pool.position.y=.05;
   const fire=instances(new T.ConeGeometry(.22,.8,6),'#ffffff',26,.7);for(let i=0;i<fire.count;i++)fire.setColorAt(i,new T.Color(i%2?'#957cff':'#d5a4ff'));fire.instanceColor!.needsUpdate=true;
   tick=(t,age)=>{for(let i=0;i<fire.count;i++){const a=i*2.4,r=Math.sqrt((i+.5)/fire.count)*e.radius,h=.6+Math.sin(age*9+i)*.25;dummy.position.set(Math.sin(a)*r,h*.4+.05,Math.cos(a)*r);dummy.scale.set(.7,h,.7);dummy.rotation.set(0,0,Math.sin(age*5+i)*.12);dummy.updateMatrix();fire.setMatrixAt(i,dummy.matrix);}fire.instanceMatrix.needsUpdate=true;};
  }else if(look==='compass-mark'){
   const target=this.targets().find(t=>t.hp>0&&Math.hypot(t.x-e.x,t.z-e.z)<.5),points:number[]=[];
   for(let i=0;i<8;i++){const a=i*Math.PI/4;points.push(0,0,0,Math.sin(a)*(i%2?.4:.6),Math.cos(a)*(i%2?.4:.6),0);}lines(points,'#ffda73');
   const halo=mesh(new T.TorusGeometry(.48,.02,4,24),'#bd8dff');
   tick=(t,age)=>{root.position.set(target?.x??e.x,this.ground(target?.x??e.x,target?.z??e.z)+3.2, target?.z??e.z);root.rotation.y=age*.7;halo.rotation.z=age;};
  }
  // Bounded even when dozens of players cast at once; shared kit resources are never disposed here.
  if(this.active.length>=140)this.remove(0);
  this.active.push({root,age:0,life,tick,dispose:()=>resources.forEach(r=>r.dispose())});tick(0,0);return true;
 }
 private remove(i:number){const a=this.active.splice(i,1)[0];this.scene.remove(a.root);a.dispose();}
 update(dt:number){if(dt<=0)return;for(let i=this.active.length-1;i>=0;i--){const a=this.active[i];a.age+=dt;if(a.age>=a.life){this.remove(i);continue;}a.tick(a.age/a.life,a.age);}}
 clear(){while(this.active.length)this.remove(this.active.length-1);}
}
