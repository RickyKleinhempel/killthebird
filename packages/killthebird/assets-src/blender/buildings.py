"""Deer stand (with peek anchor), windmill (with rotating blades), barn, church."""

import math

from mathutils import Vector

from common import Part, empty


def _planks(p, color, x0, x1, z0, z1, y, count, axis="z", thickness=0.06, gap=0.025, alt=None):
    """Wall of horizontal planks between x0..x1 and z0..z1 at depth y (in the XZ plane)."""
    h = (z1 - z0 - gap * (count - 1)) / count
    for i in range(count):
        z = z0 + i * (h + gap) + h / 2
        c = alt if (alt and i % 2) else color
        v = p.box(c, (x1 - x0, thickness, h), loc=((x0 + x1) / 2, y, z))
        p.jitter(v, 0.006)


def deer_stand():
    p = Part("deer_stand")
    floor = 3.0
    cabin = 1.95
    # Splayed legs with X braces
    legs = []
    for x in (-0.75, 0.75):
        for y in (-0.7, 0.7):
            top = Vector((x, y, floor))
            bottom = Vector((x * 1.25, y * 1.25, 0))
            p.beam("wood_dark", bottom, top, 0.14)
            legs.append((bottom, top))
    for (b0, t0), (b1, t1) in ((legs[0], legs[2]), (legs[1], legs[3]), (legs[0], legs[1]), (legs[2], legs[3])):
        lo0, lo1 = b0.lerp(t0, 0.15), b1.lerp(t1, 0.15)
        hi0, hi1 = b0.lerp(t0, 0.85), b1.lerp(t1, 0.85)
        p.beam("wood", lo0, hi1, 0.06)
        p.beam("wood", lo1, hi0, 0.06)
    # Ladder in front
    for x in (-0.28, 0.28):
        p.box("wood", (0.07, 0.07, 3.3), loc=(x, -1.35, 1.55), rot=(-0.3, 0, 0))
    for i in range(7):
        z = 0.3 + i * 0.42
        y = -1.35 - (z - 1.55) * math.tan(-0.3)
        p.box("wood_light", (0.6, 0.06, 0.05), loc=(0, y, z))
    # Platform
    p.box("wood", (1.8, 1.8, 0.12), loc=(0, 0, floor))
    for y in (-0.88, 0.88):
        p.box("wood_dark", (1.86, 0.06, 0.14), loc=(0, y, floor - 0.02))
    # Front rail: three planks (hides the chicken), dark interior back wall
    _planks(p, "wood", -0.85, 0.85, floor + 0.06, floor + 0.86, -0.82, 3, alt="wood_light")
    p.box("wood_dark", (1.6, 0.06, cabin), loc=(0, 0.79, floor + cabin / 2))  # dark back wall reads as an opening
    _planks(p, "wood", -0.85, 0.85, floor + 0.06, floor + cabin, 0.84, 6, alt="wood_light")
    # Side walls (planks running front to back)
    for x in (-0.82, 0.82):
        for i in range(6):
            h = cabin / 6 - 0.02
            z = floor + 0.06 + i * (h + 0.02) + h / 2
            p.box("wood_light" if i % 2 else "wood", (0.06, 1.7, h), loc=(x, 0, z))
    for x in (-0.82, 0.82):
        p.box("wood_dark", (0.11, 0.11, cabin + 0.05), loc=(x, -0.82, floor + cabin / 2))
        p.box("wood_dark", (0.11, 0.11, cabin + 0.05), loc=(x, 0.82, floor + cabin / 2))
    # Roof: boards with roofing felt and a trim
    roof_z = floor + cabin + 0.08
    p.box("wood_dark", (2.05, 2.15, 0.06), loc=(0, 0.05, roof_z - 0.05), rot=(0.18, 0, 0))
    p.box("roof", (2.0, 2.1, 0.07), loc=(0, 0.05, roof_z), rot=(0.18, 0, 0))
    for i in range(5):
        y = -0.9 + i * 0.45
        p.box("roof_dark", (2.02, 0.04, 0.02), loc=(0, y + 0.05, roof_z + 0.04 - y * 0.18), rot=(0.18, 0, 0))
    p.build()
    # Anchor on the platform floor: bottom centre of the hidden chicken.
    empty("Peek", location=(0, -0.3, floor + 0.06))


def windmill():
    t = Part("windmill")
    # Stone plinth and plastered tower with timber bands
    v = t.tube("stone", [(0, 0, 0), (0, 0, 0.55)], [1.6, 1.55], sides=10)
    t.jitter([x for x in v if x.co.z > 0.1], 0.03)
    t.tube("wall", [(0, 0, 0.5), (0, 0, 3.0), (0, 0, 5.4)], [1.45, 1.22, 0.98], sides=10)
    for z, r in ((1.5, 1.39), (4.2, 1.1)):
        t.tube("wood_dark", [(0, 0, z), (0, 0, z + 0.12)], [r + 0.03, r + 0.02], sides=10)
    # Arched door with frame
    t.box("wood_dark", (0.74, 0.12, 1.15), loc=(0, -1.48, 0.62), rot=(0.07, 0, 0))
    t.cyl("wood_dark", 0.37, 0.12, 8, loc=(0, -1.44, 1.2), rot=(math.pi / 2 + 0.07, 0, 0), base=False)
    t.box("white", (0.86, 0.1, 0.07), loc=(0, -1.5, 0.05))
    for x in (-0.18, 0.18):
        t.box("wood", (0.05, 0.13, 1.0), loc=(x, -1.5, 0.6), rot=(0.07, 0, 0))
    # Windows with shutters
    for z, a in ((2.1, -1.2), (3.4, -1.95), (3.4, -0.6), (4.6, -1.6)):
        r = 1.45 - (z - 0.5) / 4.9 * 0.47 + 0.02
        c = Vector((math.cos(a) * r, math.sin(a) * r, z))
        yaw = a + math.pi / 2
        t.box("white", (0.42, 0.08, 0.55), loc=c, rot=(0, 0, yaw))
        t.box("eye", (0.32, 0.1, 0.44), loc=c, rot=(0, 0, yaw))
        side = Vector((math.cos(yaw), math.sin(yaw), 0))
        for s in (1, -1):
            t.box("cloth", (0.18, 0.06, 0.5), loc=c + side * s * 0.32, rot=(0, 0, yaw))
    # Gallery with railing
    gz = 2.6
    t.tube("wood", [(0, 0, gz - 0.08), (0, 0, gz + 0.04)], [1.78, 1.78], sides=16)
    for i in range(20):
        a = i * math.tau / 20
        t.box("wood_dark", (0.05, 0.05, 0.55), loc=(math.cos(a) * 1.72, math.sin(a) * 1.72, gz + 0.3))
    t.torus("wood_dark", 1.72, 0.035, 20, 4, loc=(0, 0, gz + 0.58))
    t.torus("wood_dark", 1.72, 0.025, 20, 4, loc=(0, 0, gz + 0.32))
    # Shingled cap: stacked frustums, finial
    rings = [(1.2, 1.05, 5.35, "roof"), (1.08, 0.88, 5.62, "roof_dark"), (0.9, 0.64, 5.9, "roof"), (0.66, 0.36, 6.18, "roof_dark")]
    for r0, r1, z, color in rings:
        t.cone(color, r0, r1, 0.32, 10, loc=(0, 0, z))
    t.cone("roof", 0.38, 0.0, 0.55, 10, loc=(0, 0, 6.48))
    t.ico("gold", 0.08, 1, loc=(0, 0, 7.06))
    t.box("roof", (0.55, 1.0, 0.55), loc=(0, -0.95, 5.62))  # axle housing
    # Tail pole with steering wheel at the back
    t.beam("wood_dark", (0, 0.9, 5.5), (0, 3.2, 0.8), 0.14)
    t.beam("wood_dark", (0, 0.6, 5.0), (0, 2.6, 2.3), 0.08)
    t.torus("wood", 0.38, 0.04, 12, 4, loc=(0, 3.25, 0.75), rot=(0, math.pi / 2, 0))
    for k in range(4):
        a = k * math.pi / 4
        t.beam("wood", (0, 3.25 + math.cos(a) * 0.38, 0.75 + math.sin(a) * 0.38), (0, 3.25 - math.cos(a) * 0.38, 0.75 - math.sin(a) * 0.38), 0.03)
    tower = t.build()

    b = Part("Blades")
    b.cyl("wood_dark", 0.24, 0.42, 10, loc=(0, 0, 0), rot=(math.pi / 2, 0, 0), base=False)
    b.cone("gold", 0.12, 0.0, 0.2, 8, loc=(0, -0.21, 0), rot=(math.pi / 2, 0, 0))
    for i in range(4):
        a = i * math.pi / 2 + 0.15
        ca, sa = math.cos(a), math.sin(a)
        along = Vector((ca, 0, sa))
        across = Vector((-sa, 0, ca))
        # Stock (spar)
        b.beam("wood_dark", along * 0.2 + Vector((0, -0.12, 0)), along * 3.95 + Vector((0, -0.12, 0)), 0.11, 0.09)
        # Lattice: two rails and cross bars, then the sail cloth (two sails reefed)
        off = 0.36
        for k in (0.0, 0.62):
            b.beam("wood", along * 0.8 + across * (off - 0.31 + k) + Vector((0, -0.16, 0)),
                   along * 3.9 + across * (off - 0.31 + k) + Vector((0, -0.16, 0)), 0.045)
        for k in range(8):
            r = 0.85 + k * 0.43
            b.beam("wood", along * r + across * (off - 0.34) + Vector((0, -0.17, 0)), along * r + across * (off + 0.34) + Vector((0, -0.17, 0)), 0.035)
        sail_len = 3.0 if i % 2 == 0 else 1.6
        # beam(): width = depth (Y), height = across the blade -> a thin sheet facing the camera
        b.beam("white", along * 0.85 + across * off + Vector((0, -0.14, 0)), along * (0.85 + sail_len) + across * off + Vector((0, -0.14, 0)),
               0.02, 0.6)
    b.build(parent=tower, location=(0, -1.45, 5.6))


def barn():
    p = Part("barn")
    w, d, h = 4.2, 3.0, 2.6
    p.box("cloth_red", (w, d, h), loc=(0, 0, h / 2))
    p.box("stone", (w + 0.1, d + 0.1, 0.25), loc=(0, 0, 0.12))
    # Vertical boards (grooves) on front and sides
    for i in range(13):
        x = -w / 2 + 0.16 + i * (w - 0.32) / 12
        p.box("barn_dark", (0.035, 0.03, h - 0.3), loc=(x, -d / 2 - 0.005, h / 2 + 0.1))
    for s in (1, -1):
        for i in range(9):
            y = -d / 2 + 0.15 + i * (d - 0.3) / 8
            p.box("barn_dark", (0.03, 0.035, h - 0.3), loc=(s * (w / 2 + 0.005), y, h / 2 + 0.1))
    # Corner trims
    for x in (-w / 2, w / 2):
        for y in (-d / 2, d / 2):
            p.box("white", (0.12, 0.12, h), loc=(x, y, h / 2))
    # Gable walls + trims
    p.prism("cloth_red", w, d, 1.3, loc=(0, 0, h), rot=(0, 0, 0))
    for s in (1, -1):
        p.beam("white", (-w / 2 - 0.05, s * (d / 2 + 0.06), h), (-w / 2 - 0.05, 0, h + 1.32), 0.1)
    # Roof slabs with shingle rows, ridge cap
    slope = math.atan2(1.3, d / 2)
    rl = math.hypot(1.3, d / 2) + 0.35
    for s in (1, -1):
        center = Vector((0, s * (d / 4 + 0.08), h + 0.65 + 0.06))
        p.box("roof", (w + 0.5, rl, 0.09), loc=center, rot=(-s * slope, 0, 0))
        for k in range(5):
            t = -rl / 2 + 0.25 + k * (rl - 0.5) / 4
            off = Vector((0, s * math.cos(slope) * t, -math.sin(slope) * t))
            p.box("roof_dark", (w + 0.52, 0.05, 0.04), loc=center + off + Vector((0, 0, 0.06)), rot=(-s * slope, 0, 0))
    p.tube("roof_dark", [(-w / 2 - 0.25, 0, h + 1.37), (w / 2 + 0.25, 0, h + 1.37)], [0.09, 0.09], sides=5)
    # Big door with X brace and frame, hay loft with straw
    p.box("barn_dark", (1.7, 0.06, 1.95), loc=(0, -d / 2 - 0.02, 1.0))
    p.box("white", (1.82, 0.07, 0.1), loc=(0, -d / 2 - 0.04, 1.98))
    for x in (-0.88, 0.88):
        p.box("white", (0.1, 0.07, 1.95), loc=(x, -d / 2 - 0.04, 1.0))
    p.box("white", (0.04, 0.075, 1.95), loc=(0, -d / 2 - 0.045, 1.0))
    for s in (1, -1):
        p.beam("white", (-0.8, -d / 2 - 0.05, 0.12 if s > 0 else 1.9), (0.8, -d / 2 - 0.05, 1.9 if s > 0 else 0.12), 0.07, 0.03)
    p.box("eye", (0.75, 0.06, 0.65), loc=(0, -d / 2 - 0.02, 3.05))
    p.box("white", (0.85, 0.07, 0.07), loc=(0, -d / 2 - 0.04, 3.4))
    for k in range(7):
        x = -0.3 + k * 0.1
        p.tube("straw", [(x, -d / 2 + 0.05, 2.78), (x + p.rng.uniform(-0.05, 0.05), -d / 2 - 0.25, 2.72 + p.rng.uniform(-0.05, 0.05))], [0.035, 0.0], sides=3)
    # Side windows
    for s in (1, -1):
        p.box("eye", (0.06, 0.6, 0.55), loc=(s * (w / 2 + 0.01), -0.4, 1.6))
        p.box("white", (0.07, 0.7, 0.06), loc=(s * (w / 2 + 0.02), -0.4, 1.9))
    # Weathervane with a rooster on the ridge
    p.tube("eye", [(0, 0, h + 1.4), (0, 0, h + 2.15)], [0.03, 0.02], sides=4)
    p.box("eye", (0.6, 0.03, 0.03), loc=(0, 0, h + 1.85))
    p.cone("eye", 0.06, 0.0, 0.12, 3, loc=(0.32, 0, h + 1.85), rot=(0, math.pi / 2, 0), base=False)
    p.box("eye", (0.26, 0.03, 0.16), loc=(0.0, 0, h + 2.25))
    p.ico("eye", 0.07, 0, loc=(0.14, 0, h + 2.36))
    p.cone("eye", 0.1, 0.0, 0.2, 3, loc=(-0.15, 0, h + 2.27), rot=(0, -math.pi / 2 - 0.6, 0), base=False)
    p.box("comb", (0.06, 0.035, 0.05), loc=(0.15, 0, h + 2.44))
    p.build()


def church():
    p = Part("church")
    p.box("stone", (3.8, 6.2, 0.4), loc=(0, 0.6, 0.2))
    p.box("wall", (3.6, 6.0, 2.8), loc=(0, 0.6, 1.4))
    p.prism("roof", 3.95, 6.35, 1.9, loc=(0, 0.6, 2.8), rot=(0, 0, math.pi / 2))
    p.tube("roof_dark", [(0, -2.6, 4.72), (0, 3.8, 4.72)], [0.08, 0.08], sides=4)
    # Arched windows on the side
    for y in (-0.8, 0.7, 2.2):
        p.box("eye", (0.08, 0.42, 0.75), loc=(-1.81, y, 1.5))
        p.cyl("eye", 0.21, 0.08, 6, loc=(-1.81, y, 1.88), rot=(0, math.pi / 2, 0), base=False)
        p.box("stone", (0.1, 0.55, 0.08), loc=(-1.82, y, 1.08))
    # Tower
    p.box("wall", (1.75, 1.75, 5.7), loc=(0, -2.6, 2.85))
    p.box("stone", (1.9, 1.9, 0.45), loc=(0, -2.6, 0.22))
    for x in (-0.875, 0.875):  # corner quoins
        for k in range(8):
            p.box("stone", (0.14, 0.14, 0.3), loc=(x, -3.475, 0.6 + k * 0.6))
    p.box("stone", (1.85, 1.85, 0.12), loc=(0, -2.6, 4.2))
    # Belfry openings (arched) on front and sides
    for c, rot in (((0, -3.48, 4.85), 0.0), ((-0.88, -2.6, 4.85), math.pi / 2), ((0.88, -2.6, 4.85), math.pi / 2)):
        p.box("eye", (0.42, 0.08, 0.6), loc=c, rot=(0, 0, rot))
        p.cyl("eye", 0.21, 0.08, 6, loc=(c[0], c[1], c[2] + 0.3), rot=(math.pi / 2, 0, rot), base=False)
    # Clock
    p.cyl("white", 0.36, 0.06, 12, loc=(0, -3.49, 3.55), rot=(math.pi / 2, 0, 0), base=False)
    p.cyl("eye", 0.39, 0.04, 12, loc=(0, -3.47, 3.55), rot=(math.pi / 2, 0, 0), base=False)
    p.box("eye", (0.04, 0.06, 0.26), loc=(0.0, -3.53, 3.65))
    p.box("eye", (0.2, 0.06, 0.04), loc=(0.08, -3.53, 3.55))
    # Spire with golden cross
    p.cone("roof", 1.3, 0.0, 3.8, 8, loc=(0, -2.6, 5.7), rot=(0, 0, math.pi / 8))
    p.tube("gold", [(0, -2.6, 9.4), (0, -2.6, 10.2)], [0.05, 0.05], sides=4)
    p.box("gold", (0.4, 0.08, 0.08), loc=(0, -2.6, 9.95))
    # Door with steps
    p.box("wood_dark", (0.6, 0.08, 1.0), loc=(0, -3.49, 0.85))
    p.cyl("wood_dark", 0.3, 0.08, 6, loc=(0, -3.49, 1.35), rot=(math.pi / 2, 0, 0), base=False)
    p.box("stone", (1.0, 0.5, 0.15), loc=(0, -3.7, 0.08))
    p.build()
