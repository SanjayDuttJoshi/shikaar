import { DoorKind, ItemKind, MonsterKind, PropKind, RoomKind, Theme } from "@/types/world";
import type { Level, LevelOptions, MonsterSpawn, Placement, PropSpawn, Room } from "@/types/world";
import { MAX_PLAYERS, STORY_ENVELOPES, fusesFor, monsterPlan } from "@/world/constants";
import { placeSetPieces } from "@/world/set-pieces";
import { createDraft, initEdges, roomAt } from "@/world/draft";
import type { Draft } from "@/world/draft";
import {
  collectClearPoints,
  freeFloorPoint,
  furnishRooms,
  hideSpotsFrom,
  placeAgainstWall,
  placeCourtyardPillars,
  placeItem,
  placeLights,
} from "@/world/furnish";
import type { FurnishState } from "@/world/furnish";
import { cellCenter, doorCenter } from "@/world/geometry";
import { connectWing, layoutAsylumWing, layoutHaveliWing } from "@/world/layout-wing";
import {
  buildWingTree,
  cellDistances,
  chooseKeyRooms,
  chooseStartCell,
  placeExit,
  placeWingGates,
  planWingGrid,
} from "@/world/progression";
import { createRng } from "@/world/rng";

const BATTERIES_PER_WING = 2;
const MEDKITS_PER_WING = 1;
const MONSTER_MIN_CELLS_FROM_SPAWN = 6;

const isLiving = (r: Room): boolean => r.kind !== RoomKind.Corridor && r.kind !== RoomKind.Courtyard;

/** Player start spots around the wake-up point, in a loose grid. */
const spawnRing = (cx: number, cz: number): Placement[] => {
  const spots: Placement[] = [];
  const offsets = [
    [0, 0],
    [0.9, 0],
    [-0.9, 0],
    [0, 0.9],
    [0, -0.9],
    [0.9, 0.9],
    [-0.9, -0.9],
    [0.9, -0.9],
  ];
  for (const [dx, dz] of offsets.slice(0, MAX_PLAYERS)) spots.push({ x: cx + dx, z: cz + dz, yaw: 0 });
  return spots;
};

const placeFuseBox = (d: Draft, state: FurnishState, exitRoom: Room, exitAt: { x: number; z: number }): PropSpawn => {
  const near = placeAgainstWall(d, state, exitRoom, PropKind.FuseBox, 40, exitAt);
  if (near) return near;
  const wingRooms = d.rooms.filter((r) => r.wing === exitRoom.wing);
  for (const room of wingRooms) {
    const placed = placeAgainstWall(d, state, room, PropKind.FuseBox, 30);
    if (placed) return placed;
  }
  const spot = freeFloorPoint(d, state, exitRoom, 0.4) ?? exitAt;
  state.props.push({
    id: state.props.length,
    kind: PropKind.FuseBox,
    roomId: exitRoom.id,
    x: spot.x,
    z: spot.z,
    yaw: 0,
    w: 0.7,
    d: 0.25,
    h: 0.9,
    solid: false,
    blocksSight: false,
  });
  return state.props[state.props.length - 1];
};

export const generateLevel = ({ seed, theme, players }: LevelOptions): Level => {
  const rng = createRng(seed);
  const grid = planWingGrid({ rng }, players, theme);
  const d = createDraft(grid.width, grid.height, rng);
  const wings = buildWingTree(d, grid);
  for (const wing of wings) {
    if (theme === Theme.Asylum) layoutAsylumWing(d, wing.rect, wing.id);
    else layoutHaveliWing(d, wing.rect, wing.id);
  }
  initEdges(d);
  const innerDoor = theme === Theme.Asylum ? DoorKind.Metal : DoorKind.Wood;
  for (const wing of wings) connectWing(d, wing.id, theme === Theme.Asylum && rng.chance(0.5) ? DoorKind.Wood : innerDoor);
  const gates = placeWingGates(d, wings, innerDoor);
  const exitDoor = placeExit(d, wings, gates);
  const [sx, sy] = chooseStartCell(d, wings, theme);
  const keyRooms = chooseKeyRooms(d, wings, gates);

  const state: FurnishState = { props: [], clearPoints: collectClearPoints(d) };
  const spawnPoint = cellCenter(sx, sy);
  state.clearPoints.set(roomAt(d, sx, sy), [...(state.clearPoints.get(roomAt(d, sx, sy)) ?? []), spawnPoint]);
  if (theme === Theme.Haveli) placeCourtyardPillars(d, state);
  const exitAt = doorCenter(exitDoor);
  const exitRoom = d.rooms[roomAt(d, exitDoor.cx, exitDoor.cy)] ?? d.rooms[roomAt(d, exitDoor.cx + (exitDoor.vertical ? 1 : 0), exitDoor.cy + (exitDoor.vertical ? 0 : 1))];
  const fuseBox = placeFuseBox(d, state, exitRoom, exitAt);
  furnishRooms(d, theme, state);
  const lights = placeLights(d, theme, state);

  const items: Level["items"] = [];
  for (const [color, room] of keyRooms) placeItem(d, state, items, room, ItemKind.Key, color);

  const spawnRoom = roomAt(d, sx, sy);
  const fusesNeeded = fusesFor(players);
  const keyRoomIds = new Set([...keyRooms.values()].map((r) => r.id));
  const fuseCandidates = (wingId: number): Room[] =>
    rng.shuffle(d.rooms.filter((r) => r.wing === wingId && isLiving(r) && r.id !== spawnRoom));
  const wingOrder = rng.shuffle(wings.map((w) => w.id));
  let placedFuses = 0;
  const usedFuseRooms = new Set<number>();
  for (let round = 0; placedFuses < fusesNeeded && round < 6; round += 1) {
    for (const wingId of wingOrder) {
      if (placedFuses >= fusesNeeded) break;
      const options = fuseCandidates(wingId).filter((r) => !usedFuseRooms.has(r.id));
      const preferred = options.filter((r) => !keyRoomIds.has(r.id));
      const room = preferred[0] ?? options[0];
      if (!room) continue;
      if (placeItem(d, state, items, room, ItemKind.Fuse, null)) {
        usedFuseRooms.add(room.id);
        placedFuses += 1;
      }
    }
  }
  for (const wing of wings) {
    const rooms = rng.shuffle(d.rooms.filter((r) => r.wing === wing.id && isLiving(r)));
    for (let i = 0; i < BATTERIES_PER_WING && i < rooms.length; i += 1) placeItem(d, state, items, rooms[i], ItemKind.Battery, null);
    const medRoom = rooms[rooms.length - 1];
    for (let i = 0; i < MEDKITS_PER_WING && medRoom; i += 1) placeItem(d, state, items, medRoom, ItemKind.Medkit, null);
  }

  const notes = rng.shuffle(Array.from({ length: STORY_ENVELOPES }, (_, i) => i));
  const noteRooms = rng.shuffle(d.rooms.filter((r) => isLiving(r) && r.id !== spawnRoom));
  notes.forEach((page, i) => {
    const room = noteRooms[(i * 3) % Math.max(1, noteRooms.length)];
    if (room) placeItem(d, state, items, room, ItemKind.Envelope, null, page);
  });

  const setPieces = placeSetPieces(d, state, theme, wings, spawnRoom);

  const startWing = wings.find((w) => w.parent < 0) ?? wings[0];
  const spawnDist = cellDistances(d, [[sx, sy]], new Set(wings.map((w) => w.id)));
  const plan = monsterPlan(players, theme);
  const guardWings = [...wings].filter((w) => w.id !== startWing.id).sort((a, b) => b.depth - a.depth);
  const usedRooms: Room[] = [];
  let guardIndex = 0;
  const monsterSpawns: MonsterSpawn[] = [];
  for (const kind of plan) {
    const guards = kind !== MonsterKind.Shikari;
    const wing = guards ? (guardWings[guardIndex++ % Math.max(1, guardWings.length)] ?? startWing) : rng.pick(guardWings.length > 0 ? guardWings : wings);
    const ranked = d.rooms
      .filter((r) => r.wing === wing.id && isLiving(r) && !usedRooms.includes(r))
      .map((r) => ({ r, v: spawnDist[r.rect.y * d.width + r.rect.x] }))
      .filter((e) => e.v >= MONSTER_MIN_CELLS_FROM_SPAWN)
      .sort((a, b) => b.v - a.v)
      .map((e) => e.r);
    const room = ranked.length > 0 ? rng.pick(ranked.slice(0, 3)) : d.rooms.find((r) => r.wing === wing.id && isLiving(r));
    if (!room) continue;
    usedRooms.push(room);
    const p = freeFloorPoint(d, state, room, 0.5) ?? cellCenter(room.rect.x, room.rect.y);
    monsterSpawns.push({ x: p.x, z: p.z, yaw: rng.range(-Math.PI, Math.PI), kind, wing: guards ? wing.id : -1 });
  }

  const spawns = spawnRing(spawnPoint.x, spawnPoint.z);
  return {
    seed,
    theme,
    width: d.width,
    height: d.height,
    roomOf: d.roomOf,
    kindOf: d.kindOf,
    edgeX: d.edgeX,
    edgeY: d.edgeY,
    doorX: d.doorX,
    doorY: d.doorY,
    rooms: d.rooms,
    wings,
    doors: d.doors,
    props: state.props,
    hideSpots: hideSpotsFrom(state.props),
    items,
    lights,
    spawns,
    exitDoorId: exitDoor.id,
    fuseBoxPropId: fuseBox.id,
    fusesNeeded: Math.min(fusesNeeded, items.filter((i) => i.kind === ItemKind.Fuse).length),
    monsterSpawns,
    setPieces,
    notes,
  };
};
