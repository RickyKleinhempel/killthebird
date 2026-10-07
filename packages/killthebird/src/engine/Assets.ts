import { Box3, Vector3, type AnimationClip, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { canonicalizeMaterials } from "./materials";
import { MODEL_NAMES, type ModelName } from "./models";
import { buildPlaceholder } from "./placeholders";

export interface ModelAsset {
  scene: Object3D;
  animations: AnimationClip[];
  /** True when the GLB could not be loaded and a code-built stand-in is used. */
  placeholder: boolean;
}

export type ModelLibrary = Record<ModelName, ModelAsset>;

// Shared across game instances (e.g. React StrictMode remounts) so models are
// fetched and parsed once per page. Instances only ever clone from here.
const cache = new Map<string, Promise<ModelAsset>>();
let loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

function loadModel(url: string, name: ModelName): Promise<ModelAsset> {
  let promise = cache.get(url);
  if (!promise) {
    promise = getLoader()
      .loadAsync(url)
      .then((gltf): ModelAsset => {
        canonicalizeMaterials(gltf.scene);
        return { scene: gltf.scene, animations: gltf.animations, placeholder: false };
      })
      .catch((): ModelAsset => {
        cache.delete(url); // allow a retry on the next mount
        const fallback = buildPlaceholder(name);
        return { ...fallback, placeholder: true };
      });
    cache.set(url, promise);
  }
  return promise;
}

export async function loadModels(
  baseUrl: string,
  onProgress: (progress: number) => void,
): Promise<ModelLibrary> {
  let done = 0;
  const entries = await Promise.all(
    MODEL_NAMES.map(async (name) => {
      const asset = await loadModel(`${baseUrl}models/${name}.glb`, name);
      done++;
      onProgress(done / MODEL_NAMES.length);
      return [name, asset] as const;
    }),
  );
  const library = Object.fromEntries(entries) as ModelLibrary;
  const missing = entries.filter(([, a]) => a.placeholder).map(([n]) => n);
  if (missing.length > 0) {
    console.warn(
      `[killthebird] ${missing.length} model(s) not found under ${baseUrl}models/, using built-in stand-ins: ${missing.join(", ")}. ` +
        "Did you run `npx killthebird copy-assets` and set assetsBaseUrl?",
    );
  }
  return library;
}

/** Deep-clones a model; geometry and materials stay shared. */
export function instantiate(asset: ModelAsset): Object3D {
  return asset.scene.clone(true);
}

/**
 * Scales a freshly instantiated model so its x-extent equals `length` and
 * moves it so its centre (or bottom centre) sits at the local origin.
 */
export function fitToLength(model: Object3D, length: number, anchor: "center" | "bottom"): void {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const k = length / Math.max(size.x, 0.001);
  model.scale.multiplyScalar(k);
  const c = box.getCenter(new Vector3()).multiplyScalar(k);
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y -= anchor === "center" ? c.y : box.min.y * k;
}
