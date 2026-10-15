"""Three toy-toon ink models from the supplied references: painter, brush and Chinese ink dragon.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_ink_painter.py
"""
import bpy,os,sys,math,json
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
import build_wear as W
import build_festival_gear as F
from style import reset_scene,export_glb,render
ROOT=F.ROOT
C={'ink':'#111419','coal':'#282C32','cloth':'#555960','fold':'#3A3F46','seam':'#92969A','paper':'#DADBD7','skin':'#CACBC7','white':'#F0F0EA','iris':'#717A80','dark':'#090C10','wood':'#45403B','metal':'#898B87'}
ell=F.ell;line=F.line;box=F.box;plane=F.plane

def item(id,kind):
 W.KIND[id]=kind;it=W.Item(id);it.palette={k:it.m(k,v,rough=.8) for k,v in C.items()};return it

def brush_geometry(it,p,c=(0,0,0),s=1):
 def at(x,y,z):return(c[0]+x*s,c[1]+y*s,c[2]+z*s)
 line(it,p,[at(0,0,.08),at(0,0,.95)],[.052*s,.066*s],'wood',12)
 for z in [.12,.17,.89,.94]:
  it.add(p,W.torus(.067*s,.009*s,16,5).xf(W.xf(loc=at(0,0,z))),it.palette['metal'])
 ell(it,p,at(0,0,1.02),(.09*s,.09*s,.16*s),'ink',14,7)
 for j in range(12):
  a=j*math.tau/12;r=.05
  line(it,p,[at(math.cos(a)*r,math.sin(a)*r,1.01),at(math.cos(a)*.11,math.sin(a)*.11,1.17),at(-.035+math.cos(a)*.045,math.sin(a)*.045,1.40),at(-.07,0,1.60)],[.026*s,.032*s,.018*s,.001*s],'coal' if j%3 else 'seam',7)
 for j in range(3):
  a=j*2.4;ell(it,p,at(.10*math.cos(a),-.075,.94-j*.13),(.024*s,.018*s,.056*s),'dark',8,5)
 line(it,p,[at(0,0,.09),at(.025,0,.035),at(-.025,0,.01)],.018*s,'ink',6)

def painter():
 it=item('dz_ink_painter','disguise')
 ell(it,'head',(0,-.02,1.62),(.58,.52,.57),'skin',24,12)
 for side in [-1,1]:
  ell(it,'head',(side*.57,-.02,1.62),(.11,.10,.16),'skin',12,6)
  x=side*.22
  ell(it,'head',(x,-.505,1.65),(.17,.044,.20),'fold',16,8)
  ell(it,'head',(x,-.54,1.647),(.14,.03,.16),'paper',16,8)
  ell(it,'head',(x,-.565,1.65),(.105,.02,.13),'iris',16,8)
  ell(it,'head',(x,-.583,1.665),(.065,.014,.09),'dark',14,7)
  ell(it,'head',(x-side*.03,-.595,1.72),(.028,.009,.03),'white',8,5)
  line(it,'head',[(side*.08,-.52,1.85),(side*.22,-.52,1.91),(side*.38,-.42,1.89)],.036,'ink',8)
  for j in range(4):ell(it,'head',(side*(.33+j*.024),-.475+j*.018,1.48+(j%2)*.04),(.012,.009,.018),'fold',7,4)
 line(it,'head',[(-.065,-.54,1.405),(0,-.555,1.42),(.065,-.54,1.405)],.01,'fold',6)
 ell(it,'head',(0,-.548,1.51),(.05,.03,.046),'skin',12,6)
 # Swept black hair below a folded, wrapped scholar cap.
 for j in range(8):
  line(it,'head',[(.35-j*.09,-.22,2.13),(.28-j*.105,-.49,2.02),(.11-j*.10,-.54,1.87+j*.012)],[.09,.1,.002],'ink',8)
 ell(it,'head',(0,.04,2.13),(.64,.54,.36),'cloth',24,10)
 for j in range(3):
  it.add('head',W.lathe([(.64,1.94+j*.085),(.65,1.99+j*.085)],28,cap_top=False,cap_bottom=False).xf(W.xf(scale=(1,.84,1))),it.palette['fold' if j%2 else 'cloth'])
 for side in [-1,1]:
  plane(it,'head',[(-.14,-.04),(.12,-.05),(.18,.19),(.07,.24),(-.13,.17)],(side*.32,.02,2.31),'cloth',.16)
  line(it,'head',[(side*.42,-.12,2.45),(side*.31,-.18,2.29)],.014,'fold',6)
 # Closed wrap-front robe, wide sleeves, split hem and curling cloud embroidery.
 it.add('body',W.lathe([(.48,.24),(.50,.33),(.44,.58),(.37,.90),(.36,1.13)],24,cap_top=True,cap_bottom=True),it.palette['cloth'])
 for side in [-1,1]:
  plane(it,'body',[(-.18,.31),(.17,.34),(.21,-.34),(-.23,-.34)],(side*.24,-.34,.59),'cloth',.025)
  line(it,'body',[(side*.29,-.24,1.12),(side*.12,-.38,.92),(side*.29,-.4,.28)],.012,'ink',6)
  for j in range(4):
   x=side*(.08+j*.10);pts=[]
   for k in range(22):
    a=k*.3;r=.045*(1-k/29);pts.append((x+math.cos(a)*r,-.455,.32+math.sin(a)*r))
   line(it,'body',pts,.006,'fold',5)
 for j in range(3):
  x=-.12+j*.075;z=.95-j*.065;line(it,'body',[(x-.04,-.405,z),(x+.045,-.405,z+.014)],.013,'ink',6)
 # Painted ink spatters: actual small patches on the garment, not a full grey recolour.
 for j in range(28):
  x=math.sin(j*2.4)*.39;z=.34+(j%11)*.061;y=-math.sqrt(max(.02,.44**2-x*x))-.025
  ell(it,'body',(x,y,z),(.012+(j%3)*.009,.007,.014+(j%4)*.01),'ink',7,4)
 for side,p in [(-1,'arm-left'),(1,'arm-right')]:
  line(it,p,[(side*.37,0,1.06),(side*.52,-.01,.81),(side*.53,-.04,.56)],[.16,.20,.19],'cloth',12)
  line(it,p,[(side*.37,-.13,.59),(side*.53,-.22,.57),(side*.68,-.13,.59)],.013,'ink',6)
  ell(it,p,(side*.53,-.02,.48),(.11,.10,.12),'skin',12,6)
 for side,p in [(-1,'leg-left'),(1,'leg-right')]:
  ell(it,p,(side*.18,0,.30),(.16,.16,.20),'fold',12,6)
  ell(it,p,(side*.19,-.09,.12),(.18,.26,.12),'ink',14,7)
  box(it,p,(side*.19,-.1,.035),(.35,.45,.045),'coal',.015)
 # The costume carries its own brush; the flying skill uses the separate prop below.
 brush_geometry(it,'arm-right',(.53,-.14,.06),.84)
 return it

def brush():
 it=item('ink_brush','prop');brush_geometry(it,'body');return it

def dragon():
 it=item('ink_dragon','prop');p='body'
 path=[]
 for j in range(43):
  t=j/42;path.append((math.sin(t*math.pi*2)*(.68-.28*t),.09*math.cos(t*math.pi*3),1.8-1.65*t))
 radii=[.18*(1-j/50)**.8 if j<38 else .10*(42-j)/4+.003 for j in range(43)]
 line(it,p,path,radii,'coal',12)
 for j in range(2,39):
  x,y,z=path[j];r=radii[j]
  ell(it,p,(x,y-r*.68,z),(r*.82,r*.40,.045),'paper' if j%3 else 'seam',10,5)
  # Three overlapping rows of scales and a calligraphic dorsal mane.
  for side in [-1,1]:ell(it,p,(x+side*r*.7,y,z),(.065,.055,.043),'cloth' if j%2 else 'fold',8,4)
  if j%2==0:line(it,p,[(x,y+r*.6,z),(x-.10,y+r*1.3,z+.07),(x-.15,y+r*1.5,z+.17)],[.045,.032,.001],'ink',7)
 # A snarling long muzzle, brows, white fangs, beard and antler horns.
 x,y,z=path[0];ell(it,p,(x,-.02,z+.05),(.27,.22,.22),'cloth',16,8)
 ell(it,p,(x,-.22,z-.02),(.22,.19,.12),'coal',16,7)
 ell(it,p,(x,-.27,z-.105),(.19,.14,.047),'dark',14,6)
 for side in [-1,1]:
  ell(it,p,(x+side*.15,-.18,z+.1),(.09,.045,.065),'white',12,6)
  ell(it,p,(x+side*.15,-.215,z+.1),(.029,.015,.042),'dark',8,5)
  line(it,p,[(x+side*.05,-.18,z+.19),(x+side*.15,-.20,z+.20),(x+side*.29,-.08,z+.22)],.035,'ink',7)
  for j in range(3):line(it,p,[(x+side*(.07+j*.04),-.32,z-.07),(x+side*(.07+j*.04),-.32,z-.14)],[.024,.002],'white',7)
  line(it,p,[(x+side*.18,.02,z+.19),(x+side*.28,.06,z+.39),(x+side*.22,.03,z+.58)],[.06,.035,.003],'paper',9)
  line(it,p,[(x+side*.26,.05,z+.35),(x+side*.40,.08,z+.43),(x+side*.43,.05,z+.53)],[.03,.02,.002],'paper',7)
  line(it,p,[(x+side*.18,-.28,z-.01),(x+side*.45,-.32,z+.03),(x+side*.65,-.24,z+.22),(x+side*.70,-.12,z+.41)],[.014,.012,.008,.001],'seam',6)
  for j in range(4):line(it,p,[(x+side*.22,.02,z+.1-j*.05),(x+side*(.38+j*.035),.05,z+.22-j*.03),(x+side*.49,.08,z+.30-j*.025)],[.05,.035,.001],'ink',7)
 for j in range(4):line(it,p,[(x+(j-1.5)*.05,-.19,z-.13),(x+(j-1.5)*.08,-.18,z-.35)],[.035,.001],'ink',7)
 # Four bent limbs with three individually tapered claws each.
 for index,side in [(8,-1),(12,1),(25,-1),(29,1)]:
  x,y,z=path[index];k=side
  line(it,p,[(x,y,z),(x+k*.27,y-.05,z-.05),(x+k*.32,y-.2,z-.18)],[.09,.075,.05],'coal',9)
  for toe in range(3):line(it,p,[(x+k*.32,y-.2,z-.18),(x+k*(.43+toe*.025),y-.28+toe*.07,z-.20),(x+k*(.45+toe*.025),y-.30+toe*.07,z-.29)],[.035,.022,.001],'paper' if toe==1 else 'ink',7)
 return it

def main():
 reset_scene();entries={};objects=[]
 for build in [painter,brush,dragon]:
  it=build();e=W.realise(it);entries[it.id]=e;objects.extend([e['empty']]+[o for _,o in e['pieces']])
 size=export_glb(objects,os.path.join(ROOT,'public/assets/models/ink-painter.glb'))
 manifest={'file':'public/assets/models/ink-painter.glb','bytes':size,'models':{id:{'triangles':sum(W.mesh_tris(o) for _,o in e['pieces']),'parts':[p for p,_ in e['pieces']],'skillOnly':not id.startswith('dz_')} for id,e in entries.items()}}
 with open(os.path.join(ROOT,'art/ink-painter-manifest.json'),'w') as f:json.dump(manifest,f,indent=2);f.write('\n')
 for o in objects:o.hide_render=True
 for id,e in entries.items():
  shown=[o for _,o in e['pieces']]
  for o in [e['empty']]+shown:o.hide_render=False
  F.cpu_stage((640,800));bpy.context.scene.cycles.samples=24
  g=bpy.data.objects.get('Preview ground')
  if g:
   m=g.data.materials[0];m.diffuse_color=(.65,.75,.84,1);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.65,.75,.84,1)
  F.camera(shown,8,1.18);render(os.path.join(ROOT,'art/previews/kit',id+'.webp'))
  if id.startswith('dz_'):
   bpy.context.scene.render.resolution_x=160;bpy.context.scene.render.resolution_y=160;bpy.context.scene.render.film_transparent=True;render(os.path.join(ROOT,'public/assets/icons/items',id+'.webp'))
  for o in [e['empty']]+shown:o.hide_render=True
 print(json.dumps(manifest))
if __name__=='__main__':main()
