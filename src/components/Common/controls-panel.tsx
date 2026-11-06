"use client";

import { useEffect, useState } from "react";
import { HorrorButton } from "@/components/Common/horror-button";
import { ControlPreset, KeyAction } from "@/types/ui";
import type { Settings } from "@/types/ui";
import { ACTION_LABEL, KEY_PRESETS, keyName, rebind } from "@/lib/key-bindings";

interface ControlsPanelProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
}

interface Listening {
  action: KeyAction;
  slot: number;
}

/** Rebind every key, pick WASD or arrow-key layout, tune the mouse. */
export const ControlsPanel = ({ settings, onChange, onClose }: ControlsPanelProps) => {
  const [listening, setListening] = useState<Listening | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListening(null);
        return;
      }
      const code = e.code === "Backspace" || e.code === "Delete" ? null : e.code;
      onChange({ ...settings, keys: rebind(settings.keys, listening.action, listening.slot, code) });
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [listening, settings, onChange]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" data-testid="controls-panel">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-white/10 bg-panel p-5">
        <h2 className="text-center font-display text-2xl text-bone">Controls</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { preset: ControlPreset.Wasd, label: "W A S D" },
            { preset: ControlPreset.Arrows, label: "Arrow keys ↑ ↓ ← →" },
          ].map(({ preset, label }) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ ...settings, keys: KEY_PRESETS[preset] })}
              className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm font-semibold text-bone hover:border-blood/70"
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {Object.values(KeyAction).map((action) => (
            <li key={action} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ash">{ACTION_LABEL[action]}</span>
              <span className="flex gap-1.5">
                {[0, 1].map((slot) => {
                  const active = listening?.action === action && listening.slot === slot;
                  const code = settings.keys[action][slot];
                  return (
                    <button
                      key={slot}
                      type="button"
                      data-testid={`bind-${action}-${slot}`}
                      onClick={() => setListening({ action, slot })}
                      className={`min-w-[5.5rem] rounded border px-2 py-1.5 font-semibold ${
                        active ? "animate-pulse border-blood bg-blood/30 text-white" : "border-white/20 bg-black/50 text-bone hover:border-white/40"
                      }`}
                    >
                      {active ? "Key dabao..." : code ? keyName(code) : "—"}
                    </button>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ash/80">Button dabao, phir nayi key. Backspace se hatao, Esc se cancel. Mouse: left-click = uthao, right-click = flash.</p>
        <label className="flex flex-col gap-1 text-sm text-ash">
          Mouse speed: {settings.sensitivity.toFixed(1)}
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.1}
            value={settings.sensitivity}
            onChange={(e) => onChange({ ...settings, sensitivity: Number(e.target.value) })}
            className="accent-[#b3140f]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ash">
          <input type="checkbox" checked={settings.invertY} onChange={(e) => onChange({ ...settings, invertY: e.target.checked })} className="accent-[#b3140f]" />
          Mouse ulta (upar-neeche invert)
        </label>
        <HorrorButton testId="controls-done" onClick={onClose}>
          Theek hai
        </HorrorButton>
      </div>
    </div>
  );
};
