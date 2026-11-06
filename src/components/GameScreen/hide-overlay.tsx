import { HideKind } from "@/types/world";

/** What you see from inside: locker vents, the gap between almirah doors, or the bed's underside. */
export const HideOverlay = ({ kind }: { kind: HideKind | null }) => {
  if (kind === HideKind.Locker) {
    return (
      <div className="absolute inset-0 bg-black/90" data-testid="hide-overlay">
        <div
          className="absolute top-[30%] left-[18%] h-[34%] w-[64%]"
          style={{ background: "repeating-linear-gradient(to bottom, transparent 0 14px, rgba(8,8,8,0.97) 14px 34px)" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.6)_75%)]" />
      </div>
    );
  }
  if (kind === HideKind.Wardrobe) {
    return (
      <div className="absolute inset-0" data-testid="hide-overlay">
        <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-black via-black to-black/95" />
        <div className="absolute inset-y-0 right-0 w-[46%] bg-gradient-to-l from-black via-black to-black/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.7)_70%)]" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0" data-testid="hide-overlay">
      <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-black via-black/95 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.75)_75%)]" />
    </div>
  );
};
