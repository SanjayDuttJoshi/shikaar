import { HideKind } from "@/types/world";
import type { HideSpot, Level, Vec2 } from "@/types/world";
import { HIDE_EYE_HEIGHT, UNDER_BED_EYE_HEIGHT } from "@/game/constants";

/** Where you step out to: in front of the furniture. */
export const hideExit = (level: Level, spot: HideSpot): Vec2 => {
  const prop = level.props[spot.propId];
  const reach = prop.d / 2 + 0.55;
  const side = spot.kind === HideKind.UnderBed ? prop.w / 2 + 0.55 : reach;
  if (spot.kind === HideKind.UnderBed) {
    return { x: prop.x + Math.cos(prop.yaw) * side, z: prop.z - Math.sin(prop.yaw) * side };
  }
  return { x: prop.x + Math.sin(prop.yaw) * reach, z: prop.z + Math.cos(prop.yaw) * reach };
};

/** Camera position while hidden: inside the locker/almirah, or flat under the bed. */
export const hideEye = (level: Level, spot: HideSpot): { x: number; y: number; z: number; yaw: number } => {
  const prop = level.props[spot.propId];
  if (spot.kind === HideKind.UnderBed) {
    return { x: prop.x, y: UNDER_BED_EYE_HEIGHT, z: prop.z, yaw: prop.yaw - Math.PI / 2 };
  }
  const back = -0.05;
  return {
    x: prop.x + Math.sin(prop.yaw) * back,
    y: HIDE_EYE_HEIGHT,
    z: prop.z + Math.cos(prop.yaw) * back,
    yaw: prop.yaw + Math.PI,
  };
};

export const hideSpotFront = (level: Level, spot: HideSpot): Vec2 => hideExit(level, spot);
