import {FISH,ITEMS} from './content.ts';

export interface AquariumFish {id:string;size:number}
export interface FishShow extends AquariumFish {until:number}
// Species are classified by their maximum size, never by the size of a particular catch.
export const SMALL_FISH_MAX_CM=50,MEDIUM_FISH_MAX_CM=150,FISH_SHOW_SECONDS=6;
export const AQUARIUMS:Record<string,{capacity:number;maxClass:number;scale:number}>={
 deco_aquarium:{capacity:2,maxClass:0,scale:1},
 deco_aquarium_m:{capacity:4,maxClass:1,scale:1.5},
 deco_aquarium_l:{capacity:6,maxClass:2,scale:2},
};
export const aquarium=(id:string)=>Object.hasOwn(AQUARIUMS,id)?AQUARIUMS[id]:undefined;
export function fishClass(id:string){const max=FISH[id]?.size[1]??60;return max<SMALL_FISH_MAX_CM?0:max<=MEDIUM_FISH_MAX_CM?1:2;}
export const isDisplayFish=(id:string)=>Object.hasOwn(FISH,id)&&ITEMS[id]?.type==='fish';
export const fishFits=(tank:string,id:string)=>!!aquarium(tank)&&isDisplayFish(id)&&fishClass(id)<=aquarium(tank)!.maxClass;
export function fishSize(id:string,records:Record<string,number>,random:()=>number){const record=records[id];if(Number.isFinite(record)&&record>0)return record;const [min,max]=FISH[id].size;return Math.round((min+Math.max(0,Math.min(1,random()))*(max-min))*10)/10;}
/** Optional field: old decorations stay unchanged; invalid or oversized lists cannot enter a save. */
export function readAquariumFish(tank:string,value:unknown):AquariumFish[]|undefined{
 const spec=aquarium(tank);if(!spec||!Array.isArray(value))return undefined;
 return value.filter((f):f is AquariumFish=>!!f&&typeof f==='object'&&typeof f.id==='string'&&fishFits(tank,f.id)&&typeof f.size==='number'&&Number.isFinite(f.size)&&f.size>0).slice(0,spec.capacity).map(({id,size})=>({id,size}));
}
export function aquariumRefusal(tank:string,fish:AquariumFish[]|undefined,id:string){
 const spec=aquarium(tank);if(!spec)return 'This aquarium is no longer here.';
 if((fish?.length??0)>=spec.capacity)return 'This aquarium is full. Take a fish out first.';
 if(!fishFits(tank,id))return 'This species is too large for this aquarium.';
 return '';
}
