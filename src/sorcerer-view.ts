import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SORCERER as S,SORCERER_LOOKS} from './sorcerer-skills.ts';
import type {CombatEffect} from './combat.ts';

/** Procedural spell models; owner keys keep each concealment gate fixed until its caster exits. */
export class SorcererView {
 private active:{root:T.Group;age:number;life:number;owner:string;portal:boolean;tick:(age:number)=>void}[]=[];
 private scene:T.Scene;private ground:(x:number,z:number)=>number;
 constructor(scene:T.Scene,ground:(x:number,z:number)=>number){this.scene=scene;this.ground=ground;}
 private material(color:string,opacity=1){return new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:T.DoubleSide,depthWrite:opacity>=1});}
 private mesh(root:T.Object3D,g:T.BufferGeometry,color:string,opacity=1){const m=new T.Mesh(g,this.material(color,opacity));root.add(m);return m;}
 private strokes(root:T.Object3D,points:number[],color:string){const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3)),m=new T.LineSegments(g,new T.LineBasicMaterial({color}));root.add(m);return m;}
 private disc(radius:number,portal=false){
  const g=new T.Group(),points:number[]=[],runes:number[]=[];
  for(const r of [radius,radius*.89,radius*.67])for(let i=0;i<64;i++){const a=i*Math.PI/32,b=(i+1)*Math.PI/32;points.push(Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(b)*r,Math.sin(b)*r,0);}
  for(let i=0;i<16;i++){const a=i*Math.PI/8,rr=radius*.78,c=Math.cos(a),s=Math.sin(a),at=(x:number,y:number)=>[c*rr+c*x-s*y,s*rr+s*x+c*y,.012];for(const [x,y,u,v]of [[-.035,-.05,.035,.05],[-.035,.05,.035,-.05],[-.035,-.05,-.035,.05]])runes.push(...at(x*radius,y*radius),...at(u*radius,v*radius));}
  if(!portal)for(let k=0;k<2;k++)for(let i=0;i<4;i++){const a=i*Math.PI/2+k*Math.PI/4,b=(i+1)*Math.PI/2+k*Math.PI/4;points.push(Math.cos(a)*radius*.63,Math.sin(a)*radius*.63,.02,Math.cos(b)*radius*.63,Math.sin(b)*radius*.63,.02);}
  this.strokes(g,points,'#ff9b32');this.strokes(g,runes,portal?'#8ce9ff':'#ffe19d');
  if(portal){this.mesh(g,new T.CircleGeometry(radius*.66,40),'#19162f',.97).position.z=-.025;this.mesh(g,new T.TorusGeometry(radius,.035,5,64),'#ffbd54');}
  // A soft ring, radial flame tongues and a violet spiral make the gate readable on grass.
  this.mesh(g,new T.RingGeometry(radius*.94,radius*1.09,64),'#ff7f24',.2).position.z=-.01;
  if(portal){
   const flames=new T.InstancedMesh(new T.ConeGeometry(radius*.045,radius*.23,4),this.material('#ff9332',.8),40),dummy=new T.Object3D();g.add(flames);
   const swirl:number[]=[];for(let i=0;i<100;i++){const a=i*.16,b=(i+1)*.16,r=radius*.64*(i/100),rr=radius*.64*((i+1)/100);swirl.push(Math.cos(a)*r,Math.sin(a)*r,.01,Math.cos(b)*rr,Math.sin(b)*rr,.01);}const vortex=this.strokes(g,swirl,'#514071');
   g.userData.animate=(age:number)=>{for(let i=0;i<40;i++){const a=i*Math.PI/20+age*.2,r=radius*(1.01+.035*Math.sin(i*7+age*23));dummy.position.set(Math.cos(a)*r,Math.sin(a)*r,.02);dummy.rotation.z=a-Math.PI/2;dummy.scale.set(1,.6+.55*Math.sin(age*29+i*2),1);dummy.updateMatrix();flames.setMatrixAt(i,dummy.matrix);}flames.instanceMatrix.needsUpdate=true;vortex.rotation.z=-age*.8;};g.userData.animate(0);
  }
  return g;
 }
 private dispose(root:T.Group){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){if(o instanceof T.InstancedMesh)o.dispose();o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
 clear(){for(const a of this.active)this.dispose(a.root);this.active=[];}
 play(e:CombatEffect,owner='self'){
  if(!(SORCERER_LOOKS as readonly string[]).includes(e.look??''))return false;if(e.quiet)return true;
  if(e.look==='veil-exit'){for(const a of this.active)if(a.portal&&a.owner===owner){a.life=a.age;}}
  const root=new T.Group();root.name='spell-'+e.look;root.position.set(e.x,this.ground(e.x,e.z)+(e.y??0),e.z);root.rotation.y=e.facing??0;this.scene.add(root);
  const life=e.duration??.5,look=e.look!,radius=e.radius;let tick=(_age:number)=>{};
  if(look==='veil-portal'||look==='veil-exit'){
   const gate=this.disc(radius,true);gate.position.y=1.35;root.add(gate);
   const sparks=this.mesh(root,new T.TorusGeometry(radius*1.04,.022,4,64),'#ff6426');sparks.position.y=1.35;
   tick=age=>{const scale=Math.min(1,age/.12)*Math.min(1,(life-age)/.12);gate.scale.setScalar(Math.max(.01,scale));gate.rotation.z=age*.35;gate.userData.animate(age);sparks.rotation.z=-age*3;sparks.scale.setScalar(Math.max(.01,scale)*(1+.025*Math.sin(age*40)));};
  }else if(look==='mandala'){
   const discs=[this.disc(.55),this.disc(.55)];for(let i=0;i<2;i++){discs[i].position.set(i? .67:-.67,1.05,.65);root.add(discs[i]);}tick=age=>{for(let i=0;i<2;i++){discs[i].rotation.z=(i?1:-1)*age*15;discs[i].position.z=.65+Math.sin(age/life*Math.PI)*.7;}};
  }else if(look==='mandala-disc'){
   const disc=this.disc(radius);root.add(disc);const dx=e.toX===undefined?0:e.toX-e.x,dz=e.toZ===undefined?16:e.toZ-e.z;root.rotation.y=0;tick=age=>{const t=Math.min(1,age/life);disc.position.set(dx*t,1.1,dz*t);disc.rotation.z=age*14;disc.rotation.x=Math.PI/2;};
  }else if(look==='crimson-bands'){
   const ring=this.disc(radius);ring.rotation.x=-Math.PI/2;ring.position.y=.06;root.add(ring);
   const pieces:T.BufferGeometry[]=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,r=radius*.86,pts=[];for(let j=0;j<=12;j++){const t=j/12,angle=a+(t-.5)*.4;pts.push(new T.Vector3(Math.cos(angle)*r,Math.sin(t*Math.PI)*1.6,Math.sin(angle)*r));}pieces.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,.055,4,false));}
   const merged=mergeGeometries(pieces,false)!;pieces.forEach(p=>p.dispose());const ribbons=this.mesh(root,merged,'#ee354b');tick=age=>{ribbons.scale.y=Math.min(1,age/.25)*(1+.12*Math.sin(age*5));ring.rotation.z=age*.2;};
  }else if(look==='meteor-gate'){
   const dx=(e.toX??e.x)-e.x,dz=(e.toZ??e.z)-e.z,landingY=this.ground(e.toX??e.x,e.toZ??e.z)-root.position.y;root.rotation.y=0;
   const sling=this.disc(.42),gate=this.disc(radius*.68,true);root.add(sling,gate);gate.position.set(dx,landingY+6,dz);gate.rotation.x=-Math.PI/2;
   const rocks=[0,1,2].map(i=>{const g=new T.Group(),body=this.mesh(g,new T.IcosahedronGeometry(i===0?.72:.5,1),'#402522'),flame=this.mesh(g,new T.IcosahedronGeometry(i===0?.8:.57,1),'#ff8b25',.22);flame.scale.y=1.3;const cracks=new T.LineSegments(new T.WireframeGeometry(body.geometry),new T.LineBasicMaterial({color:'#ffb044'}));cracks.scale.setScalar(1.012);body.add(cracks);body.rotation.set(i,1,i*.7);const tail=this.mesh(g,new T.ConeGeometry(.34,2.3,7),'#ffbf4a',.7);tail.position.y=1.1;root.add(g);return g;});
   tick=age=>{const t=Math.min(1,age/S.meteor.flight),fall=Math.max(0,(age-S.meteor.flight)/S.meteor.fall);sling.visible=age<S.meteor.flight;sling.position.set(dx*t,.9*(1-t)+landingY*t+Math.sin(t*Math.PI)*3,dz*t);sling.rotation.z=age*10;gate.visible=age>=S.meteor.flight;gate.rotation.z=age;gate.userData.animate(age);gate.scale.setScalar(Math.min(1,fall*5));rocks.forEach((r,i)=>{r.visible=fall>0;const a=i*Math.PI*2/3,spread=i?1.25:0;r.position.set(dx+Math.cos(a)*spread,landingY+6*(1-fall*fall),dz+Math.sin(a)*spread);r.rotation.y=age*2;});};
  }else{
   const ring=this.disc(radius);root.add(ring);ring.rotation.x=-Math.PI/2;ring.position.y=.08;const burst=this.mesh(root,new T.IcosahedronGeometry(1,1),'#ffab40',.65);burst.position.y=.5;tick=age=>{const t=age/life;ring.scale.setScalar(.6+t*.4);burst.scale.set(radius*.3*Math.sin(t*Math.PI),Math.sin(t*Math.PI)*1.4,radius*.3*Math.sin(t*Math.PI));};
  }
  tick(0);this.active.push({root,age:0,life,owner,portal:look==='veil-portal',tick});
  while(this.active.length>32){const a=this.active.shift()!;this.dispose(a.root);}return true;
 }
 update(dt:number){for(const a of this.active){a.age+=dt;if(a.age<a.life)a.tick(a.age);else this.dispose(a.root);}this.active=this.active.filter(a=>a.age<a.life);}
}
