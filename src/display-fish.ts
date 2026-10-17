import * as T from 'three';
import {fishKit} from './assets.ts';
import {toonMaterial} from './toon.ts';

/** The same authored species/tail used by the pond; temporary art while its GLB loads. */
export function displayFish(id:string,length:number){
 const root=new T.Group();root.name='display:'+id;root.userData.animated=true;
 const model=fishKit.instance(id)??fishKit.instance(id==='fish_guardian'?'fish_koi':id);
 const art=model??new T.Group();
 if(!model){const material=toonMaterial({color:'#f4b65e'}),body=new T.Mesh(new T.SphereGeometry(.2,10,6),material);body.scale.set(.6,.65,1.5);art.add(body);const tail=new T.Mesh(new T.ConeGeometry(.15,.2,4),material);tail.name=id+'_tail';tail.rotation.x=Math.PI/2;tail.position.z=-.3;art.add(tail);}
 art.updateMatrixWorld(true);const box=new T.Box3().setFromObject(art),centre=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
 const scale=length/Math.max(.001,size.length());art.scale.multiplyScalar(scale);art.position.copy(centre).multiplyScalar(-scale);root.add(art);
 let tail:T.Object3D|null=null;art.traverse(o=>{o.userData.animated=true;if(o.name.endsWith('_tail'))tail=o;if(o instanceof T.Mesh)o.castShadow=false;});
 return {root,tail:tail as T.Object3D|null};
}
export function disposeDisplay(root:T.Object3D){root.removeFromParent();root.traverse(o=>{if(o instanceof T.Mesh){if(!o.geometry.userData.sharedKit)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.sharedKit)m.dispose();}});}
