import type { ReactNode } from "react";

interface HorrorButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  testId?: string;
}

export const HorrorButton = ({ children, onClick, variant = "primary", disabled = false, testId }: HorrorButtonProps) => (
  <button
    type="button"
    data-testid={testId}
    disabled={disabled}
    onClick={onClick}
    className={`w-full rounded-md px-5 py-3.5 font-display text-lg tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
      variant === "primary"
        ? "border border-blood bg-gradient-to-b from-[#3a0a08] to-[#1a0504] text-[#ffd8d0] shadow-[0_0_24px_rgba(179,20,15,0.35)] hover:shadow-[0_0_36px_rgba(220,30,20,0.6)] active:scale-[0.98]"
        : "border border-white/15 bg-black/40 text-bone hover:border-white/30 hover:bg-white/5"
    }`}
  >
    {children}
  </button>
);
