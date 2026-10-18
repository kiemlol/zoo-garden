import * as T from 'three';
import { buildGachaPumpkin, poseGachaPumpkin, PUMPKIN_OPEN_SECONDS } from './gacha-pumpkin.ts';
import { previewRenderer } from './mirror-preview.ts';
import { planetLight } from './toon.ts';
import { dropTree } from './dispose-tree.ts';
/** Animated 3D art on the existing shared preview renderer, copied into a 2D canvas. Only the 1.15s opening runs frames. */
export class GachaPumpkinView {
  readonly canvas = document.createElement('canvas');
  private model = buildGachaPumpkin();
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(27, 1, .1, 30);
  private frame = 0;
  private resize: ResizeObserver;
  private elapsed = 0;
  private start: number | null = null;
  private width = 0;
  private height = 0;
  constructor() {
    this.canvas.className = 'gacha-pumpkin-canvas'; this.canvas.setAttribute('aria-hidden', 'true');
    const light = planetLight('home'), sun = new T.DirectionalLight(light.sun, light.sunIntensity); sun.position.set(-3, 5, 6);
    this.scene.add(new T.HemisphereLight(light.sky, '#b79378', light.hemi), sun, this.model.root);
    this.model.root.rotation.y = -.18;
    this.resize = new ResizeObserver(() => this.paint(this.elapsed));
  }
  show(slot: HTMLElement, opening: boolean) {
    const moved = this.canvas.parentElement !== slot;
    if (moved) { this.resize.disconnect(); slot.append(this.canvas); this.resize.observe(slot); }
    if (!opening) { cancelAnimationFrame(this.frame); this.frame = 0; this.start = null; this.paint(0); return; }
    if (this.start !== null) return;
    this.start = performance.now();
    const tick = (now: number) => {
      if (this.start === null) return;
      this.paint((now - this.start) / 1000);
      if (this.elapsed < PUMPKIN_OPEN_SECONDS) this.frame = requestAnimationFrame(tick);
      else this.frame = 0;
    };
    this.frame = requestAnimationFrame(tick);
  }
  private paint(seconds: number) {
    if (!this.canvas.parentElement || document.hidden) return;
    this.elapsed = seconds; poseGachaPumpkin(this.model, seconds);
    const slot = this.canvas.parentElement, dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.min(600, Math.round((slot.clientWidth || 280) * dpr)), h = Math.min(600, Math.round((slot.clientHeight || 280) * dpr));
    if (this.width !== w || this.height !== h) { this.canvas.width = this.width = w; this.canvas.height = this.height = h; }
    // Plenty of headroom for the flying lid; the closed gift still fills the centre of the stage.
    this.camera.aspect = w / h; this.camera.position.set(0, 2.25, Math.max(6.2, 4.8 / this.camera.aspect)); this.camera.lookAt(0, 1.28, 0); this.camera.updateProjectionMatrix();
    try {
      const renderer = previewRenderer(); renderer.setSize(w, h, false); renderer.render(this.scene, this.camera);
      const ctx = this.canvas.getContext('2d'); ctx?.clearRect(0, 0, w, h); ctx?.drawImage(renderer.domElement, 0, 0);
    } catch { this.canvas.dataset.unavailable = 'true'; }
  }
  dispose() { cancelAnimationFrame(this.frame); this.start = null; this.resize.disconnect(); dropTree(this.model.root); this.scene.clear(); this.canvas.remove(); }
}
