"""Builds every game model and exports it as GLB.

blender --background --factory-startup --python build_all.py -- --out <dir> [--only a,b] [--previews <dir>]
"""

import argparse
import importlib
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import common  # noqa: E402

# model name -> (module, function)
MODELS = {
    "chicken": ("chicken", "build"),
    "tree_pine": ("vegetation", "tree_pine"),
    "tree_pine_far": ("vegetation", "tree_pine_far"),
    "tree_oak": ("vegetation", "tree_oak"),
    "tree_oak_far": ("vegetation", "tree_oak_far"),
    "tree_birch": ("vegetation", "tree_birch"),
    "bush": ("vegetation", "bush"),
    "grass": ("vegetation", "grass"),
    "heather": ("vegetation", "heather"),
    "reeds": ("vegetation", "reeds"),
    "haybale": ("props", "haybale"),
    "log_pile": ("props", "log_pile"),
    "fence": ("props", "fence"),
    "stump": ("props", "stump"),
    "rock": ("props", "rock"),
    "pumpkin": ("props", "pumpkin"),
    "signpost": ("props", "signpost"),
    "scarecrow": ("props", "scarecrow"),
    "deer_stand": ("buildings", "deer_stand"),
    "windmill": ("buildings", "windmill"),
    "barn": ("buildings", "barn"),
    "church": ("buildings", "church"),
    "mountains": ("landscape", "mountains"),
    "cloud": ("landscape", "cloud"),
}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--only", default="")
    p.add_argument("--previews", default="")
    return p.parse_args(argv)


def main():
    args = parse_args()
    os.makedirs(args.out, exist_ok=True)
    only = [n for n in args.only.split(",") if n]
    names = only or list(MODELS)
    preview = None
    if args.previews:
        import preview as preview_module

        preview = preview_module
        os.makedirs(args.previews, exist_ok=True)

    failed = []
    for name in names:
        module_name, fn_name = MODELS[name]
        started = time.time()
        try:
            common.reset_scene()
            module = importlib.import_module(module_name)
            animated = bool(getattr(module, fn_name)())
            path = os.path.join(args.out, f"{name}.glb")
            common.export_glb(path, animations=animated)
            size = os.path.getsize(path)
            print(f"[models] {name:<11} {size / 1024:7.1f} KB  {time.time() - started:4.1f}s")
            if preview:
                preview.render(os.path.join(args.previews, f"{name}.png"))
        except Exception as exc:  # keep building the others
            import traceback

            traceback.print_exc()
            failed.append(name)
            print(f"[models] {name} FAILED: {exc}")
    if failed:
        print(f"[models] failed: {', '.join(failed)}")
        sys.exit(1)


main()
