import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {toonMaterial} from './toon.ts';

// Templates never enter a scene. Each decoration owns its cloned palette so
// disposing or recoloring one placed object cannot invalidate another one.
const materialTemplates=new Map<string,T.MeshToonMaterial>();
function materialTemplate(color:string,glow=0,opacity=1){
  const key=`${color}:${glow}:${opacity}`;let material=materialTemplates.get(key);
  if(!material){material=toonMaterial({color,emissive:glow?color:'#000000',emissiveIntensity:glow,transparent:opacity<1,opacity,depthWrite:opacity===1,side:opacity<1?T.DoubleSide:T.FrontSide});materialTemplates.set(key,material);}return material;
}
type Vec=[number,number,number];
export class Sculptor {
  root=new T.Group();private palette=new Map<string,T.MeshToonMaterial>();
  material(color:string,glow=0,opacity=1){const key=`${color}:${glow}:${opacity}`;let material=this.palette.get(key);if(!material){material=materialTemplate(color,glow,opacity).clone();this.palette.set(key,material);}return material;}
  mesh(geometry:T.BufferGeometry,color:string,position:Vec=[0,0,0],parent:T.Object3D=this.root,glow=0,opacity=1){const mesh=new T.Mesh(geometry,this.material(color,glow,opacity));mesh.position.set(...position);mesh.castShadow=opacity===1;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  box(color:string,size:Vec,position:Vec,parent:T.Object3D=this.root,soft=false){return this.mesh(soft?new RoundedBoxGeometry(...size,2,Math.min(...size)*.18):new T.BoxGeometry(...size),color,position,parent);}
  ball(color:string,radius:number,position:Vec,scale:Vec=[1,1,1],parent:T.Object3D=this.root,glow=0){const ball=this.mesh(new T.SphereGeometry(radius,12,8),color,position,parent,glow);ball.scale.set(...scale);return ball;}
  cylinder(color:string,top:number,bottom:number,height:number,position:Vec,parent:T.Object3D=this.root,sides=12){return this.mesh(new T.CylinderGeometry(top,bottom,height,sides),color,position,parent);}
  rod(color:string,from:Vec,to:Vec,radius=.035,parent:T.Object3D=this.root){const a=new T.Vector3(...from),b=new T.Vector3(...to),delta=b.clone().sub(a);const rod=this.cylinder(color,radius,radius,delta.length(),a.add(b).multiplyScalar(.5).toArray() as Vec,parent,7);rod.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return rod;}
  ring(color:string,radius:number,tube:number,position:Vec,flat=false,parent:T.Object3D=this.root,arc=Math.PI*2){const ring=this.mesh(new T.TorusGeometry(radius,tube,6,24,arc),color,position,parent);if(flat)ring.rotation.x=-Math.PI/2;return ring;}
  group(position:Vec=[0,0,0],name=''){const group=new T.Group();group.position.set(...position);group.name=name;this.root.add(group);return group;}
  crystal(color:string,height:number,radius:number,position:Vec,lean=0){const group=this.group(position);group.rotation.z=lean;const low=this.cylinder(color,0,radius,height*.24,[0,height*.12,0],group,6);low.rotation.z=Math.PI;this.cylinder(color,0,radius,height*.76,[0,height*.62,0],group,6);return group;}
  star(color:string,radius:number,position:Vec,parent:T.Object3D=this.root){const shape=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?radius*.43:radius;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();return this.mesh(new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1,steps:1}),color,position,parent);}
  eyes(x:number,y:number,z:number,gap=.18,parent:T.Object3D=this.root,color='#3e3848'){for(const side of [-1,1])this.ball(color,.045,[x+side*gap,y,z],[1,1.18,.6],parent);}
  finish(id:string){
    this.root.name=`decoration:${id}`;this.root.userData.decorationId=id;this.root.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(this.root);if(Number.isFinite(bounds.min.y)){for(const child of this.root.children)child.position.y-=bounds.min.y;if(this.root.userData.carriageSeat)this.root.userData.carriageSeat[1]-=bounds.min.y;}
    this.root.updateMatrixWorld(true);return this.root;
  }
}
