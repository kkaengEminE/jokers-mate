import { describe, it, expect } from "vitest";
import {
  newGame,
  applyMove,
  chessOf,
  survivors,
  startBetting,
  act,
  exposedHand,
  actions,
} from "../src/engine";
import { restore } from "../src/persistence";
function game() {
  let g = newGame();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, move);
  return startBetting(
    g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5),
    true,
  );
}
describe("three betting streets", () => {
  it("exposes one card per completed street and settles only after all three", () => {
    let g = game();
    for (let street = 0; street < 3; street++) {
      expect(g.betting!.street).toBe(street);
      expect(exposedHand(g, "b")).toHaveLength(street + 1);
      g = act(g, "w", { type: "check" });
      expect(g.betting!.street).toBe(street);
      g = act(g, "b", { type: "check" });
      if (street < 2) {
        expect(g.phase).toBe("betting");
        expect(g.settlement).toBeNull();
      }
    }
    expect(g.phase).toBe("result");
    expect(exposedHand(g, "b")).toHaveLength(5);
    expect(g.settlement!.final.w + g.settlement!.final.b).toBe(2000);
  });
  it("does not reveal on a raise; resets minimum raise after call without charging again", () => {
    let g = act(game(), "w", { type: "raise", amount: 100 });
    expect(exposedHand(g, "b")).toHaveLength(1);
    g = act(g, "b", { type: "call" });
    expect(g.committed).toEqual({ w: 100, b: 100 });
    expect(g.betting!.lastRaise).toBe(20);
    expect(actions(g, "w").minTotal).toBe(120);
    expect(restore(JSON.stringify(g))).not.toBeNull();
  });
  it("preserves public cards but hides remaining cards after a fold", () => {
    const g = act(game(), "w", { type: "fold" });
    expect(g.phase).toBe("result");
    expect(exposedHand(g, "b")).toHaveLength(1);
    expect(g.settlement!.final.w + g.settlement!.final.b).toBe(2000);
  });
  it("skips later betting after a matched all-in", () => {
    let g = act(game(), "w", { type: "allin" });
    expect(g.phase).toBe("betting");
    g = act(g, "b", { type: "call" });
    expect(g.phase).toBe("result");
    expect(exposedHand(g, "b")).toHaveLength(5);
  });
  it("rejects corrupt street metadata", () => {
    const g = game();
    g.betting!.street = 9;
    expect(restore(JSON.stringify(g))).toBeNull();
  });
});
