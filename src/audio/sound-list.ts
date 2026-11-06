import { MonsterKind, Theme } from "@/types/world";
import { variants } from "@/audio/sound-bank";
import type { Language } from "@/types/ui";
import { voicePath } from "@/lib/voice";

/** What each monster says (voice line ids; the file depends on the chosen language). */
export const MONSTER_LINES: Record<MonsterKind, string[]> = {
  [MonsterKind.Shikari]: [
    "shikari-koi-bahar-nahi",
    "shikari-pehra",
    "shikari-lalten",
    "shikari-dekh-raha",
    "shikari-kahan",
    "shikari-hukum",
    "shikari-ginti",
    "shikari-saans",
    "shikari-bhaago",
    "shikari-kahan-tak",
    "shikari-kahan-tak",
  ],
  [MonsterKind.Chudail]: ["chudail-bachcha", "chudail-dekho", "chudail-unhi-mein", "chudail-lori", "chudail-darwaza", "chudail-koi-nahi", "chudail-kahan-tak", "chudail-kahan-tak"],
  [MonsterKind.Mareez]: ["mareez-sun-sakta", "mareez-chup", "mareez-aankhein", "mareez-saans", "mareez-kaun", "mareez-dawai", "mareez-kahan-tak", "mareez-kahan-tak"],
};

/** Sounds that follow each monster around and give it away before you see it. */
export const MONSTER_LOOPS: Record<MonsterKind, string[]> = {
  [MonsterKind.Shikari]: ["monster/breathing-loop.mp3", "monster/lantern-creak-loop.mp3"],
  [MonsterKind.Chudail]: ["monster/woman-crying-loop.mp3"],
  [MonsterKind.Mareez]: ["monster/chain-drag-loop.mp3", "monster/mareez-mutter-loop.mp3"],
};

export const MONSTER_STEPS: Record<MonsterKind, string[]> = {
  [MonsterKind.Shikari]: variants("monster/footstep-heavy-", 4),
  [MonsterKind.Chudail]: variants("monster/payal-step-", 4),
  [MonsterKind.Mareez]: variants("monster/footstep-heavy-", 4),
};

export const MONSTER_ROARS: Record<MonsterKind, string[]> = {
  [MonsterKind.Shikari]: ["monster/roar-chase.mp3", "monster/shikari-scream.mp3"],
  [MonsterKind.Chudail]: ["monster/chudail-scream.mp3", "monster/chudail-laugh.mp3"],
  [MonsterKind.Mareez]: ["monster/mareez-roar.mp3"],
};

export const SOUNDS = {
  growls: ["monster/growl-1.mp3", "monster/growl-2.mp3"],
  attack: ["monster/attack-hit.mp3"],
  sniff: ["monster/sniff.mp3"],
  monsterLaugh: ["monster/creepy-laugh.mp3"],
  monsterScream: ["monster/scream-close.mp3"],
  tileSteps: variants("player/footstep-tile-", 4),
  woodSteps: variants("player/footstep-wood-", 4),
  breath: "player/breath-heavy-loop.mp3",
  heartbeat: "player/heartbeat-loop.mp3",
  hurt: ["player/hurt-1.mp3", "player/hurt-2.mp3"],
  torch: ["player/torch-click.mp3"],
  flash: ["player/flash-burst.mp3"],
  key: ["player/key-pickup.mp3"],
  item: ["player/item-pickup.mp3"],
  doorOpen: ["player/door-open-creak.mp3"],
  doorClose: ["player/door-close.mp3"],
  doorLocked: ["player/door-locked-rattle.mp3"],
  doorUnlock: ["player/door-unlock.mp3"],
  lockerOpen: ["player/locker-open.mp3"],
  lockerClose: ["player/locker-close.mp3"],
  wardrobeOpen: ["player/wardrobe-open.mp3"],
  wardrobeClose: ["player/wardrobe-close.mp3"],
  gate: ["player/gate-open.mp3"],
  power: ["player/power-on.mp3"],
  downed: ["player/downed-thud.mp3"],
  revive: ["player/revive-gasp.mp3"],
  doorSlam: ["scares/door-slam-distant.mp3"],
  screams: ["scares/scream-distant-1.mp3", "scares/scream-distant-2.mp3"],
  whispers: ["scares/whisper-1.mp3", "scares/whisper-2.mp3"],
  scrape: ["scares/metal-scrape.mp3"],
  fall: ["scares/object-fall.mp3"],
  glass: ["scares/glass-break.mp3"],
  stinger: ["scares/stinger-hit.mp3"],
  childLaugh: ["scares/child-laugh-distant.mp3"],
  runningAbove: ["scares/footsteps-running-above.mp3"],
  chains: ["scares/chains-rattle.mp3"],
  piano: ["scares/piano-key-low.mp3"],
  knock: ["scares/knock-knock.mp3"],
  breathBehind: ["scares/breath-behind.mp3"],
  tension: "music/tension-loop.mp3",
  chase: "music/chase-loop.mp3",
  escape: ["music/escape-sting.mp3"],
  death: ["music/death-sting.mp3"],
  hum: "ambience/electric-hum.mp3",
  bodyDrop: ["scares/body-drop.mp3"],
  ropeCreak: "scares/rope-creak-loop.mp3",
  bodyThud: ["scares/body-thud.mp3"],
  catHiss: ["scares/cat-hiss.mp3", "scares/cat-yowl.mp3"],
  catRun: ["scares/cat-run.mp3"],
  rooster: ["scares/rooster-crow.mp3"],
  chickenFlap: ["scares/chicken-flap.mp3"],
  rockingChair: "scares/rocking-chair-loop.mp3",
  radioStatic: "scares/radio-static-loop.mp3",

  babyCry: ["scares/baby-cry-distant.mp3"],
  musicBox: ["scares/music-box.mp3"],
  doorCreakSlow: ["scares/door-creak-slow.mp3"],
  whistle: ["monster/whistle-distant.mp3"],
  womanCrying: "monster/woman-crying-loop.mp3",
  manCrying: "monster/man-crying-loop.mp3",
  stingerChudail: ["music/stinger-chudail.mp3"],
  stingerLow: ["music/stinger-low.mp3"],
};

export const AMBIENCE: Record<Theme, string[]> = {
  [Theme.Asylum]: ["ambience/asylum-drone.mp3", "ambience/wind-creaks.mp3", "ambience/water-drips.mp3"],
  [Theme.Haveli]: ["ambience/haveli-night.mp3", "ambience/wind-creaks.mp3"],
};

/** Announcer line ids. */
export const PA_LINES = {
  introAsylum: "pa-intro-asylum",
  introHaveli: "pa-intro-haveli",
  key: "pa-key",
  fuse: "pa-fuse",
  power: "pa-power",
  gate: "pa-gate",
  downed: "pa-downed",
};

export const RADIO_LINE = "radio-news";

/** Every file one round of the given building may play. */
export const soundsFor = (theme: Theme, lang: Language): string[] => {
  const all: string[] = [...AMBIENCE[theme], ...[...Object.values(PA_LINES), RADIO_LINE].map((id) => voicePath(id, lang))];
  for (const kind of Object.values(MonsterKind)) {
    all.push(...MONSTER_LINES[kind].map((id) => voicePath(id, lang)), ...MONSTER_LOOPS[kind], ...MONSTER_STEPS[kind], ...MONSTER_ROARS[kind]);
  }
  for (const v of Object.values(SOUNDS)) {
    if (Array.isArray(v)) all.push(...v);
    else all.push(v);
  }
  return all;
};
