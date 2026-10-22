import { useEffect, useRef, useState } from "react";
import type { Game, Side } from "./engine";
type Trip = { side: Side; amount: number; out: boolean };
export function GoldProcession({
  game,
  paused,
}: {
  game: Game;
  paused: boolean;
}) {
  const previous = useRef(game);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [event, setEvent] = useState(0);
  useEffect(() => {
    const old = previous.current;
    previous.current = game;
    if (paused) return;
    const next: Trip[] = [];
    for (const side of ["w", "b"] as const) {
      if (
        game.phase === "result" &&
        old.phase !== "result" &&
        game.settlement
      ) {
        const amount =
          game.settlement.final[side] - game.banks[side] + game.committed[side];
        if (amount > 0) next.push({ side, amount, out: true });
      } else if (
        game.id === old.id &&
        game.committed[side] > old.committed[side]
      ) {
        next.push({
          side,
          amount: game.committed[side] - old.committed[side],
          out: false,
        });
      }
    }
    if (next.length) {
      setTrips(next);
      setEvent((x) => x + 1);
    }
  }, [game, paused]);
  return (
    <div className="gold-route" aria-live="polite">
      {trips.map((trip) => (
        <div
          key={`${event}-${trip.side}`}
          className={`gold-trip ${trip.side} ${trip.out ? "out" : "in"}`}
          onAnimationEnd={() =>
            setTrips((old) => old.filter((t) => t.side !== trip.side))
          }
        >
          <span className="route-squire">
            <i>♙</i>
            <b>♣</b>
            <em>{game.betting?.folded ? "⚐" : "⚑"}</em>
          </span>
          <span className="route-cart">
            <i>● ● ●</i>
            <b>◉━━◉</b>
            <strong>{trip.amount} G</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
