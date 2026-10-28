import { expect, it } from "vitest";
import { fixture } from "../src/fixtures";
import { showdownFrame } from "../src/showdown";
import { restore } from "../src/persistence";

it("holds the final verdict while the last two cards on each side are revealed in order", () => {
  const game = fixture("showdown");
  const saved = JSON.stringify(game);
  expect(game.phase).toBe("result");
  expect(game.betting?.street).toBe(2);
  expect(
    [0, 1, 2, 3, 4].map((step) => showdownFrame(game, step).counts),
  ).toEqual([
    { w: 3, b: 3 },
    { w: 4, b: 3 },
    { w: 4, b: 4 },
    { w: 5, b: 4 },
    { w: 5, b: 5 },
  ]);
  expect(showdownFrame(game, 4).allShown).toBe(true);
  expect(showdownFrame(game, 4).complete).toBe(false);
  expect(showdownFrame(game, 5).complete).toBe(true);
  expect(showdownFrame(game, 2).latest).toEqual({ side: "b", index: 3 });
  // The presentation never changes the game or pays the pot again.
  expect(JSON.stringify(game)).toBe(saved);
  expect(restore(saved)).toEqual(game);
});

it("runs out every remaining card for early all-ins and legacy single-street saves", () => {
  const game = fixture("showdown-allin");
  expect(showdownFrame(game, 0).counts).toEqual({ w: 1, b: 1 });
  expect(showdownFrame(game, 8).counts).toEqual({ w: 5, b: 5 });
  expect(showdownFrame(game, 8).complete).toBe(false);
  expect(showdownFrame(game, 9).complete).toBe(true);
  const legacy = fixture("result");
  expect(showdownFrame(legacy, 0).counts).toEqual({ w: 0, b: 0 });
  expect(showdownFrame(legacy, 10).allShown).toBe(true);
  expect(showdownFrame(legacy, 11).complete).toBe(true);
});

it("never reveals folded hands or starts a showdown during normal betting", () => {
  expect(showdownFrame(fixture("fold"), 100).active).toBe(false);
  expect(showdownFrame(fixture("staged-poker"), 0).active).toBe(false);
  expect(
    showdownFrame({ ...fixture("showdown"), abandoned: true }, 0).active,
  ).toBe(false);
});
