/** Live controls shared by keyboard/mouse and touch. The game loop reads it every frame. */
export interface InputState {
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  crouch: boolean;
  /** E held (used for revive). */
  interactHeld: boolean;
  /** One-shot presses, consumed by the loop. */
  interactPressed: boolean;
  flashPressed: boolean;
  torchPressed: boolean;
}

export const createInputState = (yaw: number): InputState => ({
  moveX: 0,
  moveZ: 0,
  yaw,
  pitch: 0,
  sprint: false,
  crouch: false,
  interactHeld: false,
  interactPressed: false,
  flashPressed: false,
  torchPressed: false,
});

export const MOUSE_SENSITIVITY = 0.0022;
export const TOUCH_LOOK_SENSITIVITY = 0.0055;
