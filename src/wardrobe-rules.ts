import type { SaveState } from './model.ts';
import { equip, unequip } from './model.ts';
import { isHair, isFace, type Appearance } from './appearance.ts';
import { buyLook, wearLook, toLook, missingOptions, type LookId } from './looks.ts';
/** Only these existing slots belong in the dressing studio; weapons and pets stay untouched. */
export const WARDROBE_SLOTS = ['hat','glasses','outfit','boots','disguise'] as const;
export type WardrobeSlot = typeof WARDROBE_SLOTS[number];
export interface WardrobeDraft { look: LookId; appearance: Appearance; gear: SaveState['gear'] }
/** Called inside applyGameAction's transactional clone: a rejected item never partially charges or equips. */
export function dressAvatar(s: SaveState, raw: Record<string,unknown>) {
  const look=toLook(raw.look), a=raw.appearance as Partial<Appearance>|null, gear=raw.gear;
  if(!look||!a||!isHair(a.hair)||!isFace(a.face)||!gear||typeof gear!=='object'||Array.isArray(gear))return false;
  const g=gear as Record<string,unknown>;
  if(Object.keys(g).some(key=>!WARDROBE_SLOTS.includes(key as WardrobeSlot)))return false;
  if(missingOptions(s,look).length ? !buyLook(s,look) : !wearLook(s,look))return false;
  // Clothes first, costume last: changing a clothing slot has the same costume-removal semantics as equip().
  for(const slot of WARDROBE_SLOTS){
    const id=g[slot];if(id!==null&&typeof id!=='string')return false;
    if(id===s.gear[slot]||id===null&&!s.gear[slot])continue;
    if(id===null){if(!unequip(s,slot))return false;}else if(!equip(s,id as string,slot))return false;
  }
  s.appearance={hair:a.hair,face:a.face};return true;
}
