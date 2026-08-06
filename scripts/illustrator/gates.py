#!/usr/bin/env python3
"""Acceptance gates for a v4 Ronin rig part. Exit 0 = all pass."""
import json, sys

BUDGET = {'head-face':30,'head-ear':6,'head-hair-back':14,'head-hair-front':10,
 'head-bandana':6,'streamers':6,'neck':4,'torso':12,'pelvis':8,
 'arm-R-upper':4,'arm-R-fore':4,'arm-R-hand':6,'arm-L-upper':4,'arm-L-fore':4,'arm-L-hand':6,
 'leg-R-thigh':4,'leg-R-shin':4,'leg-R-foot':6,'leg-L-thigh':4,'leg-L-shin':4,'leg-L-foot':6}
PALETTE = ['0E0A0C','161B38','E89359','DB3720','AD231B','925B3E','401E20','FFFFFF']
CONTAINED_MIN = 0.85   # fraction of a path's area that must lie inside its own proxy
GROW = 1.10            # proxy tolerance, since art may sit slightly proud of the blocking shape
PALETTE_TOL = 40       # euclidean RGB distance

def rgb(h):
    try: return int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    except Exception: return None

def near_palette(h):
    v = rgb(h)
    if v is None: return False
    for p in PALETTE:
        q = rgb(p)
        if sum((v[i]-q[i])**2 for i in range(3)) <= PALETTE_TOL**2 * 3: return True
    return False

def inside(pt, poly):
    x, y = pt; c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i+1) % n]
        if ((y1 > y) != (y2 > y)) and x < (x2-x1)*(y-y1)/(y2-y1) + x1: c = not c
    return c

def grow(poly, f=GROW):
    cx = sum(p[0] for p in poly)/len(poly); cy = sum(p[1] for p in poly)/len(poly)
    return [[cx + (p[0]-cx)*f, cy + (p[1]-cy)*f] for p in poly]

def samples_of(path, n=13):
    """Area-sample a path from its anchors. Falls back to the bbox centre."""
    pts = path['pts']
    b = path['b']
    if len(pts) < 3:
        return [((b[0]+b[2])/2.0, (b[1]+b[3])/2.0)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    out = []
    for a in range(n):
        for c in range(n):
            px = x0 + (x1-x0)*(a+0.5)/n; py = y0 + (y1-y0)*(c+0.5)/n
            if inside((px, py), pts): out.append((px, py))
    return out or [((b[0]+b[2])/2.0, (b[1]+b[3])/2.0)]

def frac_in(samples, polys):
    if not samples: return 0.0
    hit = sum(1 for s in samples if any(inside(s, p) for p in polys))
    return hit / float(len(samples))

def main():
    data = json.load(open(sys.argv[1]))
    want = sys.argv[2:] or sorted(BUDGET)
    proxies, paths = data['proxies'], data['paths']
    grown = {k: [grow(p) for p in v['polys']] for k, v in proxies.items() if v['polys']}
    fails = []
    for s in want:
        mine = [p for p in paths if p['slot'] == s]
        px = proxies.get(s)
        if px is None:
            fails.append('%s: NO PROXY' % s); continue
        if not mine:
            fails.append('%s: EMPTY' % s); continue
        if s not in grown:
            fails.append('%s: proxy has no polygons' % s); continue

        # 1. path budget
        if len(mine) > BUDGET[s]:
            fails.append('%s: %d paths > budget %d' % (s, len(mine), BUDGET[s]))

        # 2+3+4. Containment against the part's OWN proxy polygon. One test replaces the
        # old bbox bounds/joint-span/shared-path trio, and is immune to legitimate
        # nesting: head-face lies wholly inside head-hair-back's BOX but also wholly
        # inside its own proxy, so it passes. A path that spans a joint or is shared
        # with a neighbour necessarily has a large fraction OUTSIDE its own proxy.
        for p in mine:
            sm = samples_of(p)
            f_own = frac_in(sm, grown[s])
            if f_own >= CONTAINED_MIN: continue
            leak = sorted(((frac_in([q for q in sm if not any(inside(q, pl) for pl in grown[s])], gp), o)
                           for o, gp in grown.items() if o != s), reverse=True)
            where = (' - %.0f%% of the escaping area is in %s' % (leak[0][0]*100, leak[0][1])) if leak and leak[0][0] > 0.2 else ''
            fails.append('%s: path %d only %.0f%% inside its own proxy%s'
                         % (s, p['i'], f_own*100, where))

        # 5. palette
        for p in mine:
            if p['c'] in ('none','other','err'): continue
            if not near_palette(p['c']):
                fails.append('%s: path %d colour #%s off-palette' % (s, p['i'], p['c']))

        # 6. no scene-wide outline path
        for p in mine:
            b = p['b']
            if (b[2]-b[0]) > 900 and (b[1]-b[3]) > 900:
                fails.append('%s: path %d is scene-scale (%dx%d) - unified outline?'
                             % (s, p['i'], b[2]-b[0], b[1]-b[3]))

        # 7. the part as a whole fills its proxy - catches scale and position drift,
        #    which is how cropped per-part images destroy the shared coordinate space
        ux0 = min(p['b'][0] for p in mine); ux1 = max(p['b'][2] for p in mine)
        uy1 = max(p['b'][1] for p in mine); uy0 = min(p['b'][3] for p in mine)
        pb = px['b']
        pw, ph = pb[2]-pb[0], pb[1]-pb[3]
        aw, ah = ux1-ux0, uy1-uy0
        if pw > 0 and ph > 0 and (aw < 0.55*pw or ah < 0.55*ph):
            fails.append('%s: art %dx%d fills too little of proxy %dx%d - cropped or misplaced?'
                         % (s, aw, ah, pw, ph))

        if not any(f.startswith(s + ':') for f in fails):
            print('PASS %-16s %d paths' % (s, len(mine)))
    for f in fails: print('FAIL ' + f)
    return 1 if fails else 0

if __name__ == '__main__':
    sys.exit(main())
