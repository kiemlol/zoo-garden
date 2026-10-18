import * as T from 'three';
import { previewRenderer, restPose } from './mirror-preview.ts';
import { planetLight } from './toon.ts';
import { dropTree } from './dispose-tree.ts';
/** One retained avatar, redrawn only on a choice/resize/drag. Uses the existing shared GL context. */
export class WardrobePreview {
  readonly canvas=document.createElement('canvas');
  private scene=new T.Scene();private camera=new T.PerspectiveCamera(28,1,.01,100);private holder=new T.Group();
  private model:T.Object3D|null=null;private slot:HTMLElement|null=null;private key='';private yaw=0;private zoom=false;
  private drag:{id:number;x:number}|null=null;private resize=new ResizeObserver(()=>this.paint());
  constructor(){this.canvas.className='wardrobe-canvas';this.canvas.setAttribute('aria-hidden','true');const light=planetLight('home'),sun=new T.DirectionalLight(light.sun,light.sunIntensity);sun.position.set(2.5,6,7);this.scene.add(new T.HemisphereLight(light.sky,light.ground,light.hemi),sun,this.holder);}
  show(slot:HTMLElement,key:string,build:()=>T.Object3D,zoom:boolean){
    if(slot!==this.slot){this.detach();this.slot=slot;slot.append(this.canvas);this.resize.observe(slot);for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])slot.addEventListener(type,this.pointer);}
    this.zoom=zoom;
    if(key!==this.key){this.key=key;if(this.model)dropTree(this.model);this.model=restPose(build());this.holder.add(this.model);}
    this.paint();
  }
  turn(delta:number){this.yaw+=delta;this.paint();}
  private pointer=(event:Event)=>{const e=event as PointerEvent;if(!this.slot)return;
    if(e.type==='pointerdown'&&e.button===0&&!this.drag){this.drag={id:e.pointerId,x:e.clientX};this.slot.setPointerCapture(e.pointerId);}
    else if(e.type==='pointermove'&&this.drag?.id===e.pointerId){this.yaw+=(e.clientX-this.drag.x)*.012;this.drag.x=e.clientX;this.paint();}
    else if(['pointerup','pointercancel','lostpointercapture'].includes(e.type)&&this.drag?.id===e.pointerId){this.drag=null;if(this.slot.hasPointerCapture(e.pointerId))this.slot.releasePointerCapture(e.pointerId);}
    else return;e.preventDefault();e.stopPropagation();
  };
  private paint(){if(!this.slot||!this.model)return;const w=this.slot.clientWidth||300,h=this.slot.clientHeight||450,dpr=Math.min(2,devicePixelRatio||1,1024/Math.max(w,h)),pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
    this.holder.rotation.y=this.yaw;this.holder.updateMatrixWorld(true);
    const box=new T.Box3(),node=this.zoom?this.model.getObjectByName('head')??this.model:this.model;
    node.traverseVisible(o=>{if(o instanceof T.Mesh&&!o.userData.outline){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));}});
    const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());if(!this.zoom){const reach=Math.max(3.6,box.max.y+.1);center.y=reach/2;size.y=reach;}const distance=Math.max(size.y,size.x/(w/h))*1.2/(2*Math.tan(T.MathUtils.degToRad(14)))+size.z*.65;
    this.camera.aspect=w/h;this.camera.position.set(center.x,center.y+distance*.08,center.z+distance);this.camera.lookAt(center);this.camera.updateProjectionMatrix();
    try{const r=previewRenderer();r.setSize(pw,ph,false);r.render(this.scene,this.camera);this.canvas.width=pw;this.canvas.height=ph;this.canvas.getContext('2d')?.drawImage(r.domElement,0,0);this.slot.dataset.ready='true';}catch{this.slot.dataset.ready='false';}
  }
  private detach(){this.resize.disconnect();this.drag=null;if(this.slot)for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])this.slot.removeEventListener(type,this.pointer);this.slot=null;}
  dispose(){this.detach();if(this.model)dropTree(this.model);this.model=null;this.key='';this.scene.clear();this.canvas.remove();}
}
