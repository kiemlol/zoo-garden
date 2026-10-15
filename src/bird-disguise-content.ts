import type {ItemDef,Recipe} from './content.ts';
export const BIRD_ITEMS:Record<string,ItemDef>={
 dz_penguin:{name:'Snow Penguin',icon:'🐧',desc:'A penguin hood with a golden beak, black bob, white headphones, blue bow, soft white belly and webbed feet. Replaces all four combat moves.',type:'disguise',slot:'disguise',price:1,sell:0},
 dz_explorer_duck:{name:'Black Explorer Duck',icon:'🦆',desc:'A black duck in a stitched hood and weathered cloak, with an orange bill, compass brooch, leather pouches and buckled boots. Replaces all four combat moves.',type:'disguise',slot:'disguise',price:1,sell:0},
};
// Test price only: available in Outfitters → Disguises; no crafting recipe or skill-prop merchandise.
export const BIRD_SHOP:Recipe[]=Object.keys(BIRD_ITEMS).map(result=>({result,energy:1,materials:{},category:'Disguises',station:'shop'}));
