"""Reference avatar revision: four anatomies, clean tank/shorts/sandals, original animated node/socket names.
Run: blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_avatar_models.py
Old file names are overwritten with the new geometry so existing saves and cached look ids remain valid.
The old hero_spec remains the AUTHORING space of existing gear; generated avatar-shapes.ts describes its retarget.
"""
import os,sys,json,math,shutil
HERE=os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:sys.path.insert(0,HERE)
import bpy
from mathutils import Vector,Matrix
import build_hero as B
from style import export_glb,reset_scene
PROFILES={
 'normal':dict(body=(0,1.04,0),head=(0,1.39,0),shoulder=.25,shoulderY=1.35,hip=.14,hipY=.78,tw=.58,th=.95,aw=.64,al=2.0,foot=.65),
 'long':dict(body=(0,1.69,0),head=(0,2.04,0),shoulder=.24,shoulderY=2.0,hip=.135,hipY=1.43,tw=.55,th=.95,aw=.58,al=3.2,foot=.65),
 'baby':dict(body=(0,.51,0),head=(0,.82,0),shoulder=.19,shoulderY=.75,hip=.12,hipY=.33,tw=.50,th=.67,aw=.61,al=.9,foot=.60),
 'sturdy':dict(body=(0,1.22,0),head=(0,1.73,0),shoulder=.56,shoulderY=1.68,hip=.17,hipY=.63,tw=1.45,th=1.55,aw=1.08,al=3.2,foot=.72),
}
HEAD=(.70,.76,.68)
AUTHOR={'body':(0,.85,0),'head':(0,1.12,0),'arm-left':(-.37,1.08,-.02),'arm-right':(.37,1.08,-.02),'leg-left':(-.18,.52,0),'leg-right':(.18,.52,0),'hand-left':(-.37,.72,.05),'hand-right':(.37,.72,.05)}
def arm_y(y,p):return y*p['al'] if y>=-.22 else -.22*p['al']+(y+.22)*.72

def data(p):
 pivots={**{k:list(p[k]) for k in ('body','head')},**{f'arm-{s}':[v*p['shoulder'],p['shoulderY'],-.02] for s,v in [('left',-1),('right',1)]},**{f'leg-{s}':[v*p['hip'],p['hipY'],0] for s,v in [('left',-1),('right',1)]}}
 fits={ 'head':dict(scale=list(HEAD),offset=[0,0,0]),'body':dict(scale=[p['tw'],p['th'],p['tw']],offset=[0,0,0]),**{f'arm-{s}':dict(scale=[p['aw'],p['al'],p['aw']],offset=[0,0,0])for s in ('left','right')},**{f'leg-{s}':dict(scale=[p['foot'],1,p['foot']],offset=[0,.52-p['hipY'],0])for s in ('left','right')},'hand-right':dict(scale=[.72,.72,.72],offset=[0,0,0]),'hand-left':dict(scale=[.72,.72,.72],offset=[0,0,0])}
 for side,sign in [('left',-1),('right',1)]:pivots['hand-'+side]=[sign*p['shoulder'],p['shoulderY']+arm_y(-.36,p),-.02+.07*p['aw']]
 return dict(pivots=pivots,fit=fits,armLength=p['al'],foot=p['foot'],hipY=p['hipY'],sturdy=p is PROFILES['sturdy'])

def bv(p):return Vector((p[0],-p[2],p[1]))
def xf(geo,fn):
 geo.verts=[Vector(fn(v))for v in geo.verts];return geo

def sphere(M,pos,size,segs=16,rings=8):return B.ellipsoid(bv(pos),(size[0],size[2],size[1]),segs=segs,rings=rings).retag(M)
def tube(M,points,radii,sides=8):return B.tube([bv(p)for p in points],radii,sides=sides,cap_start=True,cap_end=True).retag(M)
def author_head(geo,p):
 pv=bv(p['head']);old=Vector(B.HS.PIVOTS['head']);return xf(geo,lambda v:pv+Vector(((v.x-old.x)*HEAD[0],(v.y-old.y)*HEAD[2],(v.z-old.z)*HEAD[1])))

def make(shape):
 p=PROFILES[shape];d=data(p);M=B.hero_materials();M['skin'].diffuse_color=(1,.79,.68,1);M['pants'].diffuse_color=(.07,.43,.85,1)
 for key,color in [('skin',(1,.79,.68,1)),('pants',(.025,.31,.72,1))]:M[key].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=color
 # Nodes still carry the ten established material names, but none of the old body/hair/backpack geometry.
 P={n:B.Piece(n)for n in B.PARTS}
 head=B.ellipsoid(B.C,(.59,.59,.59),segs=24,rings=14).retag(M['skin'])
 # A soft tapered jaw; front stays spherical where facial decals attach.
 for v in head.verts:
  low=max(0,min(1,(B.C.z-v.z-.18)/.41));v.x*=1-.12*low
 for side in (-1,1):head=B.join(head,B.ellipsoid((side*.582,.0,1.565),(.065,.07,.105),segs=10,rings=6).retag(M['skin']))
 P['head'].add(author_head(head,p))
 for side in (-1,1):
  x=side*.205;z=1.59;front=-math.sqrt(.59**2-x*x)
  eye=B.decal((x,front,z),.034,.045,.593,.006,segs=10,rows=1,tag=M['eye'])
  cheek=B.decal((side*.32,-math.sqrt(.59**2-.32**2-.13**2),1.46),.052,.024,.593,.003,segs=8,rows=1,tag=M['blush'])
  brow=B.tube([(x-.045,-.546,1.708),(x,-.55,1.723),(x+.045,-.546,1.708)],[.007,.009,.006],sides=5,cap_start=True,cap_end=True).retag(M['eye'])
  P['head'].add(author_head(B.join(eye,cheek,brow),p))
 smile=B.tube([(-.043,-.577,1.47),(0,-.585,1.458),(.043,-.577,1.47)],[.006,.009,.006],sides=5,cap_start=True,cap_end=True).retag(M['eye']);P['head'].add(author_head(smile,p))
 # New, uninterrupted garment silhouette and exposed arms. No skirt/backpack left beneath newly worn clothing.
 profile=[(.0,.508),(.40,.515),(.41,.56),(.37,.80),(.32,1.10),(.29,1.16),(.15,1.185),(0,1.188)]
 torso=B.lathe(profile,20).retag(M['shirt'])
 def torso_map(v):
  y=(v.z-.85)*p['th'];u=max(0,min(1,(v.z-.508)/.68));taper=(.48+.70*u)if shape=='sturdy'else 1
  return (v.x*p['tw']*taper,v.y*p['tw']*taper,p['body'][1]+y)
 P['body'].add(xf(torso,torso_map))
 neck_low=p['body'][1]+.338*p['th'];P['body'].add(sphere(M['skin'],(0,(neck_low+p['head'][1]+.065)/2,0),(.085,(p['head'][1]+.065-neck_low)/2,.075),12,6))
 for side,label in [(-1,'left'),(1,'right')]:
  arm=d['pivots']['arm-'+label];hand=d['pivots']['hand-'+label];length=arm[1]-hand[1];bend=.12*side if shape=='sturdy'else .025*side
  elbow=(arm[0]+bend,arm[1]-length*.48,-.045);wrist=(hand[0],hand[1]+.065,hand[2])
  P['arm-'+label].add(tube(M['skin'],[(arm[0],arm[1]+.025,arm[2]),elbow,wrist,hand],[.105*p['aw'],.092*p['aw'],.062*p['aw'],.065*p['aw']],10))
  P['arm-'+label].add(sphere(M['skin'],(hand[0],hand[1]-.015,hand[2]),(.083*p['aw'],.095,.045*p['aw']),12,7))
  P['arm-'+label].add(sphere(M['skin'],(hand[0]-.060*side*p['aw'],hand[1]+.006,hand[2]+.025),(.027,.05,.029),8,5))
  hip=side*p['hip'];top=p['hipY'];short_bottom=max(.18,top-.19);knee=(short_bottom+.13)/2
  P['leg-'+label].add(tube(M['skin'],[(hip,top-.08,0),(hip,short_bottom,.003),(hip,knee,.025),(hip,.09,-.012)],[.081*p['foot']/.65,.075*p['foot']/.65,.060*p['foot']/.65,.044*p['foot']/.65],10))
  P['leg-'+label].add(sphere(M['pants'],(hip,top-.085,0),(.12*p['foot']/.65,.13,.135*p['foot']/.65),14,7))
  P['leg-'+label].add(sphere(M['skin'],(hip,.062,.055),(.085*p['foot']/.65,.049,.145*p['foot']/.65),12,6))
  sole=B.rbox((.18*p['foot']/.65,.30*p['foot']/.65,.024),.01,k=1,loc=(hip,-.055,.021)).retag(M['shoe']);P['leg-'+label].add(sole)
  P['leg-'+label].add(tube(M['shoe'],[(hip-.065*p['foot']/.65,.06,.10),(hip,.09,.13),(hip+.065*p['foot']/.65,.06,.10)],[.013,.013,.013],6))
 root=bpy.data.objects.new('hero',None);bpy.context.scene.collection.objects.link(root);objects=[root]
 for name in B.PARTS:
  pivot=bv(d['pivots'][name]);ob=P[name].build(pivot,name);ob.parent=root;ob.location=pivot;objects.append(ob)
 head=next(o for o in objects if o.name=='head');leaf=bpy.data.objects.new('head-leaf',None);bpy.context.scene.collection.objects.link(leaf);leaf.parent=head;leaf.location=bv((0,.47*HEAD[1]+.62*HEAD[1],0));objects.append(leaf)
 for label in ('left','right'):
  arm=next(o for o in objects if o.name=='arm-'+label);hand=bpy.data.objects.new('hand-'+label,None);bpy.context.scene.collection.objects.link(hand);hand.parent=arm;hand.location=bv(d['pivots']['hand-'+label])-bv(d['pivots']['arm-'+label]);objects.append(hand)
 bpy.context.view_layer.update();return objects,d

def main():
 os.makedirs(B.PUBLIC_MODELS,exist_ok=True);manifest={'revision':2,'shapes':{name:data(p)for name,p in PROFILES.items()},'models':{}}
 heights={'tiny':'baby','chibi':'normal','teen':'normal','tall':'long','grown':'long'}
 files=[('hero-sturdy.glb','sturdy')]
 for body in ('boy','girl'):
  for height,shape in heights.items():
   name='hero.glb'if body=='boy'and height=='chibi'else 'hero-'+'-'.join(([body]if body=='girl'else[])+([]if height=='chibi'else[height]))+'.glb';files.append((name,shape))
 for file,shape in files:
  reset_scene();objects,d=make(shape);path=os.path.join(B.PUBLIC_MODELS,file);size=export_glb(objects,path);os.makedirs(B.MODELS,exist_ok=True);shutil.copy2(path,os.path.join(B.MODELS,file));tris=sum(B.mesh_tris(o)for o in objects if o.type=='MESH');assert tris<6000,(file,tris);assert size<350*1024,(file,size);manifest['models'][file]={'shape':shape,'triangles':tris,'bytes':size};print(file,shape,tris,size)
 path=os.path.join(B.REPO,'src','avatar-shapes.ts');source='/** Generated by art/blender/kit/build_avatar_models.py. Gear authoring coordinates stay in hero_spec.py. */\nexport const AVATAR_SHAPES = '+json.dumps(manifest['shapes'],indent=2)+' as const;\nexport type AvatarShape = keyof typeof AVATAR_SHAPES;\n';open(path,'w').write(source)
 open(os.path.join(B.GEN,'avatar-manifest.json'),'w').write(json.dumps(manifest,indent=2))
 open(os.path.join(B.REPO,'art','avatar-manifest.json'),'w').write(json.dumps(manifest,indent=2)+'\n')
 print('Avatar models OK');return manifest
if __name__=='__main__':main()
