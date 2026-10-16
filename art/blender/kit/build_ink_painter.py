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
 from mathutils import Vector
 it=item('ink_dragon','prop');p='body'
 # Keep InkDragonRig's rest centreline exactly: head t=0, tail t=1.
 path=[Vector((math.sin(t*math.tau)*(.68-.28*t),.09*math.cos(t*math.pi*3),1.8-1.65*t)) for t in [j/64 for j in range(65)]]
 radii=[.142*(1-j/64)**.65+.003 for j in range(65)]
 frames=[]
 it.add(p,W.tube(path,radii,12,cap_start=True,cap_end=True,ref=(0,-1,0),frames=frames),it.palette['ink'])
 def stroke(points,r,col,sides=7,steps=8):
  # Cubic Bezier brush strokes: round roots, flowing silhouette, pointed ends.
  a,b,c,d=map(Vector,points)
  pts=[a*(1-t)**3+b*(3*t*(1-t)**2)+c*(3*t*t*(1-t))+d*t**3 for t in [i/steps for i in range(steps+1)]]
  line(it,p,pts,[r*(1-i/steps)**.75+.001 for i in range(steps+1)],col,sides)
 def leaf(c,across,along,normal,w,h,col,ridge=.012):
  # A closed, low-poly shield scale / lance-shaped fin with a raised centre.
  c=Vector(c);a=Vector(across)*w;b=Vector(along)*h;n=Vector(normal)*ridge
  verts=[c-a*.75-b*.45,c+a*.75-b*.45,c+a,c+b,c-a,c+n]
  faces=[(5,i,(i+1)%5) for i in range(5)]+[tuple(reversed(range(5)))]
  it.add(p,W.Geo(verts,faces).outward(),it.palette[col])
 # Overlapping ventral plates follow the curve's local frame, never the world Z axis.
 # Four staggered rows of smaller shields expose dark seams between ink-wash scales.
 for j in range(3,63):
  c=path[j];front,side=frames[j];tangent=(path[j+1]-path[j-1]).normalized();r=radii[j]
  # Curved paper bands hug the belly instead of sticking out like teeth.
  band=[]
  for along in [-1,1]:
   for k in range(5):
    angle=(k-2)*.30;radial=front*math.cos(angle)+side*math.sin(angle)
    band.append(c+radial*(r+.004)+tangent*(along*.025-.008*math.cos(angle)))
  it.add(p,W.Geo(band,[(k,k+1,k+6,k+5) for k in range(4)]),it.palette['paper' if j%4 else 'seam'])
  for row,angle in enumerate([-.95,-1.85,1.85,.95]):
   radial=front*math.cos(angle)+side*math.sin(angle);across=-front*math.sin(angle)+side*math.cos(angle)
   shade='cloth' if j%7==row else 'fold' if row in [0,3] else 'coal'
   leaf(c+radial*(r+.002)+tangent*(.012 if row%2 else 0),across,tangent,radial,r*.40,.040,shade,.005)
  if j%4==0:
   back=-front
   leaf(c+back*r,side,tangent,back,r*.20,.058,'seam',.011)
   stroke([c+back*r,c+back*(r+.08)-tangent*.05,c+back*(r+.11)+tangent*.025,c+back*(r+.12)+tangent*.085],.025*(1-j/80),'coal',6,4)
 # Compact skull and a long, chiselled muzzle; the eye line stays at the head joint.
 ell(it,p,(0,.035,1.86),(.205,.195,.175),'coal',16,8)
 ell(it,p,(0,-.19,1.79),(.142,.22,.091),'fold',14,6)
 ell(it,p,(0,-.365,1.80),(.16,.095,.068),'coal',12,6)
 ell(it,p,(0,-.21,1.695),(.128,.19,.032),'dark',12,5)
 ell(it,p,(0,-.24,1.665),(.125,.185,.033),'seam',12,5)
 leaf((0,-.11,1.99),(1,0,0),(0,-1,-.32),(0,-.3,1),.087,.13,'fold',.018)
 for side in [-1,1]:
  # Narrow almond eyes under a swept brow, cheek plates and nostrils.
  ell(it,p,(side*.135,-.135,1.865),(.077,.040,.040),'paper',12,5)
  ell(it,p,(side*.144,-.170,1.866),(.017,.009,.029),'dark',8,4)
  ell(it,p,(side*.138,-.178,1.88),(.007,.004,.008),'white',6,3)
  stroke([(side*.055,-.17,1.895),(side*.12,-.19,1.93),(side*.21,-.12,1.94),(side*.25,-.04,1.96)],.029,'ink',7,5)
  leaf((side*.19,-.07,1.78),(0,1,0),(side*.7,0,.7),(side,0,0),.07,.12,'cloth',.015)
  ell(it,p,(side*.087,-.443,1.805),(.029,.012,.016),'dark',8,4)
  stroke([(side*.035,-.40,1.85),(side*.08,-.45,1.86),(side*.15,-.42,1.86),(side*.18,-.37,1.84)],.018,'seam',6,4)
  # Two ivory fangs per side, with dark negative space above the lower jaw.
  for y,z in [(-.33,1.735),(-.16,1.73)]:
   stroke([(side*.105,y,z),(side*.117,y-.012,z-.025),(side*.10,y-.01,z-.058),(side*.085,y-.025,z-.055)],.020,'white',6,3)
  # Deer antlers branch upward/backward with paper-coloured branches.
  stroke([(side*.14,.055,1.98),(side*.23,.095,2.08),(side*.25,.13,2.24),(side*.31,.16,2.40)],.042,'paper',8,7)
  stroke([(side*.23,.11,2.16),(side*.31,.09,2.21),(side*.39,.11,2.24),(side*.42,.12,2.33)],.025,'paper',7,5)
  stroke([(side*.27,.14,2.28),(side*.20,.16,2.32),(side*.20,.18,2.38),(side*.19,.18,2.43)],.018,'paper',6,4)
  # Fine long whiskers flow outward in generous curves rather than angular sticks.
  stroke([(side*.13,-.375,1.76),(side*.48,-.48,1.65),(side*.64,-.30,1.90),(side*.72,-.16,2.07)],.014,'paper',6,12)
  stroke([(side*.14,-.36,1.75),(side*.36,-.43,1.62),(side*.50,-.31,1.69),(side*.55,-.25,1.75)],.009,'seam',5,8)
  # Layered swept cheek/neck mane, with separated paper-edged brush tips.
  for j in range(4):
   root=Vector((side*(.16-j*.012),.02+j*.037,1.88-j*.035))
   end=Vector((side*(.36+j*.025),.20+j*.025,2.00-j*.075))
   stroke([root,root+Vector((side*.18,.03,.03)),end+Vector((side*.015,-.03,.05)),end],.043-j*.003,'coal' if j%2 else 'fold',7,5)
   stroke([root+Vector((0,-.026,.013)),root+Vector((side*.16,.01,.045)),end+Vector((side*.01,-.025,.04)),end],.009,'seam',5,5)
  stroke([(side*.055,-.32,1.65),(side*.09,-.30,1.49),(side*.23,-.20,1.50),(side*.25,-.13,1.59)],.024,'paper',7,8)
 # Each leg, palm and four talons form ONE connected mesh. Point colours keep
 # the pale claws in the same glTF primitive, so the unchanged rig binds the
 # entire small limb together instead of sending detached fingers to other joints.
 limb_material=it.m('limbs','#FFFFFF');it.dragon_colors={}
 bind_curve=[Vector((math.sin(t*math.tau)*(.68-.28*t),.09*math.cos(t*math.pi*3),1.8-1.65*t)) for t in [j/84 for j in range(85)]]
 for index in [20,43]:
  c=path[index];front,across=frames[index];tangent=(path[index+1]-path[index-1]).normalized()
  for side in [-1,1]:
   outward=across*side;root=c+outward*radii[index]*.55
   elbow=root+outward*.16-tangent*.06+front*.015
   wrist=root+outward*.24+tangent*.035+front*.13
   g=W.tube([root,elbow,wrist],[.060,.046,.043],8,cap_start=True)
   colors=[it.palette['coal'].diffuse_color[:]]*len(g.verts)
   # Divide the open wrist into four quadrants, each extended into a finger.
   ring=list(range(len(g.verts)-8,len(g.verts)));centre=len(g.verts)
   g.verts.append(wrist);colors.append(it.palette['fold'].diffuse_color[:])
   for toe in range(4):
    base=[ring[toe*2],ring[(toe*2+1)%8],ring[(toe*2+2)%8],centre]
    start=sum((g.verts[i] for i in base),Vector())/4
    direction=(front+outward*.45+tangent*((toe-1)*.65)).normalized() if toe<3 else (-outward+front*.4).normalized()
    a=direction.cross(tangent).normalized();b=direction.cross(a).normalized()
    # Align each next ring with its root quad to avoid twisted finger faces.
    offsets=[(g.verts[i]-start).normalized() for i in base]
    for length,radius,shade in [(.055,.019,'cloth'),(.105,.012,'paper')]:
     next_ring=[];at=start+direction*length+front*(.015 if length>.1 else 0)
     for offset in offsets:
      projected=a*offset.dot(a)+b*offset.dot(b)
      if projected.length<.01:projected=a
      next_ring.append(len(g.verts));g.verts.append(at+projected.normalized()*radius);colors.append(it.palette[shade].diffuse_color[:])
     g.faces.extend((base[k],base[(k+1)%4],next_ring[(k+1)%4],next_ring[k]) for k in range(4));base=next_ring
    tip=len(g.verts);g.verts.append(start+direction*.12+front*.05);colors.append(it.palette['paper'].diffuse_color[:])
    g.faces.extend((base[k],base[(k+1)%4],tip) for k in range(4))
   # Embed the shoulder/hip at the centreline point selected by the rig's
   # existing bounds-centre binding rule. The whole limb then follows the
   # same interpolated joint as its root, even on the outside of a bend.
   for _ in range(32):
    centre=Vector(tuple((min(v[i] for v in g.verts)+max(v[i] for v in g.verts))*.5 for i in range(3)))
    candidates=[]
    for a,b in zip(bind_curve,bind_curve[1:]):
     ab=b-a;u=max(0,min(1,(centre-a).dot(ab)/ab.length_squared));candidates.append(a+ab*u)
    target=min(candidates,key=lambda point:(point-centre).length_squared)
    delta=target-sum(g.verts[:8],Vector())/8
    for i in range(8):g.verts[i]+=delta
    if delta.length<1e-6:break
   assert delta.length<1e-4,'limb root did not settle on its binding point'
   g.tags=[None]*len(g.faces);g.outward()
   offset=len(it.parts[p].verts);it.add(p,g,limb_material)
   assert len(it.parts[p].verts)-offset==len(colors)
   it.dragon_colors.update({offset+i:color for i,color in enumerate(colors)})
 # A split, tapered ink-brush tail stays small enough to bind near the last joints.
 c=path[61];front,across=frames[61];tangent=(path[64]-path[60]).normalized()
 for s in [-1,0,1]:
  stroke([c,c+tangent*.07+across*(s*.045),c+tangent*.14+across*(s*.07),path[-1]+tangent*.045+across*(s*.045)],.024,'fold' if s else 'seam',6,5)
 assert it.parts[p].tris()<=11000,it.parts[p].tris()
 return it

def dragon_reveal_order(obj,colors):
 # The shared exporter sorts triangles by X. This asset instead needs head-to-tail
 # index order for the existing drawRange animation; do not change the runtime rig.
 import bmesh
 from mathutils import Vector
 # Shared vertex colours preserve the connected palm/claw topology on export.
 tint=obj.data.color_attributes.new(name='Dragon tint',type='FLOAT_COLOR',domain='POINT')
 for i,value in enumerate(tint.data):value.color=colors.get(i,(1,1,1,1))
 limb_slot=next(i for i,m in enumerate(obj.data.materials) if m.name.endswith(' limbs'))
 material=obj.data.materials[limb_slot];node=material.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name=tint.name
 material.node_tree.links.new(node.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
 bm=bmesh.new();bm.from_mesh(obj.data)
 for edge in bm.edges:
  if any(f.material_index==limb_slot for f in edge.link_faces):edge.smooth=True
 curve=[Vector((math.sin(t*math.tau)*(.68-.28*t),.09*math.cos(t*math.pi*3),1.8-1.65*t)) for t in [j/84 for j in range(85)]]
 def nearest(point):
  best=float('inf');result=0
  for j,(a,b) in enumerate(zip(curve,curve[1:])):
   ab=b-a;u=max(0,min(1,(point-a).dot(ab)/ab.length_squared));distance=(point-a-ab*u).length_squared
   if distance<best:best=distance;result=(j+u)/84
  return result
 visited=set();order={}
 for vertex in bm.verts:
  if vertex in visited:continue
  group=[];pending=[vertex];visited.add(vertex)
  while pending:
   v=pending.pop();group.append(v)
   for edge in v.link_edges:
    other=edge.other_vert(v)
    if other not in visited:visited.add(other);pending.append(other)
  lo=Vector(tuple(min(v.co[i] for v in group) for i in range(3)))
  hi=Vector(tuple(max(v.co[i] for v in group) for i in range(3)))
  continuous=hi.z-lo.z>1 and len(group)>400;centre=(lo+hi)*.5;t=nearest(centre)
  if t<.09 or centre.z>1.64:t=0
  for face in {f for v in group for f in v.link_faces}:order[face]=nearest(face.calc_center_median()) if continuous else t
 rank={f:i for i,f in enumerate(sorted(bm.faces,key=lambda f:(f.material_index,order[f],f.index)))}
 bm.faces.sort(key=lambda f:rank[f]);bm.faces.index_update()
 bm.to_mesh(obj.data);bm.free();obj.data.update()

def main():
 reset_scene();entries={};objects=[]
 for build in [painter,brush,dragon]:
  it=build();e=W.realise(it)
  if it.id=='ink_dragon':
   for _,obj in e['pieces']:dragon_reveal_order(obj,it.dragon_colors)
  entries[it.id]=e;objects.extend([e['empty']]+[o for _,o in e['pieces']])
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
