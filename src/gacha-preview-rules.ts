/** Small pure rules shared by the viewer and its gesture/resolution tests. */
export const GACHA_TURN_SPEED = -.45; // Clockwise when viewed from above (+Y); one gentle turn in about 14 seconds.
export const GACHA_DRAG_RADIANS_PER_PX = .012;
export function previewPixels(width: number, height: number, dpr: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  // Scale both axes by ONE factor. Clamping them separately would stretch circles and models on wide screens.
  const density = Math.min(Math.max(1, dpr || 1), 2, 1024 / w, 1024 / h);
  return { width: Math.max(1, Math.round(w * density)), height: Math.max(1, Math.round(h * density)) };
}
export class GachaTurn {
  angle = -.5;
  private pointer: number | null = null;
  private x = 0;
  private resumeAt = 0;
  down(id: number, x: number) { if (this.pointer !== null) return false; this.pointer = id; this.x = x; return true; }
  move(id: number, x: number) { if (this.pointer !== id) return false; this.angle += (x - this.x) * GACHA_DRAG_RADIANS_PER_PX; this.x = x; return true; }
  up(id: number, now: number) { if (this.pointer !== id) return false; this.pointer = null; this.resumeAt = now + 1200; return true; }
  cancel(now: number) { this.pointer = null; this.resumeAt = now + 1200; }
  tick(dt: number, now: number, reducedMotion: boolean) { if (this.pointer === null && now >= this.resumeAt && !reducedMotion) this.angle += Math.max(0, Math.min(.1, dt)) * GACHA_TURN_SPEED; return this.angle; }
}
export const GACHA_CAMERA_PITCH = .13;
/** Perspective-fit bounds: a fixed cylinder for spinning, the actual turned box for a still reward/icon. */
export function gachaCameraDistance(size: {x:number;y:number;z:number}, aspect: number, yaw: number | null) {
  const tanV=Math.tan(Math.PI/12),tanH=tanV*Math.max(.1,aspect),s=Math.sin(GACHA_CAMERA_PITCH),c=Math.cos(GACHA_CAMERA_PITCH);
  const h=size.y/2,r=Math.hypot(size.x,size.z)/2;
  if(yaw===null)return Math.max(r*Math.hypot(c,1/tanH)+h*s,r*Math.abs(c+s/tanV)+h*Math.abs(s-c/tanV),r*Math.abs(c-s/tanV)+h*Math.abs(s+c/tanV)) *1.08;
  const cy=Math.cos(yaw),sy=Math.sin(yaw);let distance=.1;
  for(const ix of [-1,1])for(const iy of [-1,1])for(const iz of [-1,1]){
    const x=ix*size.x/2*cy+iz*size.z/2*sy,z=iz*size.z/2*cy-ix*size.x/2*sy,y=iy*h,back=y*s+z*c,up=y*c-z*s;
    distance=Math.max(distance,back+Math.abs(x)/tanH,back+Math.abs(up)/tanV);
  }
  return distance*1.08;
}
