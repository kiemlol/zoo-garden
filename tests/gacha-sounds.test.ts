import test from 'node:test';
import assert from 'node:assert/strict';
import { Sfx, type Sound } from '../src/sfx.ts';
const cues: Sound[]=['gacha-squash','gacha-open','gacha-blue','gacha-purple','gacha-summary'];

test('festival cues synthesize short, finite one-shot voices without adding music or audio downloads',()=>{
 const previous=globalThis.AudioContext;
 const sources:{start:number;stop:number}[]=[];
 const parameter=()=>({value:0,setValueAtTime(value:number){assert.ok(Number.isFinite(value));},exponentialRampToValueAtTime(value:number){assert.ok(value>0&&Number.isFinite(value));}});
 class Context {
  state='running';currentTime=10;sampleRate=8000;destination={};
  createGain(){return{gain:parameter(),connect(){}};}
  createBuffer(){return{getChannelData:()=>new Float32Array(8)};}
  createBiquadFilter(){return{type:'',Q:{value:0},frequency:parameter(),connect(){}};}
  source(){const source={start:NaN,stop:NaN};sources.push(source);return{connect(){},start(at:number){source.start=at;},stop(at:number){source.stop=at;}};}
  createBufferSource(){return{...this.source(),buffer:null};}
  createOscillator(){return{...this.source(),type:'',frequency:parameter()};}
 }
 globalThis.AudioContext=Context as unknown as typeof AudioContext;
 try{
  for(const cue of cues){const sfx=new Sfx(),before=sources.length;sfx.play(cue);const played=sources.slice(before);assert.ok(played.length>=2,cue);assert.ok(played.every(s=>s.stop>s.start&&s.stop<10.7),cue);sfx.play(cue);assert.equal(sources.length,before+played.length,'duplicate event is throttled');}
 }finally{globalThis.AudioContext=previous;}
});

test('gacha sounds honour the same effects mute controls as the rest of the game',()=>{
 let created=0;const previous=globalThis.AudioContext;
 globalThis.AudioContext=class{constructor(){created++;}} as unknown as typeof AudioContext;
 try{for(const cue of cues){const muted=new Sfx();muted.volume=0;muted.play(cue);const disabled=new Sfx();disabled.enabled=false;disabled.play(cue);}assert.equal(created,0);}finally{globalThis.AudioContext=previous;}
});
