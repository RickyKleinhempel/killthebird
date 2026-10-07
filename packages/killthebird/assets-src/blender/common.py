"""Shared helpers for the procedural low-poly models.

Conventions (Blender space, Z up):
  * origin = ground contact point, model stands on z = 0
  * the front faces -Y (becomes +Z / towards the game camera in glTF)
  * birds face +X
  * named sub-objects (Blades, Hat, Sign, Peek, WingL, WingR, Body, Pupils, XEyes) are used by the game code

Colours are stored as per-face vertex colours from PALETTE and every mesh gets one
shared material ("vc"). That keeps each object at a single draw call in the game,
however many colours it has. Clouds use their own material ("cloud") because the
game renders them unlit.
"""

import math
import random

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

TAU = math.tau

# Must match src/engine/materials.ts (sRGB hex).
PALETTE = {
    "grass": 0x7D8F3C,
    "grass_dry": 0xA89A55,
    "heather": 0x7A5A6A,
    "heather_flower": 0x9B5AA8,
    "leaf": 0x557F30,
    "leaf_dark": 0x3A5D2B,
    "leaf_autumn": 0xC4782D,
    "leaf_yellow": 0xD9B23A,
    "pine": 0x2F5130,
    "moss": 0x6F8A3A,
    "reed": 0x8A8F45,
    "bark": 0x5B3F2A,
    "bark_white": 0xE8E4DA,
    "wood": 0x8F6A43,
    "wood_light": 0xB08A5A,
    "wood_dark": 0x5E4630,
    "stone": 0x8D8A83,
    "stone_dark": 0x6E6B66,
    "roof": 0x9A3F2F,
    "roof_dark": 0x7A3226,
    "wall": 0xE0D5BD,
    "white": 0xF1ECE2,
    "pumpkin": 0xE0761F,
    "pumpkin_dark": 0xB85A14,
    "stem": 0x4E6B2A,
    "straw": 0xD8B860,
    "straw_dark": 0xB89A45,
    "cloth": 0x4D6A8C,
    "cloth_red": 0xA83A32,
    "cloth_brown": 0x6B5638,
    "barn_dark": 0x7E2A24,
    "berry": 0xB52A2A,
    "mushroom": 0xC8352D,
    "chicken_body": 0x7B4A2B,
    "chicken_wing": 0x5E3720,
    "chicken_belly": 0xC08A50,
    "feather_dark": 0x3D2414,
    "beak": 0xEAA832,
    "beak_dark": 0xC98A22,
    "comb": 0xCC2F28,
    "eye": 0x141414,
    "gold": 0xD8A93B,
    "mountain": 0x7E8796,
    "mountain_dark": 0x6B7383,
    "snow": 0xF3F5F9,
    "cloud": 0xFFFFFF,
}

UNLIT = {"cloud"}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def palette_rgba(name):
    h = PALETTE[name]
    rgb = [((h >> s) & 0xFF) / 255.0 for s in (16, 8, 0)]
    return tuple(srgb_to_linear(c) for c in rgb) + (1.0,)


def shared_material(name):
    """'vc' (vertex coloured, lit) or 'cloud' (vertex coloured, unlit in game)."""
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    if mat.node_tree is None and hasattr(mat, "use_nodes"):
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.roughness = 0.92
    return mat


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.actions, bpy.data.objects):
        for item in list(block):
            block.remove(item)


def trs(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    q = rot if isinstance(rot, Quaternion) else Euler(rot).to_quaternion()
    return Matrix.LocRotScale(Vector(loc), q, Vector(scale))


def _frame(tangent, prev_normal=None):
    t = tangent.normalized()
    if prev_normal is not None:
        n = prev_normal - t * prev_normal.dot(t)
        if n.length > 1e-5:
            n.normalize()
            return n, t.cross(n).normalized()
    up = Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((1, 0, 0))
    n = t.cross(up).normalized()
    return n, t.cross(n).normalized()


class Part:
    """Accumulates low-poly primitives into one mesh with per-face palette colours."""

    def __init__(self, name, seed=None):
        self.name = name
        self.bm = bmesh.new()
        self.colors = []
        self.rng = random.Random(seed if seed is not None else name)

    # --- colour bookkeeping (stored in material_index until build) -------------

    def _ci(self, color):
        if color not in PALETTE:
            raise KeyError(f"unknown palette colour {color!r}")
        if color not in self.colors:
            self.colors.append(color)
        return self.colors.index(color)

    def _tag(self, verts, color):
        index = self._ci(color)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = index
            f.smooth = False
        return verts

    def paint(self, faces, color):
        index = self._ci(color)
        for f in faces:
            f.material_index = index

    @staticmethod
    def faces_of(verts):
        return list({f for v in verts for f in v.link_faces})

    # --- primitives --------------------------------------------------------------

    def cone(self, color, r1, r2, depth, segments=6, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), base=True):
        """Cone / frustum along local Z; with base=True `loc` is the bottom centre."""
        m = trs(loc, rot, scale) @ Matrix.Translation((0, 0, depth / 2 if base else 0))
        res = bmesh.ops.create_cone(
            self.bm, cap_ends=True, cap_tris=False, segments=segments,
            radius1=r1, radius2=max(r2, 0.0), depth=depth, matrix=m,
        )
        return self._tag(res["verts"], color)

    def cyl(self, color, r, depth, segments=6, **kw):
        return self.cone(color, r, r, depth, segments, **kw)

    def ico(self, color, radius, subdiv=1, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        res = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=radius, matrix=trs(loc, rot, scale))
        return self._tag(res["verts"], color)

    def box(self, color, size, loc=(0, 0, 0), rot=(0, 0, 0)):
        m = trs(loc, rot) @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        return self._tag(res["verts"], color)

    def beam(self, color, p0, p1, width, height=None, roll=0.0):
        """Box from p0 to p1 (e.g. planks, braces) with a square/rect section."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        q = d.to_track_quat("X", "Z") @ Quaternion((1, 0, 0), roll)
        m = trs((p0 + p1) / 2, q) @ Matrix.Diagonal((d.length, width, height or width, 1.0))
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        return self._tag(res["verts"], color)

    def feather(self, color, base, direction, length, width, thickness=0.025, roll=0.0):
        """Flat feather/blade starting at `base`, pointing along `direction`."""
        d = Vector(direction).normalized()
        return self.beam(color, Vector(base), Vector(base) + d * length, width, thickness, roll)

    def prism(self, color, width, depth, height, loc=(0, 0, 0), rot=(0, 0, 0)):
        """Gable: triangular prism along X, ridge on top."""
        m = trs(loc, rot)
        w, d, h = width / 2, depth / 2, height
        pts = [(-w, -d, 0), (-w, d, 0), (-w, 0, h), (w, -d, 0), (w, d, 0), (w, 0, h)]
        vs = [self.bm.verts.new(m @ Vector(p)) for p in pts]
        for f in [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (1, 2, 5, 4), (0, 1, 4, 3)]:
            self.bm.faces.new([vs[i] for i in f])
        return self._tag(vs, color)

    def tube(self, color, points, radii, sides=5, twist=0.0, flatten=1.0):
        """Tube through `points` with a radius per point; radius 0 makes a pointed end.

        flatten < 1 squashes the cross-section (blades, feathers, leaves)."""
        pts = [Vector(p) for p in points]
        rings, prev_n = [], None
        for i, p in enumerate(pts):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == len(pts) - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
            n, b = _frame(t, prev_n)
            prev_n = n
            r = radii[i]
            if r <= 1e-6:
                rings.append([self.bm.verts.new(p)])
                continue
            ring = []
            for k in range(sides):
                a = twist * i + k * TAU / sides
                ring.append(self.bm.verts.new(p + (n * math.cos(a) * flatten + b * math.sin(a)) * r))
            rings.append(ring)
        for r0, r1 in zip(rings, rings[1:]):
            if len(r1) == 1 and len(r0) > 1:
                for k in range(len(r0)):
                    self.bm.faces.new((r0[k], r0[(k + 1) % len(r0)], r1[0]))
            elif len(r0) == 1 and len(r1) > 1:
                for k in range(len(r1)):
                    self.bm.faces.new((r0[0], r1[(k + 1) % len(r1)], r1[k]))
            elif len(r0) > 1:
                for k in range(sides):
                    self.bm.faces.new((r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k]))
        if len(rings[0]) > 2:
            self.bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 2:
            self.bm.faces.new(rings[-1])
        return self._tag([v for r in rings for v in r], color)

    def torus(self, color, major, minor, segments=12, sides=5, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        m = trs(loc, rot, scale)
        rings = []
        for i in range(segments):
            a = i * TAU / segments
            radial = Vector((math.cos(a), math.sin(a), 0))
            c = radial * major
            rings.append([
                self.bm.verts.new(m @ (c + radial * math.cos(b) * minor + Vector((0, 0, math.sin(b) * minor))))
                for b in (k * TAU / sides for k in range(sides))
            ])
        for i in range(segments):
            r0, r1 = rings[i], rings[(i + 1) % segments]
            for k in range(sides):
                self.bm.faces.new((r0[k], r1[k], r1[(k + 1) % sides], r0[(k + 1) % sides]))
        return self._tag([v for r in rings for v in r], color)

    def spiky_cone(self, color, radius, height, spikes=10, loc=(0, 0, 0), rot=0.0, inner=0.66, droop=0.12):
        """Conifer tier: star-shaped skirt with drooping tips, closed underneath."""
        x0, y0, z0 = loc
        ring = []
        for i in range(spikes * 2):
            a = rot + i * TAU / (spikes * 2)
            outer = i % 2 == 0
            r = radius * (1.0 if outer else inner) * self.rng.uniform(0.9, 1.08)
            z = z0 - (droop * height if outer else -0.1 * height)
            ring.append(self.bm.verts.new((x0 + math.cos(a) * r, y0 + math.sin(a) * r, z)))
        apex = self.bm.verts.new((x0 + self.rng.uniform(-0.04, 0.04), y0 + self.rng.uniform(-0.04, 0.04), z0 + height))
        under = self.bm.verts.new((x0, y0, z0 + 0.18 * height))
        n = len(ring)
        for i in range(n):
            self.bm.faces.new((ring[i], ring[(i + 1) % n], apex))
            self.bm.faces.new((ring[(i + 1) % n], ring[i], under))
        return self._tag(ring + [apex, under], color)

    def jitter(self, verts, amount, min_z=None, axis_scale=(1, 1, 1)):
        seen = set()
        for v in verts:
            if v in seen or (min_z is not None and v.co.z < min_z):
                continue
            seen.add(v)
            v.co.x += self.rng.uniform(-amount, amount) * axis_scale[0]
            v.co.y += self.rng.uniform(-amount, amount) * axis_scale[1]
            v.co.z += self.rng.uniform(-amount, amount) * axis_scale[2]
        return verts

    def clamp_z(self, verts, z_min=0.0):
        for v in verts:
            v.co.z = max(v.co.z, z_min)
        return verts

    # --- output ------------------------------------------------------------------

    def build(self, parent=None, location=(0, 0, 0)):
        mesh = bpy.data.meshes.new(self.name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(mesh)
        self.bm.free()

        attr = mesh.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
        rgba = [palette_rgba(c) for c in self.colors]
        unlit = bool(self.colors) and all(c in UNLIT for c in self.colors)
        for poly in mesh.polygons:
            color = rgba[poly.material_index]
            for li in poly.loop_indices:
                attr.data[li].color = color
            poly.material_index = 0
        mesh.color_attributes.active_color = attr
        mesh.materials.append(shared_material("cloud" if unlit else "vc"))

        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent is not None:
            obj.parent = parent
        obj.location = location
        return obj


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.empty_display_size = 0.2
    if parent is not None:
        obj.parent = parent
    obj.location = location
    return obj


def add_clip(clip, keys, fps=24):
    """Adds an animation clip.

    keys: {object: [(frame, data_path, index, value), ...]}
    Each object gets its own action inside an NLA track named `clip`; the glTF
    exporter merges tracks with the same name into one animation.
    """
    bpy.context.scene.render.fps = fps
    for obj, frames in keys.items():
        if "rest_loc" not in obj:  # remembered for previews (not exported)
            obj["rest_loc"] = list(obj.location)
            obj["rest_rot"] = list(obj.rotation_euler)
        obj.animation_data_create()
        action = bpy.data.actions.new(f"{obj.name}_{clip}")
        obj.animation_data.action = action
        rest = {}
        for frame, path, index, value in frames:
            prop = getattr(obj, path)
            rest.setdefault((path, index), prop[index])
            prop[index] = value
            obj.keyframe_insert(data_path=path, index=index, frame=frame)
        for (path, index), value in rest.items():
            getattr(obj, path)[index] = value
        start = int(min(f[0] for f in frames))
        track = obj.animation_data.nla_tracks.new()
        track.name = clip
        track.strips.new(clip, start, action)
        obj.animation_data.action = None


def export_glb(path, animations=False):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=animations,
        export_animation_mode="NLA_TRACKS",
        export_merge_animation="NLA_TRACK",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        check_existing=False,
    )


def radial(n, radius, z=0.0, phase=0.0):
    for i in range(n):
        a = phase + i * TAU / n
        yield (math.cos(a) * radius, math.sin(a) * radius, z), a
