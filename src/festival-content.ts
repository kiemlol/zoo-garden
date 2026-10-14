import type {ItemDef,Recipe} from './content.ts';
export const FESTIVAL_ITEMS:Record<string,ItemDef>={
 hair_pumpkin:{name:'Pumpkin witch hair',icon:'🎃',desc:'Long half-black, half-orange hair with a braided headband and pumpkin eye patch.',type:'hat',slot:'hat',sell:180},
 dress_pumpkin:{name:'Pumpkin witch dress',icon:'👗',desc:'A white bow collar, pumpkin brooch, black corset and orange pleated skirt with cross trim.',type:'armor',slot:'outfit',sell:420,stats:{def:12,hp:30}},
 boots_pumpkin:{name:'Pumpkin bow shoes',icon:'👠',desc:'Black Mary Jane shoes with orange bows and scalloped ankle cuffs.',type:'feet',slot:'boots',sell:220,stats:{speed:.08}},
 hair_flex:{name:'Flex golden hair',icon:'💇',desc:'Swept-up golden spikes with layered sides and a sharp hairline.',type:'hat',slot:'hat',sell:180},
 glasses_flex:{name:'Flex gold sunglasses',icon:'🕶️',desc:'Wide black lenses with teal reflections, gold rims and gold temples. Worn alongside hair.',type:'hat',slot:'glasses',sell:180},
 outfit_flex:{name:'Flex chain outfit',icon:'👖',desc:'A white jacket, gold dollar chain, navy cargo pants, gold waist chain and red bandana.',type:'armor',slot:'outfit',sell:480,stats:{def:16,hp:20}},
 boots_flex:{name:'Flex high-top sneakers',icon:'👟',desc:'Red, white and black high-tops with white laces, padded tongues and gold ankle accents.',type:'feet',slot:'boots',sell:240,stats:{speed:.1}},
 deco_ghost_carriage:{name:'Halloween ghost carriage',icon:'👻',desc:'A red velvet carriage drawn by a white ghost, with cobweb wheels, black bats and cyan lanterns. Place it in your garden.',type:'decor',sell:900,collider:1.55},
};
export const FESTIVAL_RECIPES:Recipe[]=[
 {result:'hair_pumpkin',energy:600,materials:{feather:8,moss_shell:3},category:'Festival outfits',station:'craft'},
 {result:'dress_pumpkin',energy:1500,materials:{leather:12,moss_shell:5,rainbow_slime:8},category:'Festival outfits',station:'craft'},
 {result:'boots_pumpkin',energy:800,materials:{leather:6,rainbow_slime:10},category:'Festival outfits',station:'craft'},
 {result:'hair_flex',energy:600,materials:{feather:8,lava_scale:3},category:'Festival outfits',station:'craft'},
 {result:'glasses_flex',energy:650,materials:{obsidian:4,lava_scale:5},category:'Festival outfits',station:'craft'},
 {result:'outfit_flex',energy:1800,materials:{leather:14,lava_scale:12,rolling_shell:4},category:'Festival outfits',station:'craft'},
 {result:'boots_flex',energy:900,materials:{leather:6,rainbow_slime:8,rolling_shell:3},category:'Festival outfits',station:'craft'},
 {result:'deco_ghost_carriage',energy:3000,materials:{bone:20,moss_shell:8,rolling_shell:10,lava_scale:8,rainbow_slime:12},category:'Decorations',station:'craft'},
];
