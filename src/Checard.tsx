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
  side,
}: {
  role: ChessRole;
  card?: Card;
  hidden?: boolean;
  side?: "w" | "b";
}) {
  const [x, y] = CELLS[role];
  return (
    <span
      className={`checard ${side ? `checard-board checard-side-${side}` : ""} ${hidden ? "checard-hidden" : ""} ${card && !hidden && (card.suit === "H" || card.suit === "D") ? "checard-red" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox={side ? `${x - 45} ${y - 50} 390 630` : `${x} ${y} 300 580`} focusable="false">
        {side ? <>
          <svg x={x} y={y + 165} style={{ width: 300, height: 415 }} viewBox={`${x} ${y + 165} 300 415`}>
            <image href={`${import.meta.env.BASE_URL}art/checards-v1.png`} width="1358" height="1158" />
          </svg>
          <svg className="checard-hat" x={x - 45} y={y - 50} style={{ width: 390, height: 215 }} viewBox={`${x} ${y} 300 165`}>
            <image href={`${import.meta.env.BASE_URL}art/checards-v1.png`} width="1358" height="1158" />
          </svg>
        </> : <image href={`${import.meta.env.BASE_URL}art/checards-v1.png`} width="1358" height="1158" />}
      </svg>
      <span className="checard-value">
        {hidden ? "✦" : card ? (card.suit === "J" ? "JK" : label(card)) : ""}
      </span>
    </span>
  );
}
