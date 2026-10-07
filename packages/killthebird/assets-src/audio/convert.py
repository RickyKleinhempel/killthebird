"""Converts audio files to MP3 with Blender's bundled FFmpeg (no extra install needed).

blender --background --factory-startup --python convert.py -- <job.json>

job.json: [{"src": "in.ogg", "dst": "out.mp3", "start": 0.0, "duration": null, "volume": 1.0,
            "fade_out": 0.0, "bitrate": 128}, ...]
"""

import json
import os
import sys
import time

import bpy


def wait_for_file(path, timeout=180.0):
    """sound.mixdown encodes in a background job; wait until the file stops growing."""
    last, stable, waited = -1, 0, 0.0
    while waited < timeout:
        size = os.path.getsize(path) if os.path.exists(path) else -1
        stable = stable + 1 if size == last and size > 0 else 0
        if stable >= 8:
            return size
        last = size
        time.sleep(0.1)
        waited += 0.1
    raise RuntimeError(f"mixdown did not finish: {path}")


def convert(job):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    fps = 100
    scene.render.fps = fps
    scene.render.fps_base = 1
    if scene.sequence_editor is None:
        scene.sequence_editor_create()
    seq = scene.sequence_editor
    strips = seq.strips if hasattr(seq, "strips") else seq.sequences
    strip = strips.new_sound("src", job["src"], channel=1, frame_start=1)
    strip.volume = job.get("volume", 1.0)

    start = float(job.get("start") or 0.0)
    total = strip.frame_final_duration / fps
    duration = job.get("duration") or (total - start)
    duration = max(0.05, min(duration, total - start))
    # Trim by offsetting the strip and limiting the scene range.
    strip.frame_start = 1 - int(round(start * fps))
    scene.frame_start = 1
    scene.frame_end = 1 + int(round(duration * fps))

    fade = float(job.get("fade_out") or 0.0)
    if fade > 0:
        end = scene.frame_end
        strip.volume = job.get("volume", 1.0)
        strip.keyframe_insert("volume", frame=max(1, end - int(fade * fps)))
        strip.volume = 0.0
        strip.keyframe_insert("volume", frame=end)

    if os.path.exists(job["dst"]):
        os.remove(job["dst"])
    wav = job["dst"].lower().endswith(".wav")  # WAV output is used for analysis only
    bpy.ops.sound.mixdown(
        filepath=job["dst"],
        check_existing=False,
        container="WAV" if wav else "MP3",
        codec="PCM" if wav else "MP3",
        format="S16",
        bitrate=int(job.get("bitrate", 128)),
        mixrate=44100,
        channels="STEREO" if job.get("stereo") else "MONO",
    )
    size = wait_for_file(job["dst"])
    print(f"[audio] {os.path.basename(job['dst'])} {duration:.2f}s {size / 1024:.1f} KB")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    with open(argv[0], encoding="utf-8") as f:
        jobs = json.load(f)
    for job in jobs:
        convert(job)


main()
