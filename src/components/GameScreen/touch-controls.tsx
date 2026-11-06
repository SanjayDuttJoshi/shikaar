"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { InputState } from "@/client/input-state";
import { pressFlash, pressTorch, setSprint, setStick, setUse, toggleCrouch, touchLook } from "@/client/input-actions";

const STICK_RADIUS = 56;

interface TouchControlsProps {
  input: InputState;
  sensitivity: number;
  onPause: () => void;
}

interface ActionButtonProps {
  label: ReactNode;
  onDown: () => void;
  onUp?: () => void;
  big?: boolean;
}

const ActionButton = ({ label, onDown, onUp, big = false }: ActionButtonProps) => (
  <button
    type="button"
    className={`no-select flex items-center justify-center rounded-full border bg-black/45 text-xs font-semibold text-bone active:bg-blood/60 ${big ? "h-16 w-16 border-white/50" : "h-14 w-14 border-white/25"}`}
    onPointerDown={(e) => {
      e.stopPropagation();
      onDown();
    }}
    onPointerUp={(e) => {
      e.stopPropagation();
      onUp?.();
    }}
    onPointerCancel={() => onUp?.()}
  >
    {label}
  </button>
);

interface Drag {
  id: number;
  x: number;
  y: number;
}

/** Left thumb: move stick. Right side: drag to look. Buttons for run, crouch, torch, flash and use. */
export const TouchControls = ({ input, sensitivity, onPause }: TouchControlsProps) => {
  const stick = useRef<Drag | null>(null);
  const look = useRef<Drag | null>(null);
  const knob = useRef<HTMLDivElement>(null);

  const onStickDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onStickMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const d = Math.min(STICK_RADIUS, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    setStick(input, (Math.cos(a) * d) / STICK_RADIUS, (-Math.sin(a) * d) / STICK_RADIUS);
    if (knob.current) knob.current.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
  };
  const onStickUp = (): void => {
    stick.current = null;
    setStick(input, 0, 0);
    if (knob.current) knob.current.style.transform = "translate(0,0)";
  };
  const onLookDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onLookMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const l = look.current;
    if (!l || l.id !== e.pointerId) return;
    touchLook(input, e.clientX - l.x, e.clientY - l.y, sensitivity);
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onLookUp = (): void => {
    look.current = null;
  };

  return (
    <div className="no-select absolute inset-0 z-10">
      <div className="absolute inset-y-0 right-0 w-3/5" onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} />
      <div
        className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 flex h-32 w-32 items-center justify-center rounded-full border border-white/15 bg-black/25"
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div ref={knob} className="h-12 w-12 rounded-full border border-white/40 bg-white/15" />
      </div>
      <div className="absolute right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] grid grid-cols-3 gap-2">
        <ActionButton label="Torch" onDown={() => pressTorch(input)} />
        <ActionButton label="Flash" onDown={() => pressFlash(input)} />
        <ActionButton label="Use" big onDown={() => setUse(input, true)} onUp={() => setUse(input, false)} />
        <ActionButton label="Jhuko" onDown={() => toggleCrouch(input)} />
        <ActionButton label="Bhaago" onDown={() => setSprint(input, true)} onUp={() => setSprint(input, false)} />
        <ActionButton label="☰" onDown={onPause} />
      </div>
    </div>
  );
};
