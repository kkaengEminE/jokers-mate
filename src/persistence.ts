import {
  entryFee,
  chessOf,
  chessEnd,
  survivors,
  settle,
  type Game,
} from "./engine";
import { deck, type Card } from "./poker";
const canonical = new Map(deck().map((c) => [c.id, c]));
const validCard = (c: Card) =>
  c &&
  canonical.get(c.id)?.rank === c.rank &&
  canonical.get(c.id)?.suit === c.suit;
// A corrupt/old save is not partly resumed. The caller can keep it and start fresh.
export function restore(raw: string | null): Game | null {
  if (!raw) return null;
  try {
    const g = JSON.parse(raw) as Game;
    if (
      g.version !== 2 ||
      (g.economy !== undefined &&
        g.economy !== "split-15-5" &&
        g.economy !== "r3" &&
        g.economy !== "r4") ||
      typeof g.id !== "string" ||
      !Number.isInteger(g.round) ||
      g.round < 1 ||
      !Array.isArray(g.moves) ||
      !["lobby", "chess", "selection", "betting", "result"].includes(g.phase)
    )
      return null;
    if (
      g.journey &&
      (!["roan", "emperor"].includes(g.journey.opponent) ||
        !["play", "prologue", "ending", "failed", "complete"].includes(
          g.journey.screen,
        ))
    )
      return null;
    const c = chessOf(g),
      board = c.board().flat().filter(Boolean);
    if (
      !g.identities ||
      Object.keys(g.identities).length !== board.length ||
      board.some((p) => !validCard(g.identities[p!.square]))
    )
      return null;
    if (!Array.isArray(g.captured?.w) || !Array.isArray(g.captured?.b))
      return null;
    const allocated = [
      ...Object.values(g.identities),
      ...g.captured.w,
      ...g.captured.b,
    ];
    if (
      allocated.length !== 32 ||
      !allocated.every(validCard) ||
      new Set(allocated.map((x) => x.id)).size !== 32
    )
      return null;
    if (
      !Array.isArray(g.achievements) ||
      g.achievements.some((x) => typeof x !== "string")
    )
      return null;
    if (
      !g.banks ||
      !g.committed ||
      !Number.isSafeInteger(g.banks.w + g.banks.b)
    )
      return null;
    for (const s of ["w", "b"] as const)
      if (
        !Number.isSafeInteger(g.banks[s]) ||
        !Number.isSafeInteger(g.committed[s]) ||
        g.banks[s] < entryFee(g.economy) ||
        g.committed[s] < (g.phase === "lobby" ? 0 : entryFee(g.economy)) ||
        g.committed[s] > g.banks[s]
      )
        return null;
    if (g.abandoned) {
      if (
        (g.economy !== "r3" && g.economy !== "r4") ||
        g.phase !== "result" ||
        g.result?.winner !== "b" ||
        !g.settlement ||
        !Array.isArray(g.hands?.w) ||
        !Array.isArray(g.hands?.b) ||
        ![0, 5].includes(g.hands.w.length) ||
        ![0, 5].includes(g.hands.b.length)
      )
        return null;
      const expected = {
        w: g.banks.w - g.committed.w,
        b: g.banks.b + g.committed.w,
      };
      if (
        JSON.stringify(g.settlement) !==
        JSON.stringify({
          final: expected,
          returned: { w: 0, b: g.committed.b },
          award: { w: 0, b: g.committed.w },
          chessAward: { w: 0, b: 0 },
          pot: g.committed.w,
          protection: 0,
        })
      )
        return null;
      return g;
    }
    if (g.phase === "lobby") {
      if (
        (g.economy !== "split-15-5" &&
          g.economy !== "r3" &&
          g.economy !== "r4") ||
        g.moves.length ||
        g.committed.w ||
        g.committed.b ||
        g.chessResult ||
        g.betting ||
        g.result ||
        g.settlement ||
        g.hands?.w.length !== 0 ||
        g.hands?.b.length !== 0
      )
        return null;
      return g;
    }
    const end = chessEnd(c);
    if (JSON.stringify(end) !== JSON.stringify(g.chessResult)) return null;
    if (!Array.isArray(g.hands?.w) || !Array.isArray(g.hands?.b)) return null;
    if ((g.phase === "chess" && end) || (g.phase !== "chess" && !end))
      return null;
    if (g.phase === "chess" || g.phase === "selection") {
      if (
        g.betting ||
        g.result ||
        g.settlement ||
        g.hands.w.length ||
        g.hands.b.length ||
        g.committed.w !== entryFee(g.economy) ||
        g.committed.b !== entryFee(g.economy)
      )
        return null;
    } else {
      for (const s of ["w", "b"] as const) {
        const valid = survivors(c, g.identities, s);
        if (
          g.hands[s].length !== 5 ||
          new Set(g.hands[s].map((x) => x.id)).size !== 5 ||
          g.hands[s].some(
            (x) => !validCard(x) || !valid.some((y) => y.id === x.id),
          )
        )
          return null;
      }
      const b = g.betting;
      if (
        !b ||
        !["w", "b"].includes(b.turn) ||
        !Array.isArray(b.acted) ||
        b.acted.some((s) => s !== "w" && s !== "b") ||
        !Number.isSafeInteger(b.lastRaise) ||
        b.lastRaise < 20 ||
        ![null, "w", "b"].includes(b.raiseLocked) ||
        ![null, "w", "b"].includes(b.folded) ||
        !Array.isArray(b.log) ||
        b.log.some((x) => typeof x !== "string")
      )
        return null;
      if (
        g.phase === "betting" &&
        (g.result || g.settlement || b.done || b.folded)
      )
        return null;
      if (g.phase === "result") {
        if (
          !b.done ||
          !g.result ||
          ![null, "w", "b"].includes(g.result.winner) ||
          typeof g.result.reason !== "string"
        )
          return null;
        const expected = settle(
          g.banks,
          g.committed,
          g.chessResult!.winner,
          g.result.winner,
          g.economy,
        );
        if (JSON.stringify(expected) !== JSON.stringify(g.settlement))
          return null;
      }
    }
    return g;
  } catch {
    return null;
  }
}
