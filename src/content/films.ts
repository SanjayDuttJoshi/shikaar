import { Actor, FilmMood, FilmSet } from "@/types/story";
import type { Film } from "@/types/story";
import { Theme } from "@/types/world";

const PI = Math.PI;

/**
 * Story films unlocked by envelopes, always played in this order (the first envelope you open
 * plays film 1, whatever room it was in). Haveli films are told by Kamla, asylum films by Raghu.
 */
export const FILMS: Record<Theme, Film[]> = {
  [Theme.Haveli]: [
    {
      title: { hi: "Yaad 1 — Nayi bahu", en: "Memory 1 — The bride" },
      shots: [
        { set: FilmSet.Courtyard, seconds: 6, camFrom: [3, 1.6, 7], camTo: [2, 1.5, 5.5], lookFrom: [0, 1, 0], lookTo: [0, 1, -1], mood: FilmMood.Moon, line: "film-h1-1", actors: [{ actor: Actor.Kamla, clip: ["Walk"], at: [0, 4, PI], to: [0, 0] }] },
        { set: FilmSet.Courtyard, seconds: 6, camFrom: [-0.5, 1.4, 1.5], camTo: [-1, 1.4, 0.5], lookFrom: [-3, 1.3, -3], lookTo: [-3, 1.3, -2], mood: FilmMood.Lantern, line: "film-h1-2", actors: [{ actor: Actor.Bhairav, clip: ["IdleLantern", "Walk"], at: [-3, -4, 0], to: [-3, -2], lantern: true }] },
        {
          set: FilmSet.Courtyard,
          seconds: 6,
          camFrom: [0, 1.5, -2],
          camTo: [0.3, 1.45, -2.8],
          lookFrom: [0, 1.4, -4.5],
          lookTo: [0, 1.4, -4.6],
          mood: FilmMood.Lantern,
          line: "film-h1-3",
          actors: [
            { actor: Actor.Kamla, clip: ["Idle"], at: [-0.6, -4.5, PI / 2] },
            { actor: Actor.Bhairav, clip: ["Interact", "Idle"], at: [0.6, -4.5, -PI / 2], lantern: true },
          ],
        },
        { set: FilmSet.Cellar, seconds: 5, camFrom: [0, 1.5, 2.5], camTo: [0, 1.4, 0], lookFrom: [0, 1.2, -3], lookTo: [0, 1.2, -3], mood: FilmMood.Bulb, line: "film-h1-4", actors: [] },
      ],
    },
    {
      title: { hi: "Yaad 2 — Waaris", en: "Memory 2 — The heir" },
      shots: [
        {
          set: FilmSet.Baithak,
          seconds: 6,
          camFrom: [3, 1.6, 3],
          camTo: [2.5, 1.6, 2.4],
          lookFrom: [-0.4, 1.3, -0.8],
          lookTo: [-0.4, 1.3, -0.8],
          mood: FilmMood.Lantern,
          line: "film-h2-1",
          actors: [
            { actor: Actor.Thakur, clip: ["IdleAlert", "Idle"], at: [-1.5, -2, 0.5] },
            { actor: Actor.Kamla, clip: ["Idle"], at: [0.8, 0.5, PI + 0.6] },
          ],
        },
        {
          set: FilmSet.Courtyard,
          seconds: 6,
          camFrom: [5, 1.7, 4],
          camTo: [4, 1.6, 1],
          lookFrom: [1, 1.1, -1],
          lookTo: [0.5, 1.1, -3],
          mood: FilmMood.Moon,
          line: "film-h2-2",
          actors: [
            { actor: Actor.Thakur, clip: ["Walk"], at: [2, 2, PI], to: [0, -4.5] },
            { actor: Actor.Kamla, clip: ["Knockback", "Walk"], at: [2.2, 2.9, PI], to: [0.2, -3.6] },
          ],
        },
        { set: FilmSet.Cellar, seconds: 5, camFrom: [1.5, 1.4, 2], camTo: [1, 1.3, 1.6], lookFrom: [0, 1.2, -2.5], lookTo: [0, 1.2, -2.5], mood: FilmMood.Bulb, doorSlamAt: 0.6, line: "film-h2-3", actors: [{ actor: Actor.Kamla, clip: ["HitReact", "Idle"], at: [0, -1.6, PI] }] },
        { set: FilmSet.Courtyard, seconds: 5, camFrom: [3, 1.4, 2], camTo: [2, 1.4, -1], lookFrom: [-2, 1.1, 0], lookTo: [-0.5, 1.1, -3], mood: FilmMood.Lantern, line: "film-h2-4", actors: [{ actor: Actor.Bhairav, clip: ["Run"], at: [-4, 4, PI], to: [-0.5, -4.5], lantern: true }] },
      ],
    },
    {
      title: { hi: "Yaad 3 — Jhooth", en: "Memory 3 — The lie" },
      shots: [
        { set: FilmSet.Courtyard, seconds: 6, camFrom: [1.5, 1.5, -2.5], camTo: [1, 1.5, -3.4], lookFrom: [0, 1.3, -6], lookTo: [0, 1.3, -6], mood: FilmMood.Lantern, line: "film-h3-1", actors: [{ actor: Actor.Bhairav, clip: ["AttackPunch", "Attack", "Interact"], at: [0, -5.2, PI], lantern: true }] },
        {
          set: FilmSet.Courtyard,
          seconds: 6,
          camFrom: [0, 1.7, 3],
          camTo: [0, 1.6, 1],
          lookFrom: [0, 1.1, -4],
          lookTo: [0, 1.1, -4],
          mood: FilmMood.Moon,
          line: "film-h3-2",
          actors: [
            { actor: Actor.Bhairav, clip: ["Knockback", "HitReact"], at: [0, -5, 0] },
            { actor: Actor.Henchman, clip: ["Run", "Walk"], at: [3, 0, -2.4], to: [0.5, -4.4] },
            { actor: Actor.Henchman, clip: ["Run", "Walk"], at: [-3, 0, 2.4], to: [-0.5, -4.4] },
            { actor: Actor.Thakur, clip: ["IdleAlert", "Idle"], at: [2.2, -1, -2.2] },
          ],
        },
        {
          set: FilmSet.Baithak,
          seconds: 6,
          camFrom: [0.2, 1.5, 2.6],
          camTo: [-0.2, 1.5, 2],
          lookFrom: [-0.3, 1.2, 0],
          lookTo: [-0.3, 1.2, 0],
          mood: FilmMood.Lantern,
          line: "film-h3-3",
          actors: [
            { actor: Actor.Thakur, clip: ["Interact", "PickUp", "Idle"], at: [-1, 0, PI / 2] },
            { actor: Actor.Henchman, clip: ["Idle"], at: [0.4, 0, -PI / 2] },
          ],
        },
        {
          set: FilmSet.Courtyard,
          seconds: 6,
          camFrom: [0.8, 0.45, -2.4],
          camTo: [0.6, 0.4, -2.8],
          lookFrom: [0, 0.2, -4.8],
          lookTo: [1.5, 1, 0],
          mood: FilmMood.Lantern,
          line: "film-h3-4",
          lanternAt: [0, -4.8],
          actors: [
            { actor: Actor.Bhairav, clip: ["Walk"], at: [0, -4, 0.6], to: [4, 3] },
            { actor: Actor.Henchman, clip: ["Walk"], at: [0.7, -4.2, 0.6], to: [4.7, 2.8] },
          ],
        },
      ],
    },
    {
      title: { hi: "Yaad 4 — Haveli ki aatma", en: "Memory 4 — What the haveli keeps" },
      shots: [
        { set: FilmSet.Cellar, seconds: 6, camFrom: [-1, 1.5, 2], camTo: [-0.5, 1.4, 1.2], lookFrom: [1.5, 0.6, -2], lookTo: [1.5, 0.6, -2], mood: FilmMood.Bulb, line: "film-h4-1", actors: [{ actor: Actor.Chudail, clip: ["CrouchIdle"], at: [1.8, -2, 2.4] }] },
        { set: FilmSet.Cellar, seconds: 6, camFrom: [0, 1.5, 2.2], camTo: [0.6, 1.5, 0.6], lookFrom: [1.6, 1.5, -1.6], lookTo: [1.6, 1.5, -1.6], mood: FilmMood.Bulb, line: "film-h4-2", actors: [{ actor: Actor.Chudail, clip: ["Idle"], at: [1.6, -1.6, -0.4] }] },
        { set: FilmSet.Courtyard, seconds: 6, camFrom: [1, 1.4, 5], camTo: [0, 1.4, 3], lookFrom: [-4, 1.2, 2], lookTo: [-4, 1.2, -2], mood: FilmMood.Moon, line: "film-h4-3", actors: [{ actor: Actor.Chudail, clip: ["Walk"], at: [-4, 4, PI], to: [-4, -3] }] },
        { set: FilmSet.Courtyard, seconds: 5, camFrom: [0, 1.6, 4], camTo: [0, 1.6, 1.3], lookFrom: [0, 1.6, -1], lookTo: [0, 1.6, -1], mood: FilmMood.Moon, line: "film-h4-4", actors: [{ actor: Actor.Chudail, clip: ["Scream", "Attack"], at: [0, -1, 0] }] },
      ],
    },
  ],
  [Theme.Asylum]: [
    {
      title: { hi: "Yaad 1 — Ward chaar", en: "Memory 1 — Ward Four" },
      shots: [
        { set: FilmSet.Ward, seconds: 5, camFrom: [-1.5, 1.5, 2.5], camTo: [-1, 1.5, 1.5], lookFrom: [1.6, 1.3, -0.5], lookTo: [1.6, 1.3, -0.5], mood: FilmMood.Bulb, line: "film-a1-1", actors: [{ actor: Actor.Raghu, clip: ["Idle"], at: [1.6, -0.5, -PI / 2] }] },
        {
          set: FilmSet.Corridor,
          seconds: 6,
          camFrom: [0.8, 1.6, 3],
          camTo: [0.6, 1.6, 2],
          lookFrom: [0, 1.2, -8],
          lookTo: [0, 1.2, -2],
          mood: FilmMood.Bulb,
          line: "film-a1-2",
          actors: [
            { actor: Actor.Bhairav, clip: ["Knockback", "Walk"], at: [0, -12, 0], to: [0, -2] },
            { actor: Actor.Henchman, clip: ["Walk"], at: [0.7, -12.4, 0], to: [0.7, -2.4] },
            { actor: Actor.Henchman, clip: ["Walk"], at: [-0.7, -12.4, 0], to: [-0.7, -2.4] },
          ],
        },
        { set: FilmSet.Ward, seconds: 5, camFrom: [-0.5, 1.6, -2.2], camTo: [-0.8, 1.6, -2.6], lookFrom: [-2, 1.6, -3], lookTo: [-2, 1.6, -3], mood: FilmMood.Bulb, line: "film-a1-3", actors: [{ actor: Actor.Bhairav, clip: ["Idle"], at: [-2, -3, PI / 2] }] },
        {
          set: FilmSet.Ward,
          seconds: 6,
          camFrom: [2.5, 1.5, 1],
          camTo: [2, 1.5, 0],
          lookFrom: [-1.5, 1.2, -3],
          lookTo: [1.5, 1.2, 2],
          mood: FilmMood.Lantern,
          line: "film-a1-4",
          actors: [
            { actor: Actor.Bhairav, clip: ["Idle"], at: [-2, -3, PI / 2] },
            { actor: Actor.Doctor, clip: ["Walk"], at: [-1.2, -3, 0.5], to: [2, 3], lantern: true },
          ],
        },
      ],
    },
    {
      title: { hi: "Yaad 2 — Taar", en: "Memory 2 — The wire" },
      shots: [
        {
          set: FilmSet.Theatre,
          seconds: 6,
          camFrom: [2.5, 2, 2.5],
          camTo: [2, 1.9, 2],
          lookFrom: [0, 0.8, 0],
          lookTo: [0, 0.8, 0],
          mood: FilmMood.Surgical,
          line: "film-a2-1",
          actors: [
            { actor: Actor.Bhairav, clip: ["Downed", "Death"], at: [0, 0, 0], lift: 0.96 },
            { actor: Actor.Doctor, clip: ["Idle"], at: [-1, 0.4, PI / 2] },
            { actor: Actor.Nurse, clip: ["Idle"], at: [1, -0.8, -PI / 2] },
          ],
        },
        {
          set: FilmSet.Theatre,
          seconds: 6,
          camFrom: [-0.2, 1.4, 1.4],
          camTo: [-0.4, 1.3, 1],
          lookFrom: [-0.4, 1.1, 0],
          lookTo: [-0.4, 1.1, 0],
          mood: FilmMood.Surgical,
          line: "film-a2-2",
          actors: [
            { actor: Actor.Bhairav, clip: ["Downed", "Death"], at: [0, 0, 0], lift: 0.96 },
            { actor: Actor.Doctor, clip: ["Interact", "PickUp"], at: [-1, 0.4, PI / 2] },
            { actor: Actor.Nurse, clip: ["Idle"], at: [1, -0.8, 0.4] },
          ],
        },
        { set: FilmSet.Theatre, seconds: 5, camFrom: [0.3, 1.0, 1.2], camTo: [0.2, 0.95, 0.9], lookFrom: [0, 0.7, 0], lookTo: [0, 0.7, 0], mood: FilmMood.Surgical, line: "film-a2-3", actors: [{ actor: Actor.Bhairav, clip: ["Downed", "Death"], at: [0, 0, 0], lift: 0.96 }] },
        { set: FilmSet.Ward, seconds: 5, camFrom: [-0.5, 1.6, 2], camTo: [-1, 1.6, 2], lookFrom: [-3, 1.6, 2], lookTo: [-3, 1.6, 2], mood: FilmMood.Moon, line: "film-a2-4", actors: [{ actor: Actor.Bhairav, clip: ["Idle"], at: [-2.7, 2, -PI / 2] }] },
      ],
    },
    {
      title: { hi: "Yaad 3 — Laal lalten", en: "Memory 3 — The red lantern" },
      shots: [
        {
          set: FilmSet.Corridor,
          seconds: 6,
          camFrom: [0.4, 1.6, 3],
          camTo: [0.3, 1.6, 0.5],
          lookFrom: [0, 1.4, -10],
          lookTo: [0, 1.4, -10],
          mood: FilmMood.Bulb,
          line: "film-a3-1",
          actors: [
            { actor: Actor.Raghu, clip: ["Walk"], at: [0, 0, PI], to: [0, -3] },
            { actor: Actor.Shikari, clip: ["Idle"], at: [0, -16, 0], lantern: true, enter: 2.2 },
          ],
        },
        { set: FilmSet.Corridor, seconds: 6, camFrom: [0.5, 1.7, -3], camTo: [0.4, 1.6, -4], lookFrom: [0, 1.6, -10], lookTo: [0, 1.7, -8], mood: FilmMood.Lantern, line: "film-a3-2", actors: [{ actor: Actor.Shikari, clip: ["Walk"], at: [0, -12, 0], to: [0, -7.5], lantern: true }] },
        { set: FilmSet.Corridor, seconds: 5, camFrom: [0, 1.4, 1.5], camTo: [0, 1.2, 0.8], lookFrom: [0, 1, -1], lookTo: [0, 0.9, -1], mood: FilmMood.Lantern, line: "film-a3-3", actors: [{ actor: Actor.Raghu, clip: ["CrouchIdle", "HitReact"], at: [0, -1, 0] }] },
        { set: FilmSet.Ward, seconds: 6, camFrom: [0, 1.7, 3], camTo: [0, 1.7, 1.4], lookFrom: [0, 1.7, -1], lookTo: [0, 1.7, -1], mood: FilmMood.Bulb, line: "film-a3-4", actors: [{ actor: Actor.RaghuBlind, clip: ["Listen", "Idle"], at: [0, -1, 0] }] },
      ],
    },
    {
      title: { hi: "Yaad 4 — Ginti", en: "Memory 4 — The count" },
      shots: [
        { set: FilmSet.Corridor, seconds: 6, camFrom: [0, 1.6, 2], camTo: [0, 1.6, -4], lookFrom: [0, 1.4, -20], lookTo: [0, 1.4, -20], mood: FilmMood.Bulb, line: "film-a4-1", actors: [] },
        { set: FilmSet.Corridor, seconds: 6, camFrom: [0.6, 1.6, 1], camTo: [0.5, 1.6, -1], lookFrom: [0, 1.5, -8], lookTo: [0, 1.5, -10], mood: FilmMood.Lantern, line: "film-a4-2", actors: [{ actor: Actor.Shikari, clip: ["Walk"], at: [0, -3, PI], to: [0, -12], lantern: true }] },
        { set: FilmSet.Ward, seconds: 6, camFrom: [2.5, 1.4, 2], camTo: [1.5, 1.4, 2.6], lookFrom: [0, 1.8, 0], lookTo: [0, 1.8, 0], mood: FilmMood.Lantern, line: "film-a4-3", actors: [{ actor: Actor.Shikari, clip: ["Idle"], at: [0, 0, 0.6], lantern: true }] },
        { set: FilmSet.Ward, seconds: 5, camFrom: [0, 1.9, 3], camTo: [0, 2, 1.3], lookFrom: [0, 2.1, -1], lookTo: [0, 2.1, -1], mood: FilmMood.Lantern, line: "film-a4-4", actors: [{ actor: Actor.Shikari, clip: ["Scream", "Attack"], at: [0, -1, 0], lantern: true }] },
      ],
    },
  ],
};

export const FILMS_PER_BUILDING = 4;
