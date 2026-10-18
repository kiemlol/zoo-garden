import * as T from 'three';
/** Separate authored hair/face BEFORE vertex-colour baking, preserving every original triangle and hand/rig node. */
export function separateHeadCosmetics(hero: T.Object3D) {
  const head=hero.getObjectByName('head');if(!head||head.getObjectByName('base-hair'))return;
  const hair=new T.Group(),face=new T.Group();hair.name='base-hair';face.name='base-face';
  head.updateWorldMatrix(true,true);const inverse=head.matrixWorld.clone().invert();
  const candidates:T.Mesh<T.BufferGeometry,T.Material>[]=[];head.traverse(o=>{if(o instanceof T.Mesh&&!Array.isArray(o.material)&&o!==head)candidates.push(o as T.Mesh<T.BufferGeometry,T.Material>);});
  const skin=new T.Box3();for(const m of candidates)if(m.material.name==='Hero skin'){
    m.geometry.computeBoundingBox();skin.union(m.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));
  }
  const ribbonX=(skin.max.x-skin.min.x)*.375;
  for(const mesh of candidates){
    const name=mesh.material.name;
    if(name==='Hero hair')hair.attach(mesh);
    else if(name==='Hero eye'||name==='Hero pants')face.attach(mesh);
    else if(name==='Hero blush'){
      // Girl hair ribbons share the cheek material. Split by triangle position so neither survives as floating remnants.
      const flat=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=flat.getAttribute('position'),toHead=inverse.clone().multiply(mesh.matrixWorld),v=new T.Vector3(),sets=[[] as number[],[] as number[]];
      for(let i=0;i<p.count;i+=3){let x=0;for(let j=0;j<3;j++)x+=v.fromBufferAttribute(p,i+j).applyMatrix4(toHead).x/3;sets[Math.abs(x)>ribbonX?0:1].push(i,i+1,i+2);}
      for(let k=0;k<2;k++)if(sets[k].length){const g=new T.BufferGeometry();for(const [key,a]of Object.entries(flat.attributes)){const values=new Float32Array(sets[k].length*a.itemSize);sets[k].forEach((n,i)=>{for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=a.getComponent(n,j);});g.setAttribute(key,new T.BufferAttribute(values,a.itemSize));}const piece=new T.Mesh(g,mesh.material);piece.applyMatrix4(toHead);(k?face:hair).add(piece);}
      flat.dispose();mesh.removeFromParent();
    }
  }
  // attach() above used world-space transforms; the holders initially lived at the scene origin.
  // Re-express those meshes in head-local space, then make the holders children of the head.
  for(const holder of [hair,face]){
    for(const mesh of holder.children){if(mesh instanceof T.Mesh&&candidates.includes(mesh))mesh.applyMatrix4(inverse);}
    head.add(holder);
  }
  // Keep a vertex-coloured skin target for mergeEars/dressEars after the other materials left the head bake.
  for(const mesh of candidates)if(mesh.parent&&mesh.material.name==='Hero skin'){
    const geo=mesh.geometry.clone(),p=geo.getAttribute('position'),colors=new Float32Array(p.count*3),like=mesh.material as T.MeshStandardMaterial;
    for(let i=0;i<p.count;i++)colors.set([like.color.r,like.color.g,like.color.b],i*3);
    geo.setAttribute('color',new T.BufferAttribute(colors,3));mesh.geometry=geo;mesh.material=like.clone();
    (mesh.material as T.MeshStandardMaterial).color.set('#ffffff');(mesh.material as T.MeshStandardMaterial).vertexColors=true;
  }
}
