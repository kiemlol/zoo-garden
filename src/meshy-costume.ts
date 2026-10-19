import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {modelUrl} from './assets.ts';
import {loadWithRetry} from './art-retry.ts';
export const WIND_SPIRIT='dz_wind_spirit';
type Mode='Idle'|'Walk'|'Run'|'Jump'|'Sit'|'Lie'|'FishCast'|'FishWait'|'FishReel'|'Attack';
interface Actor {mixer:T.AnimationMixer;actions:Map<string,T.AnimationAction>;mode?:Mode}
const actors=new WeakMap<T.Object3D,Actor>();
/** A full Meshy skinned avatar, kept outside KitLibrary: flattening into rigid kit parts would discard its skin.
 * Neither textures nor PBR materials are converted/tinted. Each avatar gets independent bones and animation state. */
export class MeshyCostumeLibrary {
 private source:GLTF|null=null;private loading:Promise<void>|null=null;
 private loader:(url:string)=>Promise<GLTF>;
 constructor(loader:(url:string)=>Promise<GLTF>=url=>new GLTFLoader().loadAsync(url)){this.loader=loader;}
 get ready(){return !!this.source;}
 get requested(){return !!this.loading;}
 load(){const keep=(g:GLTF)=>{this.source=g;g.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.userData.sharedKit=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.sharedKit=true;for(const v of Object.values(m))if(v instanceof T.Texture)v.userData.sharedKit=true;}}});};return this.loading??=loadWithRetry(modelUrl('wind-spirit.glb'),()=>this.loader(modelUrl('wind-spirit.glb')),keep).then(g=>{if(g)keep(g);});}
 instance(){
  if(!this.source)return null;const model=clone(this.source.scene) as T.Group;model.name=WIND_SPIRIT;model.userData.meshyCostume=true;
  // Weapon kits are authored around the default hand. Their grip now rides this model's real hand bone.
  model.userData.fit={'hand-right':{scale:[1,1,1],offset:[0,0,0]},'hand-left':{scale:[1,1,1],offset:[0,0,0]}};
  model.traverse(o=>{if(o instanceof T.SkinnedMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.userData.meshyCostume=true;}});
  model.getObjectByName('arm-left')!.rotation.z=-.3;model.getObjectByName('arm-right')!.rotation.z=.3;
  const mixer=new T.AnimationMixer(model),actions=new Map<string,T.AnimationAction>();
  for(const clip of this.source.animations){
   // Existing game poses own head, shoulders, hands and hips. Blender's secondary tracks bend elbows/knees;
   // filtering prevents a walk clip from overriding combat, rod, fish-show, carriage or furniture poses.
   const tracks=clip.tracks.filter(t=>/^(forearm|shin|foot)-(left|right)\./.test(t.name)).map(t=>t.clone());
   if(tracks.length)actions.set(clip.name,mixer.clipAction(new T.AnimationClip(clip.name,clip.duration,tracks)));
  }
  actors.set(model,{mixer,actions});return model;
 }
}
export const windSpiritKit=new MeshyCostumeLibrary();
/** Called after primary poses, identically for the local explorer and online observers. */
export function animateWindSpirit(model:T.Object3D,mode:Mode,dt:number,phase?:number){
 const actor=actors.get(model);if(!actor)return;
 if(actor.mode!==mode){actor.actions.get(actor.mode??'')?.fadeOut(.12);actor.actions.get(mode)?.reset().fadeIn(.12).play();actor.mode=mode;}
 const action=actor.actions.get(mode);if(action&&phase!==undefined)action.time=((phase%1+1)%1)*action.getClip().duration-Math.max(0,dt);
 actor.mixer.update(Math.max(0,Math.min(.1,dt)));
}
