import * as T from 'three';
import { AVATAR_SHAPES } from './avatar-shapes.ts';
import { toonMaterial } from './toon.ts';
/** Lightweight version of the new normal figure while its GLB is loading (same animated sockets). */
export function avatarFallback(color:string){
 const root=new T.Group(),p=AVATAR_SHAPES.normal,skin=toonMaterial({color:'#ffd4bb'}),shirt=toonMaterial({color}),blue=toonMaterial({color:'#247dcc'}),dark=toonMaterial({color:'#292837'});shirt.name='Hero shirt';
 const part=(name:string,at:readonly number[])=>{const n=new T.Group();n.name=name;n.position.set(at[0],at[1],at[2]);root.add(n);return n;};
 const ellipsoid=(parent:T.Object3D,material:T.Material,pos:number[],size:number[])=>{const m=new T.Mesh(new T.SphereGeometry(1,16,10),material);m.position.set(pos[0],pos[1],pos[2]);m.scale.set(size[0],size[1],size[2]);parent.add(m);return m;};
 const head=part('head',p.pivots.head),body=part('body',p.pivots.body),face=new T.Group(),hair=new T.Group();face.name='base-face';hair.name='base-hair';head.add(face,hair);
 ellipsoid(head,skin,[0,.357,0],[.413,.448,.401]);for(const side of[-1,1]){ellipsoid(head,skin,[side*.407,.338,0],[.045,.08,.05]);ellipsoid(face,dark,[side*.143,.357,.374],[.025,.033,.015]);}ellipsoid(face,dark,[0,.25,.389],[.03,.008,.008]);
 const torso=new T.Mesh(new T.LatheGeometry([new T.Vector2(.23,-.325),new T.Vector2(.24,-.27),new T.Vector2(.21,0),new T.Vector2(.18,.26),new T.Vector2(.085,.32)],20),shirt);body.add(torso);
 for(const side of[-1,1]){
  const name=side<0?'left':'right',arm=part('arm-'+name,p.pivots['arm-'+name as 'arm-left']),handAt=p.pivots['hand-'+name as 'hand-left'],hand=new T.Object3D();arm.rotation.order='YXZ';hand.name='hand-'+name;hand.position.set(handAt[0]-arm.position.x,handAt[1]-arm.position.y,handAt[2]-arm.position.z);arm.add(hand);
  const tube=new T.Mesh(new T.CylinderGeometry(.064,.048,-hand.position.y,10),skin);tube.position.y=hand.position.y/2;arm.add(tube);ellipsoid(arm,skin,hand.position.toArray(),[.055,.07,.04]);
  const leg=part('leg-'+name,p.pivots['leg-'+name as 'leg-left']),length=leg.position.y-.10,shin=new T.Mesh(new T.CylinderGeometry(.073,.04,length,10),skin);shin.position.y=-length/2;leg.add(shin);ellipsoid(leg,blue,[0,-.085,0],[.12,.13,.135]);ellipsoid(leg,skin,[0,.062-leg.position.y,.055],[.085,.049,.145]);ellipsoid(leg,dark,[0,.027-leg.position.y,.055],[.09,.02,.15]);
 }
 root.userData.look='boy-chibi-none-bare';return root;
}
