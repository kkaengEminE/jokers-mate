import { it, expect } from "vitest";
import { deck, evaluate, compare } from "../src/poker";
it("decides disjoint single-deck showdown hands including both jokers", () => {
  let seed = 42;
  for (let round = 0; round < 32; round++) {
    const pool = deck().filter((c) => c.suit !== "J");
    for (let i = pool.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const jokers = deck().filter((c) => c.suit === "J");
    const a =
      round % 2
        ? [...pool.slice(0, 4), jokers[0]]
        : [...pool.slice(0, 3), ...jokers];
    const b = round % 2 ? [...pool.slice(4, 8), jokers[1]] : pool.slice(3, 8);
    expect(compare(evaluate(a).key, evaluate(b).key)).not.toBe(0);
  }
});
