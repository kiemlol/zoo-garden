"""Four original toy-toon models from the supplied penguin, explorer duck, lantern and dagger references.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_bird_disguises.py
Z up, faces -Y; wearables retain the six @part pivots. Props are skill-only.
"""
import bpy,sys,os,math,json
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
import build_wear as W
import build_festival_gear as F
from style import reset_scene,export_glb,render
ROOT=F.ROOT
C={'coal':'#252935','seam':'#62626F','lining':'#181B26','white':'#F7F5EF','blue':'#9CD3E6','yellow':'#F5BD36','orange':'#ED9A3A','ink':'#10121B','brown':'#4B3938','bronze':'#A17B47','gold':'#F4C75E','silver':'#A0A4BA','violet':'#B87CFF','flame':'#8577FF','glass':'#7C90B8','skin':'#FFE2CB','hair':'#181D27'}
def item(id,kind='disguise'):
 W.KIND[id]=kind;it=W.Item(id);it.palette={k:it.m(k,v,rough=.62) for k,v in C.items()};it.palette['violet']=it.m('rune glow',C['violet'],emit=C['violet'],strength=2);it.palette['flame']=it.m('magic flame',C['flame'],emit=C['flame'],strength=1.5);return it
ell=F.ell;box=F.box;line=F.line;plane=F.plane

def ring(it,part,c,R,r,col,rot=(0,0,0),segs=24):it.add(part,W.torus(R,r,segs,6).xf(W.xf(loc=c,rot=rot)),it.palette[col])
def star(it,part,c,r,col):
 pts=[]
 for i in range(16):
  a=math.pi/2+i*math.tau/16;rr=r if i%2==0 else r*.46;pts.append((math.cos(a)*rr,math.sin(a)*rr))
 plane(it,part,pts,c,'bronze',.026)
 plane(it,part,[(x*.85,y*.85) for x,y in pts],(c[0],c[1]-.022,c[2]),col,.028)
 for i in range(8):
  a=math.pi/2+i*math.tau/8;line(it,part,[c,(c[0]+math.cos(a)*r*.8,c[1]-.045,c[2]+math.sin(a)*r*.8)],.009,'yellow',4)

def penguin():
 it=item('dz_penguin')
 # The costume owns its face as well as its body; no original explorer mesh is needed underneath.
 ell(it,'head',(0,-.04,1.58),(.545,.535,.57),'skin',24,12)
 for side in [-1,1]:
  x=side*.205
  ell(it,'head',(x,-.543,1.59),(.128,.039,.15),'hair',16,8)
  ell(it,'head',(x,-.563,1.583),(.111,.032,.135),'white',16,8)
  ell(it,'head',(x,-.590,1.584),(.078,.023,.106),'blue',16,8)
  ell(it,'head',(x,-.611,1.591),(.047,.012,.077),'ink',14,7)
  ell(it,'head',(x-.027,-.625,1.64),(.029,.010,.033),'white',10,5)
  ell(it,'head',(x+.032,-.614,1.54),(.012,.008,.015),'white',8,4)
  line(it,'head',[(x-side*.10,-.548,1.69),(x+side*.09,-.538,1.70),(x+side*.14,-.51,1.73)],.015,'hair',6)
  blush=it.palette.setdefault('blush',it.m('blush','#F2A6A4'))
  it.add('head',W.ellipsoid((side*.32,-.49,1.47),(.075,.014,.032),12,5),blush)
 line(it,'head',[(-.075,-.554,1.43),(-.04,-.573,1.414),(0,-.579,1.409),(.04,-.573,1.414),(.075,-.554,1.43)],.009,'brown',6)
 # Hood framing an open human face, with cartoon penguin eyes above the opening.
 it.add('head',W.hood(.77,53,3,segs=28,steps=(180,155,130,110,90,75)),{'main':it.palette['coal'],'rim':it.palette['lining']})
 for side in [-1,1]:
  x=side*.26;ell(it,'head',(x,-.58,2.17),(.13,.055,.16),'white',14,7);ell(it,'head',(x,-.633,2.18),(.077,.027,.105),'ink',12,6);ell(it,'head',(x-side*.015,-.657,2.22),(.023,.012,.028),'white',8,4)
 # Rounded triangular golden beak at the hood brow.
 plane(it,'head',[(-.25,0),(-.19,.09),(0,.18),(.19,.09),(.25,0),(.11,-.08),(0,-.1),(-.11,-.08)],(0,-.70,2.0),'yellow',.14)
 # Black bob replaces the original brown hair around the face; individual fringe locks.
 for side in [-1,1]:
  for j in range(4):
   x=side*(.46+j*.037);y=-.17-j*.10
   line(it,'head',[(x,y,1.98),(x*1.04,y-.03,1.59),(x*.92,y-.01,1.22)],[.105,.11,.035],'hair',8)
 for i in range(7):
  x=(i-3)*.11;y=-math.sqrt(max(.1,.59**2-x*x))-.035
  plane(it,'head',[(-.067,.18),(.067,.18),(.057,-.12),(-.045,-.11)],(x,y,1.86),'hair',.07)
 for side in [-1,1]:plane(it,'head',[(-.09,.16),(.09,.16),(.08,-.17),(-.08,-.15)],(side*.46,-.51,1.71),'hair',.06)
 # White headphones, padded black earcups and headband.
 for side in [-1,1]:
  ell(it,'head',(side*.68,-.06,1.61),(.105,.2,.235),'ink',12,6)
  ell(it,'head',(side*.754,-.14,1.61),(.085,.19,.22),'white',14,7)
  line(it,'head',[(side*.77,-.08,1.43),(side*.79,-.1,1.77)],.014,'silver',5)
 # Complete plump romper with a soft-looking white belly inset.
 ell(it,'body',(0,.015,.72),(.57,.43,.53),'coal',20,10)
 ell(it,'body',(0,-.37,.72),(.4,.13,.43),'white',20,10)
 F.bow(it,'body',(0,-.41,1.14),.18,'blue')
 for side in [-1,1]:plane(it,'body',[(-.04,.02),(.04,.02),(.07,-.16),(-.02,-.13)],(side*.07,-.445,1.11),'blue',.018)
 for side,part in [(-1,'arm-left'),(1,'arm-right')]:
  line(it,part,[(side*.39,.01,1.06),(side*.60,-.015,.79),(side*.66,-.06,.50)],[.19,.14,.025],'coal',12)
  ell(it,part,(side*.39,-.02,.64),(.155,.17,.17),'coal',12,6)
 for side,part in [(-1,'leg-left'),(1,'leg-right')]:
  ell(it,part,(side*.2,0,.28),(.22,.23,.25),'coal',12,6)
  ell(it,part,(side*.21,-.12,.105),(.22,.31,.10),'yellow',12,5)
  for j in range(3):ell(it,part,(side*.21+(j-1)*.13,-.33,.09),(.08,.13,.07),'yellow',10,5)
 return it

def duck():
 it=item('dz_explorer_duck')
 ell(it,'head',(0,-.02,1.63),(.65,.63,.62),'ink',24,12)
 it.add('head',W.hood(.79,56,-1,segs=28,steps=(180,150,120,98,80)),{'main':it.palette['coal'],'rim':it.palette['brown']})
 # Peaked crown and raised leather stitching on the hood.
 plane(it,'head',[(-.48,-.08),(-.28,.22),(0,.40),(.28,.22),(.48,-.08),(0,.07)],(0,-.25,2.10),'coal',.12)
 for side in [-1,1]:
  seam=[(side*.29,-.52,2.21),(side*.52,-.49,2.0),(side*.67,-.40,1.70),(side*.69,-.37,1.4),(side*.51,-.42,1.14)]
  line(it,'head',seam,.016,'brown',6)
  for j in range(9):
   t=j/8;z=2.19-t*.86;x=side*(.29+.36*math.sin(t*math.pi*.7));y=-.53+t*.13
   line(it,'head',[(x-side*.04,y-.012,z-.025),(x+side*.04,y-.014,z+.025)],.012,'seam',5)
  x=side*.255;ell(it,'head',(x,-.589,1.73),(.18,.068,.23),'white',16,8);ell(it,'head',(x,-.65,1.74),(.13,.048,.19),'ink',16,8)
  ell(it,'head',(x-side*.04,-.689,1.82),(.047,.018,.055),'white',10,5);ell(it,'head',(x+side*.04,-.689,1.69),(.018,.012,.021),'blue',8,4)
  line(it,'head',[(side*.10,-.59,2.0),(side*.25,-.61,2.045),(side*.40,-.51,2.0)],.028,'ink',8)
 # Wide orange duck bill with lower lip and tiny nostrils.
 ell(it,'head',(0,-.69,1.43),(.40,.26,.15),'orange',20,8);ell(it,'head',(0,-.70,1.355),(.31,.22,.075),'yellow',18,6)
 line(it,'head',[(-.32,-.81,1.40),(0,-.91,1.39),(.32,-.81,1.40)],.013,'brown',7)
 for side in [-1,1]:ell(it,'head',(side*.11,-.88,1.50),(.027,.012,.017),'brown',8,4)
 # Slight crest visible under the hood.
 for j in range(3):line(it,'head',[((j-1)*.08,-.51,2.02),((j-1)*.055,-.57,2.14)],[.065,.008],'ink',8)
 # Long, flared coat with split front tails and a ragged cape behind it.
 it.add('body',W.lathe([(.50,.22),(.49,.52),(.42,.86),(.39,1.14)],22,cap_top=True,cap_bottom=True),it.palette['coal'])
 it.add('body',W.lathe([(.68,.20),(.64,.50),(.52,.85),(.43,1.12)],20,arc=(0,math.pi),mod=lambda a,z:1+.05*math.cos(a*8)),it.palette['lining'])
 for side in [-1,1]:
  plane(it,'body',[(-.20,.28),(.17,.30),(.25,-.31),(.10,-.38),(-.02,-.32),(-.18,-.39)],(side*.24,-.43,.56),'coal',.055)
  line(it,'body',[(side*.06,-.47,.25),(side*.13,-.47,.72),(side*.28,-.35,1.08)],.015,'brown',5)
  # Folded shoulder cape and stitch cross near coat hem.
  plane(it,'body',[(-.23,.05),(.16,.13),(.28,-.08),(.02,-.16),(-.20,-.08)],(side*.39,-.26,1.02),'coal',.045)
  for j in range(3):line(it,'body',[(side*.36-.022,-.485,.32+j*.05),(side*.36+.022,-.485,.35+j*.05)],.009,'seam',4)
 # Diagonal harness and belt, metal buckles and two studded pouches.
 line(it,'body',[(-.32,-.32,1.13),(0,-.45,.88),(.36,-.42,.63)],.055,'brown',6)
 it.add('body',W.lathe([(.49,.60),(.49,.72)],24,cap_top=False),it.palette['brown'])
 box(it,'body',(0,-.49,.66),(.22,.06,.15),'silver');box(it,'body',(0,-.53,.66),(.15,.035,.095),'brown');box(it,'body',(.015,-.55,.66),(.02,.02,.08),'silver')
 for side in [-1,1]:
  box(it,'body',(side*.35,-.43,.61),(.22,.13,.23),'brown',.025);box(it,'body',(side*.35,-.51,.68),(.23,.03,.12),'brown',.02);ell(it,'body',(side*.35,-.536,.65),(.023,.012,.023),'silver',8,4)
  part='arm-left' if side<0 else 'arm-right';line(it,part,[(side*.43,0,1.05),(side*.47,0,.69)],[.18,.14],'coal',12);box(it,part,(side*.48,-.03,.73),(.29,.28,.08),'brown');ell(it,part,(side*.48,-.04,.59),(.15,.14,.18),'ink',12,6)
  leg='leg-left' if side<0 else 'leg-right';box(it,leg,(side*.19,.0,.24),(.30,.3,.33),'ink',.05);ell(it,leg,(side*.19,-.12,.12),(.19,.28,.12),'ink',12,6);box(it,leg,(side*.19,-.01,.045),(.38,.5,.06),'lining');box(it,leg,(side*.19,-.32,.23),(.19,.045,.10),'bronze');box(it,leg,(side*.19,-.348,.23),(.13,.02,.055),'ink')
 for side in [-1,1]:
  box(it,'body',(side*.30,-.40,.98),(.13,.04,.18),'silver');box(it,'body',(side*.30,-.425,.98),(.085,.025,.125),'brown')
 star(it,'body',(0,-.56,1.02),.20,'gold')
 return it

def lantern():
 it=item('explorer_lantern','prop');p='body'
 # Engraved metal pedestal and belly.
 it.add(p,W.lathe([(.31,0),(.34,.035),(.29,.10),(.26,.14),(.34,.27),(.35,.40),(.30,.53),(.20,.59)],28,cap_bottom=True,cap_top=True),it.palette['coal'])
 for z,R in [(.04,.32),(.14,.26),(.55,.22),(.65,.30),(1.18,.30),(1.34,.19)]:ring(it,p,(0,0,z),R,.025,'silver')
 # Transparent chamber; renderer retains alpha/glass through the kit.
 glass=it.m('transparent glass',C['glass'],rough=.15);glass.diffuse_color=(*glass.diffuse_color[:3],.22)
 bsdf=glass.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Alpha'].default_value=.22
 if hasattr(glass,'surface_render_method'):glass.surface_render_method='DITHERED'
 it.add(p,W.lathe([(.22,.63),(.30,.75),(.33,.92),(.29,1.13),(.18,1.32)],24),glass)
 for j in range(6):
  a=j*math.tau/6
  path=[(r*math.cos(a),r*math.sin(a),z) for r,z in [(.23,.61),(.30,.72),(.34,.91),(.30,1.12),(.19,1.34)]]
  line(it,p,path,.026,'coal',7)
  for z,r in [(.66,.25),(1.17,.28)]:ell(it,p,(r*math.cos(a),r*math.sin(a),z),(.044,.044,.044),'silver',8,4)
  scroll=[]
  for k in range(16):
   t=k/15*math.pi*2;r=.07*(1-k/22);scroll.append((.22*math.cos(a)+math.cos(t)*r*math.cos(a),.22*math.sin(a)+math.cos(t)*r*math.sin(a),1.31+math.sin(t)*r))
  line(it,p,scroll,.012,'silver',5)
 # Blue-violet flame curls, little sparks suspended inside.
 for j in range(3):
  line(it,p,[(math.sin(k*.9+j)*(.04+k*.005),math.cos(k+j)*.025,.67+k*.065) for k in range(9)],[.08,.09,.08,.07,.06,.045,.03,.02,.002],'flame' if j else 'violet',9)
 for i in range(8):ell(it,p,(math.sin(i*2.4)*.19,math.cos(i*2.4)*.16,.74+i*.055),(.014,.014,.014),'violet',6,3)
 # Overhead metal carrying loop with riveted collars.
 line(it,p,[(.22*math.cos(a),0,1.40+.30*math.sin(a)) for a in [j*math.pi/18 for j in range(19)]],.032,'coal',8)
 for side in [-1,1]:ell(it,p,(side*.21,-.02,1.40),(.055,.035,.07),'silver',10,5)
 # Engraved curls and stars around the base; visible in small model silhouette.
 for j in range(10):
  a=j*math.tau/10;path=[]
  for k in range(20):
   t=k/19*math.pi*2;r=.07*(1-k/27);path.append(((.34+.005)*math.cos(a)+math.cos(t)*r*math.sin(a),(.34+.005)*math.sin(a)-math.cos(t)*r*math.cos(a),.35+math.sin(t)*r))
  line(it,p,path,.008,'silver',5)
 return it

def dagger():
 it=item('explorer_dagger','prop');p='body'
 # Upright blade makes a readable hand prop after runtime rotation.
 blade=[(-.11,.40),(-.20,.49),(-.16,.59),(-.145,1.13),(0,1.52),(.145,1.13),(.16,.59),(.20,.49),(.11,.40)]
 plane(it,p,blade,(0,0,0),'silver',.075)
 plane(it,p,[(x*.90,z if z<.5 else z-.018) for x,z in blade],(0,-.045,0),'ink',.04)
 # Thin glowing rune alphabet on the front (each is an actual raised stroke).
 for i in range(8):
  z=.59+i*.087;pts=[(-.055,-.073,z),(.055,-.073,z+.04),(-.025,-.073,z+.08),(-.055,-.073,z)] if i%2 else [(-.05,-.073,z),(.04,-.073,z+.07),(.05,-.073,z),(-.05,-.073,z+.06)]
  line(it,p,pts,.008,'violet',5)
 # Curved guard, leather grip wrapping, steel rivets and little skull pommel.
 line(it,p,[(-.24,0,.52),(-.27,0,.49),(-.21,0,.43),(0,0,.43),(.21,0,.43),(.27,0,.49),(.24,0,.52)],.025,'silver',8)
 it.add(p,W.lathe([(.067,.05),(.072,.12),(.064,.33),(.075,.41)],12,cap_bottom=True,cap_top=True),it.palette['brown'])
 for j in range(5):ring(it,p,(0,0,.11+j*.06),.071,.009,'ink',segs=12);ell(it,p,(0,-.072,.11+j*.06),(.014,.008,.014),'silver',8,4)
 ell(it,p,(0,0,.035),(.09,.07,.08),'silver',12,6)
 for side in [-1,1]:ell(it,p,(side*.033,-.061,.045),(.026,.015,.029),'ink',8,4)
 plane(it,p,[(-.015,0),(.015,0),(0,.024)],(0,-.077,.005),'ink')
 return it

def main():
 reset_scene();entries={};objects=[]
 for build in [penguin,duck,lantern,dagger]:
  it=build();e=W.realise(it);entries[it.id]=e;objects.extend([e['empty']]+[o for _,o in e['pieces']])
 size=export_glb(objects,os.path.join(ROOT,'public/assets/models/bird-disguises.glb'))
 manifest={'file':'public/assets/models/bird-disguises.glb','bytes':size,'models':{id:{'triangles':sum(W.mesh_tris(o) for _,o in e['pieces']),'parts':[p for p,_ in e['pieces']],'skillOnly':not id.startswith('dz_')} for id,e in entries.items()}}
 with open(os.path.join(ROOT,'art/bird-disguises-manifest.json'),'w') as f:json.dump(manifest,f,indent=2);f.write('\n')
 for o in objects:o.hide_render=True
 for id,e in entries.items():
  shown=[o for _,o in e['pieces']]
  for o in [e['empty']]+shown:o.hide_render=False
  F.cpu_stage((640,800));bpy.context.scene.cycles.samples=24
  ground=bpy.data.objects.get('Preview ground')
  if ground:
   m=ground.data.materials[0];m.diffuse_color=(.65,.75,.84,1);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.65,.75,.84,1)
  F.camera(shown,8,1.15)
  render(os.path.join(ROOT,'art/previews/kit',id+'.webp'))
  if id.startswith('dz_'):
   bpy.context.scene.render.resolution_x=160;bpy.context.scene.render.resolution_y=160;bpy.context.scene.render.film_transparent=True;F.camera(shown,8,1.2);render(os.path.join(ROOT,'public/assets/icons/items',id+'.webp'))
  for o in [e['empty']]+shown:o.hide_render=True
 print(json.dumps(manifest))
if __name__=='__main__':main()
