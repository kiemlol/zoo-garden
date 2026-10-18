import * as T from 'three';
import { bakeModel } from './assets.ts';
import { toonMaterial } from './toon.ts';
import { readAppearance, type Appearance, type HairStyle, type FaceStyle } from './appearance.ts';
import { fitOf, type LookId } from './looks.ts';
const templates=new Map<string,T.Group>();
const center=new T.Vector3(0,.47,0);
const material=(color:string)=>toonMaterial({color});
function blob(g:T.Group,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=new T.Mesh(new T.SphereGeometry(1,10,6),material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
function strand(g:T.Group,color:string,points:number[][],radius:number){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),m=new T.Mesh(new T.TubeGeometry(path,Math.max(6,points.length*3),radius,6,false),material(color));g.add(m);}
/** A full, closed crown/back/nape shell: no cropped wig patches and no reliance on the body's old hair. */
function cap(g:T.Group,color:string,rainbow=false,bob=false){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],segments=40,rows=12;
  const palette=['#ef85c5','#bb8bea','#87aff8','#79d3bd','#f5d681'];
  for(let j=0;j<=rows;j++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,front=Math.cos(a),edge=1.12+(bob?1.26:1.05)*(1-front)/2;
    const theta=edge*j/rows,r=.607+.009*Math.sin(a*7)**2,c=new T.Color(rainbow?palette[Math.min(4,Math.floor(i/segments*5))]:color);
    positions.push(Math.sin(theta)*Math.sin(a)*r,.47+Math.cos(theta)*r,Math.sin(theta)*Math.cos(a)*r);colors.push(c.r,c.g,c.b);
    if(i<segments&&j<rows){const n=j*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  // Continuous crown-to-nape profile, closed at the top. Double-sided at the rim so no viewing angle reveals a missing patch.
  const mat=toonMaterial({color:'#ffffff',vertexColors:true,side:T.DoubleSide});g.add(new T.Mesh(geo,mat));
  for(let i=0;i<7;i++){const x=(i-3)*.125,z=Math.sqrt(Math.max(0,.61**2-x*x))-.035,m=blob(g,rainbow?palette[Math.min(4,Math.floor(i*5/7))]:color,x,.74+.035*Math.cos(i),z,.105,.16,.07);m.rotation.z=(i-3)*-.09;}
}
function hairModel(style:HairStyle){
  const g=new T.Group(),color=style==='bob'?'#564162':style==='waves'?'#8660af':style==='buns'?'#64bad4':style==='ponytail'?'#684334':'#72513c';
  cap(g,color,style==='rainbow',style==='bob');
  if(style==='bob')for(const s of [-1,1])blob(g,color,s*.48,.34,-.12,.17,.34,.32);
  if(style==='buns')for(const s of [-1,1]){blob(g,color,s*.5,.94,-.15,.22,.22,.22);blob(g,'#f8d593',s*.51,.82,-.11,.12,.045,.12);}
  if(style==='ponytail'){blob(g,'#f0a0bb',0,.72,-.55,.14,.1,.09);strand(g,color,[[0,.72,-.52],[.07,.57,-.7],[.1,.15,-.68],[.04,-.13,-.51]],.145);}
  if(style==='waves')for(const s of [-1,1]){strand(g,color,[[s*.48,.61,-.23],[s*.53,.25,-.3],[s*.48,-.05,-.35],[s*.56,-.2,-.25]],.13);strand(g,'#9b75be',[[s*.3,.55,-.5],[s*.37,.1,-.5],[s*.3,-.16,-.46]],.12);}
  return g;
}
/** Map a small face drawing onto the head sphere rather than floating flat cards in front of it. */
function onFace(x:number,y:number,lift=.009){const dy=y-.47;return new T.Vector3(x,y,Math.sqrt(Math.max(.01,.59**2-x*x-dy*dy))+lift);}
function dot(g:T.Group,color:string,x:number,y:number,rx:number,ry:number,lift=.012){const p=onFace(x,y,lift),m=blob(g,color,p.x,p.y,p.z,rx,ry,.016);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),p.clone().sub(center).normalize());return m;}
function stroke(g:T.Group,color:string,xy:number[][],radius=.012,lift=.016){const points=xy.map(([x,y])=>onFace(x,y,lift).toArray());strand(g,color,points,radius);}
function faceModel(style:FaceStyle){
  const g=new T.Group(),dark='#34283e',pink='#f392a8';
  for(const side of [-1,1]){
    const x=side*.205,y=.485;
    if(style==='happy'||style==='blush'||style==='wink'&&side===1)stroke(g,dark,[[x-.07,y-.012],[x,y+.035],[x+.07,y-.012]],.014);
    else{
      dot(g,'#fff9ef',x,y,.096,.115);dot(g,style==='sparkle'?'#7752ac':dark,x,y,.069,.09,.027);
      if(style==='sparkle'){stroke(g,'#fff9d1',[[x-.047,y+.016],[x+.047,y+.016]],.012,.065);stroke(g,'#fff9d1',[[x,y-.031],[x,y+.063]],.012,.065);}
      else{dot(g,'#fffdf5',x-.021,y+.04,.026,.029,.048);dot(g,'#fffdf5',x+.028,y-.035,.012,.014,.047);}
    }
    dot(g,pink,side*.34,.335,style==='blush'?.09:.065,.032);
    if(style==='tears')dot(g,'#88d9f5',side*.225,.36,.039,.075,.035);
    if(style==='surprised')stroke(g,dark,[[x-.052,.66],[x,.677],[x+.052,.66]],.012);
  }
  if(style==='surprised')dot(g,dark,0,.295,.046,.061);
  else if(style==='happy'){dot(g,dark,0,.303,.079,.055);dot(g,'#f5a3b3',0,.276,.047,.021,.035);}
  else stroke(g,dark,[[-.06,.318],[0,.293],[.06,.318]],.013);
  return g;
}
function template(kind:'hair'|'face',id:string){const key=`${kind}:${id}`;let g=templates.get(key);if(!g){g=kind==='hair'?hairModel(id as HairStyle):faceModel(id as FaceStyle);bakeModel(g);g.traverse(o=>{if(o instanceof T.Mesh){o.geometry.userData.sharedKit=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.sharedKit=true;}});templates.set(key,g);}return g.clone(true);}
/** All avatar paths call this before outlines/merge. Costumes keep their authored head; hats use a compact hair crown. */
export function applyAppearance(hero:T.Object3D,raw:Appearance|undefined,look:LookId,{hat=false,hood=false,disguise=false}={}){
  const a=readAppearance(raw),head=hero.getObjectByName('head');hero.userData.appearance=a;if(!head||disguise)return;
  const f=fitOf(look).head,scale=f?.scale??[1,1,1];
  if(a.hair!=='original'){
    const old=head.getObjectByName('base-hair');if(old)old.visible=false;
    if(!hood){const hair=template('hair',hat?'short':a.hair);hair.name='custom-hair';hair.scale.set(...scale);head.add(hair);}
  }
  if(a.face!=='original'){
    const old=head.getObjectByName('base-face');if(old)old.visible=false;
    const face=template('face',a.face);face.name='custom-face';face.scale.set(...scale);head.add(face);
  }
}
/** Models for the wardrobe's own rendered tiles, sharing the same meshes as the world. */
export function appearanceModel(kind:'hair'|'face',id:string){return template(kind,id);}
