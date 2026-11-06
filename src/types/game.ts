import type { ItemKind, KeyColor, MonsterKind, Theme, Vec2 } from "@/types/world";

export enum PlayerStatus {
  Alive = "alive",
  Hiding = "hiding",
  Downed = "downed",
  Dead = "dead",
  Escaped = "escaped",
}

export enum Stance {
  Walk = 0,
  Sprint = 1,
  Crouch = 2,
}

export enum MonsterMode {
  Patrol = "patrol",
  Investigate = "investigate",
  Chase = "chase",
  Search = "search",
  Attack = "attack",
  Stunned = "stunned",
  Recover = "recover",
}

export enum RoundPhase {
  Intro = "intro",
  Playing = "playing",
  GateOpening = "gate-opening",
  Ended = "ended",
}

export enum RoundOutcome {
  None = "none",
  AllEscaped = "all-escaped",
  SomeEscaped = "some-escaped",
  AllCaught = "all-caught",
}

export enum Difficulty {
  Easy = "easy",
  Normal = "normal",
  Hard = "hard",
}

/** Things that happened this tick. The UI, audio and network layers react to them. */
export enum GameEventKind {
  KeyFound = "key-found",
  FuseFound = "fuse-found",
  FuseInserted = "fuse-inserted",
  PowerRestored = "power-restored",
  GateOpen = "gate-open",
  BatteryFound = "battery-found",
  MedkitUsed = "medkit-used",
  DoorOpened = "door-opened",
  DoorClosed = "door-closed",
  DoorLocked = "door-locked",
  DoorUnlocked = "door-unlocked",
  MonsterSpotted = "monster-spotted",
  MonsterLost = "monster-lost",
  MonsterRoar = "monster-roar",
  MonsterTaunt = "monster-taunt",
  MonsterStep = "monster-step",
  MonsterStunned = "monster-stunned",
  MonsterSniff = "monster-sniff",
  PlayerHit = "player-hit",
  PlayerDowned = "player-downed",
  PlayerRevived = "player-revived",
  PlayerDied = "player-died",
  PlayerEscaped = "player-escaped",
  PlayerHid = "player-hid",
  PlayerUnhid = "player-unhid",
  PlayerPulledOut = "player-pulled-out",
  Flash = "flash",
  Scare = "scare",
  /** A scripted scare went off (body drop, crying figure, cat, rooster, rocking chair, radio). */
  SetPiece = "set-piece",
  /** An envelope was opened; `note` is the story film it unlocks (always the next in order). */
  EnvelopeOpened = "envelope-opened",
  /** Chudail caught you staring / any monster's signature shriek. */
  MonsterScream = "monster-scream",
  RoundEnd = "round-end",
  /** A squad member's connection dropped or they quit the round. */
  PlayerLeft = "player-left",
}

export enum ScareKind {
  DoorSlam = "door-slam",
  DistantScream = "distant-scream",
  Whisper = "whisper",
  LightsBurst = "lights-burst",
  ObjectFall = "object-fall",
  MetalScrape = "metal-scrape",
  ChildLaugh = "child-laugh",
  FootstepsAbove = "footsteps-above",
  Knock = "knock",
  GlassBreak = "glass-break",
  BreathBehind = "breath-behind",
  /** The Chowkidar's whistle, somewhere far off. */
  Whistle = "whistle",
  BabyCry = "baby-cry",
  MusicBox = "music-box",
}

export interface GameEvent {
  kind: GameEventKind;
  /** Player the event is about, if any. */
  player?: string;
  monster?: number;
  door?: number;
  item?: number;
  color?: KeyColor | null;
  scare?: ScareKind;
  setPiece?: number;
  note?: number;
  x?: number;
  z?: number;
}

export interface PlayerInput {
  /** Desired move in the player's local frame: x = strafe right, z = forward. Length ≤ 1. */
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  crouch: boolean;
}

export interface PlayerState extends Vec2 {
  id: string;
  name: string;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
  stance: Stance;
  status: PlayerStatus;
  health: number;
  stamina: number;
  exhausted: boolean;
  battery: number;
  torchOn: boolean;
  /** Torch state to restore when stepping out of a hiding spot. */
  torchBeforeHide: boolean;
  flashCooldown: number;
  /** Item id of the fuse being carried, or -1. */
  carrying: number;
  hideSpot: number;
  /** Seconds left before a downed player dies. */
  bleed: number;
  /** Seconds of revive progress received. */
  revive: number;
  /** Footstep noise radius emitted this tick (metres). */
  noise: number;
  /** Seconds since the monster last hurt this player (brief mercy window). */
  sinceHit: number;
  color: number;
}

export interface MonsterState extends Vec2 {
  id: number;
  kind: MonsterKind;
  /** Wing it guards, or -1 if it roams the whole building. */
  home: number;
  /** Seconds of fury left (Chudail after being stared at). */
  rage: number;
  /** How long the current target has been staring at it (Chudail). */
  stare: number;
  yaw: number;
  speed: number;
  mode: MonsterMode;
  /** Seconds left in the current mode where that matters (stun, search, attack windup, recover). */
  timer: number;
  target: string | null;
  goal: Vec2 | null;
  lastSeen: Vec2 | null;
  path: Vec2[];
  repathIn: number;
  stepPhase: number;
  tauntIn: number;
  stunImmunity: number;
  /** Seconds since any player was last chased by this monster. */
  calm: number;
  /** A player who hid while being watched; the monster knows where. */
  sawHide: number;
  /** Seconds left standing at a closed door it is bashing open. */
  doorPause: number;
  /** Seconds it has been pushing without getting anywhere (gives up on that waypoint). */
  stuck: number;
}

export interface DoorState {
  open: number;
  /** -1 closing, 0 still, 1 opening. */
  moving: number;
  locked: boolean;
  /** Monster is pushing through (opens even locked doors, then closes them again). */
  monsterHold: number;
}

export interface WorldItemState {
  taken: boolean;
  /** For dropped fuses: where they ended up. */
  x: number;
  z: number;
  y: number;
}

export interface SetPieceState {
  fired: boolean;
  /** Seconds since it fired. */
  t: number;
  /** Player who set it off. */
  by: string | null;
}

export interface DirectorState {
  nextScare: number;
  nextHint: number;
  tension: number;
  lastChase: number;
}

export interface WorldState {
  time: number;
  phase: RoundPhase;
  phaseTimer: number;
  outcome: RoundOutcome;
  theme: Theme;
  seed: number;
  difficulty: Difficulty;
  players: PlayerState[];
  monsters: MonsterState[];
  doors: DoorState[];
  items: WorldItemState[];
  keys: KeyColor[];
  fusesInserted: number;
  fusesNeeded: number;
  powerOn: boolean;
  gateOpen: boolean;
  director: DirectorState;
  /** Light flicker override: 0 = normal, >0 seconds of burst flicker / blackout near the given point. */
  lightsBurst: number;
  lightsBurstAt: Vec2;
  setPieces: SetPieceState[];
  /** Story pages found this round, in order. */
  notesFound: number[];
}

export enum InteractKind {
  None = "none",
  PickUp = "pick-up",
  Door = "door",
  LockedDoor = "locked-door",
  Hide = "hide",
  Unhide = "unhide",
  FuseBox = "fuse-box",
  Revive = "revive",
  Gate = "gate",
}

export interface InteractTarget {
  kind: InteractKind;
  id: number | string;
  label: string;
  /** Hold-to-use actions (revive) report progress 0..1. */
  holdSeconds: number;
}

export interface ItemPickup {
  kind: ItemKind;
  color: KeyColor | null;
}
