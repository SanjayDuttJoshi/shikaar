/** Static level description produced by the seeded generator. Every peer builds the same level from the same seed. */

export enum Theme {
  Asylum = "asylum",
  Haveli = "haveli",
}

export enum CellKind {
  Void = 0,
  Room = 1,
  Corridor = 2,
  Courtyard = 3,
}

export enum RoomKind {
  Corridor = "corridor",
  Courtyard = "courtyard",
  Ward = "ward",
  Cell = "cell",
  Office = "office",
  Bathroom = "bathroom",
  Theatre = "theatre",
  Storage = "storage",
  LockerRoom = "locker-room",
  Baithak = "baithak",
  Bedroom = "bedroom",
  Kitchen = "kitchen",
  Puja = "puja",
  Store = "store",
}

/** What separates two neighbouring cells. */
export enum EdgeKind {
  /** Same room, or an open archway between corridor pieces / courtyard and verandah. */
  Open = 0,
  Wall = 1,
  Door = 2,
}

export enum KeyColor {
  Red = 0,
  Blue = 1,
  Green = 2,
  Yellow = 3,
  Purple = 4,
}

export enum DoorKind {
  Wood = "wood",
  Metal = "metal",
  /** The way out. Opens only after every fuse is in the fuse box. */
  MainGate = "main-gate",
}

export enum ItemKind {
  Key = "key",
  Fuse = "fuse",
  Battery = "battery",
  Medkit = "medkit",
  /** A sealed envelope: opening it plays the next story film. */
  Envelope = "envelope",
}

/** Who is hunting you. The Shikari roams the whole building; the others guard their own wing. */
export enum MonsterKind {
  Shikari = "shikari",
  Chudail = "chudail",
  Mareez = "mareez",
}

/** Scripted scares placed in the building, triggered when someone walks into them. */
export enum SetPieceKind {
  /** A body drops on a rope from the ceiling right in front of you. */
  FallingBody = "falling-body",
  /** Someone sobbing in a corner. Get close and they turn, shriek and vanish. */
  CryingFigure = "crying-figure",
  /** A cat on top of a cupboard that yowls and leaps past you. */
  Cat = "cat",
  /** A rooster that explodes into flapping and crowing. */
  Rooster = "rooster",
  /** A rocking chair that starts rocking by itself when you walk in. */
  RockingChair = "rocking-chair",
  /** An old radio that crackles to life with a voice. */
  Radio = "radio",
}

export enum PropKind {
  HospitalBed = "hospital-bed",
  MetalLocker = "metal-locker",
  Wheelchair = "wheelchair",
  MetalCabinet = "metal-cabinet",
  Desk = "desk",
  Chair = "chair",
  IvStand = "iv-stand",
  Trolley = "trolley",
  Shelf = "shelf",
  Sink = "sink",
  Bathtub = "bathtub",
  OperatingTable = "operating-table",
  Crate = "crate",
  Barrel = "barrel",
  Wardrobe = "wardrobe",
  Chest = "chest",
  Charpai = "charpai",
  Table = "table",
  Rug = "rug",
  Pot = "pot",
  Pillar = "pillar",
  Lantern = "lantern",
  Mirror = "mirror",
  Cradle = "cradle",
  FuseBox = "fuse-box",
}

/** Where a piece of furniture goes inside its room. */
export enum FurnishSpot {
  Wall = "wall",
  Center = "center",
}

export enum HideKind {
  Locker = "locker",
  Wardrobe = "wardrobe",
  UnderBed = "under-bed",
}

export enum LightKind {
  TubeLight = "tube-light",
  Bulb = "bulb",
  Lantern = "lantern",
  Diya = "diya",
  Moon = "moon",
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room {
  id: number;
  kind: RoomKind;
  rect: CellRect;
  wing: number;
}

export interface Door {
  id: number;
  /** Cell on the low side (smaller x for vertical edges, smaller y for horizontal edges). */
  cx: number;
  cy: number;
  /** true when the door sits on the edge between (cx,cy) and (cx+1,cy); false for (cx,cy)-(cx,cy+1). */
  vertical: boolean;
  kind: DoorKind;
  lock: KeyColor | null;
  /** Doors that start open (unlocked internal doors are sometimes left ajar). */
  startsOpen: boolean;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface Placement extends Vec2 {
  /** Rotation around Y in radians. 0 = model faces +Z. */
  yaw: number;
}

export interface PropSpawn extends Placement {
  id: number;
  kind: PropKind;
  roomId: number;
  /** Footprint in metres (before rotation): width along local X, depth along local Z. */
  w: number;
  d: number;
  h: number;
  /** Players and monsters collide with it. */
  solid: boolean;
  /** Blocks the monster's sight line (tall furniture). */
  blocksSight: boolean;
}

export interface HideSpot extends Placement {
  id: number;
  kind: HideKind;
  propId: number;
}

export interface ItemSpawn extends Vec2 {
  id: number;
  kind: ItemKind;
  /** Height the item rests at (floor or a table top). */
  y: number;
  color: KeyColor | null;
  roomId: number;
  /** Story page index for notes, -1 otherwise. */
  note: number;
}

export interface MonsterSpawn extends Placement {
  kind: MonsterKind;
  /** Wing it guards; -1 means it roams everywhere. */
  wing: number;
}

export interface SetPiece extends Placement {
  id: number;
  kind: SetPieceKind;
  roomId: number;
  /** Fires when a player comes within `radius` of (tx, tz). */
  tx: number;
  tz: number;
  radius: number;
  /** Height the thing sits at (cat on a cupboard, body hanging from the ceiling). */
  y: number;
}

export interface LightSpawn extends Vec2 {
  id: number;
  kind: LightKind;
  y: number;
  /** 0 = dead, 1 = steady, between = flickers that often. */
  flicker: number;
  dead: boolean;
  roomId: number;
}

export interface Wing {
  id: number;
  rect: CellRect;
  /** Wing this one is unlocked from; -1 for the start wing. */
  parent: number;
  /** Colour of the doors leading into this wing; null for the start wing. */
  lock: KeyColor | null;
  depth: number;
}

export interface Level {
  seed: number;
  theme: Theme;
  /** Size in cells. */
  width: number;
  height: number;
  /** Room id per cell (row-major), -1 outside the building. */
  roomOf: Int16Array;
  kindOf: Uint8Array;
  /** Edge between (x,y) and (x+1,y): index y*width+x. */
  edgeX: Uint8Array;
  /** Edge between (x,y) and (x,y+1): index y*width+x. */
  edgeY: Uint8Array;
  /** Door id on that edge, or -1. */
  doorX: Int16Array;
  doorY: Int16Array;
  rooms: Room[];
  wings: Wing[];
  doors: Door[];
  props: PropSpawn[];
  hideSpots: HideSpot[];
  items: ItemSpawn[];
  lights: LightSpawn[];
  spawns: Placement[];
  exitDoorId: number;
  fuseBoxPropId: number;
  fusesNeeded: number;
  monsterSpawns: MonsterSpawn[];
  setPieces: SetPiece[];
  /** Story pages placed in this building (indexes into the building's story). */
  notes: number[];
}

export interface LevelOptions {
  seed: number;
  theme: Theme;
  players: number;
}
