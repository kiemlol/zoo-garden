import * as T from 'three';
import {DEFAULT_PIVOTS,FIT,BUILD,splitLook,type LookId} from './looks.ts';

/** A continuous rest-space deformation: adjacent costume parts share the same seams at every height/build. */
function birdLookTransform(look:LookId){
 const l=splitLook(look),f=FIT[l.height],build=BUILD[l.body],extension=-(f['leg-left']?.offset[1]??0),torsoH=f.body?.scale[1]??1,head=f.head?.scale[0]??1;
 const hip=.52+extension,neck=hip+.6*torsoH;
 const smooth=(a:number,b:number,t:number)=>{const v=Math.max(0,Math.min(1,t)),s=v*v*(3-2*v);return a+(b-a)*s;};
 const girl=l.body==='girl',tw=(f.body?.scale[0]??1)*(build?.torso[0]??(girl?.95:1)),td=(f.body?.scale[2]??1)*(build?.torso[1]??(girl?.96:1)),limb=build?.limb??1;
 return(p:T.Vector3)=>{const y=p.y;
 // Feet keep their size; extra height lengthens the legs and torso and reduces the head, like the mirror's bodies.
 const newY=y<=.3?y:y<.52?.3+(y-.3)/.22*(hip-.3):y<1.12?hip+(y-.52)*torsoH:neck+(y-1.12)*head;

 const wx=y<.52?smooth(limb,tw,(y-.3)/.22):smooth(tw,head,(y-1.12)/.3),wz=y<.52?smooth(limb,td,(y-.3)/.22):smooth(td,head,(y-1.12)/.3);
 return p.set(p.x*wx,newY,p.z*wz);};
}
export const birdLookPoint=(p:T.Vector3,look:LookId)=>birdLookTransform(look)(p);

/** Retarget the rig and costume geometry together, preserving hidden base meshes and shared kit resources. */
export function fitBirdDisguise(root:T.Object3D,id:string,look:LookId){
 root.updateMatrixWorld(true);const deform=birdLookTransform(look),toRoot=root.matrixWorld.clone().invert(),posed=new Set(Object.keys(DEFAULT_PIVOTS));
 const bones:{node:T.Object3D;at:T.Vector3}[]=[],pieces:{mesh:T.Mesh;old:T.Matrix4}[]=[];
 root.traverse(o=>{if(posed.has(o.name))bones.push({node:o,at:deform(new T.Vector3().setFromMatrixPosition(toRoot.clone().multiply(o.matrixWorld)))});if(o instanceof T.Mesh&&o.visible&&o.name.startsWith(id))pieces.push({mesh:o,old:toRoot.clone().multiply(o.matrixWorld)});});
 // Parents precede their hand anchors in traversal order.
 for(const {node,at}of bones){node.parent!.updateWorldMatrix(true,false);const parentToRoot=toRoot.clone().multiply(node.parent!.matrixWorld);node.position.copy(at).applyMatrix4(parentToRoot.invert());node.updateMatrix();node.updateWorldMatrix(false,true);}
 root.updateMatrixWorld(true);
 for(const {mesh,old}of pieces){const g=mesh.geometry.clone(),positions=g.getAttribute('position'),back=toRoot.clone().multiply(mesh.matrixWorld).invert(),v=new T.Vector3();g.userData.sharedKit=false;
  for(let i=0;i<positions.count;i++){v.fromBufferAttribute(positions,i).applyMatrix4(old);deform(v).applyMatrix4(back);positions.setXYZ(i,v.x,v.y,v.z);}positions.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.geometry=g;
 }
 // Held gear is attached after this deformation: use the retargeted hand anchor, keeping the weapon's own size.
 root.userData.fit={'hand-left':{scale:[1,1,1],offset:[0,0,0]},'hand-right':{scale:[1,1,1],offset:[0,0,0]}};
}
