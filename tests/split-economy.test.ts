import { expect, it } from "vitest";
import {
  settle,
  newGame,
  applyMove,
  startBetting,
  survivors,
  chessOf,
  act,
  type Side,
} from "../src/engine";
import { restore } from "../src/persistence";
const split = "split-15-5" as const;
it.each([
  ["w", "w", 1020],
  ["w", "b", 1010],
  ["b", "w", 990],
  ["b", "b", 980],
  [null, "w", 1005],
  [null, "b", 995],
  ["w", null, 1015],
  [null, null, 1000],
] as [Side | null, Side | null, number][])(
  "allocates chess %s poker %s to %d",
  (chess, poker, final) => {
    const r = settle(
      { w: 1000, b: 1000 },
      { w: 20, b: 20 },
      chess,
      poker,
      split,
    );
    expect(r.final).toEqual({ w: final, b: 2000 - final });
    expect(r.pot).toBe(10);
    expect(r.protection).toBe(0);
  },
);
it("returns unmatched poker bets on fold without touching chess pot", () => {
  const r = settle({ w: 1000, b: 1000 }, { w: 20, b: 200 }, "w", "b", split);
  expect(r.returned.b).toBe(180);
  expect(r.final.w).toBe(1010);
});
it("has no twenty-gold floor, including draws and unequal all-ins", () => {
  expect(
    settle({ w: 20, b: 1980 }, { w: 20, b: 20 }, null, "b", split).final.w,
  ).toBe(15);
  expect(
    settle({ w: 20, b: 1980 }, { w: 20, b: 1980 }, "b", "b", split).final.w,
  ).toBe(0);
  expect(
    settle({ w: 20, b: 1980 }, { w: 20, b: 20 }, "w", "b", split).final.w,
  ).toBe(30);
});
it("conserves gold and side symmetry over stack, commitment and winner combinations", () => {
  for (const w of [20, 21, 39, 100, 999, 1000, 1900, 1980]) {
    const banks = { w, b: 2000 - w };
    for (const cw of [20, Math.floor((20 + w) / 2), w])
      for (const cb of [20, Math.floor((20 + banks.b) / 2), banks.b])
        for (const chess of [null, "w", "b"] as const)
          for (const poker of [null, "w", "b"] as const) {
            const r = settle(banks, { w: cw, b: cb }, chess, poker, split);
            expect(r.final.w + r.final.b).toBe(2000);
            expect(Math.min(r.final.w, r.final.b)).toBeGreaterThanOrEqual(0);
            const flip = (s: Side | null) =>
              s === null ? null : s === "w" ? "b" : "w";
            const swapped = settle(
              { w: banks.b, b: banks.w },
              { w: cb, b: cw },
              flip(chess),
              flip(poker),
              split,
            );
            expect(swapped.final.w).toBe(r.final.b);
          }
  }
});
it("restores old untagged saves with old settlement, new rounds opt into split", () => {
  let g = newGame();
  delete g.economy;
  for (const move of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, move);
  g = startBetting(
    g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5),
  );
  g = act(g, "w", { type: "fold" });
  expect(g.settlement!.pot).toBe(40);
  expect(restore(JSON.stringify(g))).toEqual(g);
  expect(newGame(g.settlement!.final, 2).economy).toBe("r3");
  expect(restore(JSON.stringify({ ...g, economy: split }))).toBeNull();
});
