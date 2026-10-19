/** Ground taps remain available; these home things no longer advertise a redundant nearby action. */
export function showContextPrompt(kind:string|undefined,leaving=false){
 return !!kind&&(leaving||!['home','decoration','plot','pen','animal','fish'].includes(kind));
}
