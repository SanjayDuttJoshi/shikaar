"use client";

import { ChoiceRow } from "@/components/Common/choice-row";
import { HorrorButton } from "@/components/Common/horror-button";
import { InvitePanel } from "@/components/LobbyScreen/invite-panel";
import { MemberList } from "@/components/LobbyScreen/member-list";
import { LobbyStatus, RoomStatus } from "@/types/net";
import type { LobbySettings, RoomView } from "@/types/net";
import { BUILDING_OPTIONS, DIFFICULTY_OPTIONS, optionLabel } from "@/lib/menu-options";

interface LobbyScreenProps {
  view: RoomView;
  onSettings: (settings: LobbySettings) => void;
  onStart: () => void;
  onLeave: () => void;
}

/** The squad room before (and between) rounds. Only the host picks the building and starts. */
export const LobbyScreen = ({ view, onSettings, onStart, onLeave }: LobbyScreenProps) => {
  const lobby = view.lobby;
  const roundRunning = lobby?.status === LobbyStatus.Playing;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8" data-testid="lobby">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,rgba(120,20,12,0.25),transparent_60%)]" />
      <section className="relative z-10 flex w-full max-w-md animate-rise flex-col gap-4">
        <header className="text-center">
          <h1 className="font-display text-4xl text-[#e9d6cc]">Squad ka room</h1>
          <p className="mt-1 text-sm text-ash">{view.isHost ? "Tum host ho. Sab aa jayein to shuru karo." : "Host shuru karega. Taiyaar raho..."}</p>
        </header>

        <InvitePanel code={view.code} />

        {view.status === RoomStatus.Connecting && (
          <p className="animate-breathe rounded-md border border-white/10 bg-black/40 px-3 py-3 text-center text-bone">Host ko dhoondh rahe hain...</p>
        )}
        {view.status === RoomStatus.Error && (
          <p className="rounded-md border border-blood/40 bg-blood/10 px-3 py-3 text-center text-[#ffb4a8]" data-testid="room-error">
            {view.notice}
          </p>
        )}
        {view.status !== RoomStatus.Error && view.notice && (
          <p className="rounded-md border border-ember/30 bg-ember/10 px-3 py-2 text-center text-sm text-[#ffcfb0]">{view.notice}</p>
        )}

        {lobby && view.status !== RoomStatus.Error && <MemberList lobby={lobby} selfId={view.selfId} />}

        {lobby && view.isHost && (
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-panel p-4">
            <ChoiceRow label="Shikari kitna khatarnak" value={lobby.settings.difficulty} options={DIFFICULTY_OPTIONS} onChange={(difficulty) => onSettings({ ...lobby.settings, difficulty })} />
            <ChoiceRow label="Jagah" value={lobby.settings.building} options={BUILDING_OPTIONS} onChange={(building) => onSettings({ ...lobby.settings, building })} />
          </div>
        )}
        {lobby && !view.isHost && view.status === RoomStatus.Lobby && (
          <p className="text-center text-sm text-ash">
            {optionLabel(DIFFICULTY_OPTIONS, lobby.settings.difficulty)} · {optionLabel(BUILDING_OPTIONS, lobby.settings.building)}
            {roundRunning ? " · Round chal raha hai, agle mein tum bhi" : ""}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {view.isHost && (
            <HorrorButton testId="start-round" disabled={roundRunning} onClick={onStart}>
              {roundRunning ? "Round chal raha hai..." : `Andar chalo (${lobby?.members.length ?? 1} log)`}
            </HorrorButton>
          )}
          <HorrorButton variant="ghost" testId="leave-room" onClick={onLeave}>
            Room chhodo
          </HorrorButton>
        </div>
        <p className="text-center text-xs text-ash/70">Online round rukta nahi: pause karoge tab bhi Shikari chalta rahega.</p>
      </section>
    </main>
  );
};
