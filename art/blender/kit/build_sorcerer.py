"""Chibi portal sorcerer: six animated parts, solid costume, red sculpted cape and embroidered navy robe.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_sorcerer.py
"""
import bpy,os,sys,math,json
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
import build_wear as W
import build_festival_gear as F
from style import reset_scene,export_glb,render
from mathutils import Vector
ROOT=F.ROOT
C={'navy':'#243047','trim':'#48536B','black':'#141B25','hair':'#1B2028','silver':'#BBC0C6','skin':'#FFE0BF','blush':'#F4B6A0','white':'#FFF6E5','amber':'#B76D24','brown':'#65462F','gold':'#DBAE55','lightgold':'#FFE29B','red':'#BA2937','scarlet':'#DB4247','shadow':'#7A1E32','green':'#59EF9A','ink':'#111820'}
def sorcerer():
 W.KIND['dz_sorcerer']='disguise';it=W.Item('dz_sorcerer');it.palette={k:it.m(k,v,rough=.72) for k,v in C.items()};it.palette['green']=it.m('Emerald portal amulet',C['green'],emit=C['green'],strength=1.8)
 ell=F.ell;line=F.line;plane=F.plane;box=F.box
 # Warm complete face with ears, amber layered eyes and curled moustache.
 ell(it,'head',(0,-.03,1.64),(.59,.51,.57),'skin',24,12)
 for s in [-1,1]:
  ell(it,'head',(s*.57,-.04,1.58),(.12,.10,.17),'skin',12,6)
  ell(it,'head',(s*.205,-.504,1.67),(.153,.038,.183),'brown',16,8)
  ell(it,'head',(s*.205,-.529,1.665),(.138,.030,.163),'white',16,8)
  ell(it,'head',(s*.205,-.551,1.65),(.1,.025,.13),'amber',16,8)
  ell(it,'head',(s*.205,-.574,1.679),(.066,.012,.091),'ink',14,7)
  ell(it,'head',(s*.205-.032,-.589,1.72),(.03,.011,.035),'white',10,5)
  ell(it,'head',(s*.205+.04,-.58,1.59),(.016,.009,.018),'lightgold',8,4)
  line(it,'head',[(s*.095,-.507,1.86),(s*.21,-.518,1.89),(s*.34,-.45,1.87)],.028,'hair',7)
  ell(it,'head',(s*.35,-.46,1.49),(.075,.012,.035),'blush',12,5)
  line(it,'head',[(0,-.552,1.44),(s*.045,-.566,1.461),(s*.10,-.56,1.437),(s*.145,-.53,1.46)],[.009,.018,.016,.003],'hair',7)
 line(it,'head',[(-.06,-.522,1.388),(0,-.538,1.377),(.06,-.522,1.388)],.008,'brown',6)
 ell(it,'head',(0,-.542,1.51),(.052,.032,.048),'skin',10,5)
 # Swept, overlapping tapered locks: a visible silver streak at each temple.
 ell(it,'head',(0,.05,1.98),(.62,.49,.38),'hair',24,10)
 for s in [-1,1]:
  for j in range(6):
   x=s*(.24+j*.055)
   line(it,'head',[(s*.12,.11+j*.025,2.28),(x,-.14,2.17),(s*(.59+j*.013),-.12,1.98-j*.045),(s*(.63-j*.012),-.06,1.85-j*.035)],[.12,.16,.09,.002],'hair',9)
  for j in range(3):line(it,'head',[(s*.40,-.25-j*.025,2.02),(s*.55,-.31-j*.018,1.92),(s*.65,-.22,1.89-j*.027)],[.036,.047,.002],'silver',7)
 for j in range(7):
  line(it,'head',[(.24-j*.025,-.22,2.28),(.06-j*.1,-.48,2.17),(-.30-j*.045,-.51,2.00),(-.52-j*.018,-.4,1.91+j*.015)],[.11,.13,.09,.002],'hair',9)
 # Flared fitted coat and inner tunic. Feet and pants are independent leg parts.
 it.add('body',W.lathe([(.43,.27),(.44,.40),(.35,.80),(.35,1.1)],24,cap_top=True,cap_bottom=True),it.palette['navy'])
 for s in [-1,1]:
  plane(it,'body',[(-.16,.38),(.13,.32),(.19,-.40),(-.19,-.42)],(s*.23,-.34,.69),'navy',.04)
  line(it,'body',[(s*.08,-.38,1.10),(s*.13,-.43,.75),(s*.29,-.44,.31)],.011,'trim',6)
  line(it,'body',[(s*.105,-.393,1.06),(s*.155,-.451,.73),(s*.315,-.451,.31)],.005,'gold',5)
  for j in range(5):
   z=.35+j*.13;x=s*(.30-j*.031)
   line(it,'body',[(x-.023,-.463,z),(x+.023,-.463,z+.018)],.005,'gold',4)
   if j%2==0:line(it,'body',[(x,-.465,z-.012),(x,-.465,z+.029)],.005,'gold',4)
  # Gold crescent and star embroidery along bottom hem.
  for j in range(3):
   x=s*(.13+j*.1);z=.34+(.018 if j%2 else 0)
   line(it,'body',[(x+.018*math.cos(a),-.43,z+.018*math.sin(a)) for a in [k*math.pi/6 for k in range(10)]],.004,'gold',4)
 it.add('body',W.lathe([(.35,.76),(.35,.82)],24),it.palette['brown'])
 box(it,'body',(0,-.369,.79),(.15,.035,.09),'gold');box(it,'body',(0,-.395,.79),(.10,.02,.052),'black')
 for j in range(3):ell(it,'body',(.07,-.38,.89+j*.073),(.018,.012,.018),'gold',8,4)
 # Curved panels built with the common lathe helper; wide red silhouette and raised fold ribs.
 it.add('body',W.lathe([(.82,.21),(.77,.43),(.61,.79),(.40,1.14)],28,arc=(0,math.pi),mod=lambda a,z:1+.06*math.cos(a*7)),it.palette['red'])
 for j in range(9):
  a=.12+j*(math.pi-.24)/8
  line(it,'body',[(r*math.cos(a),r*math.sin(a)+.02,z) for r,z in [(.4,1.12),(.60,.81),(.77,.44),(.82,.23+.04*math.sin(a*5))]],.015,'scarlet' if j%2 else 'shadow',6)
 for s in [-1,1]:
  plane(it,'body',[(-.13,0),(.13,0),(.21,.28),(-.15,.19)],(s*.29,-.07,1.12),'red',.055)
  line(it,'body',[(s*.40,-.09,1.15),(s*.48,-.07,1.38)],.012,'scarlet',6)
 # Eye-like green amulet in a gold frame and chain, facing the camera.
 line(it,'body',[(-.20,-.31,1.13),(-.12,-.40,1.02),(0,-.445,.96),(.12,-.4,1.02),(.20,-.31,1.13)],.012,'gold',6)
 ell(it,'body',(0,-.447,1.01),(.115,.043,.12),'gold',16,8)
 ell(it,'body',(0,-.484,1.01),(.080,.026,.084),'green',16,8)
 ell(it,'body',(-.025,-.508,1.045),(.019,.009,.024),'white',8,4)
 for s,p in [(-1,'arm-left'),(1,'arm-right')]:
  line(it,p,[(s*.37,0,1.06),(s*.48,-.015,.86),(s*.48,-.05,.67)],[.16,.145,.13],'navy',12)
  for z in [.71,.75]:line(it,p,[(s*.36,-.15,z),(s*.46,-.19,z),(s*.58,-.14,z)],.008,'gold',5)
  ell(it,p,(s*.48,-.035,.58),(.108,.11,.13),'skin',12,7)
  line(it,p,[(s*.54,-.13,.65),(s*.57,-.15,.58)],.032,'skin',8)
 for s,p in [(-1,'leg-left'),(1,'leg-right')]:
  ell(it,p,(s*.18,0,.32),(.14,.15,.20),'navy',12,6)
  ell(it,p,(s*.19,-.08,.13),(.18,.25,.13),'black',14,7)
  box(it,p,(s*.19,-.10,.045),(.35,.46,.05),'brown',.025)
  line(it,p,[(s*.19-.14,-.24,.08),(s*.19,-.32,.07),(s*.19+.14,-.24,.08)],.009,'gold',6)
 return it

def main():
 reset_scene();it=sorcerer();e=W.realise(it);objects=[e['empty']]+[o for _,o in e['pieces']]
 size=export_glb(objects,os.path.join(ROOT,'public/assets/models/sorcerer.glb'))
 manifest={'file':'public/assets/models/sorcerer.glb','bytes':size,'models':{it.id:{'triangles':sum(W.mesh_tris(o) for _,o in e['pieces']),'parts':[p for p,_ in e['pieces']]}}}
 with open(os.path.join(ROOT,'art/sorcerer-manifest.json'),'w') as f:json.dump(manifest,f,indent=2);f.write('\n')
 F.cpu_stage((640,800));bpy.context.scene.cycles.samples=24
 ground=bpy.data.objects.get('Preview ground')
 if ground:
  m=ground.data.materials[0];m.diffuse_color=(.65,.75,.84,1);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.65,.75,.84,1)
 F.camera([o for _,o in e['pieces']],8,1.18);render(os.path.join(ROOT,'art/previews/kit/dz_sorcerer.webp'))
 bpy.context.scene.render.resolution_x=160;bpy.context.scene.render.resolution_y=160;bpy.context.scene.render.film_transparent=True;render(os.path.join(ROOT,'public/assets/icons/items/dz_sorcerer.webp'))
 print(json.dumps(manifest))
if __name__=='__main__':main()
