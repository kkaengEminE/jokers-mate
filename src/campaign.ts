import { newLobby, type Game } from "./engine";
export const EMPEROR_GOLD = 2_100_000_000;
export function newCampaign(): Game {
  return { ...newLobby(), journey: { opponent: "roan", screen: "prologue" } };
}
export function campaignOutcome(g: Game) {
  if (!g.settlement) return "playing";
  if (g.settlement.final.w < 20) return "failed";
  if (g.settlement.final.b < 20)
    return g.journey?.opponent === "emperor" ? "true-ending" : "ending";
  return "round";
}
export function nextRound(g: Game): Game {
  if (campaignOutcome(g) !== "round")
    throw Error("다음 판에 참가할 수 없습니다.");
  return {
    ...newLobby(g.settlement!.final, g.round + 1),
    journey: { opponent: g.journey?.opponent ?? "roan", screen: "play" },
  };
}
export function finishEnding(g: Game): Game {
  const outcome = campaignOutcome(g);
  if (outcome === "ending")
    return {
      ...newLobby({ w: g.settlement!.final.w, b: EMPEROR_GOLD }),
      journey: { opponent: "emperor", screen: "play" },
    };
  if (outcome === "true-ending")
    return { ...g, journey: { opponent: "emperor", screen: "complete" } };
  throw Error("승리 엔딩 조건이 아닙니다.");
}
export function abandon(g: Game): Game {
  if (g.economy !== "r3" || g.phase === "lobby" || g.phase === "result")
    return g;
  return {
    ...g,
    phase: "result",
    abandoned: true,
    result: { winner: "b", reason: "대국 도주 · 납부액 상실" },
    settlement: {
      final: { w: g.banks.w - g.committed.w, b: g.banks.b + g.committed.w },
      returned: { w: 0, b: g.committed.b },
      award: { w: 0, b: g.committed.w },
      chessAward: { w: 0, b: 0 },
      pot: g.committed.w,
      protection: 0,
    },
  };
}
