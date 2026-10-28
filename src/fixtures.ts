// Development-only browser QA. Imported only behind Vite's DEV guard.
import {
  newGame,
  newLobby,
  applyMove,
  startBetting,
  chessOf,
  survivors,
  act,
  settle,
  type Game,
} from "./engine";
export function fixture(name: string): Game {
  if (name === "r4-lobby") return newLobby();
  let g = name === "showdown-check" ? newGame(undefined, 2, "r4") : newGame();
  if (name === "art-chess") return g;
  for (const m of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, m);
  if (name === "selection") return g;
  g = startBetting(
    g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5),
    ["staged-poker", "showdown", "showdown-allin", "showdown-check"].includes(name),
  );
  if (name === "betting" || name === "staged-poker") return g;
  if (name === "showdown-check") {
    for (let street = 0; street < 2; street++) {
      g = act(g, "b", { type: "check" });
      g = act(g, "w", { type: "check" });
    }
    return act(g, "b", { type: "check" });
  }
  if (name === "showdown") {
    for (let street = 0; street < 3; street++) {
      g = act(g, "w", { type: "check" });
      g = act(g, "b", { type: "check" });
    }
    return g;
  }
  g = act(g, "w", { type: "allin" });
  g = act(g, "b", { type: name === "fold" ? "fold" : "call" });
  if (name.startsWith("campaign-")) {
    const emperor = name.includes("emperor");
    const failed = name.includes("failed");
    g.journey = { opponent: emperor ? "emperor" : "roan", screen: "play" };
    g.banks = { w: 1000, b: emperor ? 2_100_000_000 : 1000 };
    g.committed = { ...g.banks };
    // QA-only terminal snapshot: settled outcome, never bundled in production.
    g.chessResult = { winner: failed ? "b" : "w", reason: "검증용 체크메이트" };
    g.result = { winner: failed ? "b" : "w", reason: "검증용 쇼다운" };
    g.settlement = settle(
      g.banks,
      g.committed,
      g.chessResult.winner,
      g.result.winner,
      "r4",
    );
    if (emperor && !failed) {
      g.banks = { w: 2_100_000_000, b: 1000 };
      g.committed = { w: 1000, b: 1000 };
      g.settlement = settle(g.banks, g.committed, "w", "w", "r4");
    }
  }
  return g;
}
