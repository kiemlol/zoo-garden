import { t } from './i18n.ts';
import { heroKit, heroKitFor, wearKit, disguiseKit } from './assets.ts';
import { onArtLoaded } from './art-retry.ts';
import { lookOf, swapOption, type LookId } from './looks.ts';
import { lookName } from './look-tiles.ts';
import { WardrobePreview } from './wardrobe-preview.ts';
import { wardrobeHtml, wardrobeDraft, wardrobeGear, figureLook, WARDROBE_TABS, type WardrobeTab } from './wardrobe-ui.ts';
import { isHair, isFace } from './appearance.ts';
import { type WardrobeDraft } from './wardrobe-rules.ts';
import { previewGear } from './try-on.ts';
import type { SaveState } from './model.ts';
import type { World } from './world.ts';
import './look-shop.css';

export interface LookShopDeps {
  world: World;
  perform(type: string, payload?: Record<string, unknown>): Promise<unknown>;
  openDialog(type: string, title: string, body: string, kicker?: string, icon?: string): void;
  modal(): string | null;
  toast(message: string, icon?: string): void; tone(kind?: string): void;
  endGearTryOn(): void;
}
export { lookName };
export function lookShopHtml(s:SaveState,id:LookId){return wardrobeHtml(s,{...wardrobeDraft(s),look:id});}
/** Legacy mirror cache key, also used by friends' existing look previews. */
export function mirrorKey(id: LookId, color: string, gear: SaveState['gear']) {
  return [id, color, gear.outfit ?? '', gear.boots ?? '', heroKit.ready, heroKitFor(id).ready, wearKit.ready].join('|');
}
/** Local draft only; one validated action applies all visible choices together offline and online. */
export function initLookShop(d:LookShopDeps){
  const w=d.world;let draft:WardrobeDraft|null=null,tab:WardrobeTab='hair',zoom=false,busy=false,viewer:WardrobePreview|null=null,epoch=0;
  const shown=()=>draft??=wardrobeDraft(w.state);
  function paint(){if(d.modal()!=='looks'||!draft)return;const current=shown(),id=current.look,kit=heroKitFor(id),slot=document.querySelector<HTMLElement>('[data-wardrobe-preview]');if(!slot)return;
    const gear={...current.gear,weapon:undefined,pet:undefined,pet2:undefined};viewer??=new WardrobePreview();
    const key=JSON.stringify([id,current.appearance,gear,w.state.color,w.equipmentArt(gear,id)]);
    viewer.show(slot,key,()=>w.lookAvatar(w.state.color,gear,id,current.appearance),zoom);
    const version=epoch;if(!kit.ready)void kit.load().then(()=>{if(kit.ready&&version===epoch&&d.modal()==='looks'&&draft?.look===id)paint();});
    if(current.gear.disguise&&!disguiseKit.ready)void disguiseKit.load().then(()=>{if(disguiseKit.ready&&version===epoch&&d.modal()==='looks')paint();});
  }
  function preview(id:LookId){shown().look=id;syncPreview();}
  function syncPreview(){const next=shown();w.tryOnLook=next.look;w.tryOnGear={...next.gear};w.tryOnAppearance={...next.appearance};w.refreshPlayer();}
  function render(){if(d.modal()!=='looks')return;const scroll=document.querySelector('.wardrobe-tabs')?.scrollLeft??0,choices=document.querySelector('.wardrobe-choices')?.scrollTop??0;d.openDialog('looks',t('Dressing studio'),wardrobeHtml(w.state,shown(),tab,zoom,busy),t('MAKE IT YOURS'),'👗');const nav=document.querySelector('.wardrobe-tabs'),grid=document.querySelector('.wardrobe-choices');if(nav)nav.scrollLeft=scroll;if(grid)grid.scrollTop=choices;paint();}
  function open(){if(d.modal()!=='looks'){clear();d.endGearTryOn();draft=wardrobeDraft(w.state);}d.openDialog('looks',t('Dressing studio'),wardrobeHtml(w.state,shown(),tab,zoom,busy),t('MAKE IT YOURS'),'👗');paint();void Promise.all([heroKit.load(),wearKit.load()]).then(()=>{if(d.modal()==='looks')paint();});}
  function clear(){epoch++;const active=!!draft;draft=null;viewer?.dispose();viewer=null;if(active){w.tryOnLook=null;w.tryOnGear=null;w.tryOnAppearance=null;}return active;}
  onArtLoaded(()=>{if(d.modal()==='looks')paint();});
  document.addEventListener('click',async event=>{
    if(d.modal()!=='looks')return;const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target||target.disabled)return;
    const category=target.dataset.wardrobeTab,tool=target.dataset.wardrobeAction,action=target.dataset.lookAction;
    if(category&&WARDROBE_TABS.some(([id])=>id===category)){tab=category as WardrobeTab;d.tone('click');render();document.querySelector('[data-wardrobe-tab].active')?.scrollIntoView({block:'nearest',inline:'nearest'});return;}
    if(tool){if(tool==='zoom'){zoom=!zoom;render();}else viewer?.turn(tool==='left'?-.45:.45);d.tone('click');return;}
    if(busy)return;
    if(target.hasAttribute('data-wardrobe-figure')){preview(figureLook(shown().look,target.dataset.wardrobeFigure!));d.tone('click');render();return;}
    if(target.hasAttribute('data-look-option')){preview(swapOption(shown().look,target.dataset.lookOption as Parameters<typeof swapOption>[1]));d.tone('click');render();return;}
    if(target.hasAttribute('data-wardrobe-cosmetic')){const id=target.dataset.wardrobeCosmetic;if(tab==='hair'&&isHair(id))shown().appearance.hair=id;else if(tab==='face'&&isFace(id))shown().appearance.face=id;else return;
      // Trying a face/hair must show it: keep clothes under a costume, but take the costume off in the draft only.
      delete shown().gear.disguise;syncPreview();d.tone('click');render();return;}
    if(target.hasAttribute('data-wardrobe-item')&&['hat','glasses','outfit','boots','disguise'].includes(tab)){
      const id=target.dataset.wardrobeItem;if(id)shown().gear=previewGear(shown().gear,id);else delete shown().gear[tab as keyof SaveState['gear']];syncPreview();d.tone('click');render();return;
    }
    if(action==='reset'){draft=wardrobeDraft(w.state);syncPreview();d.tone('click');render();return;}
    if(action!=='apply')return;const current=shown(),owner=w.state,version=epoch;busy=true;render();
    try{const ok=await d.perform('dressAvatar',{look:current.look,appearance:{...current.appearance},gear:wardrobeGear(current)});
      if(ok&&w.state===owner){if(version===epoch){draft=wardrobeDraft(w.state);w.tryOnLook=null;w.tryOnGear=null;w.tryOnAppearance=null;}w.refreshPlayer();d.tone('success');d.toast(t('Outfit saved!'),'👗');}
    }finally{busy=false;if(version===epoch&&d.modal()==='looks')render();}
  });
  return {open,preview,paint,clear,get mirror(){return viewer;}};
}
