"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { InputState } from "@/client/input-state";
import { pressFlash, pressTorch, setSprint, setStick, setUse, toggleCrouch, touchLook } from "@/client/input-actions";
import { TouchButton } from "@/components/GameScreen/touch-button";

const STICK_RADIUS = 56;

interface TouchControlsProps {
  input: InputState;
  sensitivity: number;
  onPause: () => void;
  /** Out of the round (dead or escaped): only switching friends and the menu are left. */
  watching: boolean;
}

interface Drag {
  id: number;
  x: number;
  y: number;
}

/**
 * Left side: a move stick that appears wherever the thumb lands. Right side: drag to look.
 * Buttons for run, crouch, torch, flash, use and the menu sit bottom right.
 */
export const TouchControls = ({ input, sensitivity, onPause, watching }: TouchControlsProps) => {
  const stick = useRef<Drag | null>(null);
  const look = useRef<Drag | null>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);

  const placeBase = (x: number | null, y: number | null): void => {
    const el = base.current;
    if (!el) return;
    el.style.left = x === null ? "" : `${x - el.offsetWidth / 2}px`;
    el.style.top = y === null ? "" : `${y - el.offsetHeight / 2}px`;
    el.style.bottom = y === null ? "" : "auto";
  };
  const onStickDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (stick.current) return;
    const zone = e.currentTarget.getBoundingClientRect();
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    placeBase(e.clientX - zone.left, e.clientY - zone.top);
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
  const onStickUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = null;
    setStick(input, 0, 0);
    placeBase(null, null);
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
  const onLookUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (look.current?.id === e.pointerId) look.current = null;
  };

  return (
    <div className="no-select absolute inset-0 z-10" data-testid="touch-controls">
      <div className="absolute inset-y-0 right-0 w-3/5" onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} />
      {!watching && (
        <div className="absolute inset-y-0 left-0 w-2/5" data-testid="move-zone" onPointerDown={onStickDown} onPointerMove={onStickMove} onPointerUp={onStickUp} onPointerCancel={onStickUp}>
          <div
            ref={base}
            className="pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 flex h-32 w-32 items-center justify-center rounded-full border border-white/15 bg-black/25"
            data-testid="move-stick"
          >
            <div ref={knob} className="h-12 w-12 rounded-full border border-white/40 bg-white/15" />
          </div>
        </div>
      )}
      <div className="absolute right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] grid grid-cols-3 gap-2">
        {!watching && <TouchButton label="Torch" onDown={() => pressTorch(input)} />}
        {!watching && <TouchButton label="Flash" onDown={() => pressFlash(input)} />}
        <TouchButton label="Use" big onDown={() => setUse(input, true)} onUp={() => setUse(input, false)} />
        {!watching && <TouchButton label="Jhuko" onDown={() => toggleCrouch(input)} />}
        {!watching && <TouchButton label="Bhaago" onDown={() => setSprint(input, true)} onUp={() => setSprint(input, false)} />}
        <TouchButton label="☰" onTap={onPause} />
      </div>
    </div>
  );
};
