import {isDisplayFish,FISH_SHOW_SECONDS} from './aquarium.ts';
import {MAX_FISH_SIZE_CM} from './fish-size.ts';

export type FishMeasureAxis='x'|'z';
/** Toy-scale reference: even a 5 cm catch is readable; an 800 cm trophy is a few hero heights, not a distant giant. */
export const FISH_SHOW_MIN_SPAN=.5,FISH_SHOW_MAX_SPAN=7.2;
export const ONE_HAND_FISH_MAX_CM=100;
/** A small visible gap from the palm to the fish's nearest surface, in avatar-local units. */
export const FISH_SHOW_HAND_GAP=.12;
export const FISH_SHOW_RAISE_SECONDS=.35,FISH_SHOW_LOWER_SECONDS=.25;
export const FISH_SHOW_TAIL_SWING=.22;
const YAW_SWING=.045,PITCH_SWING=.02,ROLL_SWING=.035;
export interface FishShowSpecies {axis:FishMeasureAxis;yaw:number;roll:number;measure:'length'|'wingspan'|'width';tailPitch?:number}
const length:FishShowSpecies={axis:'z',yaw:Math.PI/2,roll:0,measure:'length'};
/** Authored swimming models face +Z; the ray's cm measure its wingspan, and the flat sunfish is shown upright. */
export const FISH_SHOW_SPECIES:Record<string,FishShowSpecies>={
 fish_perch:{...length},fish_clown:{...length},fish_puffer:{...length},fish_carp:{...length},
 fish_shark:{...length},fish_rainbow:{...length},fish_catfish:{...length},fish_koi:{...length},
 fish_eel:{...length},fish_swordfish:{...length},fish_jelly:{axis:'x',yaw:0,roll:0,measure:'width',tailPitch:-72*Math.PI/180},fish_icepike:{...length},
 fish_whale:{...length},fish_kraken:{...length},fish_golden:{...length},fish_sunfish:{...length,roll:-85*Math.PI/180},
 fish_angler:{...length},fish_manta:{axis:'x',yaw:0,roll:0,measure:'wingspan'},fish_guardian:{...length},
};
export function fishShowPlan(id:string,cm:number){
 if(!isDisplayFish(id)||!Number.isFinite(cm)||cm<=0)return null;
 const species=FISH_SHOW_SPECIES[id]??length;
 // Defensive bound for raw show payloads; saved records are migrated per species in model.ts.
 const fraction=Math.min(cm,MAX_FISH_SIZE_CM)/MAX_FISH_SIZE_CM;
 const twoHands=cm>ONE_HAND_FISH_MAX_CM;
 return {...species,span:FISH_SHOW_MIN_SPAN+(FISH_SHOW_MAX_SPAN-FISH_SHOW_MIN_SPAN)*fraction,twoHands,
  pitch:!twoHands&&species.axis==='z'?-Math.PI/2:0};
}
/** Use the server's shared show deadline, so live/late online observers see the same struggle phase. */
export function fishShowMotion(until:number,now:number){
 const phase=Math.max(0,(now-(until-FISH_SHOW_SECONDS*1000))/1000)*Math.PI*2;
 return {yaw:Math.sin(phase)*YAW_SWING,pitch:Math.sin(phase*1.5)*PITCH_SWING,roll:Math.sin(phase*2)*ROLL_SWING,
  tail:Math.sin(phase*2)*FISH_SHOW_TAIL_SWING,bob:Math.sin(phase*3)*.02};
}
function smooth(v:number){const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);}
export function fishShowBlend(until:number,now:number,seconds=FISH_SHOW_SECONDS){
 const age=(now-(until-seconds*1000))/1000,left=(until-now)/1000;
 return Math.min(smooth(age/FISH_SHOW_RAISE_SECONDS),smooth(left/FISH_SHOW_LOWER_SECONDS));
}
