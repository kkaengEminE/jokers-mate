import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import type { Square } from "chess.js";
import {
  entryFee,
  chessPool,
  CURRENT_ENTRY,
  enterGame,
  chessOf,
  applyMove,
  survivors,
  aiView,
  act,
  chooseBet,
  exposedHand,
  shuffle,
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
import {
  newCampaign,
  nextRound,
  finishEnding,
  campaignOutcome,
} from "./campaign";
import { restore } from "./persistence";
import "./style.css";
import "./play.css";
import { BettingControls } from "./BettingControls";
import { Checard, type ChessRole } from "./Checard";
import { GoldProcession } from "./GoldProcession";
import { showdownFrame } from "./showdown";
import { ShowdownDetails } from "./ShowdownDetails";
import { DuelLab } from "./duel/DuelLab";
const fixtureName = import.meta.env.DEV
  ? new URLSearchParams(location.search).get("fixture")
  : null;
const fixtureGame = fixtureName
  ? (await import("./fixtures")).fixture(fixtureName)
  : null;
const STORAGE = fixtureName
    ? `jokers-gambit-qa-session-v2-${fixtureName}`
    : "jokers-gambit-session-v2",
  HISTORY = fixtureName
    ? "jokers-gambit-qa-records-v2"
    : "jokers-gambit-records-v2";
const ROLE_NAMES = { k: "킹", q: "퀸", r: "룩", b: "비숍", n: "나이트", p: "폰" };
const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const SETTINGS = "jokers-mate-settings-v1";
function savedSetting(key: "hints" | "motion", fallback: boolean): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS) ?? "null");
    return typeof saved?.[key] === "boolean" ? saved[key] : fallback;
  } catch {
    return fallback;
  }
}
function initial(): Game {
  if (fixtureGame) return fixtureGame;
  try {
    const raw = localStorage.getItem(STORAGE),
      saved = restore(raw);
    if (saved) return saved;
    if (raw) localStorage.setItem(STORAGE + "-recovery", raw);
  } catch {}
  return newCampaign();
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
  role,
  side,
  revealed,
  spotlight = false,
}: {
  card?: Card;
  hidden?: boolean;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  role?: ChessRole;
  side?: Side;
  revealed?: boolean;
  spotlight?: boolean;
}) {
  const className = `playing-card ${spotlight ? "card-spotlight" : ""} ${revealed === undefined ? "" : revealed ? "card-revealed" : "card-unrevealed"} ${role ? "character-card" : ""} ${hidden ? "back" : ""} ${card?.suit === "D" || card?.suit === "H" ? "red" : ""} ${selected ? "picked" : ""} ${small ? "small" : ""}`;
  const content = role ? (
    <><Checard role={role} card={hidden ? undefined : card} hidden={hidden} side={side} />
      <span className={`compact-card-face ${hidden ? "concealed-face" : ""}`} aria-hidden="true">
        <span className={`card-role side-${side}`}>{{ k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }[role]}{"\uFE0E"}</span>
        <strong>{hidden ? "✦" : card ? label(card) : ""}</strong>
      </span></>
  ) : hidden ? (
    <>
      <span className="back-diamond">✦</span>
      <span className="back-line" />
    </>
  ) : card ? (
    <>
      <span className="card-corner">
        {card.suit === "J" ? "JK" : label(card)}
      </span>
      {role ? (
        <Checard role={role} card={card} />
      ) : (
        <span className="card-symbol">{SYMBOLS[card.suit]}</span>
      )}
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
      aria-label={`${hidden ? "비공개 카드" : card ? label(card) : ""}${revealed === undefined ? "" : revealed ? " · 공개됨" : " · 상대에게 비공개"}`}
    >
      {content}
    </div>
  );
}
function ResultDialog({ title, children, active }: { title: string; children: React.ReactNode; active: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (active && element && !element.open) element.showModal();
    if (!active) element?.close();
    return () => element?.close();
  }, [active]);
  return <>
    <button className="result-reopen" onClick={() => dialog.current?.showModal()}>{title} 보기</button>
    <dialog ref={dialog} className="result-dialog" aria-label={title}>
      <button className="result-dismiss" onClick={() => dialog.current?.close()}>게임판 보기 · 닫기</button>
      {children}
    </dialog>
  </>;
}

function App() {
  const [emperorTitle, setEmperorTitle] = useState(() => {
    try {
      return localStorage.getItem("jokers-mate-emperor-title") === "true";
    } catch {
      return false;
    }
  });
  const [titleScreen, setTitleScreen] = useState(true);
  const [g, updateG] = useState<Game>(initial),
    [records, setRecords] = useState<RecordEntry[]>(readRecords);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null),
    [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [modal, setModal] = useState<
      "help" | "settings" | "records" | "menu" | "match" | "duel" | "restart" | null
    >(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  const [restartFrom, setRestartFrom] = useState<"title" | "menu">("menu");
  const currentGame = useRef(g);
  const lastBetAt = useRef(0);
  function setG(update: React.SetStateAction<Game>) {
    const next =
      typeof update === "function" ? update(currentGame.current) : update;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
    } catch {
      setError(
        "진행을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.",
      );
      return;
    }
    currentGame.current = next;
    updateG(next);
  }
  const [aiHand, setAiHand] = useState<Card[]>([]),
    [suggesting, setSuggesting] = useState(false);
  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [hints, setHints] = useState(() => savedSetting("hints", true)),
    [motion, setMotion] = useState(
      () => savedSetting("motion", !matchMedia("(prefers-reduced-motion: reduce)").matches),
    );
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS, JSON.stringify({ hints, motion }));
    } catch {
      // Preferences remain usable for this session when storage is unavailable.
    }
  }, [hints, motion]);
  const [showdown, setShowdown] = useState({ id: "", step: 0, details: false });
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const showdownStep = showdown.id === g.id ? showdown.step : 0;
  const revealFrame = showdownFrame(g, showdownStep);
  const settlementVisible = !revealFrame.active || (showdown.id === g.id && showdown.details);
  const publicHand = (side: Side) => revealFrame.active
    ? g.hands[side].slice(0, revealFrame.counts[side])
    : exposedHand(g, side);
  const showdownTable = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    if (!revealFrame.active || revealFrame.complete || titleScreen || modal || !pageVisible) return;
    const delay = !motion ? 180 : revealFrame.allShown ? 1200 : showdownStep === 0 ? 900 : 850;
    const timer = setTimeout(() => setShowdown({ id: g.id, step: showdownStep + 1, details: false }), delay);
    return () => clearTimeout(timer);
  }, [g.id, revealFrame.active, revealFrame.complete, revealFrame.allShown, showdownStep, titleScreen, modal, pageVisible, motion]);
  useEffect(() => {
    if (revealFrame.active && !titleScreen) showdownTable.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [g.id, revealFrame.active, titleScreen]);
  const c = useMemo(() => chessOf(g), [g.moves]),
    own = useMemo(() => survivors(c, g.identities, "w"), [c, g.identities]),
    opponent = useMemo(
      () => survivors(c, g.identities, "b"),
      [c, g.identities],
    );
  const legal = selectedSquare
      ? c.moves({ square: selectedSquare as Square, verbose: true })
      : [];
  const reviewingChess = g.phase === "selection" && !g.chessReviewed;
  const humanTurn = g.phase === "chess" && c.turn() === "w";
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
    if (g.phase !== "chess" || c.turn() !== "b" || modal || titleScreen) return;
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
  }, [g.id, g.moves.length, g.phase, modal, retry, titleScreen]);
  useEffect(() => {
    if (g.phase !== "selection") {
      setAiHand([]);
      return;
    }
    setSelectedCards(own.length === 5 ? own.map((x) => x.id) : []);
    setSwapSlot(null);
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
    if (
      g.phase !== "betting" ||
      g.betting?.turn !== "b" ||
      modal ||
      titleScreen
    )
      return;
    const timer = setTimeout(() => {
      try {
        const action = chooseBet({
          ownHand: g.hands.b,
          opponentPublic: exposedHand(g, "w"),
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
  }, [g, modal, retry, titleScreen]);
  useEffect(() => {
    if (modal === "duel" || (!modal && !promotion)) return;
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
        setModal(modal === "restart" && restartFrom === "menu" ? "menu" : null);
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
  }, [modal, promotion, restartFrom]);
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
    if (!humanTurn || modal || titleScreen) return;
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
    if (currentGame.current !== g || modal || titleScreen || document.hidden || Date.now() - lastBetAt.current < 350) return false;
    try {
      setG(act(currentGame.current, "w", a));
      if (currentGame.current === g) return false;
      lastBetAt.current = Date.now();
      setError("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "베팅 오류");
      return false;
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
  const chosen = selectedCards
    .map((id) => own.find((x) => x.id === id)!)
    .filter(Boolean);
  const roleFor = (card?: Card): ChessRole | undefined =>
    card
      ? Object.entries(g.identities).reduce<ChessRole | undefined>(
          (found, [square, identity]) =>
            identity.id === card.id ? c.get(square as Square)?.type : found,
          undefined,
        )
      : undefined;
  const selectedName = useMemo(
    () => (chosen.length === 5 ? evaluate(chosen).name : ""),
    [selectedCards, g.identities],
  );
  const visibleOpponent =
    g.phase === "result" && !g.betting?.folded && !g.abandoned && revealFrame.complete;
  const splitPots = !!g.economy;
  const fee = entryFee(g.economy),
    pool = chessPool(g.economy),
    chessShare = pool / 2,
    pokerShare = fee - chessShare;
  const outcome = campaignOutcome(g);
  const storyScreen = g.journey?.screen ?? "play";
  const storyVisible = ["prologue", "ending", "failed", "complete"].includes(
    storyScreen,
  );
  const canContinue =
    storyScreen !== "complete" &&
    storyScreen !== "failed" &&
    outcome !== "failed";
  const opponentName =
    g.journey?.opponent === "emperor"
      ? "황제 아우렐리온"
      : "로언 · 정원의 기사";
  const chessAward = (s: Side) =>
    !g.chessResult
      ? 0
      : g.chessResult.winner === s
        ? pool
        : g.chessResult.winner === null && g.economy === "split-15-5"
          ? 15
          : 0;
  const drawCarry =
    (g.economy === "r3" || g.economy === "r4") &&
    g.chessResult?.winner === null;
  const total =
    g.committed.w + g.committed.b - (splitPots && !drawCarry ? pool : 0);
  const vault = (s: Side) =>
    g.settlement && settlementVisible ? g.settlement.final[s] : g.banks[s] - g.committed[s];
  function next() {
    setG(nextRound(g));
    setSelectedCards([]);
    setSelectedSquare(null);
    setError("");
  }
  function restart() {
    setG({ ...newCampaign(), journey: { opponent: "roan", screen: "play" } });
    setSelectedCards([]);
    setSelectedSquare(null);
    setModal(null);
    setError("");
  }
  function confirmRestart(from: "title" | "menu") {
    setRestartFrom(from);
    setModal("restart");
  }
  function closeModal() {
    setModal(modal === "restart" && restartFrom === "menu" ? "menu" : null);
  }
  useEffect(() => {
    function pauseHidden() {
      if (
        document.hidden &&
        !titleScreen &&
        !promotion &&
        g.phase !== "lobby" &&
        g.phase !== "result"
      )
        setModal((current) => current ?? "menu");
    }
    document.addEventListener("visibilitychange", pauseHidden);
    return () => document.removeEventListener("visibilitychange", pauseHidden);
  }, [g.phase, titleScreen, promotion]);
  function returnToMenu() {
    setTitleScreen(true);
    setModal(null);
  }
  function endingReturn() {
    if (outcome === "true-ending") {
      try {
        localStorage.setItem("jokers-mate-emperor-title", "true");
      } catch {
        setError("칭호를 저장하지 못했습니다. 저장 공간을 확인하세요.");
        return;
      }
      setEmperorTitle(true);
    }
    setG(finishEnding(g));
    setTitleScreen(true);
  }
  function exportRecords() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(records, null, 2)], {
        type: "application/json",
      }),
    );
    a.href = url;
    a.download = "jokers-mate-records.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const playing = !titleScreen && !storyVisible && g.phase !== "lobby";
  const selecting = g.phase === "selection" && !reviewingChess;
  const chosenPiece = selectedSquare ? c.get(selectedSquare as Square) : null;
  return (
    <div className={`app ${playing ? `play-view ${selecting ? "picking-view" : ""} ${g.phase === "chess" || reviewingChess ? "chess-view" : "poker-view"}` : ""} ${motion ? "" : "no-motion"} ${titleScreen ? "home-view" : ""} ${!titleScreen && !storyVisible && g.phase === "betting" ? "betting-view" : ""}`}>
      <header className="masthead">
        <a className="wordmark" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">♜</span>
          <span>
            JOKER’S MATE<small>THE ROYAL GARDEN</small>
          </span>
        </a>
        <nav aria-label="메뉴">
          <button className="help-button" onClick={() => setModal("help")} aria-label="도움말">?</button>
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
        {titleScreen && (
          <section className="title-screen" aria-label="메인 메뉴">
            <div className="title-emblem" aria-hidden="true">♛</div>
            <div className="eyebrow">THE ROYAL GARDEN</div>
            <h1>JOKER’S<br />MATE</h1>
            <p className="title-tagline">체스의 한 수, 포커의 한 장.</p>
            {storyScreen !== "prologue" && canContinue && (
              <span className="save-badge">● ROUND {g.round} · {g.phase === "chess" ? "체스 진행 중" : g.phase === "betting" ? "포커 진행 중" : g.phase === "selection" ? "카드 선택" : g.phase === "result" ? "결과 확인" : "대국 준비"}</span>
            )}
            <div className="title-actions">
              {outcome === "failed" && storyScreen !== "failed" && (
                <button className="primary" onClick={() => setTitleScreen(false)}>결과 확인</button>
              )}
              {canContinue && (
                <button className="primary" onClick={() => {
                  if (storyScreen === "prologue") setG({ ...g, journey: { opponent: "roan", screen: "play" } });
                  setTitleScreen(false);
                }}>{storyScreen === "prologue" ? "게임 시작" : "이어하기"}<span aria-hidden="true"> →</span></button>
              )}
              {storyScreen !== "prologue" && (
                <button className={canContinue ? "secondary-start" : "primary"} onClick={() => {
                  if (!canContinue) {
                    restart();
                    setTitleScreen(false);
                  } else confirmRestart("title");
                }}>새 게임</button>
              )}
            </div>
            <div className="title-links">
              <button onClick={() => setModal("help")}>플레이 방법</button>
              <button onClick={() => setModal("settings")}>설정</button>
              <button onClick={() => setModal("records")}>기록</button>
            </div>
            <span className="title-save-note">진행 상황 자동 저장</span>
          </section>
        )}
        {!titleScreen && storyVisible && (
          <section className="title-screen story-screen" aria-label="이야기">
            <div className="palace-gate" aria-hidden="true">
              {storyScreen === "prologue" ? "♟ ✉ ♜" : "♛ ♚"}
            </div>
            <h1>
              {storyScreen === "prologue"
                ? "정원의 초대"
                : storyScreen === "failed"
                  ? "꺼진 금고"
                  : g.journey?.opponent === "emperor"
                    ? "마지막 왕관"
                    : "정원의 문 너머"}
            </h1>
            <p>
              {storyScreen === "prologue"
                ? "카드 복원사 리브에게 이름이 지워진 초대장이 도착했다. 정원의 문지기 로언은 말한다. 체스에서 왕을 지키고, 살아남은 다섯 장으로 너의 이름을 되찾아라."
                : storyScreen === "failed"
                  ? "다음 대국에 참가할 금화가 부족합니다. 이번 이야기는 여기서 끝납니다. 새 게임은 로언부터 시작합니다."
                  : g.journey?.opponent === "emperor"
                    ? "아우렐리온의 금고가 닫히고 킹과 퀸의 왕관이 내려온다. 리브는 체스 기물과 카드가 쌓인 높은 왕좌를 바라본다. 이름을 되찾으러 온 사람이 이제 새로운 황제가 되었다."
                    : "로언이 이름 장부를 돌려주었다. 리브의 이름 아래, 또 하나의 초대장이 놓여 있다. 왕실의 마지막 상대, 조커 황제 아우렐리온이 기다린다."}
            </p>
            {storyScreen === "prologue" ? (
              <button
                className="primary"
                onClick={() =>
                  setG({ ...g, journey: { opponent: "roan", screen: "play" } })
                }
              >
                정원으로 · 참가 확인
              </button>
            ) : (
              <button
                className="primary"
                onClick={
                  storyScreen === "ending"
                    ? endingReturn
                    : () => setTitleScreen(true)
                }
              >
                돌아가기
              </button>
            )}
          </section>
        )}
        <div className="play-content" hidden={titleScreen || storyVisible}>
          {g.phase === "lobby" ? (
            <section className="lobby panel" aria-label="게임 시작">
              <div className="panel-eyebrow">ROUND {String(g.round).padStart(2, "0")}</div>
              <h2>왕실 정원의 대국</h2>
              <div className="matchup">
                <div className="match-player"><span className="match-avatar white" aria-hidden="true">♔</span><strong>당신</strong><small>{g.banks.w.toLocaleString()} G</small></div>
                <span className="versus" aria-hidden="true">VS</span>
                <div className="match-player"><span className="match-avatar black" aria-hidden="true">{g.journey?.opponent === "emperor" ? "♚" : "♞"}</span><strong>{g.journey?.opponent === "emperor" ? "아우렐리온" : "로언"}</strong><small>{g.banks.b.toLocaleString()} G</small></div>
              </div>
              <div className="entry-ticket"><span>참가금</span><strong>{fee} <small>G</small></strong><span>내 잔액 {g.banks.w.toLocaleString()} → {(g.banks.w - fee).toLocaleString()} G</span></div>
              {g.economy !== "r4" && <p className="fine-print">저장된 판은 참가금 {fee} G로 진행합니다.</p>}
              <button
                className="primary full"
                onClick={() => {
                  try {
                    const entered = enterGame(g);
                    localStorage.setItem(STORAGE, JSON.stringify(entered));
                    setG(entered);
                  } catch {
                    setError(
                      "저장할 수 없어 참가를 중단했습니다. 저장 공간을 확인하세요.",
                    );
                  }
                }}
              >
                {fee} G · 대국 시작 →
              </button>
              <button className="lobby-help" onClick={() => setModal("help")}>배당 안내 · 플레이 방법</button>
            </section>
          ) : (
            <div className="game-layout">
              <section
                className={`arena garden-arena ${revealFrame.active && !settlementVisible ? "showdown-scene" : ""} ${g.phase === "selection" && !reviewingChess ? "selection-scene" : ""} ${g.phase === "chess" || reviewingChess ? "chess-scene" : "poker-scene"}`}
                aria-label="게임 테이블"
              >
                <GoldProcession game={g} paused={titleScreen || !motion || !settlementVisible} />
                {reviewingChess && (
                  <ResultDialog title="체스 결과" active={!titleScreen && !storyVisible && !modal}>
                  <div
                    className="chess-end-banner"

                  >
                    <strong>
                      {g.chessResult?.winner
                        ? `${sideName(g.chessResult.winner)} 체스 승리`
                        : "체스 무승부"}
                    </strong>
                    <p>
                      {g.chessResult?.reason}. 체스가 끝났습니다. 포커로 계속하세요.
                    </p>
                    <button
                      className="primary full"
                      onClick={() =>
                        setG((current) => ({ ...current, chessReviewed: true }))
                      }
                    >
                      포커로 계속 →
                    </button>
                  </div>
                  </ResultDialog>
                )}

                <div className="phase-bar">
                  <div
                    className={
                      g.phase === "chess" || reviewingChess
                        ? "current"
                        : "complete"
                    }
                  >
                    <span>01</span> 체스
                  </div>
                  <i />
                  <div
                    className={
                      (g.phase === "selection" && !reviewingChess) ||
                      (g.phase === "betting" || (revealFrame.active && !settlementVisible))
                        ? "current"
                        : g.phase === "result"
                          ? "complete"
                          : ""
                    }
                  >
                    <span>02</span> 포커
                  </div>
                  <i />
                  <div className={g.phase === "result" && settlementVisible ? "current" : ""}>
                    <span>03</span> 정산
                  </div>
                </div>
                <div className="table-area">
                  <div className="player-row opponent-row">
                    <div className="vault">
                      <span className="avatar opponent-avatar">♞</span>
                      <div>
                        <span className="player-name">{g.journey?.opponent === "emperor" ? "아우렐리온" : "로언"} · 흑</span>
                        <strong>
                          {vault("b").toLocaleString()} <small>G</small>
                        </strong>
                        {!splitPots && g.chessResult?.winner === "b" && (
                          <span className="protection">♜ 최종 20 G 보호</span>
                        )}
                      </div>
                    </div>
                    <details className="captures">
                      <summary>
                        잡은 카드 <b>{g.captured.b.length}</b>
                      </summary>
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
                    </details>
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
                                      <span className="mobile-chess-piece" aria-hidden="true">
                                        {{ k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }[piece.type]}{"\uFE0E"}
                                      </span>
                                      <Checard role={piece.type} card={piece.color === "w" ? card : undefined} hidden={piece.color === "b"} side={piece.color} board />
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

                    </div>
                  ) : (
                    <div className="poker-table" ref={showdownTable}>
                      {revealFrame.active ? (
                        <div className="reveal-stage" role="status">
                          {revealFrame.complete ? "쇼다운 · 모든 카드 공개" : revealFrame.allShown ? "두 패를 확인하세요…" :
                            revealFrame.latest ? `${revealFrame.latest.side === "w" ? "내" : "상대"} ${revealFrame.latest.index + 1}번째 카드 공개` : "베팅 종료 · 마지막 카드 공개"}
                        </div>
                      ) : g.betting?.street !== undefined && (
                        <div className="reveal-stage" role="status">
                          베팅 {g.betting.street + 1} / 3 · 양측 {g.betting.street + 1}장 공개
                          {g.phase === "result" ? " · 종료" : ""}
                        </div>
                      )}
                      <div className="opponent-hand">
                        {Array.from({ length: 5 }, (_, i) => (
                          <PlayingCard
                            key={i}
                            side="b"
                            spotlight={!revealFrame.complete && revealFrame.latest?.side === "b" && revealFrame.latest.index === i}
                            revealed={Boolean(publicHand("b")[i])}
                            hidden={!publicHand("b")[i]}
                            card={publicHand("b")[i]}
                            role={roleFor(publicHand("b")[i]) ?? "p"}
                          />
                        ))}
                      </div>
                      {visibleOpponent && (
                        <div className="hand-name opponent-hand-name">
                          {evaluate(g.hands.b).name}
                        </div>
                      )}
                      {revealFrame.active && !settlementVisible ? (
                        <div className={`showdown-prompt ${revealFrame.complete ? "verdict" : ""}`} role="status">
                          {revealFrame.complete ? <>
                            <span className="panel-eyebrow">SHOWDOWN</span>
                            <h2>{g.result?.winner === "w" ? "포커 승리" : "포커 패배"}</h2>
                            <p>나 {evaluate(g.hands.w).name} · 상대 {evaluate(g.hands.b).name}</p>
                            <ShowdownDetails own={g.hands.w} opponent={g.hands.b} />
                            <button className="primary full" onClick={() => setShowdown({ id: g.id, step: revealFrame.finalStep, details: true })}>계속 · 정산 보기</button>
                          </> : <>
                            <strong>{revealFrame.allShown ? "승부를 확인합니다…" : "마지막 한 장까지"}</strong>
                            <p>팟 {total.toLocaleString()} G · 내 {revealFrame.counts.w}/5장 · 상대 {revealFrame.counts.b}/5장 공개</p>
                            <button onClick={() => setShowdown({ id: g.id, step: revealFrame.finalStep, details: false })}>공개 건너뛰기</button>
                          </>}
                        </div>
                      ) : (
                      <div className="central-pot" key={`${g.id}-${total}`}>
                        <span className="pot-label">
                          {g.phase === "result"
                            ? "이번 판 내 순손익"
                            : "THE POT"}
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
                              ? drawCarry
                                ? `체스 무승부 · 전체 ${fee * 2} G 이월`
                                : `포커 기본 ${fee * 2 - pool} G · 체스 배당 ${pool} G 별도`
                              : "참가금 20 G × 2"
                            : g.phase === "result"
                              ? `정산 완료 · 잔액 ${g.settlement!.final.w.toLocaleString()} G`
                              : drawCarry ? "체스 무승부 · 전체 이월" : splitPots ? `체스 배당 ${pool}G 보관` : "현재 판돈"}
                        </span>
                      </div>
                      )}
                      {g.phase === "selection" ? (
                        <div className="selection-instruction">
                          <strong>당신의 마지막 다섯 장</strong>
                          <span>아래 생존 카드에서 선택하세요</span>
                        </div>
                      ) : (
                        <>
                          <div className="own-hand">
                            {g.hands.w.map((card, i) => (
                              <PlayingCard
                                key={card.id}
                                side="w"
                                spotlight={!revealFrame.complete && revealFrame.latest?.side === "w" && revealFrame.latest.index === i}
                                revealed={publicHand("w").some((shown) => shown.id === card.id)}
                                card={card}
                                role={Object.entries(g.identities).reduce<
                                  ChessRole | undefined
                                >(
                                  (found, [square, identity]) =>
                                    identity.id === card.id
                                      ? c.get(square as Square)?.type
                                      : found,
                                  undefined,
                                )}
                              />
                            ))}
                          </div>
                          <div className="hand-name self-hand-name">
                            {g.hands.w.length === 5
                              ? evaluate(g.hands.w).name
                              : "대국 종료"}
                            {g.hands.w.some((x) => x.suit === "J") && (
                              <small className="joker-resolution">
                                최적 패{" "}
                                {evaluate(g.hands.w)
                                  .resolved.map(label)
                                  .join(" ")}
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
                    <details className="captures">
                      <summary>
                        잡은 카드 <b>{g.captured.w.length}</b>
                      </summary>
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
                    </details>
                    <div className="vault">
                      <div>
                        <span className="player-name">나 · 백</span>
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
                {(g.phase === "chess" || reviewingChess) && <div className="chess-command">
                  <div role="status"><strong>{reviewingChess ? "체스 종료" : c.isCheck() ? "체크 · 킹을 지키세요" : humanTurn ? "내 차례" : "상대가 생각하는 중…"}</strong>
                    <span>{chosenPiece && selectedSquare ? `${selectedSquare} ${ROLE_NAMES[chosenPiece.type]} · ${g.identities[selectedSquare] ? label(g.identities[selectedSquare]) : ""}` : humanTurn ? "기물을 고르고 이동할 칸을 누르세요" : `${Math.floor(g.moves.length / 2) + 1}번째 수`}</span></div>
                  {selectedSquare ? <button onClick={() => setSelectedSquare(null)}>선택 취소</button> : <button onClick={() => setModal("match")}>수순</button>}
                </div>}
              </section>
              <aside className="sidebar">
                {g.phase === "selection" && !reviewingChess && (
                  <section className="panel selection-panel">
                    <div className="panel-title">
                      <h3>함께할 다섯 장을 고르세요</h3>
                      <span>{selectedCards.length} / 5</span>
                    </div>
                    <div className="reveal-slots" aria-label="선택한 패와 공개 순서">
                      {Array.from({ length: 5 }, (_, index) => <button key={index} disabled={!chosen[index]}
                        className={swapSlot === index ? "slot-active" : ""}
                        aria-label={`${index + 1}번 슬롯 ${chosen[index] ? label(chosen[index]) : "비어 있음"}`}
                        aria-pressed={swapSlot === index}
                        onClick={() => {
                          if (swapSlot === null) setSwapSlot(index);
                          else {
                            setSelectedCards(old => { const next = [...old]; [next[index], next[swapSlot]] = [next[swapSlot], next[index]]; return next; });
                            setSwapSlot(null);
                          }
                        }}><span className={chosen[index]?.suit === "H" || chosen[index]?.suit === "D" ? "red" : ""}>{chosen[index] ? label(chosen[index]) : index + 1}</span><small>{index < 3 ? `${index + 1}차 공개` : "마지막"}</small></button>)}
                    </div>
                    <p className="slot-instruction">{swapSlot !== null ? "바꿀 자리를 누르세요 · 같은 자리로 취소" : "위 두 자리를 눌러 공개 순서를 바꿀 수 있어요"}</p>
                    <div className="card-picker" aria-label="생존 카드">
                      {own.map((card) => (
                        <PlayingCard
                          key={card.id}
                          card={card}
                          selected={selectedCards.includes(card.id)}
                          small
                          onClick={() => {
                            setSwapSlot(null);
                            setSelectedCards((old) =>
                              old.includes(card.id)
                                ? old.filter((x) => x !== card.id)
                                : old.length < 5
                                  ? [...old, card.id]
                                  : old,
                            );
                          }}
                        />
                      ))}
                    </div>
                    <p className="selection-name">
                      {selectedName || "다섯 장을 선택하면 족보가 표시됩니다."}
                    </p>
                    <div className="selection-tools"><button
                      className="text-button"
                      disabled={suggesting}
                      onClick={suggest}
                    >
                      {suggesting
                        ? "조합을 살펴보는 중…"
                        : "✦ 추천"}
                    </button><button disabled={!chosen.length} onClick={() => { setSelectedCards([]); setSwapSlot(null); }}>선택 비우기</button></div>
                    <button
                      className="primary full"
                      disabled={
                        selectedCards.length !== 5 || aiHand.length !== 5
                      }
                      onClick={() => {
                        try {
                          setG(startBetting(g, chosen, shuffle(aiHand), true));
                          setError("");
                        } catch (err) {
                          setError(String(err));
                        }
                      }}
                    >
                      {aiHand.length !== 5
                        ? "상대가 카드를 고르는 중…"
                        : "이 패로 시작 →"}
                    </button>
                  </section>
                )}
                {g.phase === "betting" && (
                  <BettingControls key={`${g.id}-${g.betting!.street}-${g.betting!.log.length}`}
                    game={g} pot={total} paused={titleScreen || !!modal || !pageVisible}
                    onAction={bet} onHistory={() => setModal("match")} />
                )}
                {g.phase === "result" && g.settlement && settlementVisible && (
                  <ResultDialog title="최종 결과" active={!titleScreen && !storyVisible && !modal}>
                  <section className="panel result-panel">
                    <div className="result-icon">
                      {g.result?.winner === "w"
                        ? "♛"
                        : g.result?.winner === "b"
                          ? "♞"
                          : "⚖"}
                    </div>
                    <h2>이번 판 {g.settlement.final.w - g.banks.w >= 0 ? "+" : ""}{(g.settlement.final.w - g.banks.w).toLocaleString()}G</h2>
                    <p>내 금고 {g.banks.w.toLocaleString()} → {g.settlement.final.w.toLocaleString()}G</p>
                    <p>{g.abandoned ? "중단된 이전 대국" : `체스 ${g.chessResult?.winner === "w" ? "승리" : g.chessResult?.winner === "b" ? "패배" : "무승부"} · 포커 ${g.result?.winner === "w" ? "승리" : "패배"}`} · {g.result?.reason}</p>
                    {!g.abandoned && !g.betting?.folded && g.hands.w.length === 5 && g.hands.b.length === 5 && (
                      <ShowdownDetails own={g.hands.w} opponent={g.hands.b} />
                    )}
                    <details><summary>정산 상세 보기</summary>
                    <table className="settlement-ledger">
                      <caption>한 번의 정산 · 양측 금액</caption>
                      <thead>
                        <tr>
                          <th>항목</th>
                          <th>나</th>
                          <th>상대</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["시작 잔액", g.banks],
                          ["총 납부액", g.committed],
                          ["미매칭 반환", g.settlement.returned],
                          [
                            "체스 배당",
                            g.settlement.chessAward ?? { w: 0, b: 0 },
                          ],
                          [
                            g.abandoned ? "도주 이전액" : "포커 배당",
                            g.settlement.award,
                          ],
                          ["최종 잔액", g.settlement.final],
                          [
                            "순손익",
                            {
                              w: g.settlement.final.w - g.banks.w,
                              b: g.settlement.final.b - g.banks.b,
                            },
                          ],
                        ].map(([name, pair]) => (
                          <tr key={String(name)}>
                            <th>{String(name)}</th>
                            {(["w", "b"] as const).map((side) => (
                              <td key={side}>
                                {(pair as Record<Side, number>)[
                                  side
                                ].toLocaleString()}{" "}
                                G
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </details>
                    {!splitPots && (
                      <p>이전 판 보호 조정: {g.settlement.protection} G</p>
                    )}
                    {outcome === "failed" ? (
                      <>
                        <p>
                          참가금 {CURRENT_ENTRY} G가 부족합니다. 게임 오버 ·
                          이어하기는 종료됩니다.
                        </p>
                        <button
                          className="primary full"
                          onClick={() =>
                            setG({
                              ...g,
                              journey: {
                                opponent: g.journey?.opponent ?? "roan",
                                screen: "failed",
                              },
                            })
                          }
                        >
                          실패 화면 보기
                        </button>
                      </>
                    ) : outcome === "ending" || outcome === "true-ending" ? (
                      <button
                        className="primary full"
                        onClick={() =>
                          setG({
                            ...g,
                            journey: {
                              opponent: g.journey?.opponent ?? "roan",
                              screen: "ending",
                            },
                          })
                        }
                      >
                        엔딩 보기
                      </button>
                    ) : (
                      <>
                        <button className="primary full" onClick={next}>
                          다음 대국 준비
                        </button>
                        <button className="full" onClick={returnToMenu}>
                          메인으로
                        </button>
                      </>
                    )}
                    {g.achievements.length > 0 && (
                      <div className="achievement-list">
                        {g.achievements.map((x) => (
                          <span key={x}>✦ {x}</span>
                        ))}
                      </div>
                    )}
                  </section>
                  </ResultDialog>
                )}
              </aside>
            </div>
          )}
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
        </div>
        {titleScreen && <footer>
          <span>♠ ♥ ♦ ♣</span>
          <p>
            JOKER’S MATE <i>·</i> 가상 골드만 사용하는 전략 게임
          </p>
          <small>PROTOTYPE · 0.2</small>
        </footer>}
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
      {modal === "duel" && <DuelLab motion={motion} onClose={() => setModal("settings")} />}
      {modal && modal !== "duel" && (
        <div className="modal-backdrop" onClick={closeModal}>
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
                match: "진행 중인 대국 기록",
                restart: "새 게임 확인",
              }[modal]
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="닫기"
              onClick={closeModal}
            >
              ×
            </button>
            {modal === "help" && <>
              <h2>플레이 방법</h2>
              <p>체스에서 살아남은 다섯 장으로 포커를 겨룹니다.</p>
              <div className="help-topics">
                <details><summary>♜ 체스 · 기물을 움직이기</summary><p>내 기물을 누르고 이동할 칸을 누르세요. 나는 백, 상대는 흑입니다. 내 카드만 보이며 상대 카드는 잡으면 공개됩니다.</p><p>일반 체스 규칙을 따릅니다. 어느 쪽이든 5기물이 남으면 체스가 끝납니다. 그 수가 체크면 공격자 승리, 아니면 무승부입니다. 체크메이트가 우선하며 3회 반복·50수도 무승부입니다.</p></details>
                <details><summary>▤ 패 선택 · 공개 순서</summary><p>생존 카드에서 다섯 장을 고르세요. 위 슬롯 두 개를 눌러 순서를 바꿀 수 있습니다. 1·2·3번째 카드를 차례로 공개하며 세 번 베팅합니다. 마지막 두 장은 쇼다운에 공개합니다.</p><p>내 패는 항상 모두 볼 수 있습니다. 공개 카드만 앞으로 나오며 상대의 숨은 카드 정체는 보이지 않습니다.</p></details>
                <details><summary>◉ 금화 베팅 · 체크 / 콜 / 폴드</summary><p>10·20·50·100 금화를 눌러 더 올릴 금액을 준비하세요. 마지막 베팅 버튼으로 확정합니다. 콜 40G에 50G를 더 올리면 이번 지불액은 90G입니다.</p><p>체크는 돈을 더 내지 않고 넘기기, 콜은 상대 금액에 맞추기, 폴드는 포커 포기입니다. 전부는 남은 금고로 올인을 준비합니다. ‘조절’에서 1G 단위와 반 팟·팟 금액도 고를 수 있습니다.</p><p>최소 정규 인상은 20G, 이후 직전 정규 인상폭 이상입니다. 10G는 조절 단위입니다. 짧은 올인은 이미 행동한 상대의 인상 권한을 다시 열지 않습니다. 부족한 콜은 남은 금액만 내며 미매칭 초과액은 반환됩니다.</p></details>
                <details><summary>♠ 족보 · 승부 결정</summary><p>족보 → 카드 랭크 → ♠ ♥ ♦ ♣ 순으로 비교합니다. 조커는 패 내부의 카드를 중복하지 않는 최선의 카드가 됩니다. A2345는 5-high이며 파이브카인드는 없습니다.</p><p>높은 순서: 스트레이트 플러시, 포카드, 풀하우스, 플러시, 스트레이트, 트리플, 투페어, 원페어, 하이카드.</p></details>
                <details><summary>금고 · 참가금과 정산</summary><p>현재 판 참가금은 각 {fee}G이며 한 번만 냅니다. 체스 합산 {pool}G, 포커 기본 {fee * 2 - pool}G와 추가 베팅을 겨룹니다. 체스 배당은 마지막에 지급하며 포커에 다시 걸 수 없습니다.</p><p>체스 무승부는 {g.economy === "split-15-5" ? "체스 몫을 나눠 받고 포커 몫을 겨룹니다." : "전체 참가금을 포커로 이월합니다."} 체스 승리·포커 패배의 추가 베팅 없는 손익은 {pool - fee}G입니다.</p><p>쇼다운을 본 뒤 계속을 누르면 이번 판 순손익과 정산 내역이 나옵니다. 다음 참가금은 {CURRENT_ENTRY}G이며 미만이면 이야기가 끝납니다. 저장된 이전 판의 경제 규칙은 해당 판이 끝날 때까지 유지됩니다.</p></details>
                <details><summary>이어하기 · 정원의 이야기</summary><p>진행은 이 브라우저에 자동 저장됩니다. 메뉴의 ‘저장하고 메인으로’ 또는 새로고침 후 ‘이어하기’로 같은 단계부터 계속할 수 있습니다.</p><p>이름을 되찾으러 온 카드 복원사 리브. 정원의 문지기 로언 너머에 황제 아우렐리온이 기다립니다.</p></details>
              </div>
            </>}
            {modal === "match" && <>
              <h2>이번 대국 기록</h2>
              <details open={g.phase === "chess" || reviewingChess}><summary>체스 수순</summary><div className="move-table">
                <div className="move-table-head"><span>#</span><span>나 · 백</span><span>상대 · 흑</span></div>
                {Array.from({ length: Math.ceil(g.moves.length / 2) }, (_, i) => <div className="move-line" key={i}><span>{i + 1}</span><b>{g.moves[i * 2]}</b><b>{g.moves[i * 2 + 1] ?? "…"}</b></div>)}
                {!g.moves.length && <p>아직 둔 수가 없습니다.</p>}
              </div></details>
              {g.betting && <details open><summary>포커 베팅</summary><p>내 투입 {g.committed.w - (splitPots ? chessShare : 0)}G · 상대 투입 {g.committed.b - (splitPots ? chessShare : 0)}G</p><div className="bet-log">{g.betting.log.map((line, index) => <div key={index}>{line}</div>)}</div></details>}
            </>}
            {modal === "settings" && (
              <>
                <div className="panel-eyebrow">YOUR GARDEN</div>
                <h2>플레이 설정</h2>
                <section aria-label="캐릭터 소개">
                  <h3>
                    리브{" "}
                    {emperorTitle && (
                      <span className="emperor-title">♛ 황제 ♚</span>
                    )}
                  </h3>
                  <p>
                    {emperorTitle
                      ? "킹과 퀸의 왕관, 체스와 카드로 쌓은 높은 왕좌. 새로운 황제의 이야기가 시작됩니다."
                      : "왕실 장부에서 이름을 되찾으러 온 카드 복원사. 정원에서 체스와 포커로 겨룹니다."}
                  </p>
                </section>
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
                <section className="duel-settings-entry" aria-label="대결 모드 테스트">
                  <h3>카드 일기토</h3>
                  <p>양쪽 기물·문양·숫자를 골라 60초 대결을 해보세요.</p>
                  <button className="primary full" onClick={() => setModal("duel")}>대결 모드 테스트 →</button>
                </section>
                <p>내장 컴퓨터 · 난도 3/10 · 기초 전술을 아는 초보 기사</p>
                <p className="fine-print">
                  가상 골드만 사용합니다. 설정은 현재 화면에 적용되며 게임
                  진행과 완료 기록은 자동 저장됩니다.
                </p>
              </>
            )}
            {modal === "menu" && (
              <>
                <div className="panel-eyebrow">JOKER’S MATE</div>
                <h2>일시정지</h2>
                <p>진행 상황이 이 브라우저에 저장됩니다.</p>
                <div className="menu-actions">
                  <button className="primary" onClick={() => setModal(null)}>
                    계속하기
                  </button>
                  <button onClick={() => setModal("help")}>
                    플레이 방법
                  </button>
                  <button onClick={() => setModal("match")}>이번 대국 기록</button>
                  <button onClick={() => setModal("records")}>완료한 대국</button>
                  <button onClick={() => setModal("settings")}>
                    설정
                  </button>
                  <button onClick={() => confirmRestart("menu")}>
                    새 게임
                  </button>
                  <button
                    onClick={() => {
                      returnToMenu();
                    }}
                  >
                    저장하고 메인으로
                  </button>
                </div>

              </>
            )}
            {modal === "restart" && (
              <>
                <h2>새 게임을 시작할까요?</h2>
                <p>현재 대국과 이야기 진행을 초기화하고 로언과 1,000G로 다시 시작합니다. 완료한 대국 기록은 유지됩니다.</p>
                <div className="menu-actions">
                  <button onClick={closeModal}>취소 · 돌아가기</button>
                  <button className="primary" onClick={() => { restart(); setTitleScreen(false); }}>새 게임으로 초기화</button>
                </div>
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
const root = createRoot(document.getElementById("root")!);
if (navigator.locks) {
  void navigator.locks.request(
    STORAGE + "-active",
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        root.render(
          <main className="title-screen">
            <h1>다른 창에서 대국 중입니다</h1>
            <p>
              기존 게임 창을 사용하세요. 이 창에서는 저장을 변경하지 않습니다.
            </p>
          </main>,
        );
        return;
      }
      root.render(<App />);
      await new Promise<void>(() => {});
    },
  );
} else root.render(<App />);
