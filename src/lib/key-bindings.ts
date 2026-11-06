import { ControlPreset, KeyAction } from "@/types/ui";
import type { KeyBindings } from "@/types/ui";

export const KEY_PRESETS: Record<ControlPreset, KeyBindings> = {
  [ControlPreset.Wasd]: {
    [KeyAction.Forward]: ["KeyW", "ArrowUp"],
    [KeyAction.Back]: ["KeyS", "ArrowDown"],
    [KeyAction.Left]: ["KeyA", "ArrowLeft"],
    [KeyAction.Right]: ["KeyD", "ArrowRight"],
    [KeyAction.Sprint]: ["ShiftLeft", "ShiftRight"],
    [KeyAction.Crouch]: ["KeyC", "ControlLeft"],
    [KeyAction.Use]: ["KeyE"],
    [KeyAction.Torch]: ["KeyF"],
    [KeyAction.Flash]: ["KeyQ"],
  },
  [ControlPreset.Arrows]: {
    [KeyAction.Forward]: ["ArrowUp"],
    [KeyAction.Back]: ["ArrowDown"],
    [KeyAction.Left]: ["ArrowLeft"],
    [KeyAction.Right]: ["ArrowRight"],
    [KeyAction.Sprint]: ["ShiftRight", "ShiftLeft"],
    [KeyAction.Crouch]: ["ControlRight", "KeyC"],
    [KeyAction.Use]: ["Enter", "KeyE"],
    [KeyAction.Torch]: ["Period", "KeyF"],
    [KeyAction.Flash]: ["Slash", "KeyQ"],
  },
};

export const ACTION_LABEL: Record<KeyAction, string> = {
  [KeyAction.Forward]: "Aage",
  [KeyAction.Back]: "Peeche",
  [KeyAction.Left]: "Baayein",
  [KeyAction.Right]: "Daayein",
  [KeyAction.Sprint]: "Bhaago",
  [KeyAction.Crouch]: "Jhuko",
  [KeyAction.Use]: "Uthao / darwaza / chhupo",
  [KeyAction.Torch]: "Torch on/off",
  [KeyAction.Flash]: "Flash",
};

/** Human-readable name for a KeyboardEvent.code ("KeyW" → "W", "ArrowUp" → "↑"). */
export const keyName = (code: string): string => {
  const special: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
    ControlLeft: "L-Ctrl",
    ControlRight: "R-Ctrl",
    AltLeft: "L-Alt",
    AltRight: "R-Alt",
    Space: "Space",
    Enter: "Enter",
    Period: ".",
    Slash: "/",
    Comma: ",",
    Semicolon: ";",
    Quote: "'",
    Tab: "Tab",
  };
  if (special[code]) return special[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
};

/** Binds `code` to `action` in slot 0/1, removing it from any other action so one key does one thing. */
export const rebind = (keys: KeyBindings, action: KeyAction, slot: number, code: string | null): KeyBindings => {
  const next = Object.fromEntries(
    Object.entries(keys).map(([a, codes]) => [a, code ? codes.filter((c) => c !== code) : [...codes]]),
  ) as KeyBindings;
  const list = [...next[action]];
  if (code) list[slot] = code;
  else list.splice(slot, 1);
  next[action] = list.filter(Boolean).slice(0, 2);
  return next;
};

export const isValidBindings = (v: unknown): v is KeyBindings => {
  if (!v || typeof v !== "object") return false;
  return Object.values(KeyAction).every((a) => {
    const codes = (v as Record<string, unknown>)[a];
    return Array.isArray(codes) && codes.length <= 2 && codes.every((c) => typeof c === "string" && c.length < 30);
  });
};
