import type { Card } from "./poker";
import { label } from "./poker";

// Sprite viewports preserve the original raster and its alpha; card data is never baked in.
const CELLS = {
  q: [145, 0],
  k: [530, 0],
  b: [920, 0],
  p: [145, 580],
  n: [530, 580],
  r: [920, 580],
} as const;
export type ChessRole = keyof typeof CELLS;
export function Checard({
  role,
  card,
  hidden = false,
}: {
  role: ChessRole;
  card?: Card;
  hidden?: boolean;
}) {
  const [x, y] = CELLS[role];
  return (
    <span
      className={`checard ${hidden ? "checard-hidden" : ""} ${card && !hidden && (card.suit === "H" || card.suit === "D") ? "checard-red" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox={`${x} ${y} 300 580`} focusable="false">
        <image
          href={`${import.meta.env.BASE_URL}art/checards-v1.png`}
          width="1358"
          height="1158"
        />
      </svg>
      <span className="checard-value">
        {hidden ? "✦" : card ? (card.suit === "J" ? "JK" : label(card)) : ""}
      </span>
    </span>
  );
}
