import * as THREE from "three";
import type { SurfaceProbe } from "@/render3d/items-view";

const MAX_LIFT = 0.6;

/** Casts straight down onto the furniture to find where a small item should rest. */
export const createSurfaceProbe = (props: THREE.Object3D): SurfaceProbe => {
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  props.updateMatrixWorld(true);
  return (x, z, near) => {
    origin.set(x, near + MAX_LIFT, z);
    ray.set(origin, down);
    ray.far = MAX_LIFT * 2 + 0.2;
    const hit = ray.intersectObject(props, true)[0];
    return hit ? hit.point.y + 0.01 : null;
  };
};
