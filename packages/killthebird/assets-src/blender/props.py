"""Small props and the shootable bonus objects (pumpkin, signpost, scarecrow)."""

import math

from mathutils import Vector

from common import Part


def fence():
    p = Part("fence")
    for x, lean in ((-1.05, 0.04), (1.05, -0.05)):
        v = p.box("wood_dark", (0.14, 0.14, 1.15), loc=(x, 0, 0.55), rot=(0, lean, 0))
        p.jitter(v, 0.012)
        p.cone("wood_dark", 0.1, 0.0, 0.14, 4, loc=(x + lean * 1.1, 0, 1.12), rot=(0, 0, math.pi / 4))
        # little grass collar around the post
        for k in range(5):
            a = k * 1.25
            base = Vector((x + math.cos(a) * 0.1, math.sin(a) * 0.1, 0))
            p.tube("grass", [base, base + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0.28))], [0.025, 0.0], sides=3)
    rails = [(0.88, 0.02, "wood"), (0.6, -0.025, "wood_light"), (0.34, 0.015, "wood")]
    for z, tilt, color in rails:
        v = p.box(color, (2.35, 0.06, 0.12), loc=(0, -0.09, z), rot=(0, tilt, 0))
        p.jitter(v, 0.01)
        for x in (-1.05, 1.05):
            p.box("stone_dark", (0.025, 0.02, 0.025), loc=(x, -0.125, z + x * tilt * -1))  # nail heads
    p.build()


def stump():
    p = Part("stump")
    v = p.tube("bark", [(0, 0, 0), (0, 0, 0.3), (0, 0, 0.56)], [0.5, 0.44, 0.41], sides=9)
    p.jitter([x for x in v if x.co.z > 0.05], 0.035)
    # Year rings on the cut
    p.cyl("wood_light", 0.38, 0.025, 9, loc=(0, 0, 0.555))
    p.cyl("wood", 0.27, 0.03, 9, loc=(0, 0, 0.56))
    p.cyl("wood_light", 0.16, 0.035, 9, loc=(0, 0, 0.565))
    p.cyl("wood_dark", 0.05, 0.04, 6, loc=(0, 0, 0.57))
    # Roots
    for a in (0.3, 1.9, 3.4, 4.8):
        d = Vector((math.cos(a), math.sin(a), 0))
        p.tube("bark", [d * 0.36 + Vector((0, 0, 0.18)), d * 0.56 + Vector((0, 0, 0.05)), d * 0.7 + Vector((0, 0, -0.07))], [0.12, 0.08, 0.04], sides=5)
    # Fly agarics
    for (x, y, h, r) in ((0.42, -0.38, 0.18, 0.11), (0.58, -0.18, 0.12, 0.08), (-0.5, -0.32, 0.14, 0.09)):
        p.tube("white", [(x, y, 0), (x, y, h)], [0.03, 0.025], sides=5)
        cap = p.ico("mushroom", r, 1, loc=(x, y, h), scale=(1, 1, 0.55))
        p.clamp_z(cap, h - 0.005)
        for k in range(4):
            a = k * 1.7 + 0.4
            p.ico("white", r * 0.17, 0, loc=(x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55, h + r * 0.42))
    p.build()


def rock():
    p = Part("rock")
    v = p.ico("stone", 0.58, 2, loc=(0, 0, 0.16), scale=(1.25, 1.0, 0.72))
    p.jitter(v, 0.07)
    p.clamp_z(v)
    # darker underside faces, moss on top
    faces = Part.faces_of(v)
    p.paint([f for f in faces if f.calc_center_median().z < 0.12], "stone_dark")
    p.paint([f for f in faces if f.normal.z > 0.75 and f.calc_center_median().x < 0.25], "moss")
    v2 = p.ico("stone", 0.3, 1, loc=(0.62, -0.22, 0.08), scale=(1, 0.9, 0.75))
    p.jitter(v2, 0.04)
    p.clamp_z(v2)
    for x, y in ((-0.7, -0.3), (0.3, -0.62), (-0.35, 0.55)):
        pv = p.ico("stone_dark", 0.1, 0, loc=(x, y, 0.03), scale=(1.2, 1, 0.6))
        p.clamp_z(pv)
    p.build()


def pumpkin():
    p = Part("pumpkin")
    # Lathe: profile rings from bottom to top, 20 segments, radius modulated by 10 lobes.
    lobes, sides = 10, 20
    profile = [(0.02, 0.12), (0.08, 0.3), (0.2, 0.42), (0.33, 0.44), (0.46, 0.36), (0.54, 0.2), (0.56, 0.06)]
    v = p.tube("pumpkin", [(0, 0, z) for z, _ in profile], [r for _, r in profile], sides=sides)
    for x in set(v):
        d = math.hypot(x.co.x, x.co.y)
        if d < 1e-4:
            continue
        a = math.atan2(x.co.y, x.co.x)
        k = 1 - 0.1 * (0.5 - 0.5 * math.cos(lobes * a))  # valleys between lobes
        x.co.x *= k
        x.co.y *= k
    for f in Part.faces_of(v):
        c = f.calc_center_median()
        if math.cos(lobes * math.atan2(c.y, c.x)) < -0.6 or c.z > 0.53:
            p.paint([f], "pumpkin_dark")
    # Curly stem, leaf and tendril
    p.tube("stem", [(0, 0, 0.52), (0.02, 0.01, 0.63), (0.09, 0.03, 0.71), (0.16, 0.02, 0.69)], [0.06, 0.045, 0.035, 0.025], sides=5)
    leaf = p.ico("leaf", 0.2, 1, loc=(-0.2, -0.08, 0.55), scale=(1.4, 0.9, 0.22), rot=(0.2, -0.35, 0.4))
    p.jitter(leaf, 0.02)
    pts = [(0.05 + 0.1 * math.cos(t) * (1 - t / 9), -0.05 + 0.1 * math.sin(t) * (1 - t / 9), 0.5 + t * 0.012) for t in [i * 0.6 for i in range(11)]]
    p.tube("stem", [(-0.02, 0.0, 0.53)] + [(x - 0.3, y - 0.15, z - 0.1) for x, y, z in pts], [0.012] * 11 + [0.0], sides=3)
    p.build()


def signpost():
    post = Part("signpost")
    v = post.box("wood_dark", (0.14, 0.14, 2.3), loc=(0, 0, 1.15))
    post.jitter(v, 0.01)
    # Bird house on top
    post.box("wood", (0.26, 0.24, 0.26), loc=(0, 0, 2.43))
    post.prism("roof", 0.36, 0.34, 0.16, loc=(0, 0, 2.56), rot=(0, 0, math.pi / 2))
    post.cyl("eye", 0.045, 0.02, 8, loc=(0, -0.12, 2.45), rot=(math.pi / 2, 0, 0), base=False)
    post.box("wood_dark", (0.03, 0.08, 0.03), loc=(0, -0.16, 2.37))
    for k in range(4):  # grass at the foot
        a = k * 1.6
        base = Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, 0))
        post.tube("grass", [base, base + Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, 0.35))], [0.03, 0.0], sides=3)
    post_obj = post.build()

    sign = Part("Sign")
    boards = [(0.0, 0.66, 1, 0.08), (-0.38, 0.58, -1, -0.14), (-0.74, 0.52, 1, 0.32)]
    for z, length, direction, yaw in boards:
        c, s = math.cos(yaw), math.sin(yaw)
        cx = direction * (length / 2 + 0.05)
        sign.box("wood_dark", (length + 0.04, 0.045, 0.25), loc=(cx * c, cx * s + 0.01, z), rot=(0, 0, yaw))  # frame
        sign.box("wood_light", (length, 0.05, 0.21), loc=(cx * c, cx * s, z), rot=(0, 0, yaw))
        tip = direction * (length + 0.05 + 0.1)
        sign.cone("wood_light", 0.16, 0.0, 0.21, 3, loc=(tip * c, tip * s, z),
                  rot=(math.pi / 2, 0, yaw + (math.pi / 2 if direction > 0 else -math.pi / 2)), base=False)
        # painted "letters"
        n = int(length / 0.11)
        for k in range(n):
            lx = direction * (0.12 + k * 0.1) if direction > 0 else direction * (0.12 + k * 0.1)
            h = 0.08 if k % 3 else 0.11
            sign.box("eye", (0.05, 0.056, h), loc=(lx * c + s * -0.0, lx * s - 0.006, z), rot=(0, 0, yaw))
    # nails
    sign.box("stone_dark", (0.03, 0.08, 0.03), loc=(0, -0.03, 0.0))
    sign.box("stone_dark", (0.03, 0.08, 0.03), loc=(0, -0.03, -0.38))
    sign.box("stone_dark", (0.03, 0.08, 0.03), loc=(0, -0.03, -0.74))
    sign.build(parent=post_obj, location=(0, 0, 1.95))


def scarecrow():
    body = Part("scarecrow")
    body.box("wood_dark", (0.1, 0.1, 2.2), loc=(0, 0.06, 1.1))
    body.box("wood_dark", (1.75, 0.09, 0.09), loc=(0, 0.06, 1.6))
    # Shirt with a patch, buttons and rope belt
    body.cone("cloth", 0.33, 0.27, 0.78, 7, loc=(0, 0, 1.08), scale=(1, 0.72, 1))
    body.box("cloth_red", (0.16, 0.04, 0.16), loc=(0.12, -0.22, 1.42), rot=(0, 0.2, 0))
    for k, z in enumerate((1.5, 1.36, 1.22)):
        body.ico("wood_light", 0.028, 1, loc=(-0.02, -0.215, z))
    body.torus("straw_dark", 0.31, 0.035, 14, 4, loc=(0, 0, 1.12), scale=(1, 0.74, 1))
    body.tube("straw_dark", [(0.05, -0.24, 1.1), (0.07, -0.27, 0.95)], [0.025, 0.02], sides=4)
    # Straw collar
    for k in range(9):
        a = k * math.tau / 9
        base = Vector((math.cos(a) * 0.14, math.sin(a) * 0.1, 1.84))
        body.tube("straw", [base, base + Vector((math.cos(a) * 0.12, math.sin(a) * 0.09, -0.06))], [0.03, 0.0], sides=3)
    # Sleeves along the cross bar, straw hands
    for s in (1, -1):
        body.tube("cloth", [(0.15 * s, 0.03, 1.62), (0.5 * s, 0.03, 1.6), (0.78 * s, 0.03, 1.58)], [0.13, 0.12, 0.11], sides=6)
        body.box("cloth_brown", (0.14, 0.04, 0.12), loc=(0.45 * s, -0.09, 1.62), rot=(0, 0.3 * s, 0))
        for k in range(5):
            a = (k - 2) * 0.35
            d = Vector((math.cos(a) * s, 0, math.sin(a)))
            base = Vector((0.8 * s, 0.03, 1.58))
            body.tube("straw", [base, base + d * 0.24], [0.028, 0.0], sides=3)
    # Trousers with a knee patch, straw feet
    for s in (1, -1):
        body.tube("cloth_brown", [(0.11 * s, 0.02, 1.12), (0.13 * s, 0.02, 0.85), (0.14 * s, 0.02, 0.62)], [0.11, 0.1, 0.095], sides=6)
        for k in range(4):
            a = k * 1.6
            base = Vector((0.14 * s, 0.02, 0.62))
            body.tube("straw", [base, base + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, -0.16))], [0.03, 0.0], sides=3)
    body.box("cloth_red", (0.12, 0.04, 0.12), loc=(-0.13, -0.09, 0.84))
    # Sack head: button eyes, stitched grin, carrot nose
    v = body.ico("straw", 0.25, 2, loc=(0, 0, 2.03), scale=(1, 0.95, 1.05))
    body.jitter(v, 0.015)
    for s in (1, -1):
        body.ico("eye", 0.045, 1, loc=(0.085 * s, -0.215, 2.09), scale=(1, 0.6, 1))
        body.box("wood_light", (0.06, 0.03, 0.01), loc=(0.085 * s, -0.245, 2.09), rot=(0, 0.6, 0))
    for k in range(6):
        t = (k - 2.5) / 2.5
        body.box("eye", (0.02, 0.03, 0.05), loc=(t * 0.11, -0.228 + abs(t) * 0.01, 1.95 + t * t * 0.03))
    body.cone("pumpkin", 0.035, 0.0, 0.16, 5, loc=(0, -0.22, 2.03), rot=(math.pi / 2 + 0.2, 0, 0))
    body_obj = body.build()

    hat = Part("Hat")
    v = hat.cyl("straw", 0.44, 0.04, 12)
    hat.jitter(v, 0.015)
    crown = hat.cone("straw", 0.23, 0.18, 0.34, 9, loc=(0, 0, 0.03))
    hat.jitter([x for x in crown if x.co.z > 0.3], 0.03)
    hat.cyl("cloth_red", 0.235, 0.07, 9, loc=(0, 0, 0.05))
    hat.box("cloth", (0.1, 0.03, 0.09), loc=(0.08, -0.205, 0.2))
    hat.tube("leaf_yellow", [(0.2, -0.05, 0.1), (0.3, -0.02, 0.32), (0.36, 0.04, 0.45)], [0.03, 0.02, 0.0], sides=3, flatten=0.4)
    hat.build(parent=body_obj, location=(0, 0, 2.24))


def haybale():
    p = Part("haybale")
    # Round bale lying on its side (axis along X)
    v = p.tube("straw", [(-0.6, 0, 0.62), (0.6, 0, 0.62)], [0.62, 0.62], sides=12)
    p.jitter(v, 0.02)
    for x in (-0.61, 0.61):
        for r in (0.42, 0.22):
            p.torus("straw_dark", r, 0.035, 12, 4, loc=(x, 0, 0.62), rot=(0, math.pi / 2, 0))
    p.torus("straw_dark", 0.63, 0.03, 14, 4, loc=(-0.2, 0, 0.62), rot=(0, math.pi / 2, 0))
    p.torus("straw_dark", 0.63, 0.03, 14, 4, loc=(0.2, 0, 0.62), rot=(0, math.pi / 2, 0))
    for k in range(8):  # loose straw
        a = p.rng.uniform(0, math.tau)
        x = p.rng.uniform(-0.55, 0.55)
        base = Vector((x, math.cos(a) * 0.6, 0.62 + math.sin(a) * 0.6))
        d = Vector((p.rng.uniform(-0.3, 0.3), math.cos(a), math.sin(a)))
        p.tube("straw", [base, base + d * 0.18], [0.02, 0.0], sides=3)
    p.clamp_z(list(p.bm.verts), 0.0)
    p.build()


def log_pile():
    p = Part("log_pile")
    rows = [(-0.5, 0.0), (0.0, 0.0), (0.5, 0.0), (-0.25, 0.43), (0.25, 0.43), (0.0, 0.86)]
    for i, (y, z) in enumerate(rows):
        r = 0.24 + p.rng.uniform(-0.02, 0.02)
        x0 = p.rng.uniform(-0.08, 0.08)
        v = p.tube("bark", [(-1.0 + x0, y, z + r), (1.0 + x0, y, z + r)], [r, r], sides=8)
        p.jitter(v, 0.015)
        for x in (-1.0 + x0, 1.0 + x0):
            p.cyl("wood_light", r * 0.85, 0.02, 8, loc=(x, y, z + r), rot=(0, math.pi / 2, 0), base=False)
            p.cyl("wood", r * 0.4, 0.024, 6, loc=(x, y, z + r), rot=(0, math.pi / 2, 0), base=False)
    p.build()
