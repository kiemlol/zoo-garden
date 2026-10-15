import * as T from 'three';

/** A small GPU skeleton bends the authored ink dragon; no vertices are rewritten per frame. */
const JOINTS=29,SCALE=2.6;
interface SkinData {geometry:T.BufferGeometry;rest:T.Vector3[];inverse:T.Quaternion[]}
const cache=new WeakMap<T.BufferGeometry,SkinData>();
const restPoint=(t:number)=>new T.Vector3(Math.sin(t*Math.PI*2)*(.68-.28*t),1.8-1.65*t,-.09*Math.cos(t*Math.PI*3));
const up=new T.Vector3(0,1,0),forward=new T.Vector3(0,0,1);
function frame(tangent:T.Vector3,reference:T.Vector3){const side=new T.Vector3().crossVectors(reference,tangent).normalize(),normal=new T.Vector3().crossVectors(tangent,side).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side,normal,tangent));}
/** Head-led orbit: several waves travel toward the tail instead of rotating a rigid S pose. */
export function inkDragonPoint(t:number,age:number,out:T.Vector3=new T.Vector3()){
 const a=age*1.65-t*3.9+.12*Math.sin(age*3-t*7),r=2.75+.35*Math.sin(age*2.4-t*6);
 return out.set(Math.sin(a)*r,4.05+.28*Math.sin(age*2.8-t*7)+.12*Math.sin(age*5-t*11),Math.cos(a)*r);
}
function skinData(mesh:T.Mesh,matrix:T.Matrix4){
 let data=cache.get(mesh.geometry);if(data)return data;
 const geometry=mesh.geometry.clone().applyMatrix4(matrix),positions=geometry.getAttribute('position'),indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4),rest=Array.from({length:JOINTS},(_,i)=>restPoint(i/(JOINTS-1))),inverse=rest.map((_,i)=>frame(restPoint(Math.min(1,(i+1)/(JOINTS-1))).sub(restPoint(Math.max(0,(i-1)/(JOINTS-1)))).normalize(),forward).invert());
 // Skin the continuous tube by nearest centreline, rather than by height: a tilted cross-section
 // must not be pulled onto different distant joints. Small disconnected details move as rigid pieces.
 const curve=Array.from({length:85},(_,i)=>restPoint(i/84)),parents=Array.from({length:positions.count},(_,i)=>i),groups=new Map<number,number[]>(),point=new T.Vector3();
 const find=(i:number):number=>parents[i]===i?i:parents[i]=find(parents[i]);
 const index=geometry.index;for(let i=0;i<(index?.count??positions.count);i+=3){const a=find(index?index.getX(i):i);parents[find(index?index.getX(i+1):i+1)]=a;parents[find(index?index.getX(i+2):i+2)]=a;}
 for(let i=0;i<positions.count;i++){const key=find(i),group=groups.get(key);if(group)group.push(i);else groups.set(key,[i]);}
 const nearest=(p:T.Vector3)=>{let best=Infinity,t=0;for(let i=0;i<curve.length-1;i++){const a=curve[i],b=curve[i+1],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz))),d=(p.x-a.x-dx*u)**2+(p.y-a.y-dy*u)**2+(p.z-a.z-dz*u)**2;if(d<best){best=d;t=(i+u)/84;}}return t;};
 for(const group of groups.values()){
  const box=new T.Box3();for(const i of group)box.expandByPoint(point.fromBufferAttribute(positions,i));
  const continuous=box.max.y-box.min.y>1&&group.length>400,centre=box.getCenter(new T.Vector3());let rigid=nearest(centre);if(rigid<.09||centre.y>1.64)rigid=0;
  for(const i of group){const t=continuous?nearest(point.fromBufferAttribute(positions,i)):rigid,joint=t*(JOINTS-1),lo=Math.min(JOINTS-2,Math.floor(joint)),mix=joint-lo;
   indices[i*4]=lo;indices[i*4+1]=lo+1;weights[i*4]=1-mix;weights[i*4+1]=mix;
  }
 }
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.userData.sharedKit=mesh.geometry.userData.sharedKit===true;
 // The whole bounding sphere is known: the animated body remains overhead within its combat circle.
 geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.5,0),4);data={geometry,rest,inverse};cache.set(mesh.geometry,data);return data;
}
export class InkDragonRig {
 readonly root=new T.Group();readonly meshes:T.SkinnedMesh[]=[];private bones:T.Bone[];private skeleton:T.Skeleton;private inverse:T.Quaternion[]=[];
 private points=Array.from({length:JOINTS},()=>new T.Vector3());private tangent=new T.Vector3();private q=new T.Quaternion();private facing=new T.Vector3();
 private side=new T.Vector3();private normal=new T.Vector3();private matrix=new T.Matrix4();private head=new T.Quaternion();private origin=new T.Vector3();private drawing:boolean;
 constructor(model:T.Group,drawing=false){
  this.drawing=drawing;model.updateMatrixWorld(true);const toModel=model.matrixWorld.clone().invert(),parts:T.Mesh[]=[];model.traverse(o=>{if(o instanceof T.Mesh)parts.push(o);});
  const rest=Array.from({length:JOINTS},(_,i)=>restPoint(i/(JOINTS-1)));this.bones=rest.map(p=>{const b=new T.Bone();b.position.copy(p);this.root.add(b);return b;});this.root.updateMatrixWorld(true);this.skeleton=new T.Skeleton(this.bones);
  for(const source of parts){const data=skinData(source,toModel.clone().multiply(source.matrixWorld));this.inverse=data.inverse;const geometry=drawing?data.geometry.clone():data.geometry;if(drawing)geometry.userData.sharedKit=false;
   const mesh=new T.SkinnedMesh(geometry,source.material);mesh.name='ink-dragon-swimming';mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;this.root.add(mesh);mesh.bind(this.skeleton,new T.Matrix4());this.meshes.push(mesh);
  }
  this.root.name='ink-dragon-rig';this.root.scale.setScalar(SCALE);this.root.userData.inkVisual=true;this.pose(0);
 }
 pose(age:number,reveal=1){
  for(let i=0;i<JOINTS;i++)inkDragonPoint(i/(JOINTS-1),age,this.points[i]).multiplyScalar(1/SCALE);
  inkDragonPoint(0,age+.02,this.facing).multiplyScalar(1/SCALE).sub(this.points[0]).normalize().negate();this.head.setFromRotationMatrix(this.matrix.lookAt(this.origin,this.facing,up));
  for(let i=0;i<JOINTS;i++){
   const tangent=this.tangent.copy(this.points[Math.min(JOINTS-1,i+1)]).sub(this.points[Math.max(0,i-1)]).normalize();this.side.crossVectors(up,tangent).normalize();this.normal.crossVectors(tangent,this.side);this.q.setFromRotationMatrix(this.matrix.makeBasis(this.side,this.normal,tangent)).multiply(this.inverse[i]);
   if(i<2)this.q.slerp(this.head,i===0?1:.5);
   this.bones[i].position.copy(this.points[i]);this.bones[i].quaternion.copy(this.q);
  }
  if(this.drawing)for(const m of this.meshes){const count=m.geometry.index?.count??m.geometry.getAttribute('position').count;m.geometry.setDrawRange(0,Math.floor(count*reveal/3)*3);}
  this.root.updateMatrixWorld(true);this.skeleton.update();
 }
 point(t:number,age:number,out:T.Vector3){return inkDragonPoint(t,age,out);}
 dispose(){this.skeleton.dispose();}
}
