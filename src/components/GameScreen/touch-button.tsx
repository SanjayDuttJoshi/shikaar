import type { ReactNode } from "react";

interface TouchButtonProps {
  label: ReactNode;
  /** Fires the moment the thumb lands (actions that must feel instant). */
  onDown?: () => void;
  onUp?: () => void;
  /**
   * Fires on a finished tap. Used for buttons that open a menu, so the tap can't fall through
   * onto whatever the menu puts under the thumb.
   */
  onTap?: () => void;
  big?: boolean;
}

export const TouchButton = ({ label, onDown, onUp, onTap, big = false }: TouchButtonProps) => (
  <button
    type="button"
    className={`no-select flex items-center justify-center rounded-full border bg-black/45 text-xs font-semibold text-bone active:bg-blood/60 ${big ? "h-16 w-16 border-white/50" : "h-14 w-14 border-white/25"}`}
    onPointerDown={(e) => {
      e.stopPropagation();
      onDown?.();
    }}
    onPointerUp={(e) => {
      e.stopPropagation();
      onUp?.();
    }}
    onPointerCancel={() => onUp?.()}
    onClick={onTap}
  >
    {label}
  </button>
);
