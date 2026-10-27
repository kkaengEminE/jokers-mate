import { describe, it, expect } from "vitest";
import { deck, evaluate, compare, label, type Suit } from "../src/poker";

describe("Joker's Mate suit tiebreaker", () => {
  const flush = (suit: Suit) => evaluate(deck().filter(c => c.suit === suit && [14, 11, 9, 6, 2].includes(c.rank)));
  it.each([["S", "H"], ["H", "D"], ["D", "C"]] as [Suit, Suit][])("%s beats %s when ranks match", (high, low) => {
    expect(compare(flush(high).key, flush(low).key)).toBe(1);
  });
  it("shows suit before rank, retaining joker labels", () => {
    for (const [id, text] of [["14S", "♠ A"], ["10H", "♥ 10"], ["12D", "♦ Q"], ["2C", "♣ 2"], ["J1", "JOKER"]]) {
      expect(label(deck().find(c => c.id === id)!)).toBe(text);
    }
  });
});
