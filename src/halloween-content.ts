import type {ItemDef,Recipe} from './content.ts';

export const CURSED_TREE='deco_cursed_tree',CURSED_BENCH='deco_cursed_bench',CURSED_COFFIN='deco_cursed_coffin',UNDYING_TEDDY='deco_undying_teddy',PATCHWORK_PET='pet_patchwork';
/** One configuration for the client and the authoritative combat simulation. */
export const PUMPKIN_SPELL={range:7,cluster:3,count:3,duration:3,cooldown:7} as const;
export const HALLOWEEN_ITEMS:Record<string,ItemDef>={
 [CURSED_TREE]:{name:'Cursed ancient tree',icon:'🌳',type:'decor',sell:1000,collider:1.4,desc:'A twisted violet-black tree with glowing cracks, cobwebs, broken iron fences and old gravestones.'},
 [CURSED_COFFIN]:{name:'Cursed grave bed',icon:'⚰️',type:'decor',sell:1400,collider:1.65,desc:'Open the coffin and lie inside. The lid closes after two seconds. Leave with the interaction button or movement controls.'},
 [CURSED_BENCH]:{name:'Cursed garden bench',icon:'🪑',type:'decor',sell:1000,collider:1.5,desc:'A violet-cushioned stone bench with skulls and roses. Two explorers can sit together, including a visiting friend.'},
 [UNDYING_TEDDY]:{name:'Undying heart teddy',icon:'🧸',type:'decor',sell:900,collider:.85,desc:'A stitched lilac and pink teddy on a tree stump, with a heart patch, mint ribbon and little mushrooms.'},
 [PATCHWORK_PET]:{name:'Patchwork kitten',icon:'🐱',type:'pet',slot:'pet',sell:1600,pet:{dmg:1,cd:PUMPKIN_SPELL.cooldown,shot:'pumpkin'},desc:'A cream and charcoal stitched companion. Every 7 seconds it turns up to three nearby creatures into harmless pumpkins for 3 seconds.'},
};
// Append recipes rather than shifting any existing recipe indexes stored in saves.
export const HALLOWEEN_RECIPES:Recipe[]=[
 {result:CURSED_TREE,energy:3200,materials:{wood:30,bone:12,moonstone:6},category:'Decorations',station:'craft'},
 {result:CURSED_COFFIN,energy:4200,materials:{wood:25,bone:20,obsidian:12,moonstone:8},category:'Decorations',station:'craft'},
 {result:CURSED_BENCH,energy:3000,materials:{wood:20,bone:12,obsidian:10},category:'Decorations',station:'craft'},
 {result:UNDYING_TEDDY,energy:2600,materials:{leather:12,feather:12,moonstone:4},category:'Decorations',station:'craft'},
 {result:PATCHWORK_PET,energy:4800,materials:{leather:16,bone:16,moonstone:10},category:'Pets',station:'craft'},
];
