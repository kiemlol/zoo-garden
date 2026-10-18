import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEFAULT_PIVOTS, fitOf, shapeOf, shapeProfile, type LookId } from './looks.ts';
const cache=new WeakMap<T.BufferGeometry,Map<string,T.BufferGeometry>>();
/** Add rings at anatomical bends before deforming a rigid legacy sleeve. Without them a long
 * sleeve's two end rings bridge straight across the new elbow and the skin pokes through.
 * Interpolate every source attribute; this runs once per cached garment/figure, never per frame. */
function cutSleeve(source:T.BufferGeometry,cuts:number[]){
 const attrs=Object.entries(source.attributes),offsets:number[]=[];let offset=0;
 for(const[,a]of attrs){offsets.push(offset);offset+=a.itemSize;}
 const yOffset=offsets[attrs.findIndex(([name])=>name==='position')]+1,index=source.index,count=index?.count??source.getAttribute('position').count;
 let triangles:number[][][]=[];
 for(let i=0;i<count;i+=3){const tri:number[][]=[];for(let j=0;j<3;j++){const v:number[]=[];for(const[,a]of attrs)for(let c=0;c<a.itemSize;c++)v.push(a.getComponent(index?index.getX(i+j):i+j,c));tri.push(v);}triangles.push(tri);}
 for(const cut of cuts){const next:number[][][]=[];
  for(const tri of triangles){const ys=tri.map(v=>v[yOffset]);if(Math.min(...ys)>=cut-1e-6||Math.max(...ys)<=cut+1e-6){next.push(tri);continue;}
   for(const sign of[-1,1]){const polygon:number[][]=[];for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],inside=(a[yOffset]-cut)*sign>=0,other=(b[yOffset]-cut)*sign>=0;if(inside)polygon.push(a);if(inside!==other){const t=(cut-a[yOffset])/(b[yOffset]-a[yOffset]);polygon.push(a.map((v,c)=>v+(b[c]-v)*t));}}for(let j=1;j<polygon.length-1;j++)next.push([polygon[0],polygon[j],polygon[j+1]]);}
  }triangles=next;
 }
 const out=new T.BufferGeometry(),vertices=triangles.flat();for(let a=0;a<attrs.length;a++){const[name,attribute]=attrs[a],values=new Float32Array(vertices.length*attribute.itemSize);for(let i=0;i<vertices.length;i++)for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=vertices[i][offsets[a]+c];out.setAttribute(name,new T.BufferAttribute(values,attribute.itemSize));}
 const welded=mergeVertices(out,1e-5);out.dispose();source.dispose();return welded;
}
/** Fit a garment once, in authoring space. Palms/feet keep their proportions as arms/shins lengthen.
 * Cached immutable geometry is shared by portraits, the wardrobe and local/remote avatars. */
export function fitAvatarPiece(piece:T.Object3D,tag:string,look:LookId){
  const pivot=DEFAULT_PIVOTS[tag],fit=fitOf(look)[tag];if(!pivot||!fit)return false;
  if(!/^(body|arm-|leg-)/.test(tag))return false;
  const profile=shapeProfile(look),shape=shapeOf(look);piece.updateMatrixWorld(true);
  const origin=piece.parent?.matrixWorld.clone().invert()??new T.Matrix4(),meshes:{mesh:T.Mesh;matrix:T.Matrix4}[]=[];
  piece.traverse(o=>{if(o instanceof T.Mesh)meshes.push({mesh:o,matrix:origin.clone().multiply(o.matrixWorld)});});
  for(const {mesh,matrix}of meshes){
    let variants=cache.get(mesh.geometry);if(!variants){variants=new Map();cache.set(mesh.geometry,variants);}
    const key=shape+':'+tag+':'+matrix.elements.join(','),old=mesh.geometry;let g=variants.get(key);
    if(!g){g=old.clone().applyMatrix4(matrix).translate(-pivot[0],-pivot[1],-pivot[2]);
      const arm=tag.startsWith('arm-'),length=profile.armLength*.22+.14*.72,elbow=-length*.48,wrist=-length+.065;
      if(arm){const authorY=(y:number)=>y>=-.22*profile.armLength?y/profile.armLength:-.22+(y+.22*profile.armLength)/.72;g=cutSleeve(g,[authorY(elbow),-.22,authorY(wrist)]);}
      const pos=g.getAttribute('position'),v=new T.Vector3();
      for(let i=0;i<pos.count;i++){
        v.fromBufferAttribute(pos,i);
        if(tag.startsWith('arm-')){v.x*=fit.scale[0];v.z*=fit.scale[2];v.y=v.y>=-.22?v.y*profile.armLength:-.22*profile.armLength+(v.y+.22)*.72;
          const bend=(profile.sturdy?.12:.025)*(tag==='arm-left'?-1:1),t=v.y>=elbow?T.MathUtils.clamp((.025-v.y)/(.025-elbow),0,1):T.MathUtils.clamp((v.y-wrist)/(elbow-wrist),0,1);v.x+=bend*t;}
        else if(tag.startsWith('leg-')){const y=v.y+.52;v.x*=profile.foot;v.z*=profile.foot;v.y=(y<=.26?y*.55:.143+(y-.26)*(profile.hipY-.143)/.26)-profile.hipY;}
        else {const u=T.MathUtils.clamp((v.y+.85-.508)/.68,0,1),taper=profile.sturdy?.48+.70*u:1;v.x*=fit.scale[0]*taper;v.y*=fit.scale[1];v.z*=fit.scale[2]*taper;}
        pos.setXYZ(i,v.x,v.y,v.z);
      }
      g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.sharedKit=true;variants.set(key,g);
    }
    mesh.geometry=g;
  }
  // Kit pieces are direct mesh children in the current library. The nested case is baked consistently too.
  piece.position.set(0,0,0);piece.quaternion.identity();piece.scale.set(1,1,1);piece.updateMatrix();
  for(const {mesh}of meshes)if(mesh!==piece){mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);mesh.updateMatrix();}
  return true;
}
