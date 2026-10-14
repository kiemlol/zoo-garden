"""The farm goat, its kid and their shelter. install(g) is called by build_farm_expansion.py.

An original chunky toy goat: round cream torso, brown saddle, large expressive head,
pink muzzle and ears, sturdy split hooves, swept horns and an upturned tail.
The kid has a proportionally larger head and little horn nubs. Adult height ~1.22 m,
kid ~0.8 m. Parts retain the body/head/four-leg/tail hinge contract, Z-up ground
and -Y front. build_farm.py remains usable; build_swamp_gear.py also rebuilds this kit.
"""
import math

from mathutils import Vector


def build_goat(g, m, pid):
    """Round toy proportions, larger face and sturdy legs; keep every rigid hinge."""
    Model, sphere, cyl, tube, FM = (g[n] for n in ('Model','sphere','cyl','tube','FM'))
    kid=pid=='kid'; k=.68 if kid else 1; head=1.12 if kid else 1
    coat,patch=FM('goat','#FBF0DC'),FM('goat patch','#A56A3A')
    def v(x,y,z): return Vector((x*k,y*k,z*k))
    def ell(part, material, c, r, seg=10, rings=5):
        part.add(sphere(1,seg,rings,scale=tuple(a*k for a in r)).moved(v(*c)),material)
    piv=dict(body=v(0,.05,.52),head=v(0,-.32,.80),tail=v(0,.45,.70))
    for name,x,y in [('fl',-.21,-.22),('fr',.21,-.22),('bl',-.21,.29),('br',.21,.29)]:piv['leg_'+name]=v(x,y,.59)
    model=Model(pid,piv)
    ell(model['body'],coat,(0,.05,.59),(.30,.43,.27),12,6)
    ell(model['body'],patch,(0,.15,.82),(.23,.27,.06))
    ell(model['head'],coat,(0,-.36,.87),(.24*head,.24*head,.25*head),12,6)
    ell(model['head'],coat,(0,-.30,.68),(.18,.18,.23))
    ell(model['head'],m['muzzle'],(0,-.565,.77),(.17,.095,.10))
    for side in (-1,1):
        ell(model['head'],m['nostril'],(side*.055,-.647,.785),(.015,.010,.018),6,3)
        ell(model['head'],coat,(side*.30,-.30,.94),(.16,.08,.07))
        ell(model['head'],m['blush'],(side*.32,-.36,.95),(.10,.025,.035),8,4)
    g['eye_pair'](model['head'],v(0,-.36,.87),tuple(a*k*head for a in (.24,.24,.25)),(.57,-.8,.18),.052*k*head,m,squash=1.2,segs=8)
    g['blush_pair'](model['head'],v(0,-.36,.87),tuple(a*k*head for a in (.24,.24,.25)),(.68,-.73,-.20),.045*k,m)
    for side in (-1,1):
        pts=[v(side*.13,-.27,1.055),v(side*.16,-.22,1.14),v(side*.19,-.12,1.22),v(side*.19,-.01,1.18)]
        if kid:pts=pts[:2]
        model['head'].add(tube(pts,[.06*k,.048*k] if kid else [.06*k,.05*k,.036*k,.008*k],sides=6,cap=0),m['horn'])
    if not kid:
        model['head'].add(tube([v(0,-.51,.70),v(0,-.51,.59),v(0,-.48,.53)],[.065,.05,.01],sides=6,cap=0),patch)
    for name,x,y in [('fl',-.21,-.22),('fr',.21,-.22),('bl',-.21,.29),('br',.21,.29)]:
        part=model['leg_'+name]
        # A spherical hip overlaps the torso even at the maximum walking swing.
        ell(part,coat,(x,y,.59),(.11,.11,.11),8,4)
        part.add(cyl(v(x,y,.59),v(x,y,.09),.078*k,.065*k,sides=7),coat)
        for dx in (-.035,.035):ell(part,m['hoof'],(x+dx,y-.02,.05),(.040,.085,.05),6,3)
    model['tail'].add(tube([v(0,.43,.69),v(0,.52,.77),v(0,.55,.87)],[.07*k,.055*k,.02*k],sides=6,cap=0),coat)
    return model


def build_shelter(g, m):
    Model, rbox, about = g['Model'], g['rbox'], g['about']
    RAD = math.radians
    model = Model('goat_shelter')
    P = model[None]
    P.add(rbox((.72, .64, .07), (0, 0, .035), n=8), m['wood'])
    P.add(rbox((.59, .52, .035), (0, 0, .087), n=8), m['hay'])
    P.add(rbox((.72, .055, .5), (0, .30, .25), n=8), m['wood_light'])                # back wall
    for side in (-1, 1):
        P.add(rbox((.055, .65, .27), (side * .34, 0, .135), n=8), m['wood_light'])  # low side boards
        P.add(rbox((.055, .055, .44), (side * .34, -.30, .22), n=8), m['wood'])    # front posts
    P.add(rbox((.82, .72, .05), (0, 0, .5), n=12), m['red'], about((0, 0, .5), (RAD(9), 0, 0)))
    P.add(rbox((.26, .26, .16), (-.12, -.05, .15), n=8), m['wood'])                # a climbing block
    return model


def install(g):
    for pid in ('goat', 'kid'):
        g['ANIMALS'].append(pid)
        g['PARTS'][pid] = g['HOOF_PARTS']
        k = 0.6 if pid == 'kid' else 1.0
        g['SIZE'][pid] = dict(h=1.22 if pid == 'goat' else .80, half=(.46,.67) if pid == 'goat' else (.32,.47))
        g['KIND'][pid] = 'animal'
        g['BUILDERS'][pid] = lambda m, pid=pid: build_goat(g, m, pid)
    g['PROPS'].append('goat_shelter')
    g['SIZE']['goat_shelter'] = dict(h=0.55, half=(0.43, 0.37))
    g['KIND']['goat_shelter'] = 'prop'
    g['BUILDERS']['goat_shelter'] = lambda m: build_shelter(g, m)
    g['FARM_IDS'] = g['ANIMALS'] + g['PROPS'] + g['PRODUCTS']
