import * as T from 'three';
import {Sculptor} from './decor-sculptor.ts';
import {CURSED_TREE,CURSED_COFFIN,CURSED_BENCH,UNDYING_TEDDY,PATCHWORK_PET} from './halloween-content.ts';

type V=[number,number,number];
const ink='#30283f',edge='#54425f',stone='#675772',purple='#743696',bone='#f4efdf',crack='#ba63ec';
function path(s:Sculptor,color:string,points:V[],radius=.018,parent=s.root){for(let i=1;i<points.length;i++)s.rod(color,points[i-1],points[i],radius,parent);}
function skull(s:Sculptor,at:V,scale=.25,parent=s.root){
 const g=new T.Group();g.position.set(...at);g.scale.setScalar(scale);parent.add(g);
 s.ball(bone,1,[0,.05,0],[1,.98,.36],g);s.box(bone,[.78,.4,.5],[0,-.64,.02],g,true);
 for(const side of [-1,1])s.ball(ink,.25,[side*.4,.02,.33],[.82,1.2,.45],g);
 const nose=s.mesh(new T.ConeGeometry(.13,.22,3),ink,[0,-.36,.37],g);nose.rotation.z=Math.PI;
 for(const x of [-.23,0,.23])s.box(ink,[.065,.22,.02],[x,-.72,.28],g);
 return g;
}
function cross(s:Sculptor,at:V,size=.15,parent=s.root,color=bone){for(const sign of [-1,1])s.rod(color,[at[0]-size,at[1]-size*.6*sign,at[2]],[at[0]+size,at[1]+size*.6*sign,at[2]],.025,parent);}
function flame(s:Sculptor,at:V){
 const outer=s.ball('#879eea',.12,at,[.75,1.6,.75],s.root,.45);outer.name='cursed-flame';
 s.ball('#e9faff',.075,[at[0],at[1]-.015,at[2]+.055],[.75,1.35,.75],s.root,.7);
 const tip=s.mesh(new T.ConeGeometry(.07,.24,6),'#aeb9ff',[at[0]-.025,at[1]+.19,at[2]],s.root,.35);tip.rotation.z=-.15;
}
function coffinShape(width:number,length:number){const p=new T.Shape();for(const[x,z]of [[-.34,-1],[-.5,-.7],[-.5,.45],[-.3,1],[.3,1],[.5,.45],[.5,-.7],[.34,-1]] as [number,number][]){if(p.curves.length===0&&p.currentPoint.length()===0)p.moveTo(x*width,z*length/2);else p.lineTo(x*width,z*length/2);}p.closePath();return p;}
/** XZ coffin slab, built as a polygon so the lid and open cavity share a recognizable silhouette. */
function slab(s:Sculptor,color:string,width:number,length:number,depth:number,at:V,parent=s.root){const g=new T.ExtrudeGeometry(coffinShape(width,length),{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);return s.mesh(g,color,at,parent);}
function rose(s:Sculptor,x:number,y:number,z:number){
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const petal=s.ball(i%2?'#6d50c0':'#9370de',.065,[x+Math.sin(a)*.065,y,z+Math.cos(a)*.065],[1,.55,1]);petal.rotation.y=a;}
 s.ball('#b6a0ef',.04,[x,y+.024,z],[1,.7,1]);
 for(const side of [-1,1]){const leaf=s.ball('#394b43',.09,[x+side*.13,y-.05,z],[1,.28,.45]);leaf.rotation.y=side*.5;}
}
export const halloweenDecorationBuilders:Record<string,(s:Sculptor)=>void>={
 [CURSED_TREE](s){
  const trunk:V[]=[[0,.12,0],[-.15,.65,-.02],[-.43,1.23,0],[-.57,1.82,-.06],[-.22,2.35,-.08],[.3,2.42,-.1]];
  // Faceted tapering tubes give the crooked trunk a strong, angular silhouette.
  for(let i=1;i<trunk.length;i++){const a=new T.Vector3(...trunk[i-1]),b=new T.Vector3(...trunk[i]),d=b.clone().sub(a),r=.42-i*.055;const m=s.mesh(new T.CylinderGeometry(Math.max(.06,r-.06),r,d.length(),7),i%2?ink:'#382d4e',a.add(b).multiplyScalar(.5).toArray() as V);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
  for(let i=0;i<6;i++){const a=i*Math.PI/3;s.rod(ink,[0,.35,0],[Math.sin(a)*(.73+i%2*.17),.045,Math.cos(a)*.63],.15);}
  const branches:V[][]=[[[.0,2.38,-.08],[.6,2.76,-.08],[1,2.58,-.04],[1.42,2.48,-.1],[1.55,2.14,-.13]],[[.1,2.4,0],[.48,2.12,.06],[.55,1.57,.07],[.9,1.18,.15],[.77,.9,.2]],[[.6,2.7,-.06],[.82,2.25,-.23],[1.2,2.07,-.2],[1.32,1.72,-.2]],[[-.3,2.3,-.08],[-.36,1.96,.28],[-.17,1.46,.4],[-.33,1.23,.4]],[[.97,2.57,-.02],[1.22,2.35,.19],[1.28,2.02,.2]]];
  for(const pts of branches)for(let i=1;i<pts.length;i++){const a=new T.Vector3(...pts[i-1]),b=new T.Vector3(...pts[i]),d=b.clone().sub(a),r=.15-(i-1)*.032;const m=s.mesh(new T.CylinderGeometry(i===pts.length-1?.004:r-.032,r,d.length(),6),i%2?ink:'#3c3055',a.add(b).multiplyScalar(.5).toArray() as V);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());}
  path(s,crack,[[-.1,.35,.33],[.02,.65,.34],[-.12,.96,.32],[-.17,1.2,.23],[-.39,1.45,.24],[-.42,1.78,.17]],.023);
  path(s,crack,[[-.17,1.16,.25],[-.34,1.33,.25],[-.3,1.5,.17]],.014);
  path(s,crack,[[-.42,1.74,.17],[-.62,1.9,.12]],.018);
  for(const side of [-1,1])for(let i=0;i<4;i++){const x=side*(.58+i*.19),y=.55+(i%2)*.12;s.rod('#45424c',[x,.03,-.22],[x-side*.11,1.13+y*.2,-.22],.027);s.mesh(new T.ConeGeometry(.065,.19,4),'#49424f',[x-side*.11,1.28+y*.2,-.22]);}
  for(const side of [-1,1])path(s,'#4e4857',[[side*.54,.95,-.22],[side*1.25,.84,-.22]],.034);
  for(const side of [-1,1]){const grave=s.group([side*.91,.03,.5]);grave.rotation.z=side*-.1;s.box('#746977',[.29,.46,.12],[0,.23,0],grave,true);s.ball('#746977',.145,[0,.44,0],[1,.8,.42],grave);cross(s,[0,.29,.07],.07,grave,'#514958');}
  for(const [a,b,c]of [[[.03,2.31,.1],[.56,2.1,.1],[.47,1.64,.1]],[[.57,2.67,-.09],[1.15,2.43,-.04],[1.24,2.11,-.04]]] as V[][]){
   path(s,'#82718e',[a,b,c],.006);for(let k=1;k<=3;k++){const t=k/4;const p=new T.Vector3(...a).lerp(new T.Vector3(...b),t),q=new T.Vector3(...a).lerp(new T.Vector3(...c),t);path(s,'#82718e',[p.toArray() as V,[...p.clone().lerp(q,.5).add(new T.Vector3(0,-.04,0)).toArray()] as V,q.toArray() as V],.005);}}
  skull(s,[.3,.28,.6],.22);for(const[x,z]of [[-.7,.75],[.62,.88],[1,.65]])s.mesh(new T.IcosahedronGeometry(.12,0),'#696171',[x,.08,z]);
 },
 [CURSED_BENCH](s){
  s.box(ink,[2.2,.2,.85],[0,.44,0],s.root,true);s.box(purple,[1.94,.17,.72],[0,.62,.04],s.root,true);
  s.box(edge,[2.17,.94,.18],[0,1.11,-.38],s.root,true);s.box(ink,[1.98,.66,.04],[0,1.17,-.27],s.root,true);
  const crest=s.mesh(new T.ConeGeometry(.42,.35,4),edge,[0,1.67,-.38]);crest.rotation.y=Math.PI/4;s.star(crack,.065,[0,1.64,-.22]);skull(s,[0,1.26,-.21],.13);
  for(const side of [-1,1]){s.box(edge,[.22,1.25,.25],[side*1.08,.68,-.3],s.root,true);s.box(stone,[.31,.08,.32],[side*1.08,1.38,-.3]);s.mesh(new T.ConeGeometry(.13,.31,4),ink,[side*1.08,1.57,-.3]);s.box(stone,[.19,.41,.66],[side*1.03,.89,.0],s.root,true);s.box(edge,[.43,.53,.72],[side*1.28,.265,.03],s.root,true);s.box(stone,[.48,.1,.76],[side*1.28,.56,.03]);cross(s,[side*1.28,.28,.4],.085,s.root,'#a89aaa');for(let i=0;i<3;i++)rose(s,side*1.28+(i%2)*.1,.66,.02+(i-1)*.16);}
  path(s,'#3a254b',[[-.5,.715,.31],[-.35,.715,.13],[-.42,.715,-.01],[-.15,.715,-.2]],.008);path(s,'#514158',[[-.75,1.48,-.24],[-.57,1.25,-.24],[-.66,1.16,-.24]],.009);
 },
 [CURSED_COFFIN](s){
  s.box(edge,[2.38,.13,2.75],[0,.065,0]);
  s.box(edge,[1.38,1.25,.22],[0,.94,-1.1],s.root,true);const arch=s.mesh(new T.CylinderGeometry(.69,.69,.22,16,1,false,0,Math.PI),edge,[0,1.56,-1.1]);arch.rotation.x=Math.PI/2;
  s.box(ink,[1.12,1.18,.045],[0,1.12,-.965],s.root,true);const inner=s.mesh(new T.CircleGeometry(.56,16,0,Math.PI),ink,[0,1.68,-.962]);skull(s,[0,1.58,-.93],.2);s.star(crack,.09,[0,2,-.94]);
  slab(s,ink,1.25,2.05,.18,[0,.17,.12]);slab(s,edge,1.31,2.1,.1,[0,.35,.12]);slab(s,'#5f2b72',1.13,1.89,.08,[0,.45,.12]);
  // Six short walls leave a genuine hollow compartment, never a solid box through the passenger.
  const outline=[[-.4,-.92],[-.62,-.62],[-.62,.57],[-.38,1.1],[.38,1.1],[.62,.57],[.62,-.62],[.4,-.92]];
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1];const wall=s.box(ink,[.1,.6,Math.hypot(dx,dz)+.06],[(a[0]+b[0])/2,.83,(a[1]+b[1])/2]);wall.rotation.y=Math.atan2(dx,dz);}
  const lid=s.group([-.66,1.13,.12],'coffin-lid');lid.userData.animated=true;slab(s,edge,1.38,2.18,.13,[.66,0,0],lid);slab(s,'#4e3a60',1.2,1.98,.025,[.66,.131,0],lid);for(const sign of [-1,1])s.rod(bone,[.44,.18,-.1*sign],[.88,.18,.1*sign],.025,lid);
  for(const side of [-1,1])for(const z of [-.81,.91]){s.box(stone,[.35,.12,.35],[side*.96,.38,z]);s.box(edge,[.26,.65,.27],[side*.96,.75,z]);s.box(stone,[.35,.14,.35],[side*.96,1.12,z]);s.box(edge,[.23,.12,.23],[side*.96,1.24,z]);flame(s,[side*.96,1.48,z]);cross(s,[side*.96,.72,z+.15],.065,s.root,'#a196aa');}
 },
 [UNDYING_TEDDY](s){
  s.cylinder('#4d414c',.62,.79,.4,[0,.2,0],s.root,10);s.cylinder('#ad8f85',.6,.6,.025,[0,.41,0],s.root,12);for(let i=0;i<10;i++){const a=i*Math.PI/5;s.rod('#3e3542',[Math.sin(a)*.75,.02,Math.cos(a)*.75],[Math.sin(a+.07)*.58,.36,Math.cos(a+.07)*.58],.022);}
  s.ball('#8568b0',.37,[0,.91,0],[1,1.24,.79]);splitBall(s,.49,[0,1.62,0],['#8568b0','#e1a5e6'],[1,1,.84]);
  for(const side of [-1,1]){s.ball(side<0?'#8568b0':'#e1a5e6',.15,[side*.37,1.99,-.02],[1,1,.58]);const arm=s.ball(side<0?'#e1a5e6':'#8568b0',.15,[side*.32,.92,.02],[.8,1.4,.9]);arm.rotation.z=side*.2;s.ball('#9670be',.22,[side*.3,.58,.27],[1,.75,1.13]);s.ball('#e2a6e3',.165,[side*.3,.61,.43],[1,.8,.28]);s.ball(bone,.07,[side*.3,.61,.48],[1,.9,.3]);for(let j=-1;j<=1;j++)s.ball(bone,.025,[side*.3+j*.055,.71,.47],[1,1,.5]);}
  heart(s,'#edb0ef',[-.29,1.78,.39],.16);s.ball(bone,.19,[0,1.4,.37],[1.3,.78,.42]);s.eyes(0,1.56,.42,.17,s.root,'#3e294f');s.ball('#4b2e5c',.07,[0,1.43,.455],[1,.65,.4]);path(s,'#4b2e5c',[[0,1.4,.47],[0,1.35,.47],[-.07,1.33,.46]],.009);path(s,'#4b2e5c',[[0,1.35,.47],[.07,1.33,.46]],.009);
  for(let i=0;i<6;i++){const y=2.03-i*.095,z=Math.sqrt(Math.max(0,.49**2-(y-1.62)**2))*.84+.018;s.rod(bone,[-.035,y,z],[.035,y-.018,z],.012);}
  for(let i=0;i<5;i++)for(const side of [-1,1])s.rod(bone,[side*.04+(i-2)*.07,.74,.28],[side*.04+(i-2)*.07,.81,.3],.009);
  for(const x of [-.2,.2]){const bow=s.ball('#a6dbcd',.095,[x*.45,1.14,.31],[1,.65,.4]);bow.rotation.z=x*2;s.rod('#b9e5dc',[0,1.12,.34],[x*.45,.92,.35],.023);}
  cross(s,[.28,1.41,.36],.04,s.root,'#9ed5c5');
  for(const[x,z,h]of [[.68,.13,.27],[.82,.25,.17]] as const){s.cylinder('#c29bd5',.035,.045,h,[x,.08+h/2,z]);s.ball('#4c286c',.17,[x,.08+h,z],[1,.55,1]);for(let i=0;i<3;i++)s.ball('#c48fd5',.025,[x+Math.sin(i*2)*.09,.15+h,z+Math.cos(i*2)*.07],[1,.3,1]);}
 },
};
function splitBall(s:Sculptor,radius:number,at:V,colors:[string,string],scale:V=[1,1,1],parent=s.root){for(let i=0;i<2;i++){const m=s.mesh(new T.SphereGeometry(radius,12,10,-Math.PI/2+i*Math.PI,Math.PI),colors[i],at,parent);m.scale.set(...scale);}}
function heart(s:Sculptor,color:string,at:V,r:number,parent=s.root){const g=new T.Group();g.position.set(...at);parent.add(g);for(const side of [-1,1])s.ball(color,r*.59,[side*r*.42,r*.2,0],[1,1,.27],g);const point=s.mesh(new T.ConeGeometry(r*.93,r*1.25,3),color,[0,-r*.38,0],g);point.rotation.z=Math.PI;point.scale.z=.22;return g;}
/** Fully authored companion, using the same owned resources and toon palette as garden decorations. */
export function buildPatchworkPet(){
 const s=new Sculptor(),cream='#f3e9d9',dark='#515569',mint='#c4dddb';
 splitBall(s,.245,[0,.36,0],[cream,dark],[.87,1.2,.78]);splitBall(s,.41,[0,.84,.025],[dark,cream],[1,1,.8]);
 for(const side of [-1,1]){const color=side<0?dark:cream;s.ball(cream,.075,[side*.12,.075,.07],[1,.7,1.35]);const arm=s.ball(color,.09,[side*.22,.37,.04],[.75,1.5,.8]);arm.rotation.z=side*.18;
  const ear=s.mesh(new T.ConeGeometry(.155,.35,3),color,[side*.25,1.21,.0]);ear.rotation.z=-side*.17;ear.scale.z=.5;const inner=s.mesh(new T.ConeGeometry(.095,.23,3),side<0?'#737e95':'#adbcd3',[side*.25,1.23,.065]);inner.rotation.z=-side*.17;inner.scale.z=.3;
  // Small fur tufts define the cheeks rather than a featureless sphere.
  for(let i=0;i<3;i++){const tuft=s.mesh(new T.ConeGeometry(.08,.15,3),color,[side*(.34+i*.012),.86-i*.095,.025]);tuft.rotation.z=-side*(1.3+i*.15);tuft.scale.z=.65;}
  s.ball('#161824',.085,[side*.16,.79,.31],[1,1.08,.45]);s.ball('#fffef4',.024,[side*.16-.02,.82,.349],[1,1,.4]);s.ball('#acb1c8',.012,[side*.16+.025,.765,.35],[1,1,.4]);}
 s.ball(cream,.15,[0,.65,.28],[1.2,.6,.44]);s.ball(dark,.035,[0,.68,.347],[1,.6,.4]);path(s,dark,[[0,.66,.35],[0,.63,.35],[-.04,.62,.35]],.006);path(s,dark,[[0,.63,.35],[.04,.62,.35]],.006);
 for(let i=0;i<5;i++){const y=1.17-i*.09,z=.025+Math.sqrt(Math.max(0,.41**2-(y-.84)**2))*.8+.013;s.rod(mint,[-.026,y,z],[.028,y-.015,z],.008);}
 const patch=s.box(dark,[.12,.13,.025],[.08,.34,.19],s.root,true);patch.rotation.z=-.2;for(let i=0;i<3;i++)s.rod(mint,[.025+i*.04,.39,.207],[.035+i*.04,.41,.207],.004);
 s.ring(cream,.19,.033,[0,.52,0],true);const tail=s.group([0,.28,-.18],'patchwork-tail');tail.userData.animated=true;path(s,cream,[[0,0,0],[.16,.07,-.11],[.23,.19,-.08],[.2,.28,-.04]],.045,tail);
 return s.finish(PATCHWORK_PET);
}

/** Temporary creature form; owns its resources just like the original enemy mesh. */
export function buildPumpkinForm(){
 const s=new Sculptor();
 for(let i=0;i<8;i++){const a=i*Math.PI/4;s.ball(i%2?'#e89731':'#f5ac40',.33,[Math.sin(a)*.22,.35,Math.cos(a)*.22],[.72,1,.72]);}
 const stem=s.cylinder('#6c7848',.035,.065,.18,[0,.73,0],s.root,6);stem.rotation.z=-.2;
 for(const side of [-1,1]){const eye=s.mesh(new T.ConeGeometry(.09,.13,3),'#4b3042',[side*.16,.42,.46]);eye.scale.z=.22;}
 path(s,'#593046',[[-.22,.25,.44],[-.1,.19,.49],[0,.24,.5],[.1,.19,.49],[.22,.25,.44]],.025);
 s.ball('#8b9b55',.12,[.13,.74,0],[1,.18,.45]);return s.finish('pumpkin-form');
}
