/**
 * Publishes how wide the dock (the menu column on the right edge) is as the CSS variable --dock-w, so the
 * map panel, the Home tab and the quest slips (hud-ours.css) sit just left of it however many columns its buttons
 * fold into on this screen. It also keeps --menu-bottom (where the dock's buttons end) for sheets that want it.
 * Measured when the dock's size changes, never per frame.
 */
export function dockMetrics(dock: DOMRect, buttons: readonly DOMRect[]) {
  const shown = buttons.filter(b => b.width > 0 && b.height > 0);
  if (!shown.length) return { width: Math.ceil(dock.width), bottom: Math.ceil(dock.bottom) };
  // The buttons, not the dock's box: the dock is as tall as the room it may use, and only its filled columns count.
  return { width: Math.ceil(dock.right - Math.min(...shown.map(b => b.left))), bottom: Math.ceil(Math.max(...shown.map(b => b.bottom))) };
}
const layouts=new WeakMap<HTMLElement,()=>void>();
/** Returns a disposer; reinitialization first disconnects observers and listeners. */
export function initHudLayout() {
  const menu = document.querySelector<HTMLElement>('#hud .top-actions'); if (!menu) return () => {};
  layouts.get(menu)?.();
  let lastWidth = -1, lastBottom = -1, lastTrackerBottom=-1, frame=0;
  const tracker=document.querySelector<HTMLElement>('#hud .tracker-stack');
  const food=document.querySelector<HTMLElement>('#quick-eat-menu'), foodAnchor=document.querySelector<HTMLElement>('.quick-eat');
  const measure = () => {
    frame=0;
    const dock=menu.getBoundingClientRect();if(!dock.width||!dock.height)return;
    const scrolling=getComputedStyle(menu).overflowY==='auto';
    const metrics=scrolling?{width:Math.ceil(dock.width),bottom:Math.ceil(dock.bottom)}:dockMetrics(dock, Array.from(menu.querySelectorAll<HTMLElement>('button'), b => b.getBoundingClientRect()));
    const {width,bottom}=metrics,root=document.documentElement.style;
    const trackerBox=tracker?.getBoundingClientRect(),trackerBottom=trackerBox?.height?Math.ceil(trackerBox.bottom):0;
    if(trackerBottom!==lastTrackerBottom){lastTrackerBottom=trackerBottom;root.setProperty('--tracker-bottom',trackerBottom+'px');}
    if (width !== lastWidth && width > 0) { lastWidth = width; root.setProperty('--dock-w', width + 'px'); }
    if (bottom !== lastBottom && bottom > 0) { lastBottom = bottom; root.setProperty('--menu-bottom', bottom + 'px'); }
    if(food&&!food.hidden&&foodAnchor){
      const anchor=foodAnchor.getBoundingClientRect(),visual=window.visualViewport;
      let topEdge=Math.max(dock.top,visual?.offsetTop??0), rightEdge=Math.min(dock.left-8,window.innerWidth-12);
      const leftEdge=Math.max(12,document.querySelector<HTMLElement>('#hud .player-card')?.getBoundingClientRect().left??12);
      const boxes=(selectors:string[])=>selectors.flatMap(selector=>{const el=document.querySelector<HTMLElement>(selector);if(!el||el.hidden)return [];const box=el.getBoundingClientRect();return box.width&&box.height?[box]:[];});
      const upper=boxes(['#hud .minimap','#hud .home-button']),lower=boxes(['#hud .skills','#hud .movement-joystick']);
      let width=Math.min(240,Math.max(0,rightEdge-leftEdge)),left=rightEdge-width;
      const overlaps=(box:DOMRect)=>box.right>left&&box.left<rightEdge;
      const visibleBottom=(visual?visual.offsetTop+visual.height:window.innerHeight)-12;
      let bottomEdge=Math.min(visibleBottom,...lower.filter(overlaps).map(box=>box.top-12));
      const belowMap=Math.max(topEdge,...upper.filter(overlaps).map(box=>box.bottom+8));
      if(bottomEdge-belowMap>=88)topEdge=belowMap;
      else {
        // Very short screens open just left of the map/Home column, so the list
        // can be tall without covering either thumb control or those buttons.
        rightEdge=Math.min(rightEdge,...upper.map(box=>box.left-8));
        width=Math.min(240,Math.max(0,rightEdge-leftEdge));left=rightEdge-width;
        bottomEdge=Math.min(visibleBottom,...lower.filter(overlaps).map(box=>box.top-12));
      }
      for(const box of boxes(['#hud .player-card','#hud .tracker-panels']))if(overlaps(box))topEdge=Math.max(topEdge,box.bottom+8);
      const height=Math.max(44,Math.min(320,bottomEdge-topEdge)),top=Math.max(topEdge,Math.min(anchor.bottom+6,bottomEdge-height));
      for(const [name,value]of Object.entries({left,top,width,height})){const key='--food-'+name,valuePx=value+'px';if(root.getPropertyValue(key)!==valuePx)root.setProperty(key,valuePx);}
    }

  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;resize?.observe(menu);if(tracker)resize?.observe(tracker);
  document.querySelectorAll<HTMLElement>('#hud .skills, #hud .movement-joystick, #hud .minimap, .quick-eat').forEach(el=>resize?.observe(el));
  const watch=typeof MutationObserver!=='undefined'?new MutationObserver(schedule):null;
  watch?.observe(menu,{childList:true});
  if(food)watch?.observe(food,{childList:true,attributes:true,attributeFilter:['hidden']});
  menu.querySelectorAll('#social-slot, #platform-slot').forEach(slot=>watch?.observe(slot,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']}));
  const hud=menu.closest('#hud');if(hud)watch?.observe(hud,{attributes:true,attributeFilter:['hidden','class']});
  window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);window.visualViewport?.addEventListener('resize',schedule);
  const timers=[300,1200,3000].map(ms=>setTimeout(schedule,ms));
  const dispose=()=>{resize?.disconnect();watch?.disconnect();if(frame)cancelAnimationFrame(frame);timers.forEach(clearTimeout);window.removeEventListener('resize',schedule);window.removeEventListener('orientationchange',schedule);window.visualViewport?.removeEventListener('resize',schedule);layouts.delete(menu);};
  layouts.set(menu,dispose);schedule();return dispose;
}
