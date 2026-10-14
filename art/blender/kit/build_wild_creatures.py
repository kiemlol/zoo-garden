"""Mosslug, rolling pangolin, four loot models and their exact-mesh icons.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_wild_creatures.py
"""
import bpy,os,sys,math,json
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,HERE)
from style import mat,reset_scene,export_glb,studio,game_camera,render
from build_weapons import Piece,sphere,tube,add_eye,new_empty,triangulate
ROOT=os.path.normpath(os.path.join(HERE,'../../..'))
M={};roots={};objects=[]
def ell(p,c,r,m,seg=10,rings=5):p.add(sphere(1,seg,rings,scale=r).moved(c),M[m])
def line(p,points,r,m,sides=7):p.add(tube(points,[r]*len(points),sides=sides,cap=0),M[m])
def part(root,role,make):
 p=Piece(root.name+'_'+role);make(p);obj=triangulate(p.build());obj.parent=root;objects.append(obj);return obj
def root(name):
 node=new_empty(name);roots[name]=node;objects.append(node);return node
def shell(p,small=False):
 c=(0,.14,.81) if not small else (0,0,.32);r=(.55,.55,.62) if not small else (.28,.22,.3)
 ell(p,c,r,'bark',12,6)
 # A raised spiral on both cheeks makes the silhouette read as a snail, not a turtle.
 for side in (-1,1):
  pts=[]
  for i in range(22):
   t=i/21;angle=t*math.pi*3.8;radius=(.38 if not small else .18)*(1-t)+.025
   pts.append((side*r[0]*.94,c[1]+math.cos(angle)*radius,c[2]+math.sin(angle)*radius))
  line(p,pts,.028 if small else .045,'cream',6)
 for i in range(8 if not small else 5):
  a=i*2.399;ell(p,(math.cos(a)*r[0]*.6,c[1]+math.sin(a)*r[1]*.65,c[2]+r[2]*.78),(.11 if small else .2,.1 if small else .19,.045 if small else .08),'moss' if i%2 else 'leaf',8,4)
 if not small:
  line(p,[(.13,.14,1.30),(.18,.1,1.55)],.025,'leaf',5)
  ell(p,(.28,.1,1.50),(.14,.055,.065),'leaf',8,4)
def snail():
 n=root('mosslug')
 part(n,'body',lambda p:(ell(p,(0,-.06,.24),(.63,.93,.25),'sage',14,6),ell(p,(0,-.45,.27),(.48,.55,.25),'cream',10,5)))
 def head(p):
  ell(p,(0,-.64,.55),(.45,.40,.40),'sage',12,6)
  for side in (-1,1):
   line(p,[(side*.23,-.74,.71),(side*.29,-.78,1.09)],.075,'sage')
   ell(p,(side*.29,-.78,1.15),(.16,.14,.16),'cream',10,5)
   add_eye(p,(side*.29,-.919,1.16),(0,-1,0),.10,M['eye'],M['white'],segs=8)
   ell(p,(side*.30,-.99,.53),(.09,.024,.05),'rose',8,4)
  line(p,[(-.12,-1.012,.55),(0,-1.035,.50),(.12,-1.012,.55)],.025,'eye',5)
 part(n,'head',head);part(n,'shell',shell)
def scales(p,c,r,rows=4):
 ell(p,c,r,'dark',10,5)
 # Shingled raised plates, warm terracotta with glowing seams between them.
 for j in range(rows):
  y=c[1]+(j/(rows-1)-.5)*r[1]*1.55
  for i in range(5):
   a=(i-2)*.54;rr=math.sqrt(max(.1,1-((y-c[1])/r[1])**2))
   ell(p,(math.sin(a)*r[0]*rr,y,c[2]+math.cos(a)*r[2]*rr),(.16,.21,.085),'scale' if (i+j)%2 else 'sand',6,3)
def pangolin():
 n=root('pangolin')
 part(n,'body',lambda p:(scales(p,(0,.12,.70),(.48,.68,.46)),line(p,[(0,.58,.55),(0,1.04,.35),(0,1.4,.12)],[.1][0],'scale',7)))
 def head(p):
  ell(p,(0,-.54,.73),(.32,.37,.29),'sand',10,5);ell(p,(0,-.87,.62),(.16,.24,.14),'cream',8,4);ell(p,(0,-1.09,.64),(.07,.055,.05),'eye',8,4)
  for side in (-1,1):
   add_eye(p,(side*.24,-.73,.82),(side*.5,-.85,.15),.095,M['eye'],M['white'],segs=8)
   ell(p,(side*.29,-.49,.98),(.10,.085,.10),'scale',8,4)
 part(n,'head',head)
 for role,x,y in [('leg_fl',-.37,-.34),('leg_fr',.37,-.34),('leg_bl',-.34,.48),('leg_br',.34,.48)]:
  def leg(p,x=x,y=y):
   ell(p,(x,y,.27),(.16,.20,.26),'sand',8,4)
   for k in (-1,0,1):line(p,[(x+k*.065,y-.12,.10),(x+k*.065,y-.29,.065)],.035,'cream',5)
  obj=part(n,role,leg)
  # Preserve actual hinge coordinates while keeping world geometry unchanged.
  pivot=Vector((x,y,.45));
  for v in obj.data.vertices:v.co-=pivot
  obj.location=pivot
 ball=part(n,'rolled',lambda p:scales(p,(0,0,.66),(.63,.64,.64),5))
 for v in ball.data.vertices:v.co.z-=.66
 ball.location.z=.66
 # Export rolled parts but hide them from standing previews/icons.
 n.children[-1].hide_render=True

def loot():
 n=root('rainbow_slime')
 def slime(p):
  for i,col in enumerate(['rose','orange','yellow','leaf','aqua','violet']):
   a=i*math.tau/6;ell(p,(math.cos(a)*.12,math.sin(a)*.12,.12),(.16,.13,.12),col,8,4)
  ell(p,(0,0,.26),(.18,.16,.22),'aqua',10,5);ell(p,(-.06,-.12,.33),(.035,.025,.06),'white',6,3)
 part(n,'body',slime)
 n=root('moss_shell');part(n,'body',lambda p:shell(p,True))
 n=root('lava_scale')
 def plate(p):
  ell(p,(0,0,.23),(.24,.14,.27),'orange',6,3)
  ell(p,(0,-.045,.27),(.21,.14,.24),'scale',6,3)
  line(p,[(-.12,-.16,.15),(0,-.18,.35),(.12,-.16,.15)],.025,'yellow',5)
 part(n,'body',plate)
 n=root('rolling_shell');part(n,'body',lambda p:scales(p,(0,0,.31),(.29,.3,.29),3))

def main():
 reset_scene()
 colors=dict(sage='#97C982',cream='#FFF1C8',moss='#4A8548',leaf='#70B74D',bark='#9E794E',eye='#302D3D',white='#FFFFFF',rose='#F58CB2',dark='#644438',scale='#B77346',sand='#E4AD6E',orange='#FC9252',yellow='#FFD578',aqua='#7BDDD0',violet='#AA91DD')
 M.update({k:mat('Wild '+k,c,.5) for k,c in colors.items()})
 snail();pangolin();loot()
 for o in objects:o.hide_render=False
 size=export_glb(objects,os.path.join(ROOT,'public/assets/models/wild-creatures.glb'))
 manifest={'file':'public/assets/models/wild-creatures.glb','bytes':size,'models':{}}
 for name,n in roots.items():
  tris=sum(len(o.data.polygons) for o in n.children_recursive if o.type=='MESH');assert tris<=2500,(name,tris)
  manifest['models'][name]={'triangles':tris,'parts':[o.name for o in n.children]}
 with open(os.path.join(ROOT,'art/wild-creatures-manifest.json'),'w') as f:json.dump(manifest,f,indent=2);f.write('\n')
 studio(size=(160,160),transparent=True);bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=24;bpy.context.scene.cycles.use_denoising=False
 for o in objects:o.hide_render=True
 for name in ['rainbow_slime','moss_shell','lava_scale','rolling_shell']:
  n=roots[name]
  for o in [n]+list(n.children_recursive):o.hide_render=False
  game_camera(target=(0,0,.25),ortho_scale=.85)
  render(os.path.join(ROOT,'public/assets/icons/items',name+'.webp'))
  for o in [n]+list(n.children_recursive):o.hide_render=True
 for name in ['mosslug','pangolin']:
  n=roots[name]
  for o in [n]+list(n.children_recursive):o.hide_render=False
  if name=='pangolin':n.children[-1].hide_render=True
  studio(size=(800,650));bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=32;bpy.context.scene.cycles.use_denoising=False;game_camera(target=(0,0,.65),ortho_scale=3.2)
  render(os.path.join(ROOT,'art/previews/kit',name+'.webp'))
  for o in [n]+list(n.children_recursive):o.hide_render=True
 print(json.dumps(manifest))
if __name__=='__main__':main()
