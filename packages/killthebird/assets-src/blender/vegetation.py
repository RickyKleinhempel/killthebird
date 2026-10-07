"""Trees, bushes, grass, heather and reeds.

The *_far variants are deliberately simple; the game uses them on the distant
hills where hundreds of trees are visible at once.
"""

import math

from mathutils import Vector

from common import Part


def _roots(p, color, radius, count=4, length=0.45, thickness=0.09):
    for i in range(count):
        a = i * math.tau / count + p.rng.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        start = d * radius * 0.6 + Vector((0, 0, 0.25))
        p.tube(color, [start, d * (radius + length * 0.5) + Vector((0, 0, 0.05)), d * (radius + length) + Vector((0, 0, -0.05))],
               [thickness, thickness * 0.6, 0.0], sides=4)


def tree_pine():
    p = Part("tree_pine")
    p.tube("bark", [(0, 0, 0), (0.02, 0, 0.9), (0, 0.02, 1.8)], [0.22, 0.15, 0.09], sides=7)
    _roots(p, "bark", 0.2, 4, 0.35, 0.08)
    tiers = [(1.45, 1.35, 0.75), (1.25, 1.25, 1.35), (1.05, 1.15, 1.9), (0.86, 1.05, 2.45), (0.66, 0.95, 2.95), (0.45, 0.85, 3.4), (0.26, 0.75, 3.8)]
    for i, (r, h, z) in enumerate(tiers):
        color = "pine" if i % 2 == 0 else "leaf_dark"
        p.spiky_cone(color, r, h, spikes=9 if i < 5 else 7, loc=(p.rng.uniform(-0.04, 0.04), p.rng.uniform(-0.04, 0.04), z),
                     rot=i * 0.5, droop=0.16)
    p.build()


def tree_pine_far():
    p = Part("tree_pine_far")
    p.cone("bark", 0.17, 0.11, 1.1, 5)
    for i, (r, h, z) in enumerate([(1.25, 1.7, 0.75), (1.0, 1.5, 1.6), (0.75, 1.3, 2.4), (0.45, 1.05, 3.1)]):
        v = p.cone("pine" if i % 2 == 0 else "leaf_dark", r, 0.0, h, 6, loc=(0, 0, z), rot=(0, 0, i * 0.45))
        p.jitter([x for x in v if x.co.z < z + 0.05], 0.1)
    p.build()


def tree_oak():
    p = Part("tree_oak")
    # Slightly crooked trunk with root flare
    p.tube("bark", [(0, 0, 0), (0.06, 0.0, 1.0), (0.0, 0.05, 1.9), (-0.05, 0.02, 2.5)], [0.34, 0.25, 0.19, 0.14], sides=8)
    _roots(p, "bark", 0.3, 5, 0.5, 0.11)
    # Bark ridges
    for i in range(6):
        a = i * math.tau / 6 + 0.3
        p.tube("wood_dark", [(math.cos(a) * 0.3, math.sin(a) * 0.3, 0.1), (math.cos(a) * 0.23, math.sin(a) * 0.23, 1.2)], [0.04, 0.03], sides=3)
    # Main branches, each ending in a leaf blob
    crowns = []
    for i, (a, up, length) in enumerate([(0.2, 0.55, 1.35), (2.3, 0.6, 1.3), (4.1, 0.5, 1.4), (1.2, 0.9, 1.0), (3.3, 0.85, 1.05)]):
        start = Vector((0.0, 0.03, 1.7 + i * 0.12))
        d = Vector((math.cos(a), math.sin(a), up)).normalized()
        mid = start + d * length * 0.55 + Vector((0, 0, 0.15))
        end = start + d * length
        p.tube("bark", [start, mid, end], [0.12, 0.08, 0.04], sides=5)
        crowns.append(end)
    blobs = [("leaf", 1.25, Vector((0, 0, 3.3)))]
    colors = ["leaf", "leaf_dark", "leaf", "leaf_autumn", "leaf", "leaf_dark", "leaf_autumn", "leaf"]
    for i, end in enumerate(crowns):
        blobs.append((colors[i], p.rng.uniform(0.8, 1.05), end + Vector((0, 0, 0.25))))
    blobs += [("leaf_dark", 0.85, Vector((0.6, -0.5, 3.6))), ("leaf", 0.8, Vector((-0.55, 0.45, 3.75))), ("leaf_autumn", 0.6, Vector((0.15, 0.1, 4.2)))]
    for color, r, c in blobs:
        v = p.ico(color, r, 1, loc=c, scale=(1, 1, 0.82))
        p.jitter(v, r * 0.13)
    p.build()


def tree_oak_far():
    p = Part("tree_oak_far")
    p.cone("bark", 0.28, 0.17, 2.3, 5)
    for color, r, loc in (("leaf", 1.3, (0, 0, 3.0)), ("leaf_dark", 0.95, (0.95, 0.2, 2.65)), ("leaf_autumn", 0.9, (-0.9, -0.15, 2.75))):
        v = p.ico(color, r, 1, loc=loc, scale=(1, 1, 0.85))
        p.jitter(v, r * 0.1)
    p.build()


def tree_birch():
    p = Part("tree_birch")
    trunk = [(0, 0, 0), (0.08, 0.0, 1.3), (-0.02, 0.05, 2.6), (0.06, 0.0, 3.9), (0.02, 0.02, 4.6)]
    p.tube("bark_white", trunk, [0.15, 0.12, 0.1, 0.07, 0.03], sides=7)
    # Black bark marks
    for i in range(16):
        z = p.rng.uniform(0.2, 3.6)
        a = p.rng.uniform(0, math.tau)
        t = z / 4.6
        r = 0.15 - 0.09 * t + 0.008
        cx = 0.08 * math.sin(t * 3.2)
        p.box("eye", (0.09, 0.03, 0.035), loc=(cx + math.cos(a) * r, math.sin(a) * r, z), rot=(0, 0, a + math.pi / 2))
    # Thin branches angled upwards
    tips = []
    for i, (a, z, length) in enumerate([(0.4, 2.2, 1.0), (2.6, 2.6, 0.95), (4.4, 3.0, 0.9), (1.5, 3.4, 0.8), (5.5, 3.7, 0.7)]):
        start = Vector((0.03, 0.02, z))
        end = start + Vector((math.cos(a), math.sin(a), 1.0)).normalized() * length
        p.tube("bark_white", [start, end], [0.045, 0.015], sides=4)
        tips.append(end)
    tips.append(Vector((0.02, 0.02, 4.7)))
    for i, c in enumerate(tips):
        for k in range(2):
            off = Vector((p.rng.uniform(-0.3, 0.3), p.rng.uniform(-0.3, 0.3), p.rng.uniform(-0.25, 0.3)))
            color = "leaf" if (i + k) % 4 == 0 else "leaf_yellow"
            v = p.ico(color, p.rng.uniform(0.38, 0.52), 1, loc=c + off, scale=(1, 1, 1.15))
            p.jitter(v, 0.05)
    p.build()


def bush():
    p = Part("bush")
    blobs = [("leaf_dark", 0.62, (0, 0, 0.42)), ("leaf", 0.5, (0.52, -0.18, 0.34)), ("leaf_dark", 0.46, (-0.5, 0.12, 0.32)),
             ("leaf", 0.4, (0.15, 0.45, 0.3)), ("leaf_autumn", 0.32, (-0.25, -0.4, 0.26)), ("leaf", 0.36, (0.2, 0.05, 0.8))]
    surface = []
    for color, r, loc in blobs:
        v = p.ico(color, r, 1, loc=loc, scale=(1, 1, 0.8))
        p.jitter(v, r * 0.14)
        p.clamp_z(v)
        surface.append((Vector(loc), r))
    # Red berries on the outside
    for i in range(10):
        c, r = surface[i % len(surface)]
        a = p.rng.uniform(-math.pi * 0.9, -math.pi * 0.1)  # front half (towards -Y)
        e = p.rng.uniform(0.1, 0.9)
        d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e) * 0.8))
        p.ico("berry", 0.055, 0, loc=c + d * r * 0.95)
    p.build()


def grass():
    p = Part("grass")
    blades = 13
    for i in range(blades):
        a = i * math.tau / blades + p.rng.uniform(-0.25, 0.25)
        lean = p.rng.uniform(0.25, 0.55)
        h = p.rng.uniform(0.45, 0.9)
        base = Vector((math.cos(a) * 0.07, math.sin(a) * 0.07, 0))
        out = Vector((math.cos(a), math.sin(a), 0))
        mid = base + out * lean * h * 0.35 + Vector((0, 0, h * 0.55))
        tip = base + out * lean * h * 1.0 + Vector((0, 0, h * 0.92))
        color = "grass_dry" if i % 4 == 0 else ("moss" if i % 4 == 1 else "grass")
        p.tube(color, [base, mid, tip], [0.035, 0.026, 0.0], sides=3, flatten=0.35)
    # Two seed stalks
    for a in (0.8, 3.6):
        base = Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, 0))
        top = base + Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, 0.82))
        p.tube("straw_dark", [base, top], [0.012, 0.008], sides=3)
        p.ico("straw", 0.028, 0, loc=top + Vector((0, 0, 0.05)), scale=(0.8, 0.8, 2.0))
    p.build()


def heather():
    p = Part("heather")
    mounds = [(0, 0, 0.18, 0.45), (0.35, 0.1, 0.14, 0.32), (-0.3, -0.08, 0.13, 0.3)]
    for x, y, z, r in mounds:
        v = p.ico("leaf_dark", r, 1, loc=(x, y, z), scale=(1, 1, 0.65))
        p.jitter(v, 0.04)
        p.clamp_z(v)
    for i in range(22):
        x, y, z, r = mounds[i % 3]
        a = p.rng.uniform(0, math.tau)
        d = p.rng.uniform(0.0, 0.8) * r
        p.ico("heather_flower", p.rng.uniform(0.05, 0.075), 0, loc=(x + math.cos(a) * d, y + math.sin(a) * d, z + r * 0.62 - d * 0.45),
              scale=(1, 1, 1.5))
    p.build()


def reeds():
    p = Part("reeds")
    for i in range(11):
        a = p.rng.uniform(0, math.tau)
        d = p.rng.uniform(0.0, 0.35)
        base = Vector((math.cos(a) * d, math.sin(a) * d, 0))
        h = p.rng.uniform(1.1, 1.8)
        lean = Vector((math.cos(a), math.sin(a), 0)) * p.rng.uniform(0.05, 0.25)
        tip = base + lean + Vector((0, 0, h))
        p.tube("reed", [base, base + lean * 0.4 + Vector((0, 0, h * 0.5)), tip], [0.03, 0.022, 0.0], sides=3, flatten=0.5)
        if i % 3 == 0:
            head = base + lean * 0.8 + Vector((0, 0, h * 0.82))
            p.cyl("bark", 0.05, 0.24, 6, loc=head)
    p.build()
