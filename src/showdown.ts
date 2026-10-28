import type { Game, Side } from "./engine";

// Presentation only: the engine's saved settlement is never delayed or repeated.
export function showdownFrame(game: Game, step: number) {
  const active =
    game.phase === "result" &&
    !game.abandoned &&
    !!game.betting &&
    !game.betting.folded;
  const initial =
    game.betting?.street === undefined ? 0 : game.betting.street + 1;
  const order: { side: Side; index: number }[] = [];
  if (active) {
    for (let index = initial; index < 5; index++) {
      order.push({ side: "w", index }, { side: "b", index });
    }
  }
  const shown = Math.max(0, Math.min(order.length, step));
  return {
    active,
    counts: {
      w: initial + Math.ceil(shown / 2),
      b: initial + Math.floor(shown / 2),
    },
    latest: shown > 0 ? order[shown - 1] : null,
    // A separate beat after the last card lets players read both hands.
    complete: active && step > order.length,
    finalStep: order.length + 1,
    allShown: active && shown === order.length,
  };
}
