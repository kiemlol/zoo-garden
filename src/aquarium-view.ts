import * as T from 'three';
import {aquarium,fishClass,type AquariumFish} from './aquarium.ts';
import {displayFish} from './display-fish.ts';

export class AquariumView {
 private swimmers:{root:T.Group;tail:T.Object3D|null;phase:number}[]=[];
 private scale:number;
 readonly root:T.Group;
 constructor(root:T.Group,id:string,fish:AquariumFish[]){
  this.root=root;
  this.scale=aquarium(id)!.scale;
  fish.forEach((f,i)=>{const shape=displayFish(f.id,(.25+fishClass(f.id)*.065)*this.scale);shape.root.name='aquarium-fish:'+i;root.add(shape.root);this.swimmers.push({...shape,phase:i*2.399});});
  this.update(0);
 }
 /** Closed ellipses stay strictly inside the glass; yaw follows the tangent rather than snapping at turns. */
 update(time:number){const s=this.scale;for(let i=0;i<this.swimmers.length;i++){const f=this.swimmers[i],a=time*(.55+i*.045)+f.phase,rx=.29*s,rz=.22*s;f.root.position.set(Math.cos(a)*rx,(.61+(i%3)*.12+Math.sin(a*2)*.018)*s,Math.sin(a)*rz);f.root.rotation.y=Math.atan2(-Math.sin(a)*rx,Math.cos(a)*rz);if(f.tail)f.tail.rotation.y=Math.sin(time*8+f.phase)*.38;}}
}
