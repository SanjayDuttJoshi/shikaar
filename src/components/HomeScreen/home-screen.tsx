"use client";

import { useState } from "react";
import { ChoiceRow } from "@/components/Common/choice-row";
import { ControlsPanel } from "@/components/Common/controls-panel";
import { HorrorButton } from "@/components/Common/horror-button";
import { SquadPanel } from "@/components/HomeScreen/squad-panel";
import { useIsTouch } from "@/hooks/use-is-touch";
import { BUILDING_OPTIONS, DIFFICULTY_OPTIONS, LANGUAGE_OPTIONS, QUALITY_OPTIONS } from "@/lib/menu-options";
import type { Settings } from "@/types/ui";

/** The "Dosto ke saath" panel's state, owned by the app. */
export interface SquadMenu {
  open: boolean;
  code: string;
  busy: boolean;
  error: string;
  onOpen: () => void;
  onClose: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
}

interface HomeScreenProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onPlaySolo: () => void;
  squad: SquadMenu;
}

export const HomeScreen = ({ settings, onChange, onPlaySolo, squad }: HomeScreenProps) => {
  const [controls, setControls] = useState(false);
  const touch = useIsTouch();
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 md:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(120,20,12,0.28),transparent_60%),radial-gradient(ellipse_at_50%_120%,rgba(30,40,30,0.5),transparent_60%)]" />
      <div className="grain pointer-events-none absolute inset-0 animate-drift opacity-40 mix-blend-overlay" />
      {/* Wide screens: title, name and play buttons on the left (visible without scrolling), options on the right. */}
      <section className="relative z-10 grid w-full max-w-md animate-rise gap-7 md:max-w-4xl md:grid-cols-2 md:items-center md:gap-x-10 md:gap-y-5">
        <div className="flex flex-col gap-6">
          <header className="text-center">
            <p className="text-sm tracking-[0.45em] text-ash uppercase">Raat 2:47</p>
            <h1 className="mt-2 animate-flicker font-display text-[clamp(3.2rem,16vw,5.5rem)] leading-none text-[#e9d6cc] text-glow-red">SHIKAAR</h1>
            <p className="mt-3 animate-breathe font-display text-lg text-ash">Andhere mein koi hai...</p>
          </header>
          <label className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-panel p-4 backdrop-blur-sm">
            <span className="text-xs font-semibold tracking-[0.2em] text-ash uppercase">Tumhara naam</span>
            <input
              value={settings.name}
              maxLength={16}
              placeholder="Naam likho (dosto ko dikhega)"
              onChange={(e) => onChange({ ...settings, name: e.target.value })}
              className="rounded-md border border-white/10 bg-black/50 px-3 py-2.5 text-base text-bone outline-none placeholder:text-ash/60 focus:border-blood/70"
            />
          </label>
          <div className="flex flex-col gap-3">
            <HorrorButton testId="play-solo" onClick={onPlaySolo}>
              Akele andar jao
            </HorrorButton>
            <HorrorButton variant="ghost" testId="play-squad" onClick={squad.onOpen}>
              Dosto ke saath (online)
            </HorrorButton>
            {!touch && (
              <HorrorButton variant="ghost" testId="open-controls" onClick={() => setControls(true)}>
                Controls / keys badlo
              </HorrorButton>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-panel p-5 backdrop-blur-sm">
          <ChoiceRow
            label="Shikari kitna khatarnak"
            value={settings.difficulty}
            options={DIFFICULTY_OPTIONS}
            onChange={(difficulty) => onChange({ ...settings, difficulty })}
          />
          <ChoiceRow label="Jagah (map)" value={settings.building} options={BUILDING_OPTIONS} onChange={(building) => onChange({ ...settings, building })} />
          <ChoiceRow label="Awaaz / Voice" value={settings.language} options={LANGUAGE_OPTIONS} onChange={(language) => onChange({ ...settings, language })} />
          <ChoiceRow label="Graphics" value={settings.quality} options={QUALITY_OPTIONS} onChange={(quality) => onChange({ ...settings, quality })} />
        </div>

        <footer className="space-y-1 text-center text-sm text-ash md:col-span-2">
          <p>🎧 Headphones lagao. Awaaz se pata chalega woh kahan hai.</p>
          <p className="text-xs text-ash/70">
            {touch
              ? "Phone tircha karo · left side angootha = chalo · right side ghisao = dekho · Use = uthao/chhupo"
              : "WASD chalo · Shift bhaago · C jhuko · F torch · E uthao/chhupo · Q flash"}
          </p>
        </footer>
      </section>
      {controls && <ControlsPanel settings={settings} onChange={onChange} onClose={() => setControls(false)} />}
      {squad.open && <SquadPanel initialCode={squad.code} busy={squad.busy} error={squad.error} onCreate={squad.onCreate} onJoin={squad.onJoin} onClose={squad.onClose} />}
    </main>
  );
};
