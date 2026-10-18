import * as T from 'three';
import {DEFAULT_PIVOTS,fitOf,shapeOf,shapeProfile,type LookId} from './looks.ts';

/** Fit the head/rig to the mirror look; keep coats compact and footwear grounded. */
function birdLookTransform(look:LookId,part?:string){
 const f=fitOf(look),extension=-(f['leg-left']?.offset[1]??0),torsoH=f.body?.scale[1]??1,head=f.head?.scale[0]??1;
 const hip=.52+extension,neck=shapeProfile(look).pivots.head[1];
 const smooth=(a:number,b:number,t:number)=>{const v=Math.max(0,Math.min(1,t)),s=v*v*(3-2*v);return a+(b-a)*s;};
 const tw=f.body?.scale[0]??1,td=f.body?.scale[2]??1,limb=shapeProfile(look).foot;
 return(p:T.Vector3)=>{const y=p.y;
 // Added height belongs primarily to the separate legs; the upper costume keeps its silhouette.
 const compact=neck+(y-1.12)*Math.min(1.08,torsoH);
 const newY=part==='body'||part?.startsWith('arm-')||part?.startsWith('hand-')?compact:part?.startsWith('leg-')?y:y<=.3?y:y<.52?.3+(y-.3)/.22*(hip-.3):y<1.12?hip+(y-.52)*torsoH:neck+(y-1.12)*head;

 const wx=y<.52?smooth(limb,tw,(y-.3)/.22):smooth(tw,head,(y-1.12)/.3),wz=y<.52?smooth(limb,td,(y-.3)/.22):smooth(td,head,(y-1.12)/.3);
 return p.set(p.x*wx,newY,p.z*wz);};
}

/** The rounded penguin is a short-legged suit. Height scales the whole silhouette,
 * rather than turning its exposed shins into the standard explorer's long legs. */
function penguinFit(look:LookId){
 const shape=shapeOf(look),sturdy=shape==='sturdy';
 const size={baby:.70,normal:.85,long:1,sturdy:1.02}[shape],rise={baby:.15,normal:.23,long:.34,sturdy:.27}[shape];
 const head=.94,width=sturdy?1.18:1,depth=sturdy?1.08:1,limb=1;
 return {size,transform:(part:string|undefined,rig=false)=>(p:T.Vector3)=>{
  const leg=part?.startsWith('leg-'),isHead=part==='head',w=isHead?head:part==='body'?width:limb,d=isHead?head:part==='body'?depth:limb;
  const y=leg?(rig ? .64 : p.y):isHead?1.12+rise+(p.y-1.12)*head:p.y+rise;
  return p.set(p.x*w*size,y*size,p.z*d*size);
 }};
}

export const birdLookPoint=(p:T.Vector3,look:LookId)=>birdLookTransform(look)(p);

// Palm centres from the authored costume meshes (Blender x/z/-y), before look fitting.
const COSTUME_PALMS:Record<string,[number,number,number]>={
 dz_penguin:[.39,.64,.02],dz_explorer_duck:[.48,.59,.04],dz_sorcerer:[.48,.58,.035],dz_ink_painter:[.53,.48,.02],
};

/** Retarget the rig and costume geometry together, preserving hidden base meshes and shared kit resources. */
export function fitBirdDisguise(root:T.Object3D,id:string,look:LookId){
 const penguin=id==='dz_penguin'?penguinFit(look):null;
 const transform=(part?:string,rig=false)=>penguin?penguin.transform(part,rig):birdLookTransform(look,rig&&(part==='body'||part==='head'||part?.startsWith('leg-'))?undefined:part);
 root.updateMatrixWorld(true);const toRoot=root.matrixWorld.clone().invert(),posed=new Set(Object.keys(DEFAULT_PIVOTS));
 const bones:{node:T.Object3D;at:T.Vector3}[]=[],pieces:{mesh:T.Mesh;old:T.Matrix4}[]=[];
 root.traverse(o=>{if(posed.has(o.name)){const palm=COSTUME_PALMS[id],hand=palm&&o.name.startsWith('hand-'),at=hand?new T.Vector3(palm[0]*(o.name==='hand-left'?-1:1),palm[1],palm[2]):new T.Vector3(...DEFAULT_PIVOTS[o.name]);bones.push({node:o,at:transform(o.name,true)(at)});}if(o instanceof T.Mesh&&o.visible&&o.name.startsWith(id))pieces.push({mesh:o,old:toRoot.clone().multiply(o.matrixWorld)});});
 // Parents precede their hand anchors in traversal order.
 for(const {node,at}of bones){node.parent!.updateWorldMatrix(true,false);const parentToRoot=toRoot.clone().multiply(node.parent!.matrixWorld);node.position.copy(at).applyMatrix4(parentToRoot.invert());node.updateMatrix();node.updateWorldMatrix(false,true);}
 root.updateMatrixWorld(true);
 for(const {mesh,old}of pieces){const g=mesh.geometry.clone(),positions=g.getAttribute('position'),back=toRoot.clone().multiply(mesh.matrixWorld).invert(),v=new T.Vector3(),deform=transform(mesh.userData.tag??mesh.name.split('@')[1]);g.userData.sharedKit=false;
  for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(old);deform(v).applyMatrix4(back);positions.setXYZ(i,v.x,v.y,v.z);}positions.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
 }
 // Separate costume legs bridge the raised hem and the unchanged shoes. They belong to the
 // animated leg rig; none of the concealed explorer clothing or backpack is made visible.
 const hem=transform('body')(new T.Vector3(0,.2,0)).y;
 for(const side of [-1,1]){const part=root.getObjectByName(side<0?'leg-left':'leg-right');if(!part)continue;
  const size=penguin?.size??1,bottom=(penguin ? .32 : .36)*size,top=Math.max(bottom+.12,hem+.26),height=top-bottom;
  const leg=new T.Mesh(new T.CylinderGeometry(.115*size,.11*size,height,12),new T.MeshStandardMaterial({color:id==='dz_penguin'?'#ffe2cb':'#242936',roughness:.85}));leg.name=id+'@shin';
  const at=new T.Vector3(side*.2*size*(penguin?(shapeOf(look)==='sturdy'?1.18:1):1), bottom+height/2,0).applyMatrix4(root.matrixWorld);part.updateWorldMatrix(true,false);part.worldToLocal(at);leg.position.copy(at);part.add(leg);
 }
 // Held gear is attached after this deformation: use the retargeted hand anchor, keeping the weapon's own size.
 root.userData.fit={'hand-left':{scale:[1,1,1],offset:[0,0,0]},'hand-right':{scale:[1,1,1],offset:[0,0,0]}};
}
