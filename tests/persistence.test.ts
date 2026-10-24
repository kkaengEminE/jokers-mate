const newGame = (...args: Parameters<typeof basenewGame>) =>
  basenewGame(args[0], args[1], "r3");
import { it, expect } from "vitest";
import { restore } from "../src/persistence";
import {
  newGame as basenewGame,
  applyMove,
  chessOf,
  survivors,
  startBetting,
  act,
} from "../src/engine";
import { bestHand, deck } from "../src/poker";
it("restores chess, selection, betting and settled snapshots without duplicate settlement", () => {
  let g = newGame();
  expect(restore(JSON.stringify(g))).toEqual(g);
  for (const move of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, move);
  expect(restore(JSON.stringify(g))).toEqual(g);
  g = startBetting(
    g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5),
  );
  g = act(g, "w", { type: "raise", amount: 100 });
  expect(restore(JSON.stringify(g))).toEqual(g);
  g = act(g, "b", { type: "fold" });
  expect(restore(JSON.stringify(g))).toEqual(g);
  const broken = structuredClone(g);
  broken.settlement!.final.w += 20;
  expect(restore(JSON.stringify(broken))).toBeNull();
});
it("rejects corrupt, wrong-version, invalid-card and invalid-phase saves", () => {
  expect(restore("{")).toBeNull();
  expect(restore(null)).toBeNull();
  const g = newGame();
  expect(restore(JSON.stringify({ ...g, version: 1 }))).toBeNull();
  const bad = structuredClone(g);
  bad.identities.a1.rank = 999;
  expect(restore(JSON.stringify(bad))).toBeNull();
  expect(restore(JSON.stringify({ ...g, phase: "result" }))).toBeNull();
  const missing = structuredClone(g);
  delete missing.identities.e1;
  expect(restore(JSON.stringify(missing))).toBeNull();
});
it("keeps identity count aligned across full capture-heavy games", () => {
  for (let trial = 0; trial < 4; trial++) {
    let g = newGame(),
      seed = trial + 1;
    for (let ply = 0; ply < 600 && g.phase === "chess"; ply++) {
      const c = chessOf(g),
        all = c.moves({ verbose: true }),
        captures = all.filter((m) => m.captured),
        choices = captures.length ? captures : all;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      g = applyMove(g, choices[seed % choices.length].san);
      expect(
        Object.keys(g.identities).length +
          g.captured.w.length +
          g.captured.b.length,
      ).toBe(32);
      expect(Object.keys(g.identities).length).toBe(
        chessOf(g).board().flat().filter(Boolean).length,
      );
    }
    expect(g.phase).toBe("selection");
    expect(restore(JSON.stringify(g))).toEqual(g);
  }
});
it("selects a complete legal hand from sixteen survivors with two jokers", () => {
  const pool = [
    ...deck().filter((c) => c.suit === "D"),
    deck().find((c) => c.id === "2C")!,
    deck().find((c) => c.id === "J1")!,
    deck().find((c) => c.id === "J2")!,
  ];
  const hand = bestHand(pool);
  expect(hand.category).toBe(9);
  expect(hand.cards).toHaveLength(5);
  expect(new Set(hand.resolved.map((c) => c.id)).size).toBe(5);
}, 30000);
