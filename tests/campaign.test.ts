import { expect, it } from "vitest";
import { settle, enterGame, makeRecord, type Game } from "../src/engine";
import {
  newCampaign,
  nextRound,
  finishEnding,
  abandon,
  campaignOutcome,
  EMPEROR_GOLD,
} from "../src/campaign";
import { restore } from "../src/persistence";
it.each([
  ["w", "w", 1020],
  ["w", "b", 1010],
  ["b", "w", 990],
  ["b", "b", 980],
  [null, "w", 1020],
  [null, "b", 980],
] as const)("R3 chess %s poker %s pays %d", (chess, poker, expected) => {
  const r = settle({ w: 1000, b: 1000 }, { w: 20, b: 20 }, chess, poker, "r3");
  expect(r.final).toEqual({ w: expected, b: 2000 - expected });
  expect(r.pot).toBe(chess === null ? 40 : 10);
});
it("matches unequal emperor all-ins and conserves the dynamic supply", () => {
  const r = settle(
    { w: 1000, b: EMPEROR_GOLD },
    { w: 1000, b: EMPEROR_GOLD },
    null,
    "w",
    "r3",
  );
  expect(r.final).toEqual({ w: 2000, b: EMPEROR_GOLD - 1000 });
  expect(r.returned.b).toBe(EMPEROR_GOLD - 1000);
  expect(() =>
    settle({ w: 1000, b: 1000 }, { w: 20, b: 20 }, null, null, "r3"),
  ).toThrow();
});
it("abandonment charges once, restores and records without completed chess", () => {
  const g = enterGame(newCampaign());
  const lost = abandon(g);
  expect(lost.settlement!.final).toEqual({ w: 980, b: 1020 });
  expect(abandon(lost)).toEqual(lost);
  expect(restore(JSON.stringify(lost))).toEqual(lost);
  expect(makeRecord(lost).chess).toContain("미완료");
  expect(nextRound(lost).committed).toEqual({ w: 0, b: 0 });
  expect(abandon(newCampaign()).settlement).toBeNull();
});
function result(
  w: number,
  b: number,
  opponent: "roan" | "emperor" = "roan",
): Game {
  return {
    ...newCampaign(),
    phase: "result",
    journey: { opponent, screen: "ending" },
    settlement: {
      final: { w, b },
      returned: { w: 0, b: 0 },
      award: { w: 0, b: 0 },
      protection: 0,
      pot: 40,
    },
  };
}
it("only total Roan victory unlocks emperor, player money carries over", () => {
  expect(campaignOutcome(result(1000, 1000))).toBe("round");
  expect(() => finishEnding(result(1000, 1000))).toThrow();
  const next = finishEnding(result(1981, 19));
  expect(next.journey).toEqual({ opponent: "emperor", screen: "play" });
  expect(next.banks).toEqual({ w: 1981, b: EMPEROR_GOLD });
  expect(restore(JSON.stringify(next))).toEqual(next);
});
it("bankruptcy boundary and true ending prohibit another round", () => {
  for (const opponent of ["roan", "emperor"] as const) {
    expect(campaignOutcome(result(19, 2000, opponent))).toBe("failed");
    expect(() => nextRound(result(19, 2000, opponent))).toThrow();
    expect(() => finishEnding(result(19, 2000, opponent))).toThrow();
    expect(campaignOutcome(result(20, 20, opponent))).toBe("round");
  }
  expect(campaignOutcome(result(1000, 19, "emperor"))).toBe("true-ending");
  expect(finishEnding(result(1000, 19, "emperor")).journey!.screen).toBe(
    "complete",
  );
  expect(newCampaign().journey).toEqual({
    opponent: "roan",
    screen: "prologue",
  });
});
it("R3 preserves supply and symmetry across unequal stacks and all-in outcomes", () => {
  for (const banks of [
    { w: 20, b: 1980 },
    { w: 39, b: 1961 },
    { w: 1000, b: 1000 },
    { w: 1000, b: EMPEROR_GOLD },
  ]) {
    for (const w of [20, banks.w])
      for (const b of [20, banks.b])
        for (const chess of [null, "w", "b"] as const)
          for (const poker of ["w", "b"] as const) {
            const r = settle(banks, { w, b }, chess, poker, "r3");
            expect(r.final.w + r.final.b).toBe(banks.w + banks.b);
            expect(Math.min(r.final.w, r.final.b)).toBeGreaterThanOrEqual(0);
            const flip = (side: "w" | "b" | null) =>
              side === null ? null : side === "w" ? "b" : "w";
            const reversed = settle(
              { w: banks.b, b: banks.w },
              { w: b, b: w },
              flip(chess),
              flip(poker),
              "r3",
            );
            expect(reversed.final.w).toBe(r.final.b);
          }
  }
});
