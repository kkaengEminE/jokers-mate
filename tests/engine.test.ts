const newGame = (...args: Parameters<typeof basenewGame>) =>
  basenewGame(args[0], args[1], "r3");
import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  newGame as basenewGame,
  chessOf,
  applyMove,
  chessEnd,
  survivors,
  settle,
  startBetting,
  act,
  actions,
  aiView,
  chooseMove,
  chooseBet,
  makeRecord,
  type Game,
  type Side,
} from "../src/engine";
import { deck, evaluate, compare, bestHand, type Card } from "../src/poker";
const cards = (text: string): Card[] =>
  text.split(" ").map((id) => {
    const c = deck().find((x) => x.id === id);
    if (!c) throw Error(id);
    return c;
  });
function play(moves: string[], g = newGame()) {
  for (const m of moves) g = applyMove(g, m);
  return g;
}
function ready(banks = { w: 1000, b: 1000 }): Game {
  const g = play(["f3", "e5", "g4", "Qh4#"], newGame(banks));
  return startBetting(
    g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5),
  );
}
describe("card allocation and chess identities", () => {
  it("deals 32 physical cards and reserves distinct K/Q suits", () => {
    for (let n = 0; n < 100; n++) {
      const g = newGame();
      expect(new Set(Object.values(g.identities).map((x) => x.id)).size).toBe(
        32,
      );
      expect(g.identities.e1.rank).toBe(13);
      expect(g.identities.e8.rank).toBe(13);
      expect(g.identities.e1.suit).not.toBe(g.identities.e8.suit);
      expect(g.identities.d1.rank).toBe(12);
      expect(g.identities.d8.rank).toBe(12);
      expect(g.identities.d1.suit).not.toBe(g.identities.d8.suit);
    }
  });
  it("rejects illegal moves without mutation", () => {
    const g = newGame();
    const before = JSON.stringify(g);
    expect(() => applyMove(g, "e5")).toThrow();
    expect(JSON.stringify(g)).toBe(before);
  });
  it("captures reveal the correct card and remove it from survivors", () => {
    const start = newGame();
    const target = start.identities.d7;
    const g = play(["e4", "d5", "exd5"], start);
    expect(g.captured.w).toEqual([target]);
    expect(
      survivors(chessOf(g), g.identities, "b").map((x) => x.id),
    ).not.toContain(target.id);
  });
  it("en passant removes the pawn from its actual square", () => {
    const start = newGame(),
      target = start.identities.d7,
      own = start.identities.e2;
    const g = play(["e4", "a6", "e5", "d5", "exd6"], start);
    expect(g.identities.d5).toBeUndefined();
    expect(g.identities.d6).toEqual(own);
    expect(g.captured.w).toEqual([target]);
  });
  it("castling carries both identities", () => {
    const start = newGame();
    const g = play(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"], start);
    expect(g.identities.g1).toEqual(start.identities.e1);
    expect(g.identities.f1).toEqual(start.identities.h1);
    expect(g.identities.h1).toBeUndefined();
    expect(g.achievements).toContain("왕의 피난처 · 캐슬링");
  });
  it("promotion retains the original pawn card", () => {
    const start = newGame();
    const card = start.identities.a2;
    const g = play(
      ["a4", "h5", "a5", "h4", "a6", "h3", "axb7", "hxg2", "bxa8=N"],
      start,
    );
    expect(chessOf(g).get("a8")?.type).toBe("n");
    expect(g.identities.a8).toEqual(card);
  });
  it("checkmate enters selection without paying the pot", () => {
    const g = play(["f3", "e5", "g4", "Qh4#"]);
    expect(g.phase).toBe("selection");
    expect(g.chessResult).toEqual({ winner: "b", reason: "체크메이트" });
    expect(g.committed).toEqual({ w: 20, b: 20 });
    expect(g.banks).toEqual({ w: 1000, b: 1000 });
    expect(g.settlement).toBeNull();
    expect(() => applyMove(g, "a3")).toThrow();
  });
  it("automatically ends on third repetition", () => {
    const g = play(["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"]);
    expect(g.chessResult).toEqual({ winner: null, reason: "3회 반복 무승부" });
  });
  it("five pieces with answerable check is an immediate win", () => {
    const c = new Chess("r6r/p3k3/Q1p4p/8/8/8/PPP5/R3K3 w - - 0 1");
    c.move("Qxa7+");
    expect(c.isCheckmate()).toBe(false);
    expect(chessEnd(c)).toEqual({ winner: "w", reason: "5기물 · 체크 승리" });
  });
  it("five pieces without check is a draw", () => {
    const c = new Chess("r3k2r/p1p5/Q6p/8/8/8/PPP5/R3K3 w - - 0 1");
    c.move("Qxa7");
    expect(chessEnd(c)).toEqual({ winner: null, reason: "5기물 · 무승부" });
  });
  it("rejects corrupt states below five pieces", () => {
    expect(() =>
      chessEnd(new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1")),
    ).toThrow();
  });
});
describe("poker evaluation", () => {
  const cases: [string, number][] = [
    ["10S 11S 12S 13S 14S", 9],
    ["5D 6D 7D 8D 9D", 8],
    ["9S 9D 9H 9C 14S", 7],
    ["9S 9D 9H 2C 2S", 6],
    ["2H 4H 7H 11H 14H", 5],
    ["14S 2D 3H 4C 5S", 4],
    ["8S 8D 8H 4C 14S", 3],
    ["8S 8D 4H 4C 14S", 2],
    ["8S 8D 3H 4C 14S", 1],
    ["2S 4D 6H 8C 14S", 0],
  ];
  it.each(cases)("%s has category %i", (c, rank) =>
    expect(evaluate(cards(c)).category).toBe(rank),
  );
  it("does not wrap Q K A 2 3", () =>
    expect(evaluate(cards("12S 13D 14H 2C 3S")).category).toBe(0));
  it("5-high loses to 6-high", () =>
    expect(
      compare(
        evaluate(cards("14S 2D 3H 4C 5S")).key,
        evaluate(cards("2S 3D 4H 5C 6S")).key,
      ),
    ).toBe(-1));
  it("rank beats suit, then full suit order breaks ties", () => {
    expect(
      compare(
        evaluate(cards("9C 9H 2D 4C 5S")).key,
        evaluate(cards("8S 8D 14H 13C 12S")).key,
      ),
    ).toBe(1);
    expect(
      compare(
        evaluate(cards("14H 13D 9S 5C 2H")).key,
        evaluate(cards("14D 13H 9C 5S 2D")).key,
      ),
    ).toBe(1);
  });
  it("one or two jokers complete royal flush without duplicate virtual cards", () => {
    for (const text of ["10S 11S 12S 13S J1", "10S 11S 12S J1 J2"]) {
      const h = evaluate(cards(text));
      expect(h.category).toBe(9);
      expect(new Set(h.resolved.map((x) => x.id)).size).toBe(5);
    }
  });
  it("never makes five of a kind", () =>
    expect(evaluate(cards("14S 14D 14H 14C J1")).category).toBe(7));
  it("optimizes a wheel and excludes same-card joker substitutions", () => {
    expect(evaluate(cards("14S 2D 3H 4C J1")).key[1]).toBe(5);
    const h = evaluate(cards("14S 14D 14H J1 J2"));
    expect(h.category).toBe(7);
    expect(new Set(h.resolved.map((x) => x.id)).size).toBe(5);
  });
  it("best selection may omit king and queen", () => {
    const h = bestHand(cards("2S 3S 4S 5S 6S 13D 12H"));
    expect(h.category).toBe(8);
    expect(h.cards.some((x) => x.rank >= 12)).toBe(false);
  });
  it("rejects duplicate physical cards", () =>
    expect(() => evaluate(cards("14S 14S 2H 3C 4D"))).toThrow());
});
describe("gold conservation and floor", () => {
  const cases: [
    number,
    number,
    number,
    number,
    Side | null,
    Side | null,
    number,
    number,
  ][] = [
    [1000, 1000, 1000, 1000, "w", "b", 20, 1980],
    [1000, 1000, 1000, 1000, "b", "w", 1980, 20],
    [1000, 1000, 1000, 1000, null, "w", 2000, 0],
    [1000, 1000, 1000, 1000, "w", "w", 2000, 0],
    [1000, 1000, 20, 20, "w", "b", 980, 1020],
    [1000, 1000, 990, 990, "w", "b", 20, 1980],
    [1000, 1000, 980, 980, "w", "b", 20, 1980],
    [1000, 1000, 1000, 100, "w", "b", 900, 1100],
    [100, 1900, 100, 1900, "w", "b", 20, 1980],
    [100, 1900, 100, 1900, "w", "w", 200, 1800],
    [100, 1900, 100, 1900, null, "b", 0, 2000],
    [1000, 1000, 100, 20, null, "w", 1020, 980],
    [1000, 1000, 20, 100, "w", "b", 980, 1020],
    [1000, 1000, 990, 1000, "w", "b", 20, 1980],
    [20, 1980, 20, 20, "w", "b", 20, 1980],
    [20, 1980, 20, 20, null, "b", 0, 2000],
    [1000, 1000, 1000, 1000, "w", null, 1000, 1000],
    [100, 1900, 100, 1900, "w", null, 100, 1900],
    [1000, 1000, 981, 981, null, "b", 19, 1981],
    [1000, 1000, 980, 980, null, "b", 20, 1980],
  ];
  it.each(cases)(
    "settles %i/%i committed %i/%i chess %s poker %s => %i/%i",
    (a, b, ca, cb, ch, p, w, black) =>
      expect(settle({ w: a, b }, { w: ca, b: cb }, ch, p).final).toEqual({
        w,
        b: black,
      }),
  );
  it("preserves totals and symmetry across small/large stacks", () => {
    const sides: (Side | null)[] = ["w", "b", null];
    const opposite = (s: Side | null) =>
      s === null ? null : s === "w" ? "b" : "w";
    for (let w = 20; w <= 1980; w += 7)
      for (const cw of [20, Math.max(20, w - 10), w])
        for (const cb of [20, Math.max(20, 1990 - w), 2000 - w])
          for (const ch of sides)
            for (const po of sides) {
              const r = settle({ w, b: 2000 - w }, { w: cw, b: cb }, ch, po);
              expect(r.final.w + r.final.b).toBe(2000);
              expect(Math.min(r.final.w, r.final.b)).toBeGreaterThanOrEqual(0);
              if (ch) expect(r.final[ch]).toBeGreaterThanOrEqual(20);
              const inverse = settle(
                { w: 2000 - w, b: w },
                { w: cb, b: cw },
                opposite(ch),
                opposite(po),
              );
              expect(inverse.final).toEqual({ w: r.final.b, b: r.final.w });
            }
  });
  it("rejects insufficient participation and broken ledgers", () => {
    expect(() => newGame({ w: 19, b: 1981 })).toThrow();
    expect(() =>
      settle({ w: 1000, b: 1000 }, { w: 1001, b: 20 }, null, "w"),
    ).toThrow();
    expect(() =>
      settle({ w: 1000, b: 1001 }, { w: 20, b: 20 }, null, "w"),
    ).toThrow();
    expect(() =>
      settle({ w: 1000, b: 1000 }, { w: 20.5, b: 20 }, null, "w"),
    ).toThrow();
  });
});
describe("end-to-end betting state machine", () => {
  it("closes check/check once and blocks re-settlement", () => {
    let g = ready();
    g = act(g, "w", { type: "check" });
    expect(g.phase).toBe("betting");
    g = act(g, "b", { type: "check" });
    expect(g.phase).toBe("result");
    expect(g.settlement!.final.w + g.settlement!.final.b).toBe(2000);
    expect(() => act(g, "w", { type: "check" })).toThrow();
  });
  it("raise + call closes, raise + re-raise stays open until response", () => {
    let g = ready();
    g = act(g, "w", { type: "raise", amount: 100 });
    g = act(g, "b", { type: "raise", amount: 180 });
    expect(g.phase).toBe("betting");
    expect(actions(g, "w").minTotal).toBe(260);
    g = act(g, "w", { type: "call" });
    expect(g.phase).toBe("result");
  });
  it("fold returns uncalled amount and does not record hidden cards", () => {
    let g = ready();
    g = act(g, "w", { type: "raise", amount: 100 });
    g = act(g, "b", { type: "fold" });
    expect(g.settlement!.returned.w).toBe(80);
    expect(g.settlement!.final).toEqual({ w: 990, b: 1010 });
    expect(makeRecord(g).hands).toEqual({ w: [], b: [] });
  });
  it("unequal all-ins refund the large stack", () => {
    let g = ready({ w: 100, b: 1900 });
    g = act(g, "w", { type: "allin" });
    expect(actions(g, "b").raise).toBe(false);
    expect(actions(g, "b").call).toBe(true);
    g = act(g, "b", { type: "call" });
    expect(g.phase).toBe("result");
    expect(g.committed).toEqual({ w: 100, b: 100 });
    expect(g.settlement!.pot).toBe(170);
  });
  it("short all-in does not reopen a previous actor", () => {
    let g = ready({ w: 1830, b: 170 });
    g = act(g, "w", { type: "raise", amount: 100 });
    g = act(g, "b", { type: "allin" });
    expect(g.phase).toBe("betting");
    expect(actions(g, "w").raise).toBe(false);
    expect(actions(g, "w").allin).toBe(false);
    g = act(g, "w", { type: "call" });
    expect(g.phase).toBe("result");
  });
  it("forced ante-only all-in settles without impossible action", () => {
    const g = ready({ w: 20, b: 1980 });
    expect(g.phase).toBe("result");
    expect(g.settlement!.pot).toBe(10);
  });
  it("rejects out-of-turn, under-raise, NaN, and check facing bet", () => {
    let g = ready();
    expect(() => act(g, "b", { type: "check" })).toThrow();
    expect(() => act(g, "w", { type: "raise", amount: 21 })).toThrow();
    expect(() => act(g, "w", { type: "raise", amount: NaN })).toThrow();
    g = act(g, "w", { type: "raise", amount: 100 });
    expect(() => act(g, "b", { type: "check" })).toThrow();
  });
  it("rejects captured, duplicate and wrong-side hand selections", () => {
    const g = play(["f3", "e5", "g4", "Qh4#"]);
    const w = survivors(chessOf(g), g.identities, "w"),
      b = survivors(chessOf(g), g.identities, "b");
    expect(() => startBetting(g, w.slice(0, 4), b.slice(0, 5))).toThrow();
    expect(() => startBetting(g, Array(5).fill(w[0]), b.slice(0, 5))).toThrow();
    expect(() => startBetting(g, b.slice(0, 5), w.slice(0, 5))).toThrow();
  });
});
describe("AI information boundary", () => {
  it("receives no opponent identities and ignores their permutation", () => {
    const g = play(["e4"]);
    const view = aiView(g);
    expect(Object.keys(view.ownCards)).toHaveLength(16);
    const changed = structuredClone(g);
    [changed.identities.a1, changed.identities.b1] = [
      changed.identities.b1,
      changed.identities.a1,
    ];
    expect(aiView(changed)).toEqual(view);
    const move = chooseMove(view, () => 0.5);
    expect(
      chessOf(g)
        .moves({ verbose: true })
        .some(
          (m) =>
            m.from === move.from &&
            m.to === move.to &&
            m.promotion === move.promotion,
        ),
    ).toBe(true);
  });
  it("bets with its own hand and public ledger only", () => {
    const a = chooseBet(
      {
        ownHand: cards("2S 4D 6H 8C 10S"),
        banks: { w: 1000, b: 1000 },
        committed: { w: 900, b: 20 },
        turn: "b",
        lastRaise: 880,
        raiseLocked: null,
      },
      () => 0.9,
    );
    expect(a.type).toBe("fold");
  });
});

describe("check escape and simultaneous five-piece endings", () => {
  it("escaping check by capture without counter-check draws", () => {
    const c = new Chess("1nb1k3/p6p/8/8/8/8/P3r3/RNBQK3 w - - 0 1");
    expect(c.isCheck()).toBe(true);
    c.move("Kxe2");
    expect(chessEnd(c)).toEqual({ winner: null, reason: "5기물 · 무승부" });
  });
  it("escaping check with counter-check wins at five pieces", () => {
    const c = new Chess("1nb1k3/p6p/8/8/8/8/P3r3/RNBQK3 w - - 0 1");
    c.move("Qxe2+");
    expect(chessEnd(c)).toEqual({ winner: "w", reason: "5기물 · 체크 승리" });
  });
  it("checkmate takes precedence over the five-piece reason", () => {
    const c = new Chess("rn5k/pp4p1/7Q/8/8/2B5/PPP5/4K3 w - - 0 1");
    c.move("Qxg7#");
    expect(chessEnd(c)).toEqual({ winner: "w", reason: "체크메이트" });
  });
  it("an en passant discovered check triggers the special win", () => {
    const c = new Chess("r3k2r/pp6/8/3pP3/8/8/1PPP4/K3R3 w kq d6 0 2");
    c.move("exd6+");
    expect(chessEnd(c)).toEqual({ winner: "w", reason: "5기물 · 체크 승리" });
  });
});
