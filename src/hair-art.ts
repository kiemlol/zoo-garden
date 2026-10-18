import * as T from 'three';
import { toonMaterial } from './toon.ts';
import type { HairStyle } from './appearance.ts';
const materials=new Map<string,T.Material>();
const mat=(color:string)=>{let m=materials.get(color);if(!m){m=toonMaterial({color});materials.set(color,m);}return m;};
const vec=(p:number[])=>new T.Vector3(p[0],p[1],p[2]);
/** Sculpted tapered locks, not intersecting balls. An elliptical section and a narrow ridge
 * give each strand a readable highlight from front, profile and back, without photo textures. */
function lock(g:T.Group,color:string,points:number[][],width:number,depth=.042,highlight?:string){
 const curve=new T.CatmullRomCurve3(points.map(vec)),steps=Math.min(40,Math.max(10,points.length*4)),sides=8,positions:number[]=[],indices:number[]=[],colors:number[]=[],base=new T.Color(color),shine=new T.Color(highlight??color).lerp(new T.Color('#ffffff'),highlight?0:.08);
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),radial=p.clone().sub(new T.Vector3(0,.47,0)).normalize();
  let across=new T.Vector3().crossVectors(tangent,radial).normalize();if(across.lengthSq()<.1)across=new T.Vector3(1,0,0);
  const normal=new T.Vector3().crossVectors(across,tangent).normalize(),taper=Math.max(.014,Math.sin(Math.PI*(.12+.88*t))**.65),w=width*taper;
  for(let j=0;j<sides;j++){
   const a=j/sides*Math.PI*2,v=p.clone().addScaledVector(across,Math.cos(a)*w).addScaledVector(normal,Math.sin(a)*depth*taper),c=Math.sin(a)>.66?shine:base;
   positions.push(v.x,v.y,v.z);colors.push(c.r,c.g,c.b);
   if(i<steps){const k=i*sides+j,n=i*sides+(j+1)%sides;indices.push(k,k+sides,n,n,k+sides,n+sides);}
  }
 }
 for(const end of [0,steps*sides])for(let j=1;j<sides-1;j++)indices.push(end,end+j+(end?1:0),end+j+(end?0:1));
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();g.add(new T.Mesh(geo,toonMaterial({color:'#ffffff',vertexColors:true})));
}
/** Continuous crown and complete nape. The fringe is separate, so a hat may flatten only the crown. */
function shell(g:T.Group,color:string,split=false,undercut=false){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],n=56,rows=16;
 for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
  const a=i/n*Math.PI*2,front=Math.cos(a),edge=undercut?1.16+(1-front)*.47:1.06+(1-front)*.72,theta=edge*j/rows,r=.608;
  const x=Math.sin(theta)*Math.sin(a)*r,y=.47+Math.cos(theta)*r,z=Math.sin(theta)*Math.cos(a)*r,c=new T.Color(split?(x<0?'#20232e':'#ef7627'):color);
  const band=Math.sin(a*20+theta*.6);c.multiplyScalar(.95+.05*band);positions.push(x,y,z);colors.push(c.r,c.g,c.b);
  if(j<rows&&i<n){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const normals=geo.getAttribute('normal');for(let i=0;i<=n;i++)normals.setXYZ(i,0,1,0);const m=new T.Mesh(geo,toonMaterial({color:'#ffffff',vertexColors:true,side:T.DoubleSide}));m.name='hair-crown';g.add(m);
}
function foxEar(g:T.Group,side:number,long:boolean){
 const x=side*.42,outer=new T.Mesh(new T.ConeGeometry(.17,long?.40:.31,3),mat('#f2f1fa'));outer.position.set(x,1.08,-.03);outer.rotation.z=side*-.20;outer.rotation.y=side*.35;outer.scale.z=.5;outer.name='hair-ear';g.add(outer);
 const inner=new T.Mesh(new T.ConeGeometry(.101,long?.26:.20,3),mat(long?'#c1a3dd':'#b4e9f2'));inner.position.copy(outer.position).add(new T.Vector3(0,.015,.055));inner.rotation.copy(outer.rotation);inner.scale.z=.23;inner.name='hair-ear';g.add(inner);
}
function fox(g:T.Group,long:boolean){
 shell(g,'#e6e6f2');
 // Swept, layered locks follow the scalp before opening into sharp, soft ends.
 for(let i=0;i<10;i++){
  const a=(i/9)*Math.PI*2,x=Math.sin(a),z=Math.cos(a),front=z>.2;
  if(front)continue;
  lock(g,i%3===0?'#cad2e9':'#eeedf8',[[x*.31,1.00,z*.31],[x*.54,.70,z*.54],[x*.57,.32,z*.53],[x*(long?.69:.65),long?-.25:.13,z*.49],[x*(long?.72:.70),long?-.58:.08,z*.43]],long?.14:.13,.048,'#fdfbff');
 }
 for(const side of [-1,1]){
  for(let i=0;i<3;i++){const x=side*(.17+i*.12);lock(g,i===2?'#d9e8f5':'#f5f3fa',[[side*.06,1.055,.18],[x,.93,.48],[x+side*.035,.72-i*.055,.565],[x+side*.09,.58-i*.06,.515]],.125-i*.01,.045,'#ffffff');}
  lock(g,long?'#d2bbec':'#b5deed',[[side*.49,.72,.29],[side*.57,.40,.32],[side*(long?.59:.67),long?-.25:.25,.24]],.12,.04);
  foxEar(g,side,long);
 }
 if(long){for(let i=0;i<2;i++){const clip=new T.Mesh(new T.BoxGeometry(.20,.045,.035),mat(i?'#704f96':'#b29bd3'));clip.position.set(-.30,.73+i*.085,.57);clip.rotation.z=-.32;g.add(clip);}}
}
function splitTails(g:T.Group){
 shell(g,'#212532',true);
 for(let i=0;i<8;i++){const x=(i-3.5)*.132,color=x<0?'#20232e':'#f98732';lock(g,color,[[x*.50,1.00,.28],[x,.82,.51],[x,.58,.57],[x*.97,.54,.55]],.086,.035,x<0?'#414859':'#ffac58');}
 for(const side of [-1,1]){
  const c=side<0?'#20232e':'#e97625',hi=side<0?'#464f64':'#ffac59';
  for(let k=0;k<4;k++){const a=(k-1.5)*.085;lock(g,c,[[side*.43,.83,-.17],[side*(.65+a),.65,-.25],[side*(.70+a),.18,-.29],[side*(.66+a),-.26,-.31],[side*(.49+a),-.47,-.22]],.09,.06,hi);}
  const tie=new T.Mesh(new T.TorusGeometry(.12,.027,6,16),mat(side<0?'#f57f32':'#332c3c'));tie.position.set(side*.60,.67,-.22);tie.rotation.y=Math.PI/2;g.add(tie);
 }
 for(let k=0;k<7;k++){const a=Math.PI*.5+k*Math.PI/7;lock(g,k<4?'#ee7e2d':'#292b39',[[Math.sin(a)*.20,1.055,Math.cos(a)*.20],[Math.sin(a)*.48,.78,Math.cos(a)*.48],[Math.sin(a)*.52,.24,Math.cos(a)*.53]],.095,.027);}
}
function blueBuns(g:T.Group){
 shell(g,'#19448d');
 for(let side of [-1,1]){
  for(let i=0;i<4;i++){const x=side*(.12+i*.11);lock(g,i%2?'#2a64bc':'#347ed4',[[side*.04,1.07,.12],[x,.97,.40],[x+side*.08,.77,.52],[x+side*.075,.60,.52]],.105,.032,'#518eda');}
  // Filled woven buns: a compact core underneath two crossing braid ropes.
  const core=new T.Mesh(new T.SphereGeometry(1,16,10),mat('#285db0'));core.position.set(side*.48,1.01,-.19);core.scale.set(.17,.17,.105);g.add(core);
  for(let strand=0;strand<2;strand++){
   const pts=[];for(let j=0;j<=40;j++){const a=j/40*Math.PI*2,r=.16+.028*Math.sin(a*6+strand*Math.PI);pts.push([side*.48+Math.cos(a)*r,1.01+Math.sin(a)*r,-.18+(strand?1:-1)*.045*Math.cos(a*6)]);}
   lock(g,strand?'#285bb0':'#3478cc',pts,.05,.038,'#5792da');
  }
  for(let i=0;i<3;i++)lock(g,'#2b5eaa',[[side*.19,1.04,-.16],[side*(.33+i*.08),.72,-.43],[side*(.35+i*.08),.26,-.43]],.055,.02,'#447cc0');
  lock(g,'#204c96',[[side*.48,.71,.23],[side*.54,.48,.27],[side*.51,.31,.24]],.065,.025);
 }
}
function rainbow(g:T.Group){
 shell(g,'#262b37',false,true);
 // Broad ribbons sweep together over a dark, neatly cropped undercut.
 const colors=['#c478d2','#ec91be','#f2bb85','#f1dd8a','#9be0c2','#85cbe3','#9ba7df'];
 for(let i=0;i<7;i++){
  const x=(i-3)*.145;lock(g,colors[i],[[x*.77,.70,-.49],[x*.97,1.04,-.29],[x*.97,1.14,.10],[x*.82,.99,.47],[x*.63,.80,.55]],.105,.065);
 }
 for(let i=0;i<9;i++){const a=Math.PI*.52+i/8*Math.PI*.96;lock(g,'#333946',[[Math.sin(a)*.57,.59,Math.cos(a)*.57],[Math.sin(a)*.52,.30,Math.cos(a)*.52]],.025,.009,'#454b58');}
}
export function hairModel(style:HairStyle,hat=false,hideEars=false,lowHat=false){
 const g=new T.Group();g.name='hair-'+style;
 if(style==='ponytail')splitTails(g);else if(style==='buns')blueBuns(g);else if(style==='rainbow')rainbow(g);else fox(g,style==='waves'||style==='bob');
 if(hideEars)g.traverse(o=>{if(o.name==='hair-ear')o.visible=false;});
 if(hat){
  // Keep the selected bangs, side locks, nape and tails. Only the crown compresses under an ordinary hat.
  // Hair's decorative animal ears tuck under the hat; they are not a replacement hairstyle.
  g.traverse(o=>{if(o instanceof T.Mesh){if(o.name==='hair-ear'){o.visible=false;return;}const geo=o.geometry.clone(),p=geo.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getY(i),edge=lowHat?.55:.76;if(y>edge)p.setY(i,edge+(y-edge)*.32);}geo.computeVertexNormals();const n=geo.getAttribute('normal');for(let i=0;i<n.count;i++)if(n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2<.01)n.setXYZ(i,0,1,0);o.geometry=geo;}});
 }
 return g;
}
/** Only head-enclosing hoods/helmets hide hair. Brimmed hats, crowns and face accessories keep it. */
export const hatCoversHair=(id:string|undefined)=>!!id&&/^(hat_(bear|frog|space|leather|astronaut|diver|mole)(_|$))/.test(id);
