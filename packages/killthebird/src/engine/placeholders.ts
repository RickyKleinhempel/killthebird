import {
  AnimationClip,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  NumberKeyframeTrack,
  Object3D,
  QuaternionKeyframeTrack,
  Quaternion,
  Euler,
  type BufferGeometry,
} from "three";
import { paletteMaterial, type PaletteName } from "./materials";
import type { ModelName } from "./models";

/**
 * Code-built stand-ins for every model. They are used when a GLB cannot be
 * loaded, so the game always stays playable. Conventions match the Blender
 * exports: origin at ground contact, +Y up, front facing +Z, birds face +X.
 */

function part(geometry: BufferGeometry, material: PaletteName, x = 0, y = 0, z = 0, name?: string): Mesh {
  const mesh = new Mesh(geometry, paletteMaterial(material));
  mesh.position.set(x, y, z);
  if (name) mesh.name = name;
  return mesh;
}

function group(name: string, ...children: Object3D[]): Group {
  const g = new Group();
  g.name = name;
  g.add(...children);
  return g;
}

function chicken(): { scene: Object3D; animations: AnimationClip[] } {
  const body = part(new IcosahedronGeometry(0.3, 0), "chicken_body", 0, 0, 0, "Body");
  body.scale.set(1.35, 0.9, 0.9);
  const head = part(new IcosahedronGeometry(0.15, 0), "chicken_body", 0.38, 0.17, 0);
  const beak = part(new ConeGeometry(0.05, 0.14, 4), "beak", 0.54, 0.15, 0);
  beak.rotation.z = -Math.PI / 2;
  const comb = part(new BoxGeometry(0.12, 0.08, 0.03), "comb", 0.38, 0.32, 0);
  const tail = part(new ConeGeometry(0.12, 0.28, 4), "chicken_wing", -0.42, 0.1, 0);
  tail.rotation.z = Math.PI / 2 + 0.5;
  const wingGeo = new BoxGeometry(0.34, 0.04, 0.5);
  wingGeo.translate(0, 0, 0.25);
  const wingL = part(wingGeo, "chicken_wing", 0, 0.1, 0.14, "WingL");
  const wingRGeo = wingGeo.clone();
  wingRGeo.translate(0, 0, -0.5);
  const wingR = part(wingRGeo, "chicken_wing", 0, 0.1, -0.14, "WingR");
  const scene = group("chicken", body, head, beak, comb, tail, wingL, wingR);

  const times = [0, 0.15, 0.3];
  const q = (x: number) => new Quaternion().setFromEuler(new Euler(x, 0, 0)).toArray();
  const flapL = new QuaternionKeyframeTrack("WingL.quaternion", times, [...q(-0.9), ...q(0.7), ...q(-0.9)]);
  const flapR = new QuaternionKeyframeTrack("WingR.quaternion", times, [...q(0.9), ...q(-0.7), ...q(0.9)]);
  const bob = new NumberKeyframeTrack("Body.position[y]", times, [0, 0.04, 0]);
  return { scene, animations: [new AnimationClip("fly", 0.3, [flapL, flapR, bob])] };
}

function pine(): Object3D {
  return group(
    "tree_pine",
    part(new CylinderGeometry(0.12, 0.18, 1.2, 5), "bark", 0, 0.6, 0),
    part(new ConeGeometry(1.1, 2.0, 6), "leaf_dark", 0, 1.9, 0),
    part(new ConeGeometry(0.8, 1.6, 6), "leaf_dark", 0, 2.9, 0),
    part(new ConeGeometry(0.5, 1.2, 6), "leaf_dark", 0, 3.7, 0),
  );
}

function oak(): Object3D {
  return group(
    "tree_oak",
    part(new CylinderGeometry(0.18, 0.28, 2.2, 6), "bark", 0, 1.1, 0),
    part(new IcosahedronGeometry(1.4, 0), "leaf", 0, 3.0, 0),
    part(new IcosahedronGeometry(0.9, 0), "leaf_autumn", 0.8, 2.6, 0.4),
    part(new IcosahedronGeometry(0.9, 0), "leaf", -0.8, 2.7, -0.2),
  );
}

function windmill(): Object3D {
  const blades = new Group();
  blades.name = "Blades";
  for (let i = 0; i < 4; i++) {
    const arm = new Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(part(new BoxGeometry(0.5, 3.2, 0.06), "white", 0, 1.8, 0));
    blades.add(arm);
  }
  blades.add(part(new CylinderGeometry(0.2, 0.2, 0.3, 8), "wood_dark", 0, 0, 0).rotateX(Math.PI / 2));
  blades.position.set(0, 5.6, 1.05);
  return group(
    "windmill",
    part(new CylinderGeometry(0.9, 1.4, 5.6, 8), "wall", 0, 2.8, 0),
    part(new ConeGeometry(1.25, 1.6, 8), "roof", 0, 6.4, 0),
    blades,
  );
}

function deerStand(): Object3D {
  const legs = [-0.6, 0.6].flatMap((x) =>
    [-0.6, 0.6].map((z) => part(new BoxGeometry(0.12, 3, 0.12), "wood_dark", x, 1.5, z)),
  );
  const peek = new Object3D();
  peek.name = "Peek";
  peek.position.set(0, 3.55, 0.75);
  return group(
    "deer_stand",
    ...legs,
    part(new BoxGeometry(1.5, 0.1, 1.5), "wood", 0, 3, 0),
    part(new BoxGeometry(1.5, 0.7, 0.08), "wood", 0, 3.4, 0.72),
    part(new BoxGeometry(1.7, 0.1, 1.7), "roof", 0, 4.4, 0),
    part(new BoxGeometry(0.1, 1.4, 1.5), "wood", -0.72, 3.7, 0),
    part(new BoxGeometry(0.1, 1.4, 1.5), "wood", 0.72, 3.7, 0),
    peek,
  );
}

function scarecrow(): Object3D {
  const hat = group("Hat", part(new CylinderGeometry(0.42, 0.42, 0.05, 10), "straw", 0, 0, 0), part(new CylinderGeometry(0.2, 0.24, 0.32, 10), "straw", 0, 0.18, 0));
  hat.position.set(0, 2.2, 0);
  return group(
    "scarecrow",
    part(new BoxGeometry(0.1, 2.0, 0.1), "wood_dark", 0, 1.0, 0),
    part(new BoxGeometry(1.6, 0.1, 0.1), "wood_dark", 0, 1.55, 0),
    part(new BoxGeometry(0.6, 0.8, 0.3), "cloth", 0, 1.35, 0),
    part(new IcosahedronGeometry(0.22, 0), "straw", 0, 1.95, 0),
    hat,
  );
}

function signpost(): Object3D {
  const sign = group("Sign", part(new BoxGeometry(1.1, 0.25, 0.05), "wood", 0.3, 0, 0), part(new BoxGeometry(0.9, 0.22, 0.05), "wood", -0.25, -0.35, 0.02));
  sign.position.set(0, 1.6, 0);
  return group("signpost", part(new BoxGeometry(0.12, 1.9, 0.12), "wood_dark", 0, 0.95, 0), sign);
}

function barn(): Object3D {
  const roof = part(new ConeGeometry(3.2, 1.8, 4), "roof", 0, 3.4, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  return group("barn", part(new BoxGeometry(4.2, 2.5, 3), "cloth_red", 0, 1.25, 0), roof, part(new BoxGeometry(1.2, 1.6, 0.05), "wood_dark", 0, 0.8, 1.52));
}

function church(): Object3D {
  return group(
    "church",
    part(new BoxGeometry(4, 3, 6), "wall", 0, 1.5, 0),
    part(new ConeGeometry(3.3, 2, 4).rotateY(Math.PI / 4), "roof", 0, 4, 0),
    part(new BoxGeometry(1.6, 6, 1.6), "wall", 0, 3, 3),
    part(new ConeGeometry(1.2, 3, 4).rotateY(Math.PI / 4), "roof", 0, 7.5, 3),
  );
}

function mountains(): Object3D {
  const g = new Group();
  g.name = "mountains";
  const peaks = [
    [-40, 70, 60],
    [0, 95, 70],
    [45, 80, 65],
  ] as const;
  for (const [x, h, r] of peaks) {
    g.add(part(new ConeGeometry(r, h, 7), "mountain", x, h / 2, 0));
    g.add(part(new ConeGeometry(r * 0.3, h * 0.3, 7), "snow", x, h * 0.86, 0));
  }
  return g;
}

function cloud(): Object3D {
  return group(
    "cloud",
    part(new IcosahedronGeometry(4, 0), "cloud", 0, 0, 0),
    part(new IcosahedronGeometry(3, 0), "cloud", 4, -0.8, 0.5),
    part(new IcosahedronGeometry(2.8, 0), "cloud", -4.2, -1, -0.3),
  );
}

function birch(): Object3D {
  return group(
    "tree_birch",
    part(new CylinderGeometry(0.06, 0.12, 4.2, 6), "white", 0, 2.1, 0),
    part(new IcosahedronGeometry(0.8, 0), "leaf_autumn", 0, 4.2, 0),
    part(new IcosahedronGeometry(0.6, 0), "leaf", 0.4, 3.6, 0.2),
  );
}

const builders: Record<ModelName, () => Object3D> = {
  chicken: () => chicken().scene,
  tree_pine: pine,
  tree_pine_far: pine,
  tree_oak: oak,
  tree_oak_far: oak,
  tree_birch: birch,
  heather: () => group("heather", part(new IcosahedronGeometry(0.4, 0).scale(1, 0.6, 1), "heather", 0, 0.2, 0)),
  reeds: () => {
    const g = new Group();
    g.name = "reeds";
    for (let i = 0; i < 6; i++) g.add(part(new ConeGeometry(0.03, 1.5, 3), "grass_dry", (i - 3) * 0.1, 0.75, (i % 2) * 0.1));
    return g;
  },
  haybale: () => group("haybale", part(new CylinderGeometry(0.6, 0.6, 1.2, 10).rotateZ(Math.PI / 2), "straw", 0, 0.6, 0)),
  log_pile: () => group("log_pile", part(new BoxGeometry(2, 0.9, 1.4), "wood", 0, 0.45, 0)),
  bush: () => group("bush", part(new IcosahedronGeometry(0.7, 0), "leaf_dark", 0, 0.45, 0), part(new IcosahedronGeometry(0.5, 0), "leaf", 0.5, 0.35, 0.2)),
  grass: () => {
    const g = new Group();
    g.name = "grass";
    for (let i = 0; i < 5; i++) {
      const blade = part(new ConeGeometry(0.06, 0.7, 3), i % 2 ? "grass" : "grass_dry", (i - 2) * 0.09, 0.35, (i % 3) * 0.05);
      blade.rotation.z = (i - 2) * 0.18;
      g.add(blade);
    }
    return g;
  },
  fence: () => group("fence", part(new BoxGeometry(0.1, 1, 0.1), "wood_dark", -1, 0.5, 0), part(new BoxGeometry(0.1, 1, 0.1), "wood_dark", 1, 0.5, 0), part(new BoxGeometry(2.2, 0.12, 0.05), "wood", 0, 0.75, 0), part(new BoxGeometry(2.2, 0.12, 0.05), "wood", 0, 0.4, 0)),
  stump: () => group("stump", part(new CylinderGeometry(0.4, 0.5, 0.6, 7), "bark", 0, 0.3, 0)),
  rock: () => group("rock", part(new IcosahedronGeometry(0.5, 0), "stone", 0, 0.25, 0)),
  deer_stand: deerStand,
  signpost,
  scarecrow,
  windmill,
  barn,
  church,
  pumpkin: () => group("pumpkin", part(new IcosahedronGeometry(0.35, 1).scale(1, 0.75, 1), "pumpkin", 0, 0.26, 0), part(new CylinderGeometry(0.04, 0.05, 0.15, 5), "stem", 0, 0.58, 0)),
  mountains,
  cloud,
};

export function buildPlaceholder(name: ModelName): { scene: Object3D; animations: AnimationClip[] } {
  if (name === "chicken") return chicken();
  return { scene: builders[name](), animations: [] };
}
