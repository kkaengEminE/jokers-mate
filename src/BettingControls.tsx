import { useEffect, useRef, useState } from "react";
import { coinQuote, quickRaise, type CoinDraft } from "./coinBet";
import type { Action, Game } from "./engine";

export function BettingControls({ game, pot, paused, onAction, onHistory }: {
  game: Game; pot: number; paused: boolean;
  onAction: (action: Action) => boolean; onHistory: () => void;
}) {
  const [tray, setTray] = useState<CoinDraft[]>([0]);
  const adjustment = useRef<HTMLDialogElement>(null);
  const submitted = useRef(false);
  const quote = coinQuote(game, tray.at(-1)!);
  const { allowed, increase, payment, action, allin } = quote;
  const active = allowed.active && !paused && !submitted.current;
  useEffect(() => {
    if (paused) {
      setTray([0]);
      adjustment.current?.close();
    }
  }, [paused]);
  function prepare(value: CoinDraft) {
    if (!active) return;
    if (value === "allin" ? !allowed.allin : !allowed.raise || value < 0 || value > quote.capacity) return;
    setTray(old => [...old, value]);
  }
  function commit(value: Action | null) {
    if (!active || !value || submitted.current) return;
    submitted.current = true;
    if (!onAction(value)) submitted.current = false;
  }
  const amount = (value: number) => value.toLocaleString();
  return <section className="coin-dock" aria-label="금화 베팅">
    <div className="coin-dock-heading">
      <strong>{allowed.active ? "내 차례" : "상대가 생각하는 중…"}</strong>
      <button onClick={onHistory} aria-label="베팅 기록 보기">기록</button>
    </div>
    <div className="coin-tray" aria-live="polite" aria-atomic="true">
      <div><span className="tray-coins" aria-hidden="true">{increase > 0 || tray.at(-1) === "allin" ? "◉ ◉ ◉" : "· · ·"}</span><span>{increase > 0 || tray.at(-1) === "allin" ? "이번 지불" : "준비 받침"}</span><strong>{amount(increase > 0 || tray.at(-1) === "allin" ? payment : 0)} <small>G</small></strong></div>
      <span className={`tray-note ${increase > 0 && !action ? "needs-coins" : ""}`}>{quote.reason}</span>
      {action && <span className="tray-balance">확정 후 {amount(quote.remaining)}G</span>}
    </div>
    <div className="gold-denominations" aria-label="더 올릴 금화">
      {[10, 20, 50, 100].map(value => <button key={value} className={`gold-coin coin-${value}`} aria-label={`${value}금화 추가`}
        disabled={!active || !allowed.raise || increase + value > quote.capacity}
        onClick={() => prepare(increase + value)}><span>+{value}</span><small>금화</small></button>)}
    </div>
    <div className="tray-tools">
      <button disabled={!active || !allowed.raise || quote.minimum > quote.capacity} onClick={() => prepare(quote.minimum)}>최소</button>
      <button aria-label="준비한 금화 되돌리기" disabled={!active || tray.length < 2} onClick={() => setTray(old => old.slice(0, -1))}>↶ 취소</button>
      <button disabled={!active || tray.at(-1) === 0} onClick={() => setTray(old => [...old, 0])}>비우기</button>
      <button disabled={!active || !allowed.allin} onClick={() => prepare("allin")}>전부</button>
      <button aria-label="금액 세부 조절" disabled={!active || !allowed.raise} onClick={() => adjustment.current?.showModal()}>조절</button>
    </div>
    <div className="bet-actions">
      <button className="fold-action" disabled={!active} onClick={() => commit({ type: "fold" })}>폴드</button>
      <button className={!action ? "primary" : ""} disabled={!active || (!allowed.check && !allowed.call)}
        onClick={() => commit({ type: allowed.call ? "call" : "check" })}>
        {allowed.call ? <><strong>{amount(quote.callPayment)}G</strong><span>콜{quote.callPayment === allowed.left ? " · 올인" : ""}</span></> : "체크"}
      </button>
      <button className={action ? "primary commit-bet" : "commit-bet"} disabled={!active || !action} onClick={() => commit(action)}>
        {increase > 0 || tray.at(-1) === "allin" ? <><strong>{amount(payment)}G</strong><span>{allin ? "올인" : allowed.owed ? "내고 레이즈" : "베팅"}</span></> : "베팅"}
      </button>
    </div>
    <dialog ref={adjustment} className="result-dialog coin-adjustment" aria-label="금액 세부 조절">
      <h2>금화 조절</h2>
      <p>더 올림 <strong>{amount(increase)}G</strong> · 콜 {amount(quote.callPayment)}G</p>
      <div className="fine-coins">{[-10, -1, 1, 10].map(value => <button key={value}
        disabled={!active || !allowed.raise || increase + value < 0 || increase + value > quote.capacity}
        onClick={() => prepare(increase + value)}>{value > 0 ? "+" : ""}{value}G</button>)}</div>
      <div className="fine-coins">{([0.5, 1] as const).map(fraction => <button key={fraction}
        disabled={!active || quickRaise(game, pot, fraction) === null}
        onClick={() => { const value = quickRaise(game, pot, fraction); if (value !== null) prepare(value); }}>{fraction === 0.5 ? "반 팟" : "팟만큼"}</button>)}</div>
      <p>{quote.reason}</p>
      <button className="primary full" onClick={() => adjustment.current?.close()}>준비 완료 · 돌아가기</button>
    </dialog>
  </section>;
}
