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
  /** One-shot: show (or stop showing) the view of this squad friend, by their place in the squad list (-1 none). */
  viewPressed: number;
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
  viewPressed: -1,
});

export const MOUSE_SENSITIVITY = 0.0022;
export const TOUCH_LOOK_SENSITIVITY = 0.0055;
