"""Original toy-toon pumpkin witch, Flex set and ghost carriage from supplied screenshots.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_festival_gear.py
No textures: wearable parts follow hero_spec pivots and @part tags.
"""
import bpy,sys,os,math,json
from mathutils import Vector,Matrix
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
import build_wear as W
from style import reset_scene,export_glb,studio,render
ROOT=os.path.normpath(os.path.join(HERE,'../../..'));entries={}
COLORS={'black':'#23232B','ink':'#101C23','orange':'#F68C43','lightorange':'#FFB068','white':'#FFF8E7','gold':'#EFB94D','blond':'#FFE477','red':'#B9243B','scarlet':'#E0444D','navy':'#263446','navylight':'#3B4A5E','teal':'#6EB8B5','violet':'#BFB2DA','cyan':'#A8FFF1','ghost':'#EDF9EF'}
def item(id,kind):
 W.KIND[id]=kind;it=W.Item(id);it.palette={k:it.m(k,v) for k,v in COLORS.items()};return it

def ell(it,part,c,r,col,segs=12,rings=6):it.add(part,W.ellipsoid(c,r,segs,rings),it.palette[col])
def box(it,part,c,size,col,bevel=.015):it.add(part,W.rbox(tuple(v/2 for v in size),bevel,c,segs=8),it.palette[col])
def line(it,part,path,r,col,sides=6):it.add(part,W.tube(path,r,sides,cap_start=True,cap_end=True),it.palette[col])
def plane(it,part,outline,c,col,depth=.015):
 # XY polygon turned upright into XZ; its front faces the explorer's -Y.
 it.add(part,W.prism(outline,depth).xf(W.xf(loc=c,rot=(90,0,0))),it.palette[col])
def pumpkin(it,part,c,r=.07):
 for i in range(5):
  a=i*math.tau/5;ell(it,part,(c[0]+math.cos(a)*r*.32,c[1]+math.sin(a)*r*.20,c[2]),(r*.54,r*.45,r*.85),'orange',8,4)
 line(it,part,[(c[0],c[1],c[2]+r*.75),(c[0]+r*.15,c[1],c[2]+r*1.1)],r*.16,'gold',5)
 for sx in [-1,1]:plane(it,part,[(-.018,-.01),(.018,-.01),(0,.017)],(c[0]+sx*r*.3,c[1]-r*.45,c[2]+r*.05),'black')
 plane(it,part,[(-r*.42,0),(-r*.22,-r*.25),(0,-r*.13),(r*.22,-r*.25),(r*.42,0)],(c[0],c[1]-r*.5,c[2]-r*.22),'black')
def bow(it,part,c,size,col):
 for sx in [-1,1]:ell(it,part,(c[0]+sx*size*.65,c[1],c[2]),(size*.65,size*.22,size*.42),col,8,4)
 ell(it,part,c,(size*.23,size*.27,size*.27),col,8,4)
def hair_cap(it,split=False):
 # Open lower face; the cap overlays the explorer's existing hair, with a crisp centre split.
 profile=[(0,2.29),(.32,2.25),(.54,2.1),(.63,1.94),(.635,1.82)]
 for side in [-1,1]:
  color='orange' if split and side>0 else 'black' if split else 'blond'
  geo=W.lathe(profile,12,cap_top=True,arc=(-math.pi/2 if side>0 else math.pi/2, math.pi/2 if side>0 else 3*math.pi/2))
  it.add('head',geo,it.palette[color])
  # Forehead bangs are individual tapered locks, not a single straight slab.
  for i in range(5):
   x=side*(.055+i*.104);y=-math.sqrt(max(.08,.64**2-x*x))
   plane(it,'head',[(-.075,.18),(.075,.18),(.060,-.03),(.017,-.115),(-.04,-.07)],(x,y-.016,1.92),color,.08)
def hair_pumpkin():
 it=item('hair_pumpkin','hat');hair_cap(it,True)
 for side in [-1,1]:
  col='black' if side<0 else 'orange'
  # Long softly pointed side locks and a braid on the orange side.
  for j in range(3):
   line(it,'head',[(side*(.5+j*.045),.10-j*.15,1.95),(side*(.62+j*.035),.08-j*.12,1.65),(side*(.64+j*.025),-.04-j*.1,1.37),(side*(.59+j*.02),-.04-j*.1,1.10),(side*(.64+j*.02),-.04-j*.1,1.03)],[.075,.10,.085,.06,.008],col,8)
  if side>0:
   for j in range(5):ell(it,'head',(.55+(.025 if j%2 else -.025),-.37,1.66-j*.13),(.075,.075,.11),'orange',8,4)
   bow(it,'head',(.55,-.40,1.0),.085,'black')
 # Black braided headband over the crown with tiny pumpkin ornaments.
 for i in range(13):
  a=-math.pi/2+i*math.pi/12;ell(it,'head',(.62*math.sin(a),.02,1.85+.43*math.cos(a)),(.065,.06,.05),'black',8,4)
 pumpkin(it,'head',(-.59,-.05,1.91),.06);pumpkin(it,'head',(.59,-.05,1.91),.06)
 # Pumpkin patch and thin diagonal strap on the character's right eye.
 pumpkin(it,'head',(.22,-.565,1.64),.125)
 line(it,'head',[(-.43,-.40,1.97),(.24,-.58,1.68),(.50,-.34,1.51)],.016,'black',5)
 return it

def dress_pumpkin():
 it=item('dress_pumpkin','outfit')
 # Corset above an orange pleated A-line skirt; both clear the base torso envelope.
 it.add('body',W.lathe([(.44,.54),(.37,.86),(.36,1.15)],16,cap_bottom=True,cap_top=True),it.palette['black'])
 it.add('body',W.lathe([(.61,.24),(.57,.30),(.49,.48),(.43,.58)],20,mod=lambda a,z:1+.03*math.cos(a*10),cap_bottom=True,cap_top=True),it.palette['orange'])
 for i in range(10):
  a=i*math.tau/10;line(it,'body',[(math.cos(a)*.44,math.sin(a)*.44,.54),(math.cos(a)*.58,math.sin(a)*.58,.28)],.014,'lightorange',5)
 for i in range(16):
  a=i*math.tau/16;ell(it,'body',(.58*math.cos(a),.58*math.sin(a),.26),(.05,.04,.035),'black',6,3)
 # Tailored white collar, huge white bow, tiny central pumpkin.
 for side in [-1,1]:
  plane(it,'body',[(-.12,.08),(.13,.06),(.10,-.12),(-.05,-.16)],(side*.17,-.33,1.10),'white',.04)
  plane(it,'body',[(0,.11),(side*.19,.04),(side*.14,-.09),(0,-.06)],(side*.07,-.385,1.07),'white',.035)
 pumpkin(it,'body',(0,-.412,1.08),.065)
 for z in [.94,.84,.74]:ell(it,'body',(0,-.397,z),(.027,.024,.027),'white',6,3)
 # Overlapping black coat-tails, orange seams, cross motifs near the hem.
 for side in [-1,1]:
  plane(it,'body',[(-.16,.15),(.16,.15),(.14,-.16),(0,-.25),(-.16,-.16)],(side*.26,-.48,.58),'black',.035)
  line(it,'body',[(side*.15,-.51,.42),(side*.35,-.51,.3)],.016,'black',5)
  for z in [.39,.33]:line(it,'body',[(side*.24-.04,-.55,z),(side*.24+.04,-.55,z)],.012,'black',4)
  line(it,'body',[(side*.24,-.55,.43),(side*.24,-.55,.29)],.012,'black',4)
  part='arm-left' if side<0 else 'arm-right';ell(it,part,(side*.39,0,.99),(.145,.155,.155),'orange',10,5);box(it,part,(side*.39,-.01,.80),(.23,.25,.07),'white')
 return it

def shoes(id,flex=False):
 it=item(id,'boots')
 for side,part in [(-1,'leg-left'),(1,'leg-right')]:
  x=side*.18
  box(it,part,(x,-.09,.075),(.35,.47,.15),'black',.035)
  box(it,part,(x,-.105,.15),(.32,.46,.06),'white' if flex else 'black',.02)
  ell(it,part,(x,-.09,.23),(.17,.24,.15),'white' if flex else 'black',10,5)
  if flex:
   box(it,part,(x,.015,.29),(.26,.24,.24),'red',.02);plane(it,part,[(-.13,.045),(.13,.045),(.10,-.045),(-.10,-.045)],(x,-.32,.21),'red',.025);box(it,part,(x,-.31,.32),(.15,.065,.20),'black')
   for j in range(3):line(it,part,[(x-.065,-.347,.23+j*.045),(x+.065,-.347,.25+j*.045)],.012,'white',5)
   for sx in [-1,1]:plane(it,part,[(-.07,0),(.055,.035),(.09,.01),(-.03,-.02)],(x+sx*.16,-.10,.25),'red',.015)
   ell(it,part,(x,.015,.42),(.115,.13,.035),'gold',10,4)
  else:
   box(it,part,(x,-.02,.34),(.24,.22,.065),'orange');bow(it,part,(x,-.345,.27),.10,'orange')
   for j in range(5):ell(it,part,(x+math.cos(j*math.tau/5)*.12,math.sin(j*math.tau/5)*.12,.34),(.035,.035,.025),'orange',6,3)
 return it

def hair_flex():
 it=item('hair_flex','hat');hair_cap(it)
 # Golden sideburns cover the base hair at the temples.
 for side in [-1,1]:line(it,'head',[(side*.53,-.16,1.97),(side*.56,-.16,1.53)],.095,'blond',7)
 # Swept irregular triangular locks around a high golden crest.
 for i in range(14):
  a=i*math.tau/14;c=(math.cos(a)*.46,math.sin(a)*.38,2.16)
  it.add('head',W.lathe([(.095,0),(.085,.14),(0,.28)],6,cap_bottom=True).xf(W.xf(loc=c,rot=(14*math.sin(a),35,0))),it.palette['gold' if i%4==0 else 'blond'])
 for i in range(5):line(it,'head',[(-.4+i*.16,-.25,2.12),(-.25+i*.16,-.28,2.30)],.045,'blond',6)
 return it

def glasses_flex():
 it=item('glasses_flex','hat')
 for side in [-1,1]:
  x=side*.245
  box(it,'head',(x,-.566,1.66),(.465,.065,.245),'gold',.028)
  box(it,'head',(x,-.607,1.65),(.42,.025,.20),'ink',.018)
  line(it,'head',[(x-.10,-.628,1.74),(x-.10,-.628,1.58)],.012,'teal',5)
  line(it,'head',[(side*.45,-.54,1.74),(side*.57,-.36,1.72),(side*.58,.07,1.70)],.025,'gold',6)
 box(it,'head',(0,-.59,1.7),(.065,.08,.05),'gold')
 return it

def outfit_flex():
 it=item('outfit_flex','outfit')
 it.add('body',W.lathe([(.44,.53),(.40,.82),(.35,1.15)],16,cap_bottom=True,cap_top=True),it.palette['white'])
 # Jacket closure, folded collar and angular black/silver details.
 line(it,'body',[(0,-.445,.54),(0,-.37,1.15)],.018,'black',5)
 for side in [-1,1]:
  plane(it,'body',[(-.09,.09),(.10,.08),(.035,-.15)],(side*.17,-.345,1.10),'white',.05)
  plane(it,'body',[(-.04,.08),(.04,.05),(-.01,-.01),(.03,-.10),(-.06,-.03)],(side*.28,-.36,.90),'navylight')
  part='arm-left' if side<0 else 'arm-right';line(it,part,[(side*.40,0,1.08),(side*.40,0,.76)],.14,'white',8);box(it,part,(side*.4,-.008,.765),(.26,.26,.06),'gold')
  line(it,part,[(side*.4,-.143,1.01),(side*.4,-.143,.81)],.015,'black',5)
  leg='leg-left' if side<0 else 'leg-right'
  ell(it,leg,(side*.18,0,.43),(.185,.185,.26),'navy',10,5)
  box(it,leg,(side*.29,-.03,.45),(.12,.20,.18),'navylight',.015)
  line(it,leg,[(side*.22,-.17,.57),(side*.24,-.17,.34)],.012,'navylight',5)
 # Gold rope chain with a real dollar-shaped double-bar pendant.
 path=[(-.21,-.33,1.15),(-.15,-.4,.99),(0,-.445,.94),(.15,-.4,.99),(.21,-.33,1.15)]
 line(it,'body',path,.028,'gold',7)
 dollar=[(.055,-.466,.91),(-.045,-.466,.94),(-.080,-.466,.88),(-.02,-.466,.82),(.06,-.466,.79),(.075,-.466,.73),(.015,-.466,.69),(-.06,-.466,.72)]
 line(it,'body',dollar,.025,'gold',7)
 for x in [-.019,.019]:line(it,'body',[(x,-.48,.96),(x,-.48,.67)],.012,'gold',5)
 # Waist chain sits above pants and the red pocket bandana drapes to one side.
 line(it,'body',[(-.35,-.26,.57),(-.14,-.435,.50),(.10,-.46,.51),(.34,-.29,.57)],.025,'gold',6)
 plane(it,'body',[(-.11,.08),(.1,.07),(.13,-.14),(-.075,-.2),(-.16,-.07)],(-.20,-.445,.51),'red',.02)
 return it

def carriage():
 it=item('deco_ghost_carriage','decor');part='body'
 # Ornate open black chassis, a red velvet tufted two-seat bench, curved side wings.
 box(it,part,(0,.2,.54),(1.14,1.60,.13),'black',.04)
 box(it,part,(0,.35,.70),(1.05,1.12,.16),'red',.055)
 plane(it,part,[(-.55,-.5),(.55,-.5),(.55,.28),(.45,.48),(.3,.55),(0,.59),(-.3,.55),(-.45,.48),(-.55,.28)],(0,.87,1.18),'red',.18)
 for x in [-.43,-.22,0,.22,.43]:line(it,part,[(x,.754,.86),(x,.754,1.55)],.016,'scarlet',5)
 for x in [-.36,0,.36]:ell(it,part,(x,.74,1.08),(.04,.023,.04),'gold',8,4)
 for side in [-1,1]:
  box(it,part,(side*.57,.33,.98),(.16,1.2,.57),'black',.055)
  plane(it,part,[(-.38,-.18),(.38,-.18),(.43,.09),(.15,.2),(-.3,.12)],(side*.565,.25,1.10),'red',.045)
  # Bent axle/frame and shafts extending forward to the floating ghost.
  line(it,part,[(side*.45,.88,.41),(side*.48,-.32,.35),(side*.35,-1.65,.52)],.045,'black',7)
  for y,r,z in [( .58,.50,.52),(-.64,.29,.33)]:
   x=side*.73
   # Wheel is an actual torus plus nested cobweb rings and radial spokes in the YZ plane.
   it.add(part,W.torus(r,.033,20,6).xf(W.xf(loc=(x,y,z),rot=(0,90,0))),it.palette['black'])
   for f in [.38,.65,.86]:
    points=[(x,y+math.cos(i*math.tau/12)*r*f,z+math.sin(i*math.tau/12)*r*f) for i in range(13)]
    line(it,part,points,.009,'violet',4)
   for i in range(12):
    a=i*math.tau/12;line(it,part,[(x,y,z),(x,y+math.cos(a)*r,z+math.sin(a)*r)],.009,'violet',4)
   ell(it,part,(x,y,z),(.06,.065,.065),'black',8,4)
  # Two chunky cyan lanterns, black hats, stems and ribs.
  x=side*.49;y=-.32
  line(it,part,[(x,y,.78),(x,y,1.44)],.04,'black',7)
  ell(it,part,(x,y,1.36),(.19,.17,.24),'cyan',12,6)
  for i in range(4):
   a=i*math.tau/4;line(it,part,[(x+math.cos(a)*.13,y+math.sin(a)*.13,1.15),(x+math.cos(a)*.18,y+math.sin(a)*.18,1.36),(x+math.cos(a)*.13,y+math.sin(a)*.13,1.56)],.025,'black',5)
  ell(it,part,(x,y,1.57),(.22,.19,.06),'black',10,4);box(it,part,(x,y,1.63),(.20,.18,.11),'black')
 # The bat on the front red panel.
 box(it,part,(0,-.52,.89),(1.0,.09,.32),'red')
 bat=[(-.36,.07),(-.28,-.04),(-.16,.02),(-.12,-.09),(0,-.045),(.12,-.09),(.16,.02),(.28,-.04),(.36,.07),(.18,.035),(.12,.14),(.05,.07),(0,.11),(-.05,.07),(-.12,.14),(-.18,.035)]
 plane(it,part,bat,(0,-.578,.95),'black',.012)
 # White, scalloped ghost with expressive black eyes and moustache-like mouth, harness.
 ell(it,part,(0,-1.59,.75),(.34,.30,.63),'ghost',14,8)
 for i in range(8):
  a=i*math.tau/8;ell(it,part,(math.cos(a)*.25,-1.59+math.sin(a)*.23,.25),(.13,.11,.1),'ghost',8,4)
 for side in [-1,1]:
  ell(it,part,(side*.12,-1.86,.98),(.073,.032,.045),'black',8,4)
  plane(it,part,[(-.04,.045),(.04,-.015),(.04,.04)],(side*.12,-1.90,1.02),'black')
  ell(it,part,(side*.07,-1.90,.84),(.09,.027,.035),'black',8,4)
 ell(it,part,(0,-1.894,.78),(.06,.025,.04),'black',8,4)
 ring=[(.32*math.cos(i*math.tau/16),-1.59+.29*math.sin(i*math.tau/16),.57) for i in range(17)];line(it,part,ring,.035,'black',7)
 return it

def cpu_stage(size,transparent=False):
 for obj in list(bpy.data.objects):
  if obj.type in ['LIGHT','CAMERA'] or obj.name.startswith('Preview ground'):bpy.data.objects.remove(obj,do_unlink=True)
 studio(size=size,transparent=transparent);scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.cycles.device='CPU';scene.view_settings.exposure=-.45
 for o in bpy.data.objects:
  if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy*=.65

def camera(objects,elevation=18,margin=1.18):
 cam=W.icon_camera(objects,elevation,margin);return cam

def main():
 reset_scene();builders=[hair_pumpkin,dress_pumpkin,lambda:shoes('boots_pumpkin'),hair_flex,glasses_flex,outfit_flex,lambda:shoes('boots_flex',True),carriage];objects=[]
 for build in builders:
  it=build();e=W.realise(it);entries[it.id]=e;objects.extend([e['empty']]+[o for _,o in e['pieces']])
 size=export_glb(objects,os.path.join(ROOT,'public/assets/models/festival-gear.glb'))
 manifest={'file':'public/assets/models/festival-gear.glb','bytes':size,'models':{}}
 for id,e in entries.items():
  tris=sum(len(o.data.polygons) for _,o in e['pieces']);assert tris<10000,(id,tris)
  manifest['models'][id]={'triangles':tris,'parts':[p for p,_ in e['pieces']]}
 with open(os.path.join(ROOT,'art/festival-gear-manifest.json'),'w') as f:json.dump(manifest,f,indent=2);f.write('\n')
 cpu_stage((160,160),True)
 for o in objects:o.hide_render=True
 for id,e in entries.items():
  objs=[o for _,o in e['pieces']]
  for o in [e['empty']]+objs:o.hide_render=False
  if id=='deco_ghost_carriage':e['empty'].rotation_euler.z=math.radians(-30)
  camera(objs,20 if id=='deco_ghost_carriage' else 10,1.2)
  bpy.context.scene.render.image_settings.quality=85;render(os.path.join(ROOT,'public/assets/icons/items',id+'.webp'))
  for o in [e['empty']]+objs:o.hide_render=True
  e['empty'].rotation_euler.z=0
 # Render the actual base explorer in both outfits at a readable front three-quarter view.
 hero,_=W.load_hero()
 # Preview removes only original shirt faces, mirroring the runtime's separate shirt mesh.
 import bmesh
 for obj in hero:
  if obj.type!='MESH':continue
  slots={i for i,m in enumerate(obj.data.materials) if m and m.name.startswith('Hero shirt')}
  if slots:
   bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index in slots],context='FACES');bm.to_mesh(obj.data);bm.free()
 for label,ids in [('pumpkin-witch',['hair_pumpkin','dress_pumpkin','boots_pumpkin']),('flex-outfit',['hair_flex','glasses_flex','outfit_flex','boots_flex'])]:
  for o in hero:o.hide_render=o.name.startswith('head-leaf')
  shown=[]
  for id in ids:
   e=entries[id]
   for o in [e['empty']]+[o for _,o in e['pieces']]:o.hide_render=False;shown.append(o)
  cpu_stage((800,1000));camera([o for o in hero+shown if o.type=='MESH'],8,1.18);render(os.path.join(ROOT,'art/previews/kit',label+'.webp'))
  for o in hero+shown:o.hide_render=True
 e=entries['deco_ghost_carriage'];e['empty'].rotation_euler.z=math.radians(-30);shown=[o for _,o in e['pieces']]
 for o in [e['empty']]+shown:o.hide_render=False
 cpu_stage((1000,800));camera(shown,22,1.25);render(os.path.join(ROOT,'art/previews/kit/ghost-carriage.webp'))
 print(json.dumps(manifest))
if __name__=='__main__':main()
