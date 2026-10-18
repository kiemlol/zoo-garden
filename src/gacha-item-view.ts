import * as T from 'three';
import { buildGachaItem } from './gacha-art.ts';
import { GachaTurn, previewPixels, gachaCameraDistance, GACHA_CAMERA_PITCH } from './gacha-preview-rules.ts';
import { previewRenderer } from './mirror-preview.ts';
import { planetLight } from './toon.ts';
import { dropTree } from './dispose-tree.ts';
/** Real model pixels, not a rotated image. Static reward renders once; the shop viewer turns at 30fps while visible. */
export class GachaItemView {
  readonly canvas = document.createElement('canvas');
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(30, 1, .05, 100);
  private holder = new T.Group();
  private turn = new GachaTurn();
  private size = new T.Vector3(1,1,1);
  private slot: HTMLElement | null = null;
  private model: T.Group | null = null;
  private id = '';
  private rotating = false;
  private generation = 0;
  private frame = 0;
  private last = 0;
  private painted = 0;
  private resize: ResizeObserver;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  constructor() {
    this.canvas.className='gacha-model-canvas'; this.canvas.setAttribute('aria-hidden','true');
    const light = planetLight('home'), sun = new T.DirectionalLight(light.sun,light.sunIntensity); sun.position.set(2.5,6,7);
    this.scene.add(new T.HemisphereLight(light.sky, light.ground, light.hemi),sun,this.holder);
    this.resize = new ResizeObserver(() => this.paint()); this.motion.addEventListener('change',this.motionChanged);
  }
  show(slot: HTMLElement, id: string, rotating: boolean) {
    if (slot !== this.slot) {
      this.detach(); this.slot=slot; slot.append(this.canvas); this.resize.observe(slot);
      for (const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) slot.addEventListener(type,this.pointer);
    }
    this.rotating=rotating; slot.classList.toggle('gacha-can-turn',rotating);
    if (this.id === id) { this.paint(); this.schedule(); return; }
    this.id=id; const generation=++this.generation;
    delete slot.dataset.ready; delete slot.dataset.unavailable;
    if(this.model)dropTree(this.model); this.model=null; this.turn=new GachaTurn();
    void buildGachaItem(id).then(model => {
      if (generation!==this.generation) { if(model)dropTree(model); return; }
      if (!model) { if(this.slot)this.slot.dataset.unavailable='true'; return; }
      this.model=model; model.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(model), center=box.getCenter(new T.Vector3()); box.getSize(this.size);
      model.position.sub(center); this.holder.add(model); this.holder.rotation.y=this.turn.angle;
      this.paint(); this.schedule();
    }).catch(()=>{if(generation===this.generation&&this.slot)this.slot.dataset.unavailable='true';});
  }
  private schedule() { if(this.rotating&&this.slot&&!this.frame&&!this.motion.matches){this.last=performance.now();this.frame=requestAnimationFrame(this.tick);} }
  private tick = (now: number) => {
    this.frame=0;
    if(!this.slot||!this.rotating)return;
    if(!document.hidden&&now-this.painted>=1000/30){this.holder.rotation.y=this.turn.tick((now-this.last)/1000,now,this.motion.matches);this.last=now;this.painted=now;this.paint();}
    this.frame=requestAnimationFrame(this.tick);
  };
  private motionChanged = () => { if(this.motion.matches){cancelAnimationFrame(this.frame);this.frame=0;}else this.schedule(); };
  private pointer = (event: Event) => {
    if(!this.rotating||!this.slot)return;
    const e=event as PointerEvent, now=performance.now(); let used=false;
    if(e.type==='pointerdown'&&e.button===0){used=this.turn.down(e.pointerId,e.clientX);if(used)this.slot.setPointerCapture(e.pointerId);}
    if(e.type==='pointermove')used=this.turn.move(e.pointerId,e.clientX);
    if(['pointerup','pointercancel','lostpointercapture'].includes(e.type)){used=this.turn.up(e.pointerId,now);if(used&&this.slot.hasPointerCapture(e.pointerId))this.slot.releasePointerCapture(e.pointerId);}
    if(used){e.preventDefault();e.stopPropagation();this.holder.rotation.y=this.turn.angle;this.paint();}
  };
  private paint() {
    if(!this.slot||!this.model||document.hidden)return;
    const w=this.slot.clientWidth||280,h=this.slot.clientHeight||280,pixels=previewPixels(w,h,devicePixelRatio);
    if(this.canvas.width!==pixels.width||this.canvas.height!==pixels.height){this.canvas.width=pixels.width;this.canvas.height=pixels.height;}
    this.camera.aspect=w/h;
    // A yaw-invariant envelope prevents cropping/pumping as a long carriage rotates through its side view.
    const distance=gachaCameraDistance(this.size,this.camera.aspect,this.rotating?null:this.turn.angle);
    this.camera.position.set(0,distance*Math.sin(GACHA_CAMERA_PITCH),distance*Math.cos(GACHA_CAMERA_PITCH));this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();
    try{
      const renderer=previewRenderer(),surface=renderer.domElement as HTMLCanvasElement;
      if(surface.width!==pixels.width||surface.height!==pixels.height)renderer.setSize(pixels.width,pixels.height,false);
      renderer.render(this.scene,this.camera);
      const ctx=this.canvas.getContext('2d');ctx?.clearRect(0,0,pixels.width,pixels.height);ctx?.drawImage(surface,0,0);
      this.slot.dataset.ready='true';
    }catch{this.slot.dataset.unavailable='true';}
  }
  private detach() {
    this.resize.disconnect();this.turn.cancel(performance.now());if(!this.slot)return;
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])this.slot.removeEventListener(type,this.pointer);
    this.slot=null;
  }
  dispose() { ++this.generation;cancelAnimationFrame(this.frame);this.frame=0;this.detach();this.motion.removeEventListener('change',this.motionChanged);if(this.model)dropTree(this.model);this.model=null;this.scene.clear();this.canvas.remove(); }
}
