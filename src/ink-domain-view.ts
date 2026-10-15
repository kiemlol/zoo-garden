import * as T from 'three';
import type {InkDomain} from './ink-skills.ts';
/** Per-fragment world-space masks also cover batched trees, instanced rocks and the ground. */
export class InkDomainView {
 private fields={value:Array.from({length:24},()=>new T.Vector4())};
 private patched=new WeakMap<T.Material,{compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']}>();
 private count={value:0};private clock=0;
 patch(material:T.Material){
  if(this.patched.has(material)||material.userData.inkKeepColor)return;
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey;this.patched.set(material,{compile,key});const fields=this.fields,count=this.count;
  material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);
   const standard=shader.vertexShader.includes('#include <project_vertex>'),card=shader.vertexShader.includes('vec3 pivot=(modelMatrix*instanceMatrix')&&shader.vertexShader.includes('gl_Position=projectionMatrix*mvPosition;');if(!standard&&!card)return;
   shader.uniforms.inkDomains=fields;shader.uniforms.inkCount=count;
   shader.vertexShader='varying vec3 vInkWorld;\n'+(standard?shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    vec4 inkWorld = vec4(transformed,1.0);
    #ifdef USE_BATCHING
     inkWorld = batchingMatrix * inkWorld;
    #endif
    #ifdef USE_INSTANCING
     inkWorld = instanceMatrix * inkWorld;
    #endif
    vInkWorld = (modelMatrix * inkWorld).xyz;`):shader.vertexShader.replace('gl_Position=projectionMatrix*mvPosition;','vInkWorld=pivot+right*q.x+up*q.y;gl_Position=projectionMatrix*mvPosition;'));
   shader.fragmentShader='varying vec3 vInkWorld;\nuniform vec4 inkDomains[24];\nuniform int inkCount;\n'+shader.fragmentShader;
   const wash=`float inkMask=0.0;for(int inkIndex=0;inkIndex<24;inkIndex++){if(inkIndex>=inkCount)break;vec4 domain=inkDomains[inkIndex];if(domain.z>0.0)inkMask=max(inkMask,1.0-smoothstep(domain.z-.12,domain.z,distance(vInkWorld.xz,domain.xy)));}float inkLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(inkLuma),inkMask);`;
   shader.fragmentShader=shader.fragmentShader.replace(/}\s*$/,wash+'\n}');
  };
  material.customProgramCacheKey=function(){return key.call(this)+'-ink-wash-v1';};material.needsUpdate=true;
 }
 private exempt(mesh:T.Mesh){
  const keep=(source:T.Material)=>{if(source.userData.inkKeepColor)return source;if(!source.userData.sharedKit&&!this.patched.has(source)){source.userData.inkKeepColor=true;return source;}const material=source.clone(),previous=this.patched.get(source);material.onBeforeCompile=previous?.compile??source.onBeforeCompile;material.customProgramCacheKey=previous?.key??source.customProgramCacheKey;material.userData.inkKeepColor=true;material.userData.sharedKit=false;return material;};
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(keep):keep(mesh.material);
 }
 update(dt:number,domains:readonly InkDomain[],scene:T.Scene,players:readonly T.Object3D[]){
  this.count.value=Math.min(24,domains.length);this.fields.value.forEach((v,i)=>{const f=domains[i];v.set(f?.x??0,f?.z??0,f?.radius??0,0);});
  this.clock-=dt;if(!domains.length||this.clock>0)return;this.clock=.2;const exempt=new Set(players);
  const walk=(o:T.Object3D,keep=false)=>{keep=keep||exempt.has(o);if(o instanceof T.Mesh){if(keep)this.exempt(o);else for(const m of Array.isArray(o.material)?o.material:[o.material])this.patch(m);}for(const c of o.children)walk(c,keep);};walk(scene);
 }
 clear(){this.count.value=0;this.fields.value.forEach(v=>v.set(0,0,0,0));this.clock=0;}
}
