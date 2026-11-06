import { KeyAction } from "@/types/ui";
import type { KeyBindings } from "@/types/ui";
import type { InputState } from "@/client/input-state";
import { MOUSE_SENSITIVITY } from "@/client/input-state";

export interface DesktopInputOptions {
  canvas: HTMLCanvasElement;
  input: InputState;
  sensitivity: () => number;
  /** Current key bindings and look settings (read live, so changing them in the pause menu applies at once). */
  bindings: () => KeyBindings;
  invertY: () => boolean;
  onPause: () => void;
  enabled: () => boolean;
}

/** Keyboard (rebindable) + pointer-lock mouse look. Returns a cleanup function. */
export const attachDesktopInput = ({ canvas, input, sensitivity, bindings, invertY, onPause, enabled }: DesktopInputOptions): (() => void) => {
  const held = new Set<string>();
  const actionsOf = (code: string): KeyAction[] => {
    const keys = bindings();
    return (Object.keys(keys) as KeyAction[]).filter((a) => keys[a].includes(code));
  };
  const isHeld = (action: KeyAction): boolean => bindings()[action].some((c) => held.has(c));
  const recompute = (): void => {
    input.moveX = (isHeld(KeyAction.Right) ? 1 : 0) - (isHeld(KeyAction.Left) ? 1 : 0);
    input.moveZ = (isHeld(KeyAction.Forward) ? 1 : 0) - (isHeld(KeyAction.Back) ? 1 : 0);
    input.sprint = isHeld(KeyAction.Sprint);
    input.crouch = isHeld(KeyAction.Crouch);
    input.interactHeld = isHeld(KeyAction.Use);
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    // Esc normally just releases the mouse (which pauses); without a locked mouse it pauses directly.
    if (e.code === "Escape" && enabled() && document.pointerLockElement !== canvas) onPause();
    if (!enabled() || e.code === "Escape") return;
    const actions = actionsOf(e.code);
    if (actions.length > 0) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    if (actions.includes(KeyAction.Use)) input.interactPressed = true;
    if (actions.includes(KeyAction.Torch)) input.torchPressed = true;
    if (actions.includes(KeyAction.Flash)) input.flashPressed = true;
    recompute();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
    recompute();
  };
  const onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement !== canvas || !enabled()) return;
    const s = MOUSE_SENSITIVITY * sensitivity();
    input.yaw -= e.movementX * s;
    input.pitch = Math.max(-1.45, Math.min(1.45, input.pitch - e.movementY * s * (invertY() ? -1 : 1)));
  };
  const onMouseDown = (e: MouseEvent): void => {
    if (!enabled()) return;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.()?.catch?.(() => undefined);
      return;
    }
    if (e.button === 2) input.flashPressed = true;
    if (e.button === 0) input.interactPressed = true;
  };
  const onLockChange = (): void => {
    if (document.pointerLockElement !== canvas && enabled()) {
      held.clear();
      recompute();
      onPause();
    }
  };
  const onBlur = (): void => {
    held.clear();
    recompute();
  };
  const noMenu = (e: Event): void => e.preventDefault();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onLockChange);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("contextmenu", noMenu);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("pointerlockchange", onLockChange);
    canvas.removeEventListener("mousedown", onMouseDown);
    canvas.removeEventListener("contextmenu", noMenu);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  };
};
