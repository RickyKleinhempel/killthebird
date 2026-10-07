"""Renders a quick Workbench preview of the current scene (3/4 front view)."""

import math

import bpy
from mathutils import Vector


def _scene_bounds():
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def render(path, size=512):
    # Show the rest pose: stacked NLA tracks (fly + idle) would otherwise blend.
    for obj in bpy.context.scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = True
        if "rest_loc" in obj:
            obj.location = obj["rest_loc"]
            obj.rotation_euler = obj["rest_rot"]
    _render(path, size, Vector((0.55, -1.0, 0.45)), 2.3)
    _render(path.replace(".png", "_front.png"), size, Vector((0.0, -1.0, 0.12)), 2.2)


def _render(path, size, direction, distance):
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    lo, hi = _scene_bounds()
    center = (lo + hi) / 2
    radius = max((hi - lo).length / 2, 0.1)

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 50
    cam = bpy.data.objects.new("PreviewCam", cam_data)
    scene.collection.objects.link(cam)
    direction = direction.normalized()
    cam.location = center + direction * radius * distance
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "VERTEX"
    shading.show_shadows = True
    shading.show_cavity = False
    scene.display.render_aa = "8"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

    bpy.data.objects.remove(cam)
    bpy.data.cameras.remove(cam_data)
