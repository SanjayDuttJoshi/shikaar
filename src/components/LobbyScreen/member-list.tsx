import { LobbyStatus } from "@/types/net";
import type { LobbyState } from "@/types/net";
import { MAX_SQUAD } from "@/net/messages";
import { squadCss } from "@/lib/squad";

interface MemberListProps {
  lobby: LobbyState;
  selfId: string;
}

/** Who's in the room: colour, name, host crown, and who's busy in the current round. */
export const MemberList = ({ lobby, selfId }: MemberListProps) => (
  <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-panel p-4">
    <p className="text-xs font-semibold tracking-[0.2em] text-ash uppercase">
      Squad ({lobby.members.length}/{MAX_SQUAD})
    </p>
    <ul className="flex flex-col gap-1.5" data-testid="member-list">
      {lobby.members.map((m) => (
        <li key={m.peerId} className="flex items-center gap-3 rounded-md bg-black/40 px-3 py-2">
          <span className="h-3 w-3 shrink-0 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: squadCss(m.color), color: squadCss(m.color) }} />
          <span className="flex-1 truncate text-bone">
            {m.name}
            {m.peerId === selfId && <span className="ml-2 text-xs text-ash">(tum)</span>}
          </span>
          {lobby.status === LobbyStatus.Playing && lobby.inRound.includes(m.peerId) && <span className="text-xs text-ember">andar hai</span>}
          {m.peerId === lobby.hostId && <span title="Host">👑</span>}
        </li>
      ))}
    </ul>
    {lobby.members.length < 2 && <p className="text-center text-sm text-ash">Dosto ka intezaar... code bhejo!</p>}
  </div>
);
