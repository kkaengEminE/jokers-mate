// Development-only browser QA. Imported only behind Vite's DEV guard.
import {
  newGame,
  applyMove,
  startBetting,
  chessOf,
  survivors,
  act,
  type Game,
} from "./engine";
export function fixture(name: string): Game {
  let g = newGame();
  for (const m of ["f3", "e5", "g4", "Qh4#"]) g = applyMove(g, m);
  if (name === "selection") return g;
  g = startBetting(
    g,
    survivors(chessOf(g), g.identities, "w").slice(0, 5),
    survivors(chessOf(g), g.identities, "b").slice(0, 5),
  );
  if (name === "betting") return g;
  g = act(g, "w", { type: "allin" });
  return act(g, "b", { type: name === "fold" ? "fold" : "call" });
}
