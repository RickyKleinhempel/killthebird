"""Background: mountain range with rock bands and snow caps, and clouds."""

import math

from mathutils import Vector

from common import Part


def _peak(p, x, y, h, r, sides=11):
    """Mountain built from stacked rings so faces can be coloured by height."""
    levels = [0.0, 0.28, 0.52, 0.72, 0.88, 1.0]
    radii = [r, r * 0.74, r * 0.5, r * 0.3, r * 0.14, 0.0]
    phase = p.rng.uniform(0, math.tau)
    points = [Vector((x, y, h * t)) for t in levels]
    verts = p.tube("mountain", points, radii, sides=sides, twist=0.35)
    # Ridges: push every other ring vertex outwards, jitter heights
    for v in set(verts):
        if 0.5 < v.co.z < h * 0.97:
            d = Vector((v.co.x - x, v.co.y - y, 0))
            a = math.atan2(d.y, d.x)
            ridge = 1.0 + 0.16 * math.cos(3 * a + phase) + p.rng.uniform(-0.06, 0.06)
            v.co.x = x + d.x * ridge
            v.co.y = y + d.y * ridge
            v.co.z += p.rng.uniform(-0.04, 0.04) * h
    snow_line = h * p.rng.uniform(0.62, 0.7)
    for f in Part.faces_of(verts):
        cz = f.calc_center_median().z + p.rng.uniform(-0.06, 0.06) * h
        if cz > snow_line:
            p.paint([f], "snow")
        elif cz < h * 0.3:
            p.paint([f], "mountain_dark")


def mountains():
    p = Part("mountains", seed=11)
    for x, y, h, r in [(-62, 6, 55, 42), (-30, 0, 84, 56), (5, 12, 70, 50), (38, -4, 96, 60), (74, 8, 62, 46), (100, 14, 48, 36)]:
        _peak(p, x, y, h, r)
    p.build()


def cloud():
    p = Part("cloud", seed=5)
    puffs = [(0, 0, 0.2, 3.7), (3.7, 0.4, -0.5, 2.9), (-3.9, -0.2, -0.7, 2.7), (1.5, -0.6, 1.6, 2.5),
             (-1.7, 0.5, 1.2, 2.3), (5.9, -0.3, -1.0, 1.9), (-6.0, 0.3, -1.1, 1.7)]
    for x, y, z, r in puffs:
        v = p.ico("cloud", r, 2, loc=(x, y, z), scale=(1, 0.85, 0.82))
        p.jitter(v, r * 0.05)
    p.clamp_z(list(p.bm.verts), -1.7)
    p.build()
