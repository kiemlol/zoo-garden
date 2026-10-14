"""Original toon octopus/slime, loot and lava rod. No textures or skins.
blender -b --factory-startup --python-exit-code 1 --python art/blender/kit/build_swamp_gear.py -- --render
Also rebuilds the farm kit from its existing builders with the redesigned goat.
"""
import bpy, os, sys, math, json

def cpu_render(path):
    bpy.context.scene.render.engine='CYCLES'
    bpy.context.scene.cycles.samples=32
    bpy.context.scene.cycles.use_denoising=False
    bpy.context.scene.cycles.device='CPU'
    return render(path)
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
from style import mat,reset_scene,export_glb,studio,game_camera,render
from build_weapons import Piece,sphere,tube,add_eye,ell_point,new_empty,triangulate,Weapon,KIND,build_rod_common,realise_weapon,icon_matrix_weapon,icon_camera
import build_farm as farm
ROOT=os.path.normpath(os.path.join(HERE,'../../..'))

def ell(piece,c,r,m,seg=10,rings=5):piece.add(sphere(1,seg,rings,scale=r).moved(c),m)

def build():
    m={k:mat('Swamp '+k,c,.5) for k,c in dict(violet='#A782E3',dark='#583A86',mint='#ADDF82',cream='#FFF2D2',eye='#322943',white='#FFFFFF',rose='#F3A1CE',orange='#FF9A36').items()}
    objects=[]; roots={}
    piece=Piece('swamp_octo_body')
    ell(piece,(0,0,.81),(.58,.48,.64),m['violet'],14,8)
    ell(piece,(0,-.28,.76),(.40,.25,.43),m['mint'],12,6)
    # Eight curved jelly arms: plump bases, upturned tips, little suction cups.
    for i in range(8):
        a=i*math.tau/8; x,y=math.cos(a),math.sin(a)
        path=[(x*.36,y*.36,.43),(x*.61,y*.61,.23),(x*.89,y*.83,.16),(x*1.03,y*.94,.27),(x*.98,y*.89,.40)]
        piece.add(tube(path,[.18,.16,.13,.09,.025],sides=7,cap=0),m['violet'])
        for r,z in [(.65,.22),(.88,.20)]:ell(piece,(x*r,y*r-.01,z),(.065,.065,.028),m['mint'],6,3)
    c=(0,0,.81);r=(.58,.48,.64)
    for side in (-1,1):
        p,n=ell_point(c,r,(side*.38,-.92,.14));add_eye(piece,p,n,.09,m['eye'],m['white'],segs=8,squash=1.1)
        ell(piece,(side*.31,-.47,.70),(.085,.025,.045),m['rose'],8,4)
    piece.add(tube([(-.12,-.524,.76),(0,-.54,.69),(.12,-.524,.76)],[.025,.025,.025],sides=5,cap=0),m['dark'])
    ell(piece,(.17,-.13,1.31),(.16,.13,.07),m['cream'],8,4)
    ell(piece,(-.17,.04,1.42),(.10,.09,.08),m['mint'],8,4)
    root=new_empty('swamp_octo');obj=triangulate(piece.build());obj.parent=root
    roots['swamp_octo']=root;objects.extend([root,obj])
    for name,color in [('venom_ink','violet'),('jelly_resin','mint')]:
        p=Piece(name+'_body')
        if name=='venom_ink':
            # Keep the durable item ID; replace the pearl with curled jelly feelers.
            for i in range(3):
                x=(i-1)*.13
                pts=[(x,.06,.10),(x,-.02,.22),(x+.04,-.04,.39),(x+.11,0,.54),(x+.08,.06,.61),(x+.015,.075,.58)]
                p.add(tube(pts,[.085,.077,.062,.043,.029,.008],sides=7,cap=0),m['violet'])
                for z in (.20,.31,.42):ell(p,(x-.015,-.085,z),(.04,.025,.035),m['mint'],6,3)
                ell(p,(x+.02,-.06,.36),(.023,.016,.045),m['cream'],6,3)
            ell(p,(0,.05,.06),(.25,.14,.06),m['mint'],10,4)
        else:
            ell(p,(0,0,.24),(.23,.20,.25),m[color],12,7)
            ell(p,(-.075,-.15,.35),(.045,.025,.065),m['white'],8,4)
            ell(p,(0,0,.08),(.26,.22,.07),m['dark'],10,4)
            ell(p,(.06,.01,.48),(.09,.08,.13),m[color],8,4)
        root=new_empty(name);obj=triangulate(p.build());obj.parent=root
        roots[name]=root;objects.extend([root,obj])
    KIND['rod_lava']='rod';w=Weapon('rod_lava')
    grip=w.m('grip','#693A33');stone=w.m('obsidian','#382E43');lava=w.m('magma','#FF8D38');gold=w.m('rings','#FFD77A')
    build_rod_common(w,grip,stone,stone,gold,lava,stone,lava,lava,tip_r=.035,gem=gold)
    # Raised magma veins and a flame-shaped reel ornament remain opaque toon geometry.
    w.add(tube([(0,-.28,.03),(.025,-.65,.025),(-.018,-1.05,.02),(0,-1.40,.013)],[.012,.012,.009,.004],sides=5,cap=0),lava)
    rod=realise_weapon(w);roots['rod_lava']=rod['node'];objects.extend([rod['node']]+rod['meshes']+list(rod['empties'].values()))
    return roots,objects,rod

def main():
    reset_scene();roots,objects,rod=build()
    path=os.path.join(ROOT,'public/assets/models/swamp-gear.glb');size=export_glb(objects,path)
    manifest={'file':'public/assets/models/swamp-gear.glb','bytes':size,'textures':0,'models':{}}
    for name,root in roots.items():
        meshes=[o for o in root.children_recursive if o.type=='MESH'];tris=sum(len(o.data.polygons) for o in meshes)
        assert tris<=2500,(name,tris)
        manifest['models'][name]={'triangles':tris,'parts':[o.name for o in root.children]}
    assert size<200*1024,size
    with open(os.path.join(ROOT,'art/swamp-gear-manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
    # Item icons use these exact meshes; ground loot can also instance the roots.
    studio(size=(160,160),transparent=True)
    for obj in objects:obj.hide_render=True
    for name in ('venom_ink','jelly_resin','rod_lava'):
        root=roots[name]
        for obj in [root]+list(root.children_recursive):obj.hide_render=False
        bpy.context.view_layer.update()
        vertices=[o.matrix_world@v.co for o in root.children_recursive if o.type=='MESH' for v in o.data.vertices]
        low=Vector(tuple(min(v[i] for v in vertices) for i in range(3)));high=Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
        center=(low+high)*.5
        if name=='rod_lava':
            # The exact rod icon rotation and projected-bounds fit used by the other rods.
            root.matrix_world=icon_matrix_weapon(rod)
            bpy.context.view_layer.update()
            cam=icon_camera(rod['meshes'],elevation=14,margin=1.05)
        else:
            cam=game_camera(target=center,ortho_scale=max(high-low)*(1.16 if name=='venom_ink' else 1.35))
            cam.location=center+Vector((3,-5,3))
            cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.scene.render.image_settings.quality=85
        cpu_render(os.path.join(ROOT,'public/assets/icons/items',name+'.webp'))
        for obj in [root]+list(root.children_recursive):obj.hide_render=True
    if '--render' in sys.argv:
        roots['swamp_octo'].hide_render=False
        for obj in roots['swamp_octo'].children_recursive:obj.hide_render=False
        studio(size=(800,650));game_camera(target=(0,0,.65),ortho_scale=3.2)
        cpu_render(os.path.join(ROOT,'art/previews/kit/swamp-octo.webp'))
    reset_scene();entries=farm.build_all();stats={pid:farm.piece_stats(entries[pid]) for pid in farm.FARM_IDS}
    for pid in ('goat','kid'):
        errors=farm.check_piece(entries[pid],stats[pid]);assert not errors,(pid,errors)
    farm.export(entries,os.path.join(ROOT,'public/assets/models/farm.glb'))
    # Update only changed goat facts, keeping all other art contract metadata.
    manifest_path=os.path.join(ROOT,'art/asset-manifest.json')
    if os.path.exists(manifest_path):
        data=json.load(open(manifest_path))
        for pid in ('goat','kid'):data['farm']['nodes'][pid]=stats[pid]
        data['farm']['bytes']=os.path.getsize(os.path.join(ROOT,'public/assets/models/farm.glb'))
        data['farm']['generator']='art/blender/kit/build_swamp_gear.py (existing farm builders)'
        data['farm']['blender']=bpy.app.version_string
        data['farm']['materials']=farm.material_table(entries)
        with open(manifest_path,'w') as f:json.dump(data,f,indent=2);f.write('\n')
    if '--render' in sys.argv:
        for e in entries.values():
            for o in [e['root']]+e['meshes']:o.hide_render=True
        for name,x in [('goat',-.75),('kid',.75)]:
            e=entries[name];e['root'].location.x=x
            for o in [e['root']]+e['meshes']:o.hide_render=False
        studio(size=(900,650));game_camera(target=(0,-.05,.55),ortho_scale=3.1)
        cpu_render(os.path.join(ROOT,'art/previews/kit/goats.webp'))
    print(json.dumps(manifest))

if __name__=='__main__':main()
