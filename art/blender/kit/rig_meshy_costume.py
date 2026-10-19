"""Rig the downloaded Meshy Wind Spirit; never remodel, decimate, recolour or replace its mesh.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/rig_meshy_costume.py -- --source SOURCE.glb
Meshy task provenance is recorded in art/meshy-wind-spirit.json. Input stays outside the repository.
"""
import bpy,sys,os,json,math,hashlib,argparse,struct
import numpy as np
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',default=str(ROOT/'public/assets/models/wind-spirit.glb'));p.add_argument('--preview',default=str(ROOT/'art/previews/kit/dz_wind_spirit.png'));args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
def digest(o):
 h=hashlib.sha256()
 for coll,prop,n,dtype in [(o.data.vertices,'co',3,'f'),(o.data.loops,'vertex_index',1,'i')]+[(u.data,'uv',2,'f') for u in o.data.uv_layers]:
  a=np.empty(len(coll)*n,dtype=dtype);coll.foreach_get(prop,a);h.update(a.tobytes())
 return h.hexdigest()
original={o.name:digest(o) for o in meshes};materials={m.name:sorted(i.image.name for i in m.node_tree.nodes if i.type=='TEX_IMAGE' and i.image) for o in meshes for m in o.data.materials}
points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box];lo=min(v.z for v in points);hi=max(v.z for v in points);scale=2.35/(hi-lo)
# Uniform scene placement only. All local vertices, face indices, UVs and shader inputs stay untouched.
for o in meshes:o.location.z-=lo;o.location*=scale;o.scale*=scale
bpy.context.view_layer.update()
# Anatomical segments are used for Blender's heat weights. Runtime bones are then aligned to shared game axes.
bones={'root':((0,0,0),(0,0,.1),None),'body':((0,0,.75),(0,0,1.30),'root'),'head':((0,0,1.30),(0,0,1.95),'root')}
for side,label in [(-1,'left'),(1,'right')]:
 def at(x,y,z):return(side*x,y,z)
 bones['arm-'+label]=(at(.24,0,1.28),at(.44,-.015,1.03),'root')
 bones['forearm-'+label]=(at(.44,-.015,1.03),at(.66,-.025,.82),'arm-'+label)
 bones['hand-'+label]=(at(.66,-.025,.82),at(.73,-.045,.75),'forearm-'+label)
 bones['leg-'+label]=(at(.14,0,.70),at(.14,0,.37),'root')
 bones['shin-'+label]=(at(.14,0,.37),at(.14,0,.12),'leg-'+label)
 bones['foot-'+label]=(at(.14,0,.12),at(.14,-.16,.10),'shin-'+label)
arm=bpy.data.armatures.new('WindSpiritSkeleton');rig=bpy.data.objects.new('WindSpiritRig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in bones.items():
 b=arm.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
# Ribbon geometry can be open/non-manifold, so use deterministic segment weights rather than heat solving.
# This changes vertex groups only; source positions, normals, UVs, polygons and textures are preserved.
weight_names=[n for n in bones if n!='root'];radii={'body':.26,'head':.28}
weight_counts={n:0 for n in weight_names}
for o in meshes:
 v=np.empty(len(o.data.vertices)*3,dtype='f');o.data.vertices.foreach_get('co',v);v=v.reshape((-1,3));m=np.array(o.matrix_world);world=v@m[:3,:3].T+m[:3,3]
 ds=[]
 for name in weight_names:
  start,end,_=bones[name];a=np.array(start);d=np.array(end)-a;t=np.clip(((world-a)@d)/max(1e-8,d@d),0,1)
  radius=radii.get(name,.13 if name.startswith('foot') else .10)
  ds.append(np.sum((world-a-t[:,None]*d)**2,axis=1)/radius**2)
 ds=np.array(ds).T;near=np.argsort(ds,axis=1)[:,:4];values=np.take_along_axis(ds,near,axis=1);values=np.exp(-2*(values-values[:,:1]));values/=values.sum(axis=1,keepdims=True)
 groups=[o.vertex_groups.new(name=n) for n in weight_names]
 for i in range(len(v)):
  # Keep the halo/head and back hair on the head, including its low trailing curls.
  if world[i,2]>1.42 or world[i,1]>.09 and world[i,2]>.94:
   groups[weight_names.index('head')].add([i],1,'REPLACE');weight_counts['head']+=1
  else:
   for g,w in zip(near[i],values[i]):
    if w>1e-5:groups[int(g)].add([i],float(w),'REPLACE');weight_counts[weight_names[int(g)]]+=1
 mod=o.modifiers.new('Wind Spirit skin','ARMATURE');mod.object=rig
 matrix=o.matrix_world.copy();o.parent=rig;o.matrix_world=matrix
# Upright, parallel rest axes export as identity quaternions, matching the game's existing procedural poses.
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for b in arm.edit_bones:b.use_connect=False;b.tail=b.head+Vector((0,0,.1));b.roll=0
bpy.ops.object.mode_set(mode='OBJECT')
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
root=bpy.data.objects.new('dz_wind_spirit',None);bpy.context.collection.objects.link(root);rig.parent=root
# GLTF exports keep the armature and the complete source mesh together. No anatomical pieces are cut out.
for o in meshes:
 matrix=o.matrix_world.copy();o.parent=rig;o.matrix_world=matrix
root['meshyTask']='01a153cf-93b1-7221-8a29-6d1b30ded323';root['meshyRemeshTask']='01a153d8-feaf-7636-bbc9-62eb0bd46daf';root['sourceSha256']=hashlib.sha256(Path(args.source).read_bytes()).hexdigest();root['preserveAppearance']=True
# Standard clips are authored in Blender. The game drives the primary named bones with its existing poses;
# it plays only the shin/elbow tracks from these clips as secondary articulation, on local and remote avatars.
clips={'Idle':2,'Walk':.8,'Run':.5,'Jump':.6,'Sit':1,'Lie':1,'FishCast':.5,'FishWait':2,'FishReel':1,'Attack':.4}
for name,duration in clips.items():
 action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action;action.use_fake_user=True
 count=30;end=max(2,round(duration*30))
 for f in range(end+1):
  t=f/end;phase=t*math.tau
  for pb in rig.pose.bones:pb.rotation_euler=(0,0,0)
  for side,label in [(-1,'left'),(1,'right')]:
   leg=rig.pose.bones['leg-'+label];armb=rig.pose.bones['arm-'+label];shin=rig.pose.bones['shin-'+label];fore=rig.pose.bones['forearm-'+label]
   if name in ['Walk','Run']:
    swing=math.sin(phase)*(1 if side<0 else -1);leg.rotation_euler.x=swing*(.7 if name=='Run' else .5);armb.rotation_euler.x=-swing*.55;shin.rotation_euler.x=max(0,-swing)*.65
   elif name=='Sit':leg.rotation_euler.x=-math.pi/2;shin.rotation_euler.x=math.pi/2
   elif name=='Jump':leg.rotation_euler.x=.5*math.sin(t*math.pi);shin.rotation_euler.x=.6*math.sin(t*math.pi);armb.rotation_euler.x=-2*math.sin(t*math.pi)
   elif name.startswith('Fish'):fore.rotation_euler.x=-.12 if name=='FishWait' else -.15-.12*math.sin(phase)
   elif name=='Attack':armb.rotation_euler.x=-1.8*math.sin(t*math.pi);fore.rotation_euler.x=-.2*math.sin(t*math.pi)
  if name=='Idle':rig.pose.bones['head'].rotation_euler.z=.06*math.sin(phase)
  for pb in rig.pose.bones:pb.keyframe_insert(data_path='rotation_euler',frame=f+1,group=pb.name)
 rig.animation_data.action=None
rig.animation_data.action=bpy.data.actions.get('Idle')
for pb in rig.pose.bones:pb.rotation_euler=(0,0,0)
for o in meshes:assert digest(o)==original[o.name], 'Rigging changed source mesh/UV data'
assert materials=={m.name:sorted(i.image.name for i in m.node_tree.nodes if i.type=='TEX_IMAGE' and i.image) for o in meshes for m in o.data.materials},'Rigging changed source textures'
scene=bpy.context.scene;scene.render.fps=30;scene.frame_set(1)
Path(args.output).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=args.output,export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_skins=True,export_all_influences=False,export_image_format='AUTO',export_extras=True)
# Blender stores split normals at reduced precision internally. Restore Meshy's exact normals on export;
# topology and UV order are unchanged, checked below before touching the attribute bytes.
def glb(path):
 data=bytearray(Path(path).read_bytes());length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);return data,doc,28+length
def attribute(data,doc,offset,index):
 ac=doc['accessors'][index];view=doc['bufferViews'][ac['bufferView']];start=offset+view.get('byteOffset',0)+ac.get('byteOffset',0);size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[ac['type']];dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[ac['componentType']];array=np.frombuffer(data,dtype=dtype,count=ac['count']*size,offset=start).reshape((-1,size));return start,array
source,sd,so=glb(args.source);exported,ed,eo=glb(args.output);sp=sd['meshes'][0]['primitives'][0];ep=ed['meshes'][0]['primitives'][0]
src=attribute(source,sd,so,sp['attributes']['POSITION'])[1].copy();dst=attribute(exported,ed,eo,ep['attributes']['POSITION'])[1];src[:,1]-=lo;src*=scale
position_error=float(np.max(np.abs(src-dst)));assert position_error<1e-6,'Export changed the source shape beyond uniform scene scale'
appearance={}
for name in ['NORMAL','TEXCOORD_0']:
 start,actual=attribute(exported,ed,eo,ep['attributes'][name]);_,expected=attribute(source,sd,so,sp['attributes'][name]);assert actual.shape==expected.shape
 if name=='NORMAL':exported[start:start+expected.nbytes]=expected.tobytes()
 else:assert np.array_equal(actual,expected),'Export changed source UVs'
 appearance[name]=hashlib.sha256(expected.tobytes()).hexdigest()
assert np.array_equal(attribute(source,sd,so,sp['indices'])[1],attribute(exported,ed,eo,ep['indices'])[1]),'Export changed triangle topology'
appearance['indices']=hashlib.sha256(attribute(source,sd,so,sp['indices'])[1].astype('<u4').tobytes()).hexdigest()
appearance['position']=hashlib.sha256(dst.tobytes()).hexdigest()
appearance['textures']=[hashlib.sha256(source[so+sd['bufferViews'][i['bufferView']].get('byteOffset',0):so+sd['bufferViews'][i['bufferView']].get('byteOffset',0)+sd['bufferViews'][i['bufferView']]['byteLength']]).hexdigest() for i in sd.get('images',[])]
Path(args.output).write_bytes(exported)
report={'sourceSha256':root['sourceSha256'],'sourceMeshFingerprints':original,'triangles':sum(len(o.data.polygons) for o in meshes),'bones':len(arm.bones),'weightedVertices':weight_counts,'animations':list(clips),'height':2.35,'sourcePreserved':True,'appearance':appearance,'uniformScale':scale,'positionError':position_error,'landmarks':{k:list(v[0]) for k,v in bones.items()}}
(ROOT/'art/meshy-wind-spirit-rig.json').write_text(json.dumps(report,indent=2)+'\n')
# Render the untouched model with its preserved materials; no image textures are generated or repainted here.
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.72,.85,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for loc,power,size in [((3,-4,6),550,4),((-3,-1,3),280,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size
bpy.ops.object.camera_add(location=(3,-7,3.3));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.16))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.65;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=False;scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.filepath=args.preview;Path(args.preview).parent.mkdir(parents=True,exist_ok=True);bpy.ops.render.render(write_still=True)
print('RIG_REPORT',json.dumps(report))
