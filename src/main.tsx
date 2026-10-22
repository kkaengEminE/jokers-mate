import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Square } from "chess.js";
import {
  newGame,
  chessOf,
  applyMove,
  survivors,
  aiView,
  actions,
  act,
  chooseBet,
  startBetting,
  sideName,
  makeRecord,
  chooseMove,
  type Game,
  type RecordEntry,
  type Side,
  type Action,
} from "./engine";
import { label, SYMBOLS, evaluate, bestHandAsync, type Card } from "./poker";
import { restore } from "./persistence";
import "./style.css";
const fixtureName = import.meta.env.DEV
  ? new URLSearchParams(location.search).get("fixture")
  : null;
const fixtureGame = fixtureName
  ? (await import("./fixtures")).fixture(fixtureName)
  : null;
const STORAGE = fixtureName
    ? "jokers-gambit-qa-session-v2"
    : "jokers-gambit-session-v2",
  HISTORY = fixtureName
    ? "jokers-gambit-qa-records-v2"
    : "jokers-gambit-records-v2";
const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
function initial(): Game {
  if (fixtureGame) return fixtureGame;
  try {
    const raw = localStorage.getItem(STORAGE),
      saved = restore(raw);
    if (saved) return saved;
    if (raw) localStorage.setItem(STORAGE + "-recovery", raw);
  } catch {}
  return newGame();
}
function readRecords(): RecordEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((x) => x?.id && x?.final && x?.settlement).slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
function PlayingCard({
  card,
  hidden = false,
  selected = false,
  onClick,
  small = false,
}: {
  card?: Card;
  hidden?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
}) {
  const className = `playing-card ${hidden ? "back" : ""} ${card?.suit === "D" || card?.suit === "H" ? "red" : ""} ${selected ? "picked" : ""} ${small ? "small" : ""}`;
  const content = hidden ? (
    <>
      <span className="back-diamond">✦</span>
      <span className="back-line" />
    </>
  ) : card ? (
    <>
      <span className="card-corner">
        {card.suit === "J" ? "JK" : label(card).slice(0, -1)}
        <i>{SYMBOLS[card.suit]}</i>
      </span>
      <span className="card-symbol">{SYMBOLS[card.suit]}</span>
      <span className="card-bottom">
        {card.suit === "J" ? "WILD" : label(card)}
      </span>
      {selected && <span className="checkmark">✓</span>}
    </>
  ) : null;
  return onClick ? (
    <button
      className={className}
      aria-label={`${card ? label(card) : "비공개 카드"}${selected ? " 선택됨" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div
      className={className}
      aria-label={hidden ? "비공개 카드" : card ? label(card) : ""}
    >
      {content}
    </div>
  );
}
function App() {
  const [g, setG] = useState<Game>(initial),
    [records, setRecords] = useState<RecordEntry[]>(readRecords);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null),
    [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [modal, setModal] = useState<
      "help" | "settings" | "records" | "menu" | null
    >(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const [aiHand, setAiHand] = useState<Card[]>([]),
    [suggesting, setSuggesting] = useState(false),
    [raise, setRaise] = useState(60);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [hints, setHints] = useState(true),
    [motion, setMotion] = useState(
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const c = useMemo(() => chessOf(g), [g.moves]),
    own = useMemo(() => survivors(c, g.identities, "w"), [c, g.identities]),
    opponent = useMemo(
      () => survivors(c, g.identities, "b"),
      [c, g.identities],
    );
  const options = actions(g, "w"),
    legal = selectedSquare
      ? c.moves({ square: selectedSquare as Square, verbose: true })
      : [];
  const reviewingChess = g.phase === "selection" && !g.chessReviewed;
  const humanTurn = g.phase === "chess" && c.turn() === "w";
  const status = reviewingChess
    ? `체스 종료 · ${g.chessResult?.reason} · ${g.chessResult?.winner ? sideName(g.chessResult.winner) + " 승리" : "무승부"}`
    : g.phase === "chess"
      ? c.isCheck()
        ? "체크! 킹을 지켜주세요."
        : humanTurn
          ? "당신의 차례입니다."
          : "정원의 기사가 생각하고 있습니다…"
      : g.phase === "selection"
        ? "살아남은 카드에서 다섯 장을 고르세요."
        : g.phase === "betting"
          ? g.betting?.turn === "w"
            ? "당신의 선택을 기다립니다."
            : "정원의 기사가 판돈을 고민합니다…"
          : "한 판의 이야기가 끝났습니다.";
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(g));
    } catch {
      setError("자동 저장 공간이 부족합니다. 기록을 내보내 주세요.");
    }
  }, [g]);
  useEffect(() => {
    if (g.phase !== "result" || !g.settlement) return;
    setRecords((old) => {
      if (old.some((r) => r.id === g.id)) return old;
      const updated = [makeRecord(g), ...old].slice(0, 100);
      try {
        localStorage.setItem(HISTORY, JSON.stringify(updated));
      } catch {
        setError("기록 저장에 실패했습니다.");
      }
      return updated;
    });
  }, [g]);
  const suggestion = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      suggestion.current?.abort();
    },
    [g.id, g.phase],
  );
  useEffect(() => {
    if (g.phase !== "chess" || c.turn() !== "b" || modal) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    // All computation is already bundled with the game; no worker fetch or API.
    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        const next = applyMove(g, chooseMove(aiView(g)));
        if (!cancelled)
          setG((current) =>
            current.id === g.id && current.moves.length === g.moves.length
              ? next
              : current,
          );
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "컴퓨터 수 계산에 실패했습니다.",
          );
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setBusy(false);
    };
  }, [g.id, g.moves.length, g.phase, modal, retry]);
  useEffect(() => {
    if (g.phase !== "selection") {
      setAiHand([]);
      return;
    }
    setSelectedCards(own.length === 5 ? own.map((x) => x.id) : []);
    setBusy(true);
    const controller = new AbortController();
    bestHandAsync(opponent, controller.signal)
      .then((hand) => {
        if (!controller.signal.aborted) setAiHand(hand.cards);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "카드 계산 오류");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [g.id, g.phase, retry]);
  useEffect(() => {
    if (g.phase !== "betting" || g.betting?.turn !== "b" || modal) return;
    const timer = setTimeout(() => {
      try {
        const action = chooseBet({
          ownHand: g.hands.b,
          banks: g.banks,
          committed: g.committed,
          turn: "b",
          lastRaise: g.betting!.lastRaise,
          raiseLocked: g.betting!.raiseLocked,
        });
        setG((current) =>
          current === g ? act(current, "b", action) : current,
        );
      } catch (err) {
        setError(String(err));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [g, modal, retry]);
  useEffect(() => {
    if (!modal && !promotion) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,summary,[href],[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setPromotion(null);
      }
      if (e.key === "Tab") {
        const els = focusable(),
          first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", f);
    return () => {
      window.removeEventListener("keydown", f);
      previous?.focus();
    };
  }, [modal, promotion]);
  function move(from: string, to: string, promote?: string) {
    try {
      setG(applyMove(g, { from, to, promotion: promote }));
      setSelectedSquare(null);
      setPromotion(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "이동할 수 없습니다.");
    }
  }
  function clickSquare(square: string) {
    if (!humanTurn || modal) return;
    const targets = legal.filter((m) => m.to === square);
    if (targets.length) {
      if (targets.some((m) => m.promotion))
        setPromotion({ from: selectedSquare!, to: square });
      else move(selectedSquare!, square);
      return;
    }
    setSelectedSquare(c.get(square as Square)?.color === "w" ? square : null);
  }
  function bet(a: Action) {
    try {
      setG(act(g, "w", a));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "베팅 오류");
    }
  }
  function suggest() {
    suggestion.current?.abort();
    const controller = new AbortController();
    suggestion.current = controller;
    setSuggesting(true);
    bestHandAsync(own, controller.signal)
      .then((hand) => {
        if (!controller.signal.aborted)
          setSelectedCards(hand.cards.map((c) => c.id));
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "추천 오류");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSuggesting(false);
      });
  }
  const chosen = own.filter((x) => selectedCards.includes(x.id));
  const selectedName = useMemo(
    () => (chosen.length === 5 ? evaluate(chosen).name : ""),
    [selectedCards, g.identities],
  );
  const visibleOpponent = g.phase === "result" && !g.betting?.folded;
  const splitPots = g.economy === "split-15-5";
  const chessAward = (s: Side) =>
    !g.chessResult
      ? 0
      : g.chessResult.winner === s
        ? 30
        : g.chessResult.winner === null
          ? 15
          : 0;
  const total = g.committed.w + g.committed.b - (splitPots ? 30 : 0);
  const vault = (s: Side) =>
    g.settlement ? g.settlement.final[s] : g.banks[s] - g.committed[s];
  function next() {
    setG(newGame(g.settlement!.final, g.round + 1));
    setSelectedCards([]);
    setSelectedSquare(null);
    setError("");
  }
  function restart() {
    setG(newGame());
    setSelectedCards([]);
    setSelectedSquare(null);
    setModal(null);
    setError("");
  }
  function exportRecords() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(records, null, 2)], {
        type: "application/json",
      }),
    );
    a.href = url;
    a.download = "jokers-gambit-records.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className={`app ${motion ? "" : "no-motion"}`}>
      <header className="masthead">
        <a className="wordmark" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">♜</span>
          <span>
            JOKER’S GAMBIT<small>THE ROYAL GARDEN</small>
          </span>
        </a>
        <nav aria-label="메뉴">
          <button onClick={() => setModal("help")}>게임 규칙</button>
          <button onClick={() => setModal("records")}>
            기록 <span className="count">{records.length}</span>
          </button>
          <button onClick={() => setModal("settings")}>설정</button>
          <button
            className="menu-button"
            onClick={() => setModal("menu")}
            aria-label="게임 메뉴"
          >
            ☰
          </button>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              CHESS × POKER <span>EST. IN WONDERLAND</span>
            </div>
            <h1>
              한 수의 전략.
              <br className="mobile-break" /> 한 장의 반전.
            </h1>
            <p>왕을 지키고, 당신의 마지막 패를 준비하세요.</p>
          </div>
          <div className="round-marker">
            <span>MATCH</span>
            <strong>{String(g.round).padStart(2, "0")}</strong>
            <small>총 2,000 골드</small>
          </div>
        </section>
        <div className="game-layout">
          <section className="arena" aria-label="게임 테이블">
            <div className="phase-bar">
              <div
                className={
                  g.phase === "chess" || reviewingChess ? "current" : "complete"
                }
              >
                <span>01</span> 체스
              </div>
              <i />
              <div
                className={
                  (g.phase === "selection" && !reviewingChess) ||
                  g.phase === "betting"
                    ? "current"
                    : g.phase === "result"
                      ? "complete"
                      : ""
                }
              >
                <span>02</span> 포커
              </div>
              <i />
              <div className={g.phase === "result" ? "current" : ""}>
                <span>03</span> 정산
              </div>
            </div>
            <div className="table-area">
              <div className="player-row opponent-row">
                <div className="vault">
                  <span className="avatar opponent-avatar">♞</span>
                  <div>
                    <span className="player-name">
                      정원의 기사 <small>컴퓨터 · 초급</small>
                    </span>
                    <strong>
                      {vault("b").toLocaleString()} <small>G</small>
                    </strong>
                    {!splitPots && g.chessResult?.winner === "b" && (
                      <span className="protection">♜ 최종 20 G 보호</span>
                    )}
                  </div>
                </div>
                <div className="captures">
                  <span>
                    기사가 잡은 카드 <b>{g.captured.b.length}</b>
                  </span>
                  <div>
                    {g.captured.b.length ? (
                      g.captured.b.map((x) => (
                        <span
                          key={x.id}
                          className={
                            x.suit === "H" || x.suit === "D" ? "red" : ""
                          }
                        >
                          {label(x)}
                        </span>
                      ))
                    ) : (
                      <small>아직 비어 있습니다</small>
                    )}
                  </div>
                </div>
              </div>
              {g.phase === "chess" || reviewingChess ? (
                <div className="board-shell">
                  <div
                    className="board"
                    role="group"
                    aria-label="체스판 · 플레이어 백색"
                  >
                    <div className="board-ornament top">✦</div>
                    {c.board().flatMap((row, ri) =>
                      row.map((piece, fi) => {
                        const square = `${"abcdefgh"[fi]}${8 - ri}`,
                          card = g.identities[square],
                          target = legal.some((m) => m.to === square),
                          last = c.history({ verbose: true }).at(-1);
                        return (
                          <button
                            key={square}
                            className={`square ${(ri + fi) % 2 === 0 ? "light" : "dark"} ${selectedSquare === square ? "selected" : ""} ${last?.from === square || last?.to === square ? "last-move" : ""} ${piece?.type === "k" && piece.color === c.turn() && c.isCheck() ? "in-check" : ""}`}
                            onClick={() => clickSquare(square)}
                            aria-label={`${square} ${piece ? `${piece.color === "w" ? "내" : "상대"} ${piece.type}` : "빈칸"}${piece?.color === "w" && card ? " " + label(card) : ""}`}
                            aria-pressed={selectedSquare === square}
                            disabled={!humanTurn}
                          >
                            {fi === 0 && (
                              <span className="rank-label">{8 - ri}</span>
                            )}
                            {ri === 7 && (
                              <span className="file-label">
                                {"abcdefgh"[fi]}
                              </span>
                            )}
                            {piece && (
                              <>
                                <span
                                  className={`piece ${piece.color === "w" ? "ivory" : "onyx"}`}
                                >
                                  {PIECES[piece.color][piece.type]}
                                </span>
                                <span
                                  className={`identity ${piece.color === "b" ? "concealed" : card?.suit === "D" || card?.suit === "H" ? "red" : ""}`}
                                >
                                  {piece.color === "w" && card
                                    ? label(card)
                                    : "◆"}
                                </span>
                              </>
                            )}
                            {target && hints && (
                              <span
                                className={`move-hint ${piece ? "capture-hint" : ""}`}
                              />
                            )}
                          </button>
                        );
                      }),
                    )}
                  </div>
                  <div className="board-caption">
                    <span>♔ WHITE · YOU</span>
                    <span>카드 정체성은 승격해도 유지됩니다</span>
                  </div>
                </div>
              ) : (
                <div className="poker-table">
                  <span className="table-flourish">❧</span>
                  <div className="table-attendant" aria-hidden="true">
                    ♟<span>{g.betting?.folded ? "⚐" : "⚑"}</span>
                  </div>
                  {(g.betting?.log.length ?? 0) > 0 && (
                    <div
                      key={g.betting!.log.length}
                      className={`gold-carriage ${g.phase === "result" ? "returning" : ""}`}
                      aria-hidden="true"
                    >
                      <span>✦</span>
                      <i>▰</i>
                      <b>◉ ◉</b>
                    </div>
                  )}
                  <div className="opponent-hand">
                    {Array.from({ length: 5 }, (_, i) => (
                      <PlayingCard
                        key={i}
                        hidden={!visibleOpponent}
                        card={visibleOpponent ? g.hands.b[i] : undefined}
                      />
                    ))}
                  </div>
                  {visibleOpponent && (
                    <div className="hand-name">{evaluate(g.hands.b).name}</div>
                  )}
                  <div className="central-pot" key={`${g.id}-${total}`}>
                    <span className="pot-label">
                      {g.phase === "result" ? "이번 판 내 순손익" : "THE POT"}
                    </span>
                    <strong>
                      {g.phase === "result"
                        ? `${g.settlement!.final.w - g.banks.w >= 0 ? "+" : ""}${g.settlement!.final.w - g.banks.w}`
                        : total.toLocaleString()}{" "}
                      <small>G</small>
                    </strong>
                    <span>
                      {g.phase === "selection"
                        ? splitPots
                          ? "포커 참가금 5 G × 2 · 체스 팟 30 G 별도"
                          : "참가금 20 G × 2"
                        : g.phase === "result"
                          ? `정산 완료 · 잔액 ${g.settlement!.final.w.toLocaleString()} G`
                          : "♜ 유효 판돈은 최종 정산에서 확정"}
                    </span>
                  </div>
                  {g.phase === "selection" ? (
                    <div className="selection-instruction">
                      <strong>당신의 마지막 다섯 장</strong>
                      <span>아래 생존 카드에서 선택하세요</span>
                    </div>
                  ) : (
                    <>
                      <div className="own-hand">
                        {g.hands.w.map((card) => (
                          <PlayingCard key={card.id} card={card} />
                        ))}
                      </div>
                      <div className="hand-name">
                        {evaluate(g.hands.w).name}
                        {g.hands.w.some((x) => x.suit === "J") && (
                          <small className="joker-resolution">
                            최적 패{" "}
                            {evaluate(g.hands.w).resolved.map(label).join(" ")}
                          </small>
                        )}
                      </div>
                    </>
                  )}
                  {g.betting?.folded && (
                    <div className="fold-banner">
                      ⚑ {sideName(g.betting.folded)} 폴드 · 상대 패 비공개
                    </div>
                  )}
                </div>
              )}
              <div className="player-row self-row">
                <div className="captures">
                  <span>
                    내가 잡은 카드 <b>{g.captured.w.length}</b>
                  </span>
                  <div>
                    {g.captured.w.length ? (
                      g.captured.w.map((x) => (
                        <span
                          key={x.id}
                          className={
                            x.suit === "H" || x.suit === "D" ? "red" : ""
                          }
                        >
                          {label(x)}
                        </span>
                      ))
                    ) : (
                      <small>첫 번째 기회를 기다리는 중</small>
                    )}
                  </div>
                </div>
                <div className="vault">
                  <div>
                    <span className="player-name">
                      당신 <small>PLAYER</small>
                    </span>
                    <strong>
                      {vault("w").toLocaleString()} <small>G</small>
                    </strong>
                    {!splitPots && g.chessResult?.winner === "w" && (
                      <span className="protection">♜ 최종 20 G 보호</span>
                    )}
                  </div>
                  <span className="avatar">♔</span>
                </div>
              </div>
            </div>
            <div className="status-bar" role="status">
              <span className={`status-dot ${busy ? "thinking" : ""}`} />
              {status}
              <small>
                {g.phase === "chess"
                  ? `${Math.floor(g.moves.length / 2) + 1}번째 수`
                  : `${own.length}장 생존`}
              </small>
            </div>
          </section>
          <aside className="sidebar">
            <section className="panel overview">
              <div className="panel-eyebrow">THE GAMBIT</div>
              <h2>
                {reviewingChess
                  ? "체스 결과를 확인하세요."
                  : g.phase === "chess"
                    ? "살아남는 카드가,\n승부를 바꿉니다."
                    : g.phase === "selection"
                      ? "선택의 시간."
                      : g.phase === "betting"
                        ? "당신의 패를 믿나요?"
                        : "승부의 기록."}
              </h2>
              <p>
                {reviewingChess
                  ? "체스의 마지막 상황입니다. 결과를 확인한 다음 포커로 이어집니다."
                  : g.phase === "chess"
                    ? "기물을 선택하면 가능한 이동을 볼 수 있어요. 상대의 카드는 잡는 순간 공개됩니다."
                    : g.phase === "selection"
                      ? "킹이나 퀸을 반드시 선택할 필요는 없습니다. 조커는 가장 강한 합법 패로 바뀝니다."
                      : g.phase === "betting"
                        ? "금고에 남긴 골드는 안전합니다. 올인은 모든 남은 골드를 거는 선택입니다."
                        : "체스의 전략과 포커의 운명이 하나의 결과로 남았습니다."}
              </p>
              <div className="mini-stats">
                <div>
                  <small>내 생존 기물</small>
                  <strong>
                    {own.length}
                    <span> / 16</span>
                  </strong>
                </div>
                <div>
                  <small>상대 생존 기물</small>
                  <strong>
                    {opponent.length}
                    <span> / 16</span>
                  </strong>
                </div>
              </div>
              <div className="rule-note">
                <span>♜</span>
                <p>
                  {g.chessResult
                    ? `${g.chessResult.reason} · ${g.chessResult.winner ? sideName(g.chessResult.winner) + " 승리" : "승자 없음"}`
                    : "어느 쪽이든 5기물이 남으면 체스가 종료됩니다."}
                  <small>
                    {splitPots
                      ? `체스 팟 30 G · 내 확정 배당 ${chessAward("w")} G (포커 종료 후 지급). 최종 20 G 보장은 없습니다.`
                      : "기존 판 규칙: 체스 승자는 최종 잔액 20 G를 보호받습니다."}
                  </small>
                </p>
              </div>
            </section>
            {reviewingChess && (
              <section className="panel result-panel" aria-live="polite">
                <div className="panel-eyebrow">CHESS RESULT</div>
                <h2>
                  {g.chessResult?.winner
                    ? sideName(g.chessResult.winner) + " 체스 승리"
                    : "체스 무승부"}
                </h2>
                <p>
                  {g.chessResult?.reason} · 마지막 수 {g.moves.at(-1)}
                </p>
                <p>
                  마지막 체스판을 확인하세요. 이번 판은 아직 끝나지 않았습니다.
                  생존 카드로 포커를 한 번 진행한 뒤 골드를 정산합니다.
                </p>
                <button
                  className="primary full"
                  onClick={() => setG({ ...g, chessReviewed: true })}
                >
                  결과 확인 · 포커로 넘어가기 →
                </button>
              </section>
            )}
            {(g.phase === "chess" || reviewingChess) && (
              <section className="panel move-panel">
                <div className="panel-title">
                  <h3>수순 기록</h3>
                  <span>{reviewingChess ? "FINAL" : "LIVE"}</span>
                </div>
                <div className="move-table">
                  <div className="move-table-head">
                    <span>#</span>
                    <span>당신 · 백</span>
                    <span>기사 · 흑</span>
                  </div>
                  {g.moves.length ? (
                    Array.from(
                      { length: Math.ceil(g.moves.length / 2) },
                      (_, i) => (
                        <div key={i} className="move-line">
                          <span>{i + 1}</span>
                          <b>{g.moves[i * 2]}</b>
                          <b>{g.moves[i * 2 + 1] ?? "…"}</b>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="empty-moves">
                      아직 쓰이지 않은 이야기.
                      <br />
                      <small>첫 수를 두어 정원을 깨워주세요.</small>
                    </div>
                  )}
                </div>
              </section>
            )}
            {g.phase === "selection" && !reviewingChess && (
              <section className="panel selection-panel">
                <div className="panel-title">
                  <h3>내 생존 카드</h3>
                  <span>{selectedCards.length} / 5</span>
                </div>
                <div className="card-picker">
                  {own.map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      selected={selectedCards.includes(card.id)}
                      small
                      onClick={() =>
                        setSelectedCards((old) =>
                          old.includes(card.id)
                            ? old.filter((x) => x !== card.id)
                            : old.length < 5
                              ? [...old, card.id]
                              : old,
                        )
                      }
                    />
                  ))}
                </div>
                <p className="selection-name">
                  {selectedName || "다섯 장을 선택하면 족보가 표시됩니다."}
                </p>
                <button
                  className="text-button"
                  disabled={suggesting}
                  onClick={suggest}
                >
                  {suggesting ? "조합을 살펴보는 중…" : "✦ 가장 강한 패 추천"}
                </button>
                <button
                  className="primary full"
                  disabled={selectedCards.length !== 5 || aiHand.length !== 5}
                  onClick={() => {
                    try {
                      setG(startBetting(g, chosen, aiHand));
                      setError("");
                    } catch (err) {
                      setError(String(err));
                    }
                  }}
                >
                  {aiHand.length !== 5
                    ? "상대가 카드를 고르는 중…"
                    : "이 패로 베팅 시작 →"}
                </button>
              </section>
            )}
            {g.phase === "betting" && (
              <section className="panel betting-panel">
                <div className="panel-title">
                  <h3>베팅 라운드</h3>
                  <span>1 / 1</span>
                </div>
                <div className="bet-summary">
                  <span>
                    포커 투입 <b>{g.committed.w - (splitPots ? 15 : 0)} G</b>
                  </span>
                  <span>
                    상대 포커 투입{" "}
                    <b>{g.committed.b - (splitPots ? 15 : 0)} G</b>
                  </span>
                  <span>
                    콜 필요 <b>{Math.min(options.owed, options.left)} G</b>
                  </span>
                </div>
                <div className="action-grid">
                  <button
                    disabled={!options.check && !options.call}
                    className="primary"
                    onClick={() =>
                      bet({ type: options.call ? "call" : "check" })
                    }
                  >
                    {options.call
                      ? `콜 ${Math.min(options.owed, options.left)} G`
                      : "체크"}
                  </button>
                  <button
                    disabled={!options.active}
                    onClick={() => bet({ type: "fold" })}
                  >
                    ⚑ 폴드
                  </button>
                </div>
                <label className="raise-label">
                  포커 총 투입액으로 베트 / 레이즈
                  <input
                    type="number"
                    min={options.minTotal - (splitPots ? 15 : 0)}
                    max={options.maxTotal - (splitPots ? 15 : 0)}
                    step="1"
                    value={
                      Math.max(raise, options.minTotal) - (splitPots ? 15 : 0)
                    }
                    onChange={(e) =>
                      setRaise(Number(e.target.value) + (splitPots ? 15 : 0))
                    }
                    disabled={!options.raise}
                  />
                </label>
                <div className="action-grid">
                  <button
                    disabled={
                      !options.raise ||
                      Math.max(raise, options.minTotal) > options.maxTotal
                    }
                    onClick={() =>
                      bet({
                        type: "raise",
                        amount: Math.max(raise, options.minTotal),
                      })
                    }
                  >
                    베트 / 레이즈
                  </button>
                  <button
                    className="all-in"
                    disabled={!options.allin}
                    onClick={() => bet({ type: "allin" })}
                  >
                    올인 {options.left} G
                  </button>
                </div>
                <p className="fine-print">
                  최소 인상폭 {g.betting!.lastRaise} G · 미대응 초과액은
                  반환됩니다.
                </p>
                <div className="bet-log" aria-live="polite">
                  {g.betting!.log.map((x, i) => (
                    <div key={i}>{x}</div>
                  ))}
                </div>
              </section>
            )}
            {g.phase === "result" && g.settlement && (
              <section className="panel result-panel">
                <div className="result-icon">
                  {g.result?.winner === "w"
                    ? "♛"
                    : g.result?.winner === "b"
                      ? "♞"
                      : "⚖"}
                </div>
                <h2>
                  {g.result?.winner === "w"
                    ? "포커 · 당신의 승리"
                    : g.result?.winner === "b"
                      ? "포커 · 기사의 승리"
                      : "무승부"}
                </h2>
                <p>
                  {g.result?.reason} ·{" "}
                  {g.settlement.final.w - g.banks.w >= 0 ? "+" : ""}
                  {g.settlement.final.w - g.banks.w} G
                </p>
                <p>
                  체스와 포커가 모두 끝났습니다. 다음 판은 새 체스판과 새 카드로
                  시작하며 참가금 20 G를 다시 냅니다.
                </p>
                {splitPots && (
                  <p>
                    체스 순손익{" "}
                    {g.settlement.chessAward!.w - 15 >= 0 ? "+" : ""}
                    {g.settlement.chessAward!.w - 15} G · 포커 순손익{" "}
                    {g.settlement.award.w -
                      (g.committed.w - 15 - g.settlement.returned.w) >=
                    0
                      ? "+"
                      : ""}
                    {g.settlement.award.w -
                      (g.committed.w - 15 - g.settlement.returned.w)}{" "}
                    G
                  </p>
                )}
                <dl>
                  <div>
                    <dt>내 시작 잔액</dt>
                    <dd>{g.banks.w} G</dd>
                  </div>
                  <div>
                    <dt>내 총 투입액 (참가금 포함)</dt>
                    <dd>{g.committed.w} G</dd>
                  </div>
                  <div>
                    <dt>
                      {splitPots ? "내 포커 배당" : "내 팟 배당 (보호 조정 전)"}
                    </dt>
                    <dd>{g.settlement.award.w} G</dd>
                  </div>
                  <div>
                    <dt>내 순손익</dt>
                    <dd>
                      {g.settlement.final.w - g.banks.w >= 0 ? "+" : ""}
                      {g.settlement.final.w - g.banks.w} G
                    </dd>
                  </div>
                  <div>
                    <dt>포커 경합 팟</dt>
                    <dd>{g.settlement.pot} G</dd>
                  </div>
                  <div>
                    <dt>내 초과액 반환</dt>
                    <dd>{g.settlement.returned.w} G</dd>
                  </div>
                  <div>
                    <dt>{splitPots ? "체스 배당" : "20 G 보호 조정"}</dt>
                    <dd>
                      {splitPots
                        ? g.settlement.chessAward!.w
                        : g.settlement.protection}{" "}
                      G
                    </dd>
                  </div>
                  <div>
                    <dt>내 최종 잔액</dt>
                    <dd>{g.settlement.final.w} G</dd>
                  </div>
                </dl>
                {Math.min(g.settlement.final.w, g.settlement.final.b) < 20 ? (
                  <>
                    <p className="end-message">
                      {g.settlement.final.w < 20
                        ? "참가금이 부족해 전체 게임이 종료되었습니다."
                        : "상대가 다음 판에 참가할 수 없습니다. 전체 게임 승리!"}
                    </p>
                    <button className="primary full" onClick={restart}>
                      새 게임 시작
                    </button>
                  </>
                ) : (
                  <button className="primary full" onClick={next}>
                    다음 판 · 체스부터 시작 →
                  </button>
                )}
                {g.achievements.length > 0 && (
                  <div className="achievement-list">
                    {g.achievements.map((x) => (
                      <span key={x}>✦ {x}</span>
                    ))}
                  </div>
                )}
              </section>
            )}
            <div className="garden-quote">
              <span>❦</span>
              <p>
                “모든 왕관 뒤에는,
                <br />
                아직 펼치지 않은 카드가 있다.”
              </p>
              <small>— THE ROYAL GARDEN —</small>
            </div>
          </aside>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button
              onClick={() => {
                setError("");
                setRetry((x) => x + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        )}
        <footer>
          <span>♠ ♦ ♥ ♣</span>
          <p>
            JOKER’S GAMBIT <i>·</i> 가상 골드만 사용하는 전략 게임
          </p>
          <small>PROTOTYPE · 0.2</small>
        </footer>
      </main>
      {promotion && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="승격 선택"
            className="modal"
          >
            <h2>새로운 왕관을 선택하세요</h2>
            <p>체스 역할이 바뀌어도 카드 정체성은 유지됩니다.</p>
            <div className="promotion-options">
              {(["q", "r", "b", "n"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => move(promotion.from, promotion.to, p)}
                  aria-label={{ q: "퀸", r: "룩", b: "비숍", n: "나이트" }[p]}
                >
                  {PIECES.w[p]}
                </button>
              ))}
            </div>
            <button onClick={() => setPromotion(null)}>취소</button>
          </section>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className={`modal ${modal === "records" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                help: "게임 규칙",
                settings: "설정",
                records: "기록",
                menu: "메뉴",
              }[modal]
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="닫기"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === "help" && (
              <>
                <div className="panel-eyebrow">HOW TO PLAY</div>
                <h2>정원의 규칙</h2>
                <ol className="rules">
                  <li>
                    <b>입장</b>각 1,000 G로 시작합니다. 새 판마다 체스 15 G +
                    포커 5 G를 미리 냅니다. 체스 팟 30 G는 승자에게, 무승부이면
                    15 G씩 반환합니다. 체스 배당은 이번 포커에 재사용할 수
                    없습니다.
                  </li>
                  <li>
                    <b>체스</b>일반 체스처럼 움직입니다. 내 기물의 카드가
                    표시되며, 상대 카드는 캡처 시 공개됩니다.
                  </li>
                  <li>
                    <b>다섯 기물</b>어느 쪽이든 5기물이 되면 종료. 그 수가
                    체크면 공격자 승리, 아니면 무승부입니다. 체크메이트가
                    우선합니다.
                  </li>
                  <li>
                    <b>포커</b>생존 카드에서 5장을 선택합니다. 족보 → 랭크 → ♠ ♦
                    ♥ ♣ 순으로 비교합니다. 조커는 패 내부의 동일 카드를 중복하지
                    않고 최선의 패가 됩니다. A2345는 5-high, 파이브카인드는
                    없습니다.
                  </li>
                  <li>
                    <b>베팅</b>한 라운드. 최소 베트·인상폭 20 G, 이후 마지막
                    정규 인상폭 이상. 짧은 올인은 이미 행동한 상대의 레이즈를
                    다시 열지 않습니다. 홀수 판은 당신이, 짝수 판은 기사가 먼저
                    베팅합니다.
                  </li>
                  <li>
                    <b>최종 정산</b>미대응 초과액을 반환하고 유효 팟을
                    분배합니다. 새 판은 최종 20 G 보장이 없습니다. 포커 체크도 5
                    G 참가금은 걸려 있으며 폴드하면 잃습니다. 동률은 반씩
                    분배합니다. 기존 저장 판은 기존 20 G 참가금·보호 규칙으로
                    마칩니다.
                  </li>
                  <li>
                    <b>다음 판</b>최종 잔액이 20 G 미만이면 전체 패배입니다.
                    체스는 플레이어 백색으로 새로 시작하고 카드를 다시
                    배정합니다.
                  </li>
                </ol>
                <p className="fine-print">
                  프로토타입 정책: 3회 반복·50수는 자동 무승부. 폴드 패와 미선택
                  패는 기록에 공개하지 않습니다. 내장 컴퓨터는 자기 카드와 공개
                  체스판만 봅니다. 외부 AI 서비스나 API 키는 필요 없습니다. 진행
                  상태는 이 브라우저에 자동 저장됩니다.
                </p>
              </>
            )}
            {modal === "settings" && (
              <>
                <div className="panel-eyebrow">YOUR GARDEN</div>
                <h2>플레이 설정</h2>
                <label className="toggle">
                  <span>가능한 이동 표시</span>
                  <input
                    type="checkbox"
                    checked={hints}
                    onChange={(e) => setHints(e.target.checked)}
                  />
                </label>
                <label className="toggle">
                  <span>움직임 효과</span>
                  <input
                    type="checkbox"
                    checked={motion}
                    onChange={(e) => setMotion(e.target.checked)}
                  />
                </label>
                <p>내장 컴퓨터 · 난도 3/10 · 기초 전술을 아는 초보 기사</p>
                <p className="fine-print">
                  가상 골드만 사용합니다. 설정은 현재 화면에 적용되며 게임
                  진행과 완료 기록은 자동 저장됩니다.
                </p>
              </>
            )}
            {modal === "menu" && (
              <>
                <div className="panel-eyebrow">JOKER’S GAMBIT</div>
                <h2>잠시 정원을 거닐까요?</h2>
                <p>진행 상황이 이 브라우저에 저장됩니다.</p>
                <div className="menu-actions">
                  <button className="primary" onClick={() => setModal(null)}>
                    Play · 계속하기
                  </button>
                  <button onClick={() => setModal("help")}>
                    Help · 게임 규칙
                  </button>
                  <button onClick={() => setModal("records")}>
                    Records · 기록
                  </button>
                  <button onClick={() => setModal("settings")}>
                    Settings · 설정
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "현재 판을 종료하고 1,000골드로 새로 시작할까요? 완료 기록은 유지됩니다.",
                        )
                      )
                        restart();
                    }}
                  >
                    새 전체 게임
                  </button>
                  <button onClick={() => setModal("menu")}>
                    Exit · 저장된 상태로 일시정지
                  </button>
                </div>
                <small>
                  나가려면 이 탭을 닫으세요. 브라우저 탭을 강제로 닫지 않습니다.
                </small>
              </>
            )}
            {modal === "records" && (
              <>
                <div className="panel-eyebrow">THE CHRONICLE</div>
                <h2>정원의 기록</h2>
                <button disabled={!records.length} onClick={exportRecords}>
                  JSON으로 내보내기
                </button>
                <p className="fine-print">
                  최근 100판 · 폴드 패는 저장하지 않습니다.
                </p>
                {records.length ? (
                  records.map((r) => (
                    <details className="record" key={r.id}>
                      <summary>
                        {new Date(r.date).toLocaleDateString("ko-KR")} ·{" "}
                        {r.round}번째 판 <strong>{r.final.w} G</strong>
                      </summary>
                      <p>
                        체스: {r.chess}
                        <br />
                        포커: {r.poker}
                      </p>
                      <p>
                        {r.hands.w.length
                          ? `내 패: ${r.hands.w.map(label).join(" ")} / 상대: ${r.hands.b.map(label).join(" ")}`
                          : "폴드 · 패 비공개"}
                      </p>
                      <code>{r.pgn}</code>
                      <p>{r.achievements.join(" · ")}</p>
                    </details>
                  ))
                ) : (
                  <p className="empty-records">
                    첫 번째 이야기를 기다리고 있습니다.
                    <br />한 판을 마치면 결과와 수순이 여기에 남습니다.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
