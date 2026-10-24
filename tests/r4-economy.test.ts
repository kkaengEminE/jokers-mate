import { expect, it } from "vitest";
import {
  newGame,
  newLobby,
  enterGame,
  settle,
  applyMove,
  startBetting,
  survivors,
  chessOf,
  act,
} from "../src/engine";
import { restore } from "../src/persistence";
import { campaignOutcome, nextRound } from "../src/campaign";
it.each([
  ["w", "w", 1050],
  ["w", "b", 990],
  ["b", "w", 1010],
  ["b", "b", 950],
  [null, "w", 1050],
  [null, "b", 950],
] as const)("R4 base chess %s poker %s final %d", (chess, poker, w) => {
  const r = settle({ w: 1000, b: 1000 }, { w: 50, b: 50 }, chess, poker, "r4");
  expect(r.final).toEqual({ w, b: 2000 - w });
  expect(r.pot).toBe(chess === null ? 100 : 60);
  expect(r.protection).toBe(0);
});
it("charges 50 once and rejects entry at 49", () => {
  const l = newLobby({ w: 50, b: 1950 });
  expect(l.economy).toBe("r4");
  expect(l.committed.w).toBe(0);
  const g = enterGame(l);
  expect(g.committed).toEqual({ w: 50, b: 50 });
  expect(() => enterGame(g)).toThrow();
  expect(() => newGame({ w: 49, b: 1951 })).toThrow();
  expect(restore(JSON.stringify(g))).toEqual(g);
});
it("no floor even for a chess winner at the entry boundary or all-in", () => {
  const low = settle({ w: 50, b: 1950 }, { w: 50, b: 50 }, "w", "b", "r4");
  expect(low.final).toEqual({ w: 40, b: 1960 });
  expect(campaignOutcome({ ...newGame(), settlement: low })).toBe("failed");
  const all = settle(
    { w: 1000, b: 1000 },
    { w: 1000, b: 1000 },
    "w",
    "b",
    "r4",
  );
  expect(all.final).toEqual({ w: 40, b: 1960 });
});
it("returns unmatched raises on fold and supports large opponent stacks", () => {
  const fold = settle({ w: 1000, b: 1000 }, { w: 50, b: 250 }, "w", "b", "r4");
  expect(fold.returned.b).toBe(200);
  expect(fold.final).toEqual({ w: 990, b: 1010 });
  const large = settle(
    { w: 1000, b: 2100000000 },
    { w: 1000, b: 2100000000 },
    null,
    "w",
    "r4",
  );
  expect(large.final).toEqual({ w: 2000, b: 2099999000 });
});
it("round-trip real check/check and fold settlements and upgrade next round", () => {
  for (const economy of ["r3", "r4"] as const) {
    let g = newGame(undefined, 1, economy);
    for (const move of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, move);
    g = startBetting(
      g,
      survivors(chessOf(g), g.identities, "w").slice(0, 5),
      survivors(chessOf(g), g.identities, "b").slice(0, 5),
    );
    const fold = act(g, "w", { type: "fold" });
    expect(restore(JSON.stringify(fold))).toEqual(fold);
    const done = act(act(g, "w", { type: "check" }), "b", { type: "check" });
    expect(restore(JSON.stringify(done))).toEqual(done);
    expect(nextRound(done).economy).toBe("r4");
    expect(enterGame(nextRound(done)).committed.w).toBe(50);
  }
});
it("conserves gold and symmetry for uneven stacks, all-ins, and every winner", () => {
  for (const banks of [
    { w: 50, b: 50 },
    { w: 59, b: 1941 },
    { w: 1000, b: 1000 },
    { w: 1000, b: 2100000000 },
  ])
    for (const w of [50, banks.w])
      for (const b of [50, banks.b])
        for (const chess of [null, "w", "b"] as const)
          for (const poker of ["w", "b"] as const) {
            const r = settle(banks, { w, b }, chess, poker, "r4");
            expect(r.final.w + r.final.b).toBe(banks.w + banks.b);
            expect(Math.min(r.final.w, r.final.b)).toBeGreaterThanOrEqual(0);
            const flip = (s: "w" | "b" | null) =>
              s === null ? null : s === "w" ? "b" : "w";
            const other = settle(
              { w: banks.b, b: banks.w },
              { w: b, b: w },
              flip(chess),
              flip(poker),
              "r4",
            );
            expect(other.final.w).toBe(r.final.b);
          }
});
