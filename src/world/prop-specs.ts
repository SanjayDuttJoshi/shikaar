import { FurnishSpot, HideKind, PropKind, RoomKind } from "@/types/world";

export interface PropSpec {
  /** Width along local X, depth along local Z (the model faces +Z), height. Metres. */
  w: number;
  d: number;
  h: number;
  solid: boolean;
  blocksSight: boolean;
  hide: HideKind | null;
  /** Items may be placed on top. */
  surface: boolean;
}

export const PROP_SPECS: Record<PropKind, PropSpec> = {
  [PropKind.HospitalBed]: { w: 1.0, d: 2.1, h: 0.62, solid: true, blocksSight: false, hide: HideKind.UnderBed, surface: false },
  [PropKind.MetalLocker]: { w: 0.62, d: 0.55, h: 1.95, solid: true, blocksSight: true, hide: HideKind.Locker, surface: false },
  [PropKind.Wheelchair]: { w: 0.65, d: 0.85, h: 0.95, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.MetalCabinet]: { w: 0.9, d: 0.45, h: 1.1, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Desk]: { w: 1.4, d: 0.7, h: 0.76, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Chair]: { w: 0.5, d: 0.5, h: 0.9, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.IvStand]: { w: 0.45, d: 0.45, h: 1.9, solid: false, blocksSight: false, hide: null, surface: false },
  [PropKind.Trolley]: { w: 0.9, d: 0.5, h: 0.9, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Shelf]: { w: 1.2, d: 0.45, h: 2.0, solid: true, blocksSight: true, hide: null, surface: false },
  [PropKind.Sink]: { w: 0.6, d: 0.45, h: 0.9, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.Bathtub]: { w: 0.8, d: 1.7, h: 0.6, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.OperatingTable]: { w: 0.8, d: 2.0, h: 0.95, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Crate]: { w: 0.8, d: 0.8, h: 0.8, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Barrel]: { w: 0.6, d: 0.6, h: 0.9, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.Wardrobe]: { w: 1.2, d: 0.6, h: 2.0, solid: true, blocksSight: true, hide: HideKind.Wardrobe, surface: false },
  [PropKind.Chest]: { w: 1.0, d: 0.55, h: 0.6, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Charpai]: { w: 1.0, d: 2.0, h: 0.55, solid: true, blocksSight: false, hide: HideKind.UnderBed, surface: true },
  [PropKind.Table]: { w: 1.2, d: 0.8, h: 0.75, solid: true, blocksSight: false, hide: null, surface: true },
  [PropKind.Rug]: { w: 2.2, d: 3.0, h: 0.02, solid: false, blocksSight: false, hide: null, surface: false },
  [PropKind.Pot]: { w: 0.45, d: 0.45, h: 0.55, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.Pillar]: { w: 0.42, d: 0.42, h: 3.2, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.Lantern]: { w: 0.25, d: 0.25, h: 0.4, solid: false, blocksSight: false, hide: null, surface: false },
  [PropKind.Mirror]: { w: 0.7, d: 0.12, h: 1.7, solid: false, blocksSight: false, hide: null, surface: false },
  [PropKind.Cradle]: { w: 0.6, d: 1.0, h: 0.9, solid: true, blocksSight: false, hide: null, surface: false },
  [PropKind.FuseBox]: { w: 0.7, d: 0.25, h: 0.9, solid: false, blocksSight: false, hide: null, surface: false },
};

export interface FurnishEntry {
  kind: PropKind;
  where: FurnishSpot;
  min: number;
  max: number;
}

const wall = (kind: PropKind, min: number, max: number): FurnishEntry => ({ kind, where: FurnishSpot.Wall, min, max });
const center = (kind: PropKind): FurnishEntry => ({ kind, where: FurnishSpot.Center, min: 1, max: 1 });

/** What each kind of room is furnished with. Hide spots come from lockers, wardrobes and beds. */
export const ROOM_FURNITURE: Record<RoomKind, FurnishEntry[]> = {
  [RoomKind.Corridor]: [],
  [RoomKind.Courtyard]: [],
  [RoomKind.Ward]: [
    wall(PropKind.HospitalBed, 3, 6),
    wall(PropKind.IvStand, 1, 2),
    wall(PropKind.Wheelchair, 0, 1),
    wall(PropKind.MetalLocker, 1, 2),
  ],
  [RoomKind.Cell]: [wall(PropKind.HospitalBed, 1, 1), wall(PropKind.Chair, 0, 1), wall(PropKind.MetalLocker, 0, 1)],
  [RoomKind.Office]: [
    wall(PropKind.Desk, 1, 1),
    wall(PropKind.Chair, 1, 2),
    wall(PropKind.MetalCabinet, 1, 2),
    wall(PropKind.MetalLocker, 1, 2),
    wall(PropKind.Shelf, 0, 1),
  ],
  [RoomKind.Bathroom]: [wall(PropKind.Sink, 1, 3), wall(PropKind.Bathtub, 1, 1), wall(PropKind.MetalLocker, 0, 1)],
  [RoomKind.Theatre]: [
    center(PropKind.OperatingTable),
    wall(PropKind.Trolley, 1, 2),
    wall(PropKind.IvStand, 1, 2),
    wall(PropKind.MetalCabinet, 1, 2),
    wall(PropKind.MetalLocker, 0, 1),
  ],
  [RoomKind.Storage]: [
    wall(PropKind.Shelf, 2, 4),
    wall(PropKind.Crate, 1, 3),
    wall(PropKind.Barrel, 0, 2),
    wall(PropKind.MetalLocker, 1, 2),
  ],
  [RoomKind.LockerRoom]: [wall(PropKind.MetalLocker, 4, 8), wall(PropKind.Chair, 0, 2), wall(PropKind.Desk, 0, 1)],
  [RoomKind.Baithak]: [
    center(PropKind.Rug),
    wall(PropKind.Chair, 2, 4),
    wall(PropKind.Table, 1, 1),
    wall(PropKind.Wardrobe, 0, 1),
    wall(PropKind.Mirror, 0, 1),
  ],
  [RoomKind.Bedroom]: [
    wall(PropKind.Charpai, 1, 2),
    wall(PropKind.Wardrobe, 1, 1),
    wall(PropKind.Chest, 0, 1),
    wall(PropKind.Cradle, 0, 1),
    wall(PropKind.Mirror, 0, 1),
  ],
  [RoomKind.Kitchen]: [wall(PropKind.Pot, 2, 5), wall(PropKind.Shelf, 1, 2), wall(PropKind.Table, 1, 1), wall(PropKind.Wardrobe, 0, 1)],
  [RoomKind.Puja]: [wall(PropKind.Pot, 1, 3), wall(PropKind.Chest, 1, 1), wall(PropKind.Table, 0, 1)],
  [RoomKind.Store]: [
    wall(PropKind.Chest, 1, 3),
    wall(PropKind.Crate, 1, 3),
    wall(PropKind.Wardrobe, 1, 1),
    wall(PropKind.Pot, 0, 2),
  ],
};

export const ASYLUM_CORRIDOR_CLUTTER = [PropKind.Wheelchair, PropKind.Trolley, PropKind.IvStand, PropKind.Chair];
export const HAVELI_CORRIDOR_CLUTTER = [PropKind.Pot, PropKind.Chest];
