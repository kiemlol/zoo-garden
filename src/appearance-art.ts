import { mergeParts } from './avatar-merge.ts';
import { hairModel, hatCoversHair } from './hair-art.ts';
import * as T from 'three';
import { bakeModel } from './assets.ts';
import { toonMaterial } from './toon.ts';
import { readAppearance, type Appearance, type HairStyle, type FaceStyle } from './appearance.ts';
import { fitOf, splitLook, type LookId } from './looks.ts';
const templates=new Map<string,T.Group>();
const center=new T.Vector3(0,.47,0);
const material=(color:string)=>toonMaterial({color});
function blob(g:T.Group,color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=new T.Mesh(new T.SphereGeometry(1,10,6),material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
function strand(g:T.Group,color:string,points:number[][],radius:number){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p as [number,number,number]))),m=new T.Mesh(new T.TubeGeometry(path,Math.max(6,points.length*3),radius,6,false),material(color));g.add(m);}
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
function template(kind:'hair'|'face',id:string,hat=false,hideEars=false,lowHat=false){const key=`${kind}:${id}:${hat}:${hideEars}:${lowHat}`;let g=templates.get(key);if(!g){g=kind==='hair'?hairModel(id as HairStyle,hat,hideEars,lowHat):faceModel(id as FaceStyle);if(kind==='hair')mergeParts(g);else g.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.Material).transparent=true;});bakeModel(g);g.traverse(o=>{if(o instanceof T.Mesh){o.geometry.userData.sharedKit=true;for(const m of Array.isArray(o.material)?o.material:[o.material])m.userData.sharedKit=true;}});templates.set(key,g);}return g.clone(true);}
/** All avatar paths call this before outlines/merge. Costumes keep their authored head; hats use a compact hair crown. */
export function applyAppearance(hero:T.Object3D,raw:Appearance|undefined,look:LookId,{hat=false,hatId=undefined as string|undefined,hood=false,disguise=false}={}){
  const a=readAppearance(raw),head=hero.getObjectByName('head');hero.userData.appearance=a;if(!head||disguise)return;
  const scale=fitOf(look).head?.scale??[1,1,1];
  // Facial marks stay clean at close range: an expanded ink hull would cover these tiny strokes.
  const baseFace=head.getObjectByName('base-face');baseFace?.traverse(o=>{if(o instanceof T.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])m.transparent=true;}});
  const oldHair=head.getObjectByName('base-hair');if(oldHair)oldHair.visible=false;
  if(!hood&&!hatCoversHair(hatId)){const hair=template('hair',a.hair,hat&&!/^(crown|hat_halo|hat_bunny)$/.test(hatId??''),splitLook(look).ears!=='none',hatId==='hat_cat');hair.name='custom-hair';hair.scale.set(...scale);head.add(hair);}
  if(a.face!=='original'){
    const old=head.getObjectByName('base-face');if(old)old.visible=false;
    const face=template('face',a.face);face.name='custom-face';face.scale.set(...scale);head.add(face);
  }
}
/** Models for the wardrobe's own rendered tiles, sharing the same meshes as the world. */
export function appearanceModel(kind:'hair'|'face',id:string){return template(kind,id);}
