export enum Quality {
  Low = "low",
  Medium = "medium",
  High = "high",
}

/** Surface materials the level and procedural props are built from. Each theme maps them to textures. */
export enum Surface {
  WallLower = "wall-lower",
  WallUpper = "wall-upper",
  Floor = "floor",
  CourtyardFloor = "courtyard-floor",
  Ceiling = "ceiling",
  Trim = "trim",
  DoorWood = "door-wood",
  DoorMetal = "door-metal",
  Metal = "metal",
  Wood = "wood",
  Fabric = "fabric",
  Stone = "stone",
  Brick = "brick",
  Brass = "brass",
  Carpet = "carpet",
  Ground = "ground",
}

export interface QualitySettings {
  pixelRatio: number;
  torchShadow: number;
  lightPool: number;
  postFx: boolean;
  antialias: boolean;
  drawDistance: number;
  /** Squad members' torches that light the world (the rest only glow). */
  mateTorches: number;
}

/** Decal textures in public/assets/textures/decals. */
export enum DecalKind {
  GrimeLeak1 = "grime-leak-1",
  GrimeLeak2 = "grime-leak-2",
  GrimeStreak = "grime-streak",
  WaterStain = "water-stain",
  BloodSmear = "blood-smear",
  BloodSpatter1 = "blood-spatter-1",
  BloodSpatter2 = "blood-spatter-2",
  BloodPool = "blood-pool",
  Crack1 = "crack-1",
  Crack2 = "crack-2",
}
