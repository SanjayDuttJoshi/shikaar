import { describe, expect, it } from "vitest";
import { Difficulty, PlayerStatus, RoundPhase } from "@/types/game";
import { Theme } from "@/types/world";
import { createFriendView } from "@/client/friend-view";
import { createInputState } from "@/client/input-state";
import { pressView } from "@/client/input-actions";
import { createWorldState } from "@/game/context";
import { generateLevel } from "@/world/generate-level";

const PLAYERS = [
  { id: "raju", name: "Raju", color: 0 },
  { id: "priya", name: "Priya", color: 1 },
  { id: "sonu", name: "Sonu", color: 2 },
];

const setup = (online = true) => {
  const level = generateLevel({ seed: 8, theme: Theme.Haveli, players: PLAYERS.length });
  const state = createWorldState(level, PLAYERS, Difficulty.Easy);
  state.phase = RoundPhase.Playing;
  const input = createInputState(0.5);
  const view = createFriendView(state, "raju", online, input);
  const me = state.players[0];
  return { state, input, view, me };
};

describe("dost ki nazar (friend view)", () => {
  it("tapping a friend's name shows their eyes; tapping again comes back", () => {
    const { input, view, me } = setup();
    pressView(input, 1);
    view.update(me, false);
    expect(view.peeking()).toBe("sonu");
    expect(input.viewPressed).toBe(-1);
    pressView(input, 0);
    view.update(me, false);
    expect(view.peeking()).toBe("priya");
    pressView(input, 0);
    view.update(me, false);
    expect(view.peeking()).toBeNull();
  });

  it("your own body doesn't turn while you look through a friend's eyes", () => {
    const { input, view, me } = setup();
    pressView(input, 0);
    view.update(me, false);
    input.yaw += 1.2;
    input.pitch = 0.6;
    view.update(me, false);
    expect(input.yaw).toBeCloseTo(0.5);
    expect(input.pitch).toBe(0);
  });

  it("walking brings your eyes back and the step still happens", () => {
    const { input, view, me } = setup();
    pressView(input, 0);
    view.update(me, false);
    input.moveZ = 1;
    view.update(me, false);
    expect(view.peeking()).toBeNull();
    expect(input.moveZ).toBe(1);
  });

  it("a button press only brings your eyes back (it doesn't act on what you couldn't see)", () => {
    const { input, view, me } = setup();
    pressView(input, 0);
    view.update(me, false);
    input.interactPressed = true;
    view.update(me, false);
    expect(view.peeking()).toBeNull();
    expect(input.interactPressed).toBe(false);
  });

  it("getting hurt (stop) or the friend leaving the round ends the view", () => {
    const { state, input, view, me } = setup();
    pressView(input, 0);
    view.update(me, false);
    view.stop();
    expect(view.peeking()).toBeNull();
    pressView(input, 0);
    view.update(me, false);
    state.players[1].status = PlayerStatus.Dead;
    view.update(me, false);
    expect(view.peeking()).toBeNull();
  });

  it("can't peek at a friend who is already out, in solo, or from a menu", () => {
    const solo = setup(false);
    pressView(solo.input, 0);
    solo.view.update(solo.me, false);
    expect(solo.view.peeking()).toBeNull();

    const { state, input, view, me } = setup();
    state.players[1].status = PlayerStatus.Escaped;
    pressView(input, 0);
    view.update(me, false);
    expect(view.peeking()).toBeNull();
    pressView(input, 1);
    view.update(me, true);
    expect(view.peeking()).toBeNull();
  });

  it("after dying, tapping a name picks who to watch", () => {
    const { input, view, me } = setup();
    me.status = PlayerStatus.Dead;
    pressView(input, 1);
    expect(view.update(me, false)).toBe("sonu");
    expect(view.peeking()).toBeNull();
  });
});
