import { GameEventKind, PlayerStatus, RoundPhase } from "@/types/game";
import type { GameEvent, WorldState } from "@/types/game";
import { MessageTone } from "@/types/ui";
import type { Level } from "@/types/world";
import { keyLabel } from "@/lib/labels";

export interface MessageSpec {
  text: string;
  tone: MessageTone;
  seconds: number;
}

const msg = (text: string, tone: MessageTone, seconds = 3.2): MessageSpec => ({ text, tone, seconds });

/** Hinglish lines shown for game events (only those that matter to this player). */
export const messageFor = (e: GameEvent, state: WorldState, level: Level, selfId: string): MessageSpec | null => {
  const mine = e.player === selfId;
  const who = state.players.find((p) => p.id === e.player)?.name ?? "Koi";
  switch (e.kind) {
    case GameEventKind.KeyFound:
      return msg(`${mine ? "" : `${who} ko `}${keyLabel(e.color ?? null)} chaabi mil gayi!`, MessageTone.Good);
    case GameEventKind.FuseFound:
      return mine ? msg("Fuse mil gaya. Fuse box tak le jao.", MessageTone.Good) : msg(`${who} ko fuse mil gaya`, MessageTone.Good, 2.6);
    case GameEventKind.FuseInserted:
      return msg(`Fuse laga diya (${state.fusesInserted}/${state.fusesNeeded})`, MessageTone.Good);
    case GameEventKind.PowerRestored:
      return msg("Bijli wapas aa gayi! Main gate khul raha hai...", MessageTone.Danger, 4.5);
    case GameEventKind.GateOpen:
      return msg("GATE KHUL GAYA! BHAAGO!", MessageTone.Danger, 5);
    case GameEventKind.BatteryFound:
      return mine ? msg("Battery mil gayi", MessageTone.Info, 2) : null;
    case GameEventKind.MedkitUsed:
      return mine ? msg("Patti baandh li. Thoda behtar.", MessageTone.Info, 2.4) : null;
    case GameEventKind.DoorLocked: {
      if (!mine) return null;
      if (e.item !== undefined) return msg("Ek baar mein ek hi fuse utha sakte ho", MessageTone.Info, 2.4);
      if (e.door === level.exitDoorId) {
        const left = state.fusesNeeded - state.fusesInserted;
        return msg(`Main gate band hai. ${left} fuse aur chahiye.`, MessageTone.Info, 2.8);
      }
      return msg(`Band hai. ${keyLabel(e.color ?? null)} chaabi chahiye.`, MessageTone.Info, 2.4);
    }
    case GameEventKind.DoorUnlocked:
      return msg(`${keyLabel(e.color ?? null)} darwaze khul gaye`, MessageTone.Good);
    case GameEventKind.PlayerDowned:
      return mine ? msg("Gir gaye! Koi dost uthaye...", MessageTone.Danger, 4) : msg(`${who} gir gaya! Jaldi uthao!`, MessageTone.Danger, 4);
    case GameEventKind.PlayerRevived:
      return msg(mine ? "Uth gaye! Bhaago!" : `${who} uth gaya`, MessageTone.Good);
    case GameEventKind.PlayerDied:
      return mine ? null : msg(`${who} ko Shikari le gaya...`, MessageTone.Danger, 4);
    case GameEventKind.PlayerEscaped:
      return msg(mine ? "BACH GAYE!" : `${who} bahar nikal gaya!`, MessageTone.Good, 4);
    case GameEventKind.PlayerPulledOut:
      return mine ? msg("USNE DEKH LIYA THA!", MessageTone.Danger, 2.5) : null;
    case GameEventKind.MonsterStunned:
      return mine ? msg("Ruk gaya! Bhaago!", MessageTone.Good, 2) : null;
    case GameEventKind.EnvelopeOpened:
      return mine ? null : msg(`${who} ko lifafa mila. Pause menu ki "Yaadein" mein dekho.`, MessageTone.Info, 3.6);
    case GameEventKind.PlayerLeft:
      return msg(`${who} ka connection toot gaya`, MessageTone.Danger, 4);
    default:
      return null;
  }
};

/** The line under the objectives header: what to do next. */
export const objectiveText = (state: WorldState, level: Level, selfId: string): string => {
  const me = state.players.find((p) => p.id === selfId);
  if (state.phase === RoundPhase.Intro) return "";
  if (me?.status === PlayerStatus.Escaped) return "Tum bach gaye. Dosto ka intezaar...";
  if (me?.status === PlayerStatus.Dead) return "Tum mar chuke ho. Dosto ko dekho...";
  if (me?.status === PlayerStatus.Downed) return "Ghisat ke chhupo. Dost tumhe utha sakte hain.";
  if (state.gateOpen) return "Main gate se bahar niklo!";
  if (state.powerOn) return "Gate khulne tak zinda raho!";
  if (me && me.carrying >= 0) return "Fuse ko fuse box mein lagao (exit ke paas)";
  const locks = level.wings.filter((w) => w.lock !== null).length;
  if (state.keys.length < locks) return "Chaabi dhoondho aur band darwaze kholo";
  return `Fuse dhoondho: ${state.fusesInserted}/${state.fusesNeeded} lage`;
};
