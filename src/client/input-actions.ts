import type { InputState } from "@/client/input-state";
import { TOUCH_LOOK_SENSITIVITY } from "@/client/input-state";

/** Small mutators so UI code (touch buttons) can drive the shared input without touching it directly. */
export const pressTorch = (input: InputState): void => {
  input.torchPressed = true;
};

export const pressFlash = (input: InputState): void => {
  input.flashPressed = true;
};

export const setUse = (input: InputState, held: boolean): void => {
  if (held) input.interactPressed = true;
  input.interactHeld = held;
};

export const toggleCrouch = (input: InputState): void => {
  input.crouch = !input.crouch;
};

export const setSprint = (input: InputState, on: boolean): void => {
  input.sprint = on;
};

export const setStick = (input: InputState, x: number, z: number): void => {
  input.moveX = x;
  input.moveZ = z;
};

export const touchLook = (input: InputState, dx: number, dy: number, sensitivity: number): void => {
  const s = TOUCH_LOOK_SENSITIVITY * sensitivity;
  input.yaw -= dx * s;
  input.pitch = Math.max(-1.45, Math.min(1.45, input.pitch - dy * s));
};
