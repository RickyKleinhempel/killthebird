"""The game's bird: a round, cartoony moorland grouse (faces +X).

Objects (used by the game):
  Body    - torso, head, tail, legs; parent of everything else
  WingL/R - animated wings (pivot at the shoulder)
  Pupils  - normal eyes (hidden when the bird is hit)
  XEyes   - "knocked out" cross eyes (hidden by default, shown on hit)
"""

import math

from mathutils import Quaternion, Vector

from common import Part, add_clip


def _body():
    p = Part("Body")
    # Torso: plump, slightly pear shaped, back darker than breast.
    v = p.ico("chicken_body", 0.3, 2, loc=(0, 0, 0), scale=(1.45, 1.0, 0.95))
    p.jitter(v, 0.01)
    p.ico("chicken_belly", 0.25, 2, loc=(0.13, 0, -0.07), scale=(1.15, 0.9, 0.85))
    # Speckled breast
    for i in range(9):
        a = -0.9 + i * 0.22
        p.ico("chicken_body", 0.026, 1, loc=(0.27 + 0.03 * math.cos(i), math.sin(a) * 0.17, -0.12 + 0.05 * (i % 3)),
              scale=(0.5, 1, 1.2))
    # Back: overlapping scale feathers
    for x, y in [(-0.02, 0.13), (0.1, -0.12), (-0.16, 0.0), (0.06, 0.02), (-0.22, 0.13), (-0.24, -0.12), (-0.08, -0.15), (0.14, 0.1)]:
        p.ico("chicken_wing", 0.075, 1, loc=(x, y, 0.25 - abs(x) * 0.3), scale=(1.5, 1.0, 0.32), rot=(0, 0.25, 0))

    # Neck and head
    p.ico("chicken_body", 0.15, 1, loc=(0.29, 0, 0.13), scale=(1.0, 0.92, 1.1))
    v = p.ico("chicken_body", 0.18, 2, loc=(0.42, 0, 0.27), scale=(1.05, 0.95, 1.0))
    p.jitter(v, 0.006)
    # Light cheek patches
    for s in (1, -1):
        p.ico("chicken_belly", 0.07, 1, loc=(0.47, 0.11 * s, 0.2), scale=(1.2, 0.5, 0.8))

    # Beak: upper and lower half, slightly open (comic)
    p.cone("beak", 0.065, 0.0, 0.18, 5, loc=(0.555, 0, 0.262), rot=(0, math.pi / 2 - 0.12, 0), scale=(1, 1.1, 1))
    p.cone("beak_dark", 0.045, 0.0, 0.13, 5, loc=(0.55, 0, 0.222), rot=(0, math.pi / 2 + 0.28, 0), scale=(0.9, 1.0, 1))
    # Wattle
    p.ico("comb", 0.035, 1, loc=(0.535, 0, 0.175), scale=(0.8, 0.75, 1.5))

    # Big round eyes with heavy lids (grumpy look) and the red grouse brows
    for s in (1, -1):
        p.ico("white", 0.078, 2, loc=(0.49, 0.095 * s, 0.295))
        p.ico("chicken_body", 0.085, 1, loc=(0.488, 0.095 * s, 0.338), scale=(1.05, 1.08, 0.45), rot=(0.25 * s, -0.35, 0))
        p.tube("comb", [(0.4, 0.075 * s, 0.37), (0.47, 0.115 * s, 0.405), (0.55, 0.1 * s, 0.375)], [0.026, 0.038, 0.018], sides=5)

    # Head tuft
    for a in (-0.35, 0.0, 0.35):
        p.tube("feather_dark", [(0.36, 0.0, 0.42), (0.33, 0.06 * a, 0.5), (0.27, 0.12 * a, 0.53)], [0.022, 0.016, 0.0], sides=3)

    # Tail fan: five long feathers with light tips
    for a in (-0.55, -0.27, 0.0, 0.27, 0.55):
        d = Vector((-math.cos(a), math.sin(a) * 0.9, 0.42)).normalized()
        base = Vector((-0.34, 0, 0.05))
        p.feather("chicken_wing", base, d, 0.36, 0.11, 0.022, roll=a * 0.3)
        p.feather("white", base + d * 0.33, d, 0.08, 0.1, 0.024, roll=a * 0.3)
        p.feather("feather_dark", base + d * 0.26, d, 0.07, 0.112, 0.026, roll=a * 0.3)

    # Feathered legs (grouse have fluffy feet) with toes
    for s in (1, -1):
        p.ico("chicken_belly", 0.075, 1, loc=(0.03, 0.085 * s, -0.25), scale=(1.0, 0.9, 1.3))
        p.tube("beak", [(0.02, 0.085 * s, -0.3), (-0.02, 0.085 * s, -0.4)], [0.025, 0.02], sides=4)
        for toe in (-0.45, 0.0, 0.45):
            d = Vector((math.cos(toe) * 0.6, math.sin(toe) * 0.6 * s, -0.8)).normalized()
            start = Vector((-0.02, 0.085 * s, -0.4))
            p.tube("beak", [start, start + d * 0.07], [0.016, 0.0], sides=3)
        p.tube("beak", [(-0.02, 0.085 * s, -0.4), (-0.08, 0.085 * s, -0.42)], [0.014, 0.0], sides=3)
    return p.build()


def _wing(name, side, parent):
    p = Part(name)
    s = side
    # Coverts (inner wing) and arm feathers
    p.box("chicken_body", (0.34, 0.24, 0.055), loc=(0.02, 0.12 * s, 0))
    p.box("chicken_wing", (0.3, 0.2, 0.05), loc=(-0.02, 0.32 * s, 0))
    for i, y in enumerate((0.06, 0.15, 0.24, 0.33)):
        # secondaries along the trailing edge, pointing backwards
        p.feather("chicken_wing" if i % 2 else "feather_dark", (-0.12, y * s, 0), (-1, 0.15 * s, 0), 0.16, 0.085, 0.022)
    # Primaries: long "fingers" at the wing tip, fanned outwards
    for i, a in enumerate((-0.55, -0.3, -0.05, 0.2, 0.45)):
        d = Vector((math.sin(a) * 0.9 - 0.25, math.cos(a) * s, 0.0)).normalized()
        base = Vector((0.04 - i * 0.04, 0.42 * s, 0))
        p.feather("feather_dark", base, d, 0.2 + 0.03 * (2 - abs(i - 2)), 0.06, 0.02)
    # Light stripe on the coverts
    p.box("chicken_belly", (0.04, 0.32, 0.06), loc=(0.14, 0.2 * s, 0.002))
    return p.build(parent=parent, location=(0.0, 0.16 * s, 0.11))


def _eyes(parent):
    pupils = Part("Pupils")
    for s in (1, -1):
        pupils.ico("eye", 0.042, 2, loc=(0.548, 0.123 * s, 0.298))
        pupils.ico("white", 0.013, 1, loc=(0.575, 0.128 * s, 0.318))
    pupils_obj = pupils.build(parent=parent)

    x = Part("XEyes")
    for s in (1, -1):
        center = Vector((0.552, 0.122 * s, 0.298))
        normal = (center - Vector((0.49, 0.095 * s, 0.295))).normalized()
        q = normal.to_track_quat("X", "Z")
        for roll in (math.pi / 4, -math.pi / 4):
            r = q @ Quaternion((1, 0, 0), roll)
            x.box("eye", (0.014, 0.018, 0.085), loc=center, rot=r)
    x_obj = x.build(parent=parent)
    return pupils_obj, x_obj


def build():
    body = _body()
    wing_l = _wing("WingL", 1, body)
    wing_r = _wing("WingR", -1, body)
    _eyes(body)

    # Flap cycle: 9 frames at 24 fps (~0.33 s), wings fully up -> down -> up.
    up, down = 1.0, -0.7
    add_clip("fly", {
        wing_l: [(1, "rotation_euler", 0, up), (5, "rotation_euler", 0, down), (9, "rotation_euler", 0, up)],
        wing_r: [(1, "rotation_euler", 0, -up), (5, "rotation_euler", 0, -down), (9, "rotation_euler", 0, -up)],
        body: [(1, "location", 2, -0.035), (5, "location", 2, 0.045), (9, "location", 2, -0.035)],
    })

    # Idle for the peeking chicken: wings folded along the body, curious head tilt.
    fold = 1.35
    add_clip("idle", {
        wing_l: [(1, "rotation_euler", 0, -fold), (25, "rotation_euler", 0, -fold + 0.12), (49, "rotation_euler", 0, -fold)],
        wing_r: [(1, "rotation_euler", 0, fold), (25, "rotation_euler", 0, fold - 0.12), (49, "rotation_euler", 0, fold)],
        body: [(1, "rotation_euler", 0, 0.0), (13, "rotation_euler", 0, 0.12), (25, "rotation_euler", 0, 0.0),
               (37, "rotation_euler", 0, -0.1), (49, "rotation_euler", 0, 0.0)],
    })
    return True  # animated
