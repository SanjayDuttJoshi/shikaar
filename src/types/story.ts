/** Small stages the story films are shot on. */
export enum FilmSet {
  Courtyard = "courtyard",
  Cellar = "cellar",
  Baithak = "baithak",
  Ward = "ward",
  Corridor = "corridor",
  Theatre = "theatre",
}

/** The main light of a shot. */
export enum FilmMood {
  Lantern = "lantern",
  Moon = "moon",
  Surgical = "surgical",
  Bulb = "bulb",
}

/** Who can appear in a film (the model each one uses is decided by the film player). */
export enum Actor {
  Kamla = "kamla",
  Bhairav = "bhairav",
  Thakur = "thakur",
  Henchman = "henchman",
  Doctor = "doctor",
  Nurse = "nurse",
  Raghu = "raghu",
  RaghuBlind = "raghu-blind",
  Chudail = "chudail",
  Shikari = "shikari",
}

export type V3 = [number, number, number];

export interface ActorCue {
  actor: Actor;
  /** Animation clip names to try, best first. */
  clip: string[];
  /** Start position [x, z] and facing (yaw, radians; 0 faces +Z). */
  at: [number, number, number];
  /** Walks/drifts to [x, z] over the shot. */
  to?: [number, number];
  /** Holds a lit lantern. */
  lantern?: boolean;
  /** Seconds into the shot before this actor appears. */
  enter?: number;
  /** Raised off the floor (lying on the operating table). */
  lift?: number;
}

export interface FilmShot {
  set: FilmSet;
  /** Minimum length; stretched to fit the narration. */
  seconds: number;
  camFrom: V3;
  camTo: V3;
  lookFrom: V3;
  lookTo: V3;
  actors: ActorCue[];
  /** Voice line id (src/content/voice-lines.json). */
  line: string;
  /** A door in the set is shut at this time (cellar). */
  doorSlamAt?: number;
  /** A lit lantern left lying on the floor at [x, z]. */
  lanternAt?: [number, number];
  /** Extra light: a lantern-red glow, cold moonlight, or a surgical lamp. */
  mood?: FilmMood;
}

export interface Film {
  title: { hi: string; en: string };
  shots: FilmShot[];
}
