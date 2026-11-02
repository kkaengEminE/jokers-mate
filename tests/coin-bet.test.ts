import { describe, expect, it } from "vitest";
import { act, applyMove, chessOf, newGame, startBetting, survivors } from "../src/engine";
import { coinQuote, quickRaise } from "../src/coinBet";

function game(bank = 1000) {
  let g = newGame({ w: bank, b: 1000 }, 1, "r4");
  for (const move of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, move);
  return startBetting(g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5), true);
}

describe("gold tray quotes against the unchanged betting engine", () => {
  it("prepares without charging and does not permit an ordinary 10G bet", () => {
    const g = game(), saved = JSON.stringify(g);
    expect(coinQuote(g, 0).action).toBeNull();
    expect(coinQuote(g, 10).action).toBeNull();
    expect(coinQuote(g, 10).reason).toContain("10G 더 필요");
    const q = coinQuote(g, 20);
    expect(q.payment).toBe(20);
    expect(q.remaining).toBe(930);
    expect(JSON.stringify(g)).toBe(saved);
    expect(act(g, "w", q.action!).committed.w).toBe(70);
  });
  it("shows the actual payment including a call, and honors the last full raise", () => {
    let g = act(game(), "w", { type: "check" });
    g = act(g, "b", { type: "raise", amount: 90 });
    expect(coinQuote(g, 20).action).toBeNull();
    const q = coinQuote(g, 40);
    expect(q.minimum).toBe(40);
    expect(q.payment).toBe(80);
    expect(q.action).toEqual({ type: "raise", amount: 130 });
    const next = act(g, "w", q.action!);
    expect(next.committed.w - g.committed.w).toBe(q.payment);
    expect(q.remaining).toBe(870);
    expect(coinQuote(g, 50).payment).toBe(90);
  });
  it("does not charge earlier streets again", () => {
    let g = act(game(), "w", { type: "raise", amount: 90 });
    g = act(g, "b", { type: "call" });
    const q = coinQuote(g, 50);
    expect(q.payment).toBe(50);
    expect(act(g, "w", q.action!).committed.w).toBe(140);
  });
  it("preserves 1G adjustments and exact odd balances", () => {
    const g = game();
    const q = coinQuote(g, 21);
    expect(act(g, "w", q.action!).committed.w).toBe(71);
    const short = game(87), all = coinQuote(short, "allin");
    expect(all.payment).toBe(37);
    expect(act(short, "w", all.action!).committed.w).toBe(87);
  });
  it("uses the explicit all-in action when coins exactly use the remaining gold", () => {
    const g = game(90), q = coinQuote(g, 40);
    expect(q.allin).toBe(true);
    expect(q.action).toEqual({ type: "allin" });
    expect(act(g, "w", q.action!).committed.w).toBe(90);
  });
  it("handles a short all-in without reopening an already-acted opponent's raise", () => {
    const g = game(65);
    g.betting!.acted = ["b"];
    const q = coinQuote(g, "allin");
    expect(q.payment).toBe(15);
    const next = act(g, "w", q.action!);
    expect(next.betting!.raiseLocked).toBe("b");
    expect(coinQuote(next, "allin", "b").action).toBeNull();
    expect(coinQuote(next, 20, "b").action).toBeNull();
    expect(coinQuote(next, 0, "b").allowed.call).toBe(true);
  });
  it("shows a short call's real payment and retains unmatched refunds", () => {
    let g = act(game(65), "w", { type: "check" });
    g = act(g, "b", { type: "raise", amount: 90 });
    expect(coinQuote(g, 0).callPayment).toBe(15);
    const next = act(g, "w", { type: "call" });
    expect(next.settlement!.returned.b).toBe(25);
    expect(next.settlement!.final.w + next.settlement!.final.b).toBe(1065);
  });
  it("rejects over-budget, fractional, negative, unsafe, and nonfinite drafts", () => {
    for (const value of [951, 1.5, -20, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(coinQuote(game(), value).action).toBeNull();
    }
  });
  it("disables commitments on the opponent turn and after settlement", () => {
    const g = act(game(), "w", { type: "check" });
    expect(coinQuote(g, 20).action).toBeNull();
    expect(coinQuote(g, "allin").action).toBeNull();
    expect(coinQuote(act(g, "b", { type: "fold" }), "allin").action).toBeNull();
  });
  it("fits quick amounts to legal bounds without changing the pot", () => {
    const g = game();
    expect(quickRaise(g, 60, 0.5)).toBe(30);
    expect(quickRaise(g, 61, 0.5)).toBe(31);
    expect(quickRaise(g, 10, 0.5)).toBe(20);
    expect(quickRaise(game(65), 100, 1)).toBeNull();
    expect(quickRaise(game(87), 100, 1)).toBe(37);
  });
});
