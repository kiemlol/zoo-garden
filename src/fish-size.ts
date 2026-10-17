/** Shared species/new-catch ceiling. Historical records and aquarium residents keep their saved centimetres. */
export const MAX_FISH_SIZE_CM=800;
export const capFishSize=(cm:number)=>Math.min(MAX_FISH_SIZE_CM,cm);
