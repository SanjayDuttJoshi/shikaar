import { EdgeKind, RoomKind } from "@/types/world";
import type { CellRect, Room } from "@/types/world";
import { DoorKind } from "@/types/world";
import { addDoor, addRoom, boundaryPairs, createUnionFind, roomAt, setEdge } from "@/world/draft";
import type { CellPair, Draft } from "@/world/draft";

const CORRIDOR_DEPTH = 2;
const HAVELI_BAND = 2;

const isPassage = (kind: RoomKind): boolean => kind === RoomKind.Corridor || kind === RoomKind.Courtyard;

/** Splits a run of `total` cells into parts of 2..4 cells. */
export const splitRun = (d: Draft, total: number): number[] => {
  const parts: number[] = [];
  let remaining = total;
  while (remaining > 4) {
    const part = d.rng.int(2, Math.min(4, remaining - 2));
    parts.push(part);
    remaining -= part;
  }
  if (remaining > 0) parts.push(remaining);
  return parts;
};

/** Cuts a long corridor strip into short pieces so locks and lights can be placed per piece. */
const addCorridorStrip = (d: Draft, strip: CellRect, wing: number): void => {
  const horizontal = strip.w >= strip.h;
  const length = horizontal ? strip.w : strip.h;
  let offset = 0;
  while (offset < length) {
    const piece = Math.min(3, length - offset);
    const rect = horizontal
      ? { x: strip.x + offset, y: strip.y, w: piece, h: 1 }
      : { x: strip.x, y: strip.y + offset, w: 1, h: piece };
    addRoom(d, RoomKind.Corridor, rect, wing);
    offset += piece;
  }
};

const asylumRoomKind = (d: Draft, rect: CellRect): RoomKind => {
  const area = rect.w * rect.h;
  const short = Math.min(rect.w, rect.h);
  if (area >= 9 && short >= 3) return d.rng.pick([RoomKind.Ward, RoomKind.Ward, RoomKind.Theatre, RoomKind.LockerRoom]);
  if (area >= 8) return d.rng.pick([RoomKind.Ward, RoomKind.Storage, RoomKind.LockerRoom, RoomKind.Bathroom]);
  return d.rng.pick([RoomKind.Cell, RoomKind.Cell, RoomKind.Office, RoomKind.Bathroom, RoomKind.Storage]);
};

const haveliRoomKind = (d: Draft, rect: CellRect, pujaUsed: boolean): RoomKind => {
  const area = rect.w * rect.h;
  if (area >= 8) return d.rng.pick([RoomKind.Baithak, RoomKind.Bedroom, RoomKind.Kitchen]);
  if (!pujaUsed && d.rng.chance(0.3)) return RoomKind.Puja;
  return d.rng.pick([RoomKind.Bedroom, RoomKind.Store, RoomKind.Kitchen, RoomKind.Bedroom]);
};

/** Hospital wing: binary-space-partition with corridors cut along the first splits. */
export const layoutAsylumWing = (d: Draft, rect: CellRect, wing: number): void => {
  const leaves: CellRect[] = [];
  const split = (r: CellRect, depth: number): void => {
    const alongX = r.w > r.h || (r.w === r.h && d.rng.chance(0.5));
    const length = alongX ? r.w : r.h;
    if (depth < CORRIDOR_DEPTH && length >= 7) {
      const p = d.rng.int(3, length - 4);
      if (alongX) {
        addCorridorStrip(d, { x: r.x + p, y: r.y, w: 1, h: r.h }, wing);
        split({ x: r.x, y: r.y, w: p, h: r.h }, depth + 1);
        split({ x: r.x + p + 1, y: r.y, w: r.w - p - 1, h: r.h }, depth + 1);
      } else {
        addCorridorStrip(d, { x: r.x, y: r.y + p, w: r.w, h: 1 }, wing);
        split({ x: r.x, y: r.y, w: r.w, h: p }, depth + 1);
        split({ x: r.x, y: r.y + p + 1, w: r.w, h: r.h - p - 1 }, depth + 1);
      }
      return;
    }
    if (length >= 5 && (r.w * r.h > 12 || d.rng.chance(0.5))) {
      const p = d.rng.int(2, length - 2);
      if (alongX) {
        split({ x: r.x, y: r.y, w: p, h: r.h }, depth + 1);
        split({ x: r.x + p, y: r.y, w: r.w - p, h: r.h }, depth + 1);
      } else {
        split({ x: r.x, y: r.y, w: r.w, h: p }, depth + 1);
        split({ x: r.x, y: r.y + p, w: r.w, h: r.h - p }, depth + 1);
      }
      return;
    }
    leaves.push(r);
  };
  split(rect, 0);
  for (const leaf of leaves) addRoom(d, asylumRoomKind(d, leaf), leaf, wing);
};

/** Haveli wing: open courtyard ringed by a pillared verandah, rooms around the outside. */
export const layoutHaveliWing = (d: Draft, rect: CellRect, wing: number): void => {
  const b = HAVELI_BAND;
  const inner = { x: rect.x + b, y: rect.y + b, w: rect.w - 2 * b, h: rect.h - 2 * b };
  addRoom(d, RoomKind.Courtyard, { x: inner.x + 1, y: inner.y + 1, w: inner.w - 2, h: inner.h - 2 }, wing);
  addCorridorStrip(d, { x: inner.x, y: inner.y, w: inner.w, h: 1 }, wing);
  addCorridorStrip(d, { x: inner.x, y: inner.y + inner.h - 1, w: inner.w, h: 1 }, wing);
  addCorridorStrip(d, { x: inner.x, y: inner.y + 1, w: 1, h: inner.h - 2 }, wing);
  addCorridorStrip(d, { x: inner.x + inner.w - 1, y: inner.y + 1, w: 1, h: inner.h - 2 }, wing);

  let pujaUsed = false;
  const addBandRun = (start: CellRect, alongX: boolean): void => {
    let offset = 0;
    for (const part of splitRun(d, alongX ? start.w : start.h)) {
      const r = alongX
        ? { x: start.x + offset, y: start.y, w: part, h: start.h }
        : { x: start.x, y: start.y + offset, w: start.w, h: part };
      const kind = haveliRoomKind(d, r, pujaUsed);
      pujaUsed = pujaUsed || kind === RoomKind.Puja;
      addRoom(d, kind, r, wing);
      offset += part;
    }
  };
  addBandRun({ x: rect.x, y: rect.y, w: rect.w, h: b }, true);
  addBandRun({ x: rect.x, y: rect.y + rect.h - b, w: rect.w, h: b }, true);
  addBandRun({ x: rect.x, y: rect.y + b, w: b, h: rect.h - 2 * b }, false);
  addBandRun({ x: rect.x + rect.w - b, y: rect.y + b, w: b, h: rect.h - 2 * b }, false);
};

const pairKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Picks a door spot near the middle of a shared wall rather than in a corner. */
const pickCentralPair = (d: Draft, pairs: CellPair[]): CellPair => {
  const sorted = [...pairs].sort((p, q) => {
    const score = (c: CellPair): number => {
      const a = d.rooms[roomAt(d, c.ax, c.ay)].rect;
      const cx = a.x + (a.w - 1) / 2;
      const cy = a.y + (a.h - 1) / 2;
      return Math.abs(c.ax - cx) + Math.abs(c.ay - cy);
    };
    return score(p) - score(q);
  });
  const top = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  return d.rng.pick(top);
};

/**
 * Opens passages inside one wing: corridor pieces flow into each other, every room
 * gets a door to a corridor where it can, the rest chain through neighbours, and a few
 * extra doors make loops so a chase never ends in a guaranteed dead end.
 */
export const connectWing = (d: Draft, wing: number, doorKind: DoorKind): void => {
  const rooms = d.rooms.filter((r) => r.wing === wing);
  const uf = createUnionFind(d.rooms.length);
  const linked = new Set<string>();
  const inWing = (id: number): boolean => id >= 0 && d.rooms[id].wing === wing;

  for (const room of rooms.filter((r) => isPassage(r.kind))) {
    for (const p of boundaryPairs(d, room, (o) => inWing(o) && isPassage(d.rooms[o].kind))) {
      setEdge(d, p, EdgeKind.Open);
      uf.union(room.id, roomAt(d, p.bx, p.by));
    }
  }

  const link = (room: Room, pairs: CellPair[]): void => {
    const p = pickCentralPair(d, pairs);
    const other = roomAt(d, p.bx, p.by);
    addDoor(d, p, doorKind, null, d.rng.chance(0.35));
    uf.union(room.id, other);
    linked.add(pairKey(room.id, other));
  };

  for (const room of rooms.filter((r) => !isPassage(r.kind))) {
    const toPassage = boundaryPairs(d, room, (o) => inWing(o) && d.rooms[o].kind === RoomKind.Corridor);
    if (toPassage.length === 0) continue;
    link(room, toPassage);
    const big = room.rect.w * room.rect.h >= 9;
    if (big && d.rng.chance(0.5)) {
      const far = toPassage.filter((p) => roomAt(d, p.bx, p.by) !== roomAt(d, toPassage[0].bx, toPassage[0].by));
      if (far.length > 0) link(room, far);
    }
  }

  const anchor = rooms.find((r) => isPassage(r.kind)) ?? rooms[0];
  let guard = rooms.length * 4;
  while (guard > 0) {
    guard -= 1;
    const loose = rooms.filter((r) => uf.find(r.id) !== uf.find(anchor.id));
    if (loose.length === 0) break;
    let joined = false;
    for (const room of d.rng.shuffle(loose)) {
      const pairs = boundaryPairs(d, room, (o) => inWing(o) && uf.find(o) !== uf.find(room.id));
      if (pairs.length === 0) continue;
      link(room, pairs);
      joined = true;
      break;
    }
    if (!joined) break;
  }

  for (const room of rooms.filter((r) => !isPassage(r.kind))) {
    const neighbours = boundaryPairs(
      d,
      room,
      (o) => inWing(o) && !isPassage(d.rooms[o].kind) && o > room.id && !linked.has(pairKey(room.id, o)),
    );
    const byRoom = new Map<number, CellPair[]>();
    for (const p of neighbours) {
      const o = roomAt(d, p.bx, p.by);
      byRoom.set(o, [...(byRoom.get(o) ?? []), p]);
    }
    for (const pairs of byRoom.values()) {
      if (d.rng.chance(0.3)) link(room, pairs);
    }
  }
};
