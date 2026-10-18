import { HAIR_STYLES, FACE_STYLES, appearanceOf } from './appearance.ts';
import { lookOf, lookPrice, ROWS, OPTIONS, lookOptions, ownsOption } from './looks.ts';
import { WARDROBE_SLOTS, type WardrobeDraft } from './wardrobe-rules.ts';
import { ITEMS } from './content.ts';
import type { SaveState } from './model.ts';
import { gearLevel, levelAllows } from './level-gates.ts';
import { assetUrl } from './asset-url.ts';
import { lookArt } from './look-tiles.ts';
import { t } from './i18n.ts';
export const WARDROBE_TABS=[['hair','✂','Hair'],['face','☺','Face'],['body','♙','Figure'],['hat','♔','Hats'],['glasses','∞','Accessories'],['outfit','♧','Clothes'],['boots','♟','Shoes'],['deco','🐻','Hood'],['ears','🐱','Ears'],['disguise','★','Costumes']] as const;
export type WardrobeTab=typeof WARDROBE_TABS[number][0];
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const wardrobeDraft=(s:SaveState):WardrobeDraft=>({look:lookOf(s),appearance:appearanceOf(s),gear:{...s.gear}});
export const wardrobeGear=(draft:WardrobeDraft)=>Object.fromEntries(WARDROBE_SLOTS.map(slot=>[slot,draft.gear[slot]??null]));
export const appearanceIcon=(kind:'hair'|'face',id:string)=>assetUrl(`icons/appearance/${kind}-${id}.webp`);
function tile(attr:string,id:string,label:string,url:string,on:boolean,worn:boolean,tag='',disabled=false){return `<button class="wardrobe-tile${on?' selected':''}" ${attr}="${id}" aria-label="${esc(t(label))}" aria-pressed="${on}" title="${esc(t(label))}"${disabled?' disabled':''}><span class="wardrobe-orb"><img src="${url}" alt="" draggable="false" width="256" height="256">${on?'<i>✓</i>':''}</span><small>${esc(t(label))}</small>${tag?`<b>${esc(tag)}</b>`:worn?`<b>${esc(t('Wearing'))}</b>`:''}</button>`;}
export function wardrobeHtml(s:SaveState,draft:WardrobeDraft,tab:WardrobeTab='hair',zoom=false,busy=false){
  const current=appearanceOf(s),price=lookPrice(s,draft.look),unchanged=JSON.stringify([draft.look,draft.appearance,wardrobeGear(draft)])===JSON.stringify([lookOf(s),current,wardrobeGear(wardrobeDraft(s))]);let tiles='';
  if(tab==='hair'||tab==='face')tiles=Object.entries(tab==='hair'?HAIR_STYLES:FACE_STYLES).map(([id,o])=>tile('data-wardrobe-cosmetic',id,o.name,appearanceIcon(tab,id),draft.appearance[tab]===id,current[tab]===id)).join('');
  else if(tab==='body'||tab==='ears'||tab==='deco'){
    const rows=tab==='body'?['body','height'] as const:[tab];tiles=rows.map(row=>`<h3 class="wardrobe-section">${esc(t(row==='height'?'Height':row==='body'?'Body':row==='ears'?'Ears':'Hood'))}</h3>`+ROWS[row].map(id=>tile('data-look-option',id,OPTIONS[id].name,lookArt(id),lookOptions(draft.look).includes(id),lookOptions(lookOf(s)).includes(id),ownsOption(s,id)?'':`ϟ ${OPTIONS[id].price}`)).join('')).join('');
  }else{
    const ids=Object.keys(s.bag).filter(id=>(s.bag[id]??0)>0&&ITEMS[id]?.slot===tab);
    tiles=`<button class="wardrobe-tile${!draft.gear[tab]?' selected':''}" data-wardrobe-item="" aria-pressed="${!draft.gear[tab]}"><span class="wardrobe-orb wardrobe-empty">∅${!draft.gear[tab]?'<i>✓</i>':''}</span><small>${esc(t('Remove'))}</small></button>`+ids.map(id=>tile('data-wardrobe-item',id,ITEMS[id].name,assetUrl(`icons/items/${id}.webp`),draft.gear[tab]===id,s.gear[tab]===id,levelAllows(s.level,id)?'':t('Needs level {level}',{level:gearLevel(id)}),s.gear[tab]!==id&&!levelAllows(s.level,id))).join('');
  }
  return `<div class="wardrobe-studio"><section class="wardrobe-stage"><div class="wardrobe-heading"><span>${esc(t('DRESSING STUDIO'))}</span><h2>${esc(s.name)}</h2></div><div class="wardrobe-avatar" aria-label="${esc(t('Drag to turn your explorer'))}" data-wardrobe-preview></div><div class="wardrobe-stage-tools"><button data-wardrobe-action="left" aria-label="${esc(t('Turn left'))}">↶</button><button data-wardrobe-action="zoom" aria-pressed="${zoom}">${esc(t(zoom?'Full body':'Closer look'))}</button><button data-wardrobe-action="right" aria-label="${esc(t('Turn right'))}">↷</button></div><p class="wardrobe-hint">${esc(t('Drag to turn your explorer'))}</p></section><section class="wardrobe-closet"><nav class="wardrobe-tabs" aria-label="${esc(t('Looks'))}">${WARDROBE_TABS.map(([key,icon,name])=>`<button data-wardrobe-tab="${key}" class="${key===tab?'active':''}" aria-pressed="${key===tab}"><span>${icon}</span><small>${esc(t(name))}</small></button>`).join('')}</nav><div class="wardrobe-choices" data-category="${tab}">${tiles}</div><footer class="wardrobe-footer"><button class="soft-button" data-look-action="reset"${busy?' disabled':''}>${esc(t('Back to mine'))}</button><button class="primary" data-look-action="apply"${busy||unchanged||s.energy<price?' disabled':''}>${esc(t(price?'Buy & wear':'Save outfit'))}${price?` · ϟ ${price}`:''}</button></footer><p class="wardrobe-note">${esc(t('Try freely. Save to wear; close to keep your current outfit.'))}</p></section></div>`;
}
