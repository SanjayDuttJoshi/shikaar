import VOICE_DATA from "@/content/voice-lines.json";
import { Language } from "@/types/ui";

interface VoiceLine {
  id: string;
  speaker: string;
  tts: string;
  hi: string;
  en: string;
}

const LINES = new Map<string, VoiceLine>((VOICE_DATA.lines as VoiceLine[]).map((l) => [l.id, l]));

/** Audio file for a spoken line in the chosen language. */
export const voicePath = (id: string, lang: Language): string => `voice/${lang}/${id}.mp3`;

/** What the line says, for subtitles (Hinglish in Roman script for Hindi). */
export const subtitleFor = (id: string, lang: Language): string => {
  const line = LINES.get(id);
  if (!line) return "";
  return lang === Language.English ? line.en : line.hi;
};

export const speakerOf = (id: string): string => LINES.get(id)?.speaker ?? "";
