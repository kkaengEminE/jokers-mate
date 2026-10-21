import { it, expect, vi } from "vitest";
import { applyMove, newGame, aiView, chooseMove, chessOf } from "../src/engine";
import { bestHand, bestHandAsync, deck } from "../src/poker";
it("responds after the first move with Worker and network unavailable", () => {
  const fetchMock = vi.fn(() => {
    throw new Error("offline");
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Worker", undefined);
  try {
    const g = applyMove(newGame(), "e4"),
      reply = chooseMove(aiView(g));
    const next = applyMove(g, reply);
    expect(next.moves).toHaveLength(2);
    expect(chessOf(next).turn()).toBe("w");
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("asynchronous built-in hand selection matches exact evaluator without Worker", async () => {
  vi.stubGlobal("Worker", undefined);
  try {
    const pool = deck().filter((c) =>
      ["2S", "3S", "4S", "5S", "J1", "13H", "12D"].includes(c.id),
    );
    expect((await bestHandAsync(pool)).key).toEqual(bestHand(pool).key);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("cancels stale recommendation work", async () => {
  const c = new AbortController();
  c.abort();
  await expect(
    bestHandAsync(deck().slice(0, 8), c.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});
