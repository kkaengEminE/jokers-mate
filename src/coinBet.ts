import { actions, type Action, type Game, type Side } from "./engine";

// A tray is presentation state only. The engine still owns legality and payment.
export type CoinDraft = number | "allin";

export function coinQuote(game: Game, draft: CoinDraft, side: Side = "w") {
  const allowed = actions(game, side);
  const high = Math.max(game.committed.w, game.committed.b);
  const minimum = allowed.minTotal - high;
  const capacity = Math.max(0, allowed.left - allowed.owed);
  const increase = draft === "allin" ? capacity : draft;
  const payment = draft === "allin" ? allowed.left : allowed.owed + increase;
  const allin = draft === "allin" || (increase > 0 && payment === allowed.left);
  let action: Action | null = null;
  if (allin && allowed.allin && (draft === "allin" || Number.isSafeInteger(increase))) {
    action = { type: "allin" };
  } else if (
    !allin && allowed.raise && Number.isSafeInteger(increase) &&
    increase >= minimum && payment < allowed.left
  ) {
    action = { type: "raise", amount: high + increase };
  }
  const reason = !allowed.active ? "상대 차례"
    : !allowed.raise && !allowed.allin ? "지금은 체크 / 콜 또는 폴드만 가능"
    : payment > allowed.left ? "금고에 남은 금액을 넘었어요"
    : !action && increase > 0 && increase < minimum ? `${minimum - increase}G 더 필요`
    : !action && capacity < minimum ? "남은 금화로 올인할 수 있어요"
    : !action ? `금화를 골라보세요 · 최소 인상 ${minimum}G`
    : allin ? "남은 금화 전부를 겁니다"
    : allowed.owed ? `콜 ${allowed.owed.toLocaleString()} + 더 올림 ${increase.toLocaleString()}G`
    : `더 올림 ${increase.toLocaleString()}G`;
  return {
    allowed, minimum, capacity, increase, payment, allin, action, reason,
    remaining: Math.max(0, allowed.left - payment),
    callPayment: Math.min(allowed.owed, allowed.left),
  };
}

export function quickRaise(game: Game, pot: number, fraction: 0.5 | 1) {
  const { allowed, capacity, minimum } = coinQuote(game, 0);
  return allowed.raise && capacity >= minimum
    ? Math.min(capacity, Math.max(minimum, Math.ceil(pot * fraction)))
    : null;
}
