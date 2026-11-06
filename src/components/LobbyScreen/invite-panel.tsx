"use client";

import { useState } from "react";
import { buildInviteLink } from "@/net/room-code";

interface InvitePanelProps {
  code: string;
}

const COPIED_MS = 1800;

/** The room code, a link to copy, and one tap to send it on WhatsApp. */
export const InvitePanel = ({ code }: InvitePanelProps) => {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : buildInviteLink(window.location.origin, window.location.pathname, code);
  const text = `SHIKAAR khelein? Andhere mein saath chalte hain 😈 Room code: ${code}\n${link}`;

  const copy = (): void => {
    navigator.clipboard
      ?.writeText(link)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-white/10 bg-panel p-4 text-center">
      <p className="text-xs font-semibold tracking-[0.3em] text-ash uppercase">Room code</p>
      <p className="font-display text-5xl tracking-[0.35em] text-[#ffd8d0] text-glow-red" data-testid="room-code">
        {code}
      </p>
      <div className="grid w-full grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-sm font-semibold text-bone hover:border-white/30"
        >
          {copied ? "Copy ho gaya ✓" : "Link copy karo"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-[#25d366]/50 bg-[#0d2a18] px-3 py-2.5 text-sm font-semibold text-[#b8f5cc] hover:border-[#25d366]"
        >
          WhatsApp pe bhejo
        </a>
      </div>
    </div>
  );
};
