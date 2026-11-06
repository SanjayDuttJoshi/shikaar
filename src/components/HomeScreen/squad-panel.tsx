"use client";

import { useState } from "react";
import { HorrorButton } from "@/components/Common/horror-button";
import { isValidRoomCode, normalizeRoomCode } from "@/net/room-code";

interface SquadPanelProps {
  initialCode: string;
  busy: boolean;
  error: string;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onClose: () => void;
}

/** "Dosto ke saath": open a new room or join a friend's with their code. */
export const SquadPanel = ({ initialCode, busy, error, onCreate, onJoin, onClose }: SquadPanelProps) => {
  const [code, setCode] = useState(normalizeRoomCode(initialCode));
  const valid = isValidRoomCode(code);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" data-testid="squad-panel">
      <section className="flex w-full max-w-sm animate-rise flex-col gap-5 rounded-lg border border-white/10 bg-panel p-5">
        <header className="text-center">
          <h2 className="font-display text-3xl text-[#e9d6cc]">Dosto ke saath</h2>
          <p className="mt-1 text-sm text-ash">2 se 6 log. Free, bina login, seedha ek phone se doosre tak.</p>
        </header>

        <div className="flex flex-col gap-2">
          <HorrorButton testId="create-room" disabled={busy} onClick={onCreate}>
            Naya room banao
          </HorrorButton>
          <p className="text-center text-xs text-ash">Tum host banoge. Code ya link dosto ko bhejo.</p>
        </div>

        <div className="flex items-center gap-3 text-xs tracking-[0.3em] text-ash/70 uppercase">
          <span className="h-px flex-1 bg-white/10" />
          ya
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) onJoin(code);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-[0.2em] text-ash uppercase">Dost ka room code</span>
            <input
              data-testid="join-code"
              value={code}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABCDE"
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              className="rounded-md border border-white/10 bg-black/50 px-3 py-2.5 text-center font-display text-2xl tracking-[0.5em] text-bone uppercase outline-none placeholder:text-ash/40 focus:border-blood/70"
            />
          </label>
          <HorrorButton testId="join-room" variant="ghost" disabled={!valid || busy} onClick={() => onJoin(code)}>
            {busy ? "Jud rahe hain..." : "Room mein jao"}
          </HorrorButton>
        </form>

        {error && <p className="rounded-md border border-blood/40 bg-blood/10 px-3 py-2 text-center text-sm text-[#ffb4a8]">{error}</p>}

        <button type="button" onClick={onClose} className="text-sm text-ash underline-offset-4 hover:text-bone hover:underline">
          Wapas
        </button>
      </section>
    </div>
  );
};
