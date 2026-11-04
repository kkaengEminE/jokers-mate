import React, { useEffect, useRef, useState } from "react";
import {
  ROLES,
  SUIT_LABELS,
  LEVEL_LABELS,
  cardLabel,
  rankLabel,
  fighterKit,
  displayDamage,
  isFighterCard,
  type FighterCard,
  type ActionKind,
  type DuelSuit,
} from "./cards";
import {
  createDuel,
  advanceDuel,
  queueAction,
  clearInputs,
  emptyInput,
  fighterPose,
  distance,
  type DuelState,
  type OpponentMode,
  type Side,
  type Input,
} from "./engine";
import "./duel.css";
import "./finish.css";
const ART = `${import.meta.env.BASE_URL}art/duel/`;
const DEFAULTS: [FighterCard, FighterCard] = [
  { role: "q", suit: "H", rank: 9 },
  { role: "k", suit: "C", rank: 13 },
];
const MODES: Record<OpponentMode, string> = {
  ai: "AI 대결",
  idle: "움직이지 않는 상대",
  "high-guard": "서서 방어하는 상대",
  "low-guard": "앉아 방어하는 상대",
};
const STORAGE = "jokers-mate-duel-lab-v1";
type Team = "w" | "b";
const TEAM_LABEL: Record<Team, string> = { w: "백", b: "흑" };
const TEAM_STORAGE = "jokers-mate-duel-team-v1";
const SOUND_STORAGE = "jokers-mate-duel-sound-v1";
const FINISH_DURATION = 3000;
function initialSound(): boolean {
  try {
    return localStorage.getItem(SOUND_STORAGE) !== "off";
  } catch {
    return true;
  }
}
function initialTeam(): Team {
  try {
    return localStorage.getItem(TEAM_STORAGE) === "b" ? "b" : "w";
  } catch {
    return "w";
  }
}
function initialCards(): [FighterCard, FighterCard] {
  try {
    const c = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (Array.isArray(c) && c.length === 2 && c.every(isFighterCard))
      return c as [FighterCard, FighterCard];
  } catch {
    /* Defaults remain usable when storage is unavailable. */
  }
  return DEFAULTS.map((c) => ({ ...c })) as [FighterCard, FighterCard];
}
const hp = (n: number) => Math.ceil(n / 100);
const effectLabels = {
  hit: "명중",
  block: "방어",
  dodge: "회피",
  miss: "사거리 밖",
  special: "필살기",
  finish: "종료",
};

export function FighterArt({
  card,
  team,
  pose = 0,
  opponent = false,
}: {
  card: FighterCard;
  team: Team;
  pose?: number;
  opponent?: boolean;
}) {
  const row = ROLES.find((r) => r.value === card.role)!.row;
  const anchors = [95, 104, 90, 74, 79, 89, 104, 90];
  const cardY = [104, 105, 105, 100, 107, 143, 107, 149];
  return (
    <svg
      className="duel-figure"
      data-team={team}
      viewBox="-30 -5 241 191"
      aria-hidden="true"
    >
      <g transform={opponent ? "translate(180 0) scale(-1 1)" : undefined}>
        <svg
          x={90 - anchors[pose]}
          y="0"
          width="181"
          height="181"
          viewBox={`${pose * 181} ${row * 181} 181 181`}
          overflow="hidden"
        >
          <image
            href={`${ART}fighters.png`}
            width="1448"
            height="1086"
            style={{
              filter:
                team === "w"
                  ? "grayscale(1) contrast(.55) brightness(1.6)"
                  : "grayscale(1) contrast(.75) brightness(.5)",
            }}
          />
        </svg>
      </g>
      <text
        x="90"
        y={cardY[pose]}
        textAnchor="middle"
        fill={
          card.suit === "H" || card.suit === "D"
            ? team === "w"
              ? "#9b302e"
              : "#ffb3a8"
            : team === "w"
              ? "#172c26"
              : "#fff1cf"
        }
        fontFamily="Georgia, serif"
        fontSize="13"
        fontWeight="bold"
        stroke={team === "w" ? "#fff1cf" : "#172c26"}
        strokeWidth=".7"
        paintOrder="stroke"
      >
        {cardLabel(card)}
      </text>
    </svg>
  );
}
function CardPicker({
  side,
  team,
  card,
  onChange,
}: {
  side: Side;
  team: Team;
  card: FighterCard;
  onChange: (c: FighterCard) => void;
}) {
  const kit = fighterKit(card),
    title = side === 0 ? "내 카드" : "상대 카드";
  return (
    <section
      className={`duel-pick ${side === 1 ? "rival" : ""}`}
      aria-label={title}
    >
      <div className="duel-pick-heading">
        <span>{side === 0 ? "PLAYER 01" : "COMPUTER"}</span>
        <h2>
          {title} · {TEAM_LABEL[team]}
        </h2>
        <strong style={{ color: kit.color }}>{kit.name}</strong>
      </div>
      <div className="duel-pick-body">
        <div className="duel-portrait">
          <FighterArt card={card} team={team} opponent={side === 1} />
          <span className="duel-floor-shadow" />
        </div>
        <div className="duel-selectors">
          <label>
            기물
            <select
              aria-label={`${title} 기물`}
              value={card.role}
              onChange={(e) =>
                onChange({
                  ...card,
                  role: e.target.value as FighterCard["role"],
                })
              }
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            문양
            <select
              aria-label={`${title} 문양`}
              value={card.suit}
              onChange={(e) => {
                const suit = e.target.value as DuelSuit;
                onChange({
                  ...card,
                  suit,
                  rank: suit === "J" ? 1 : card.suit === "J" ? 9 : card.rank,
                });
              }}
            >
              {Object.entries(SUIT_LABELS).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            {card.suit === "J" ? "조커 번호" : "숫자"}
            <select
              aria-label={`${title} 숫자`}
              value={card.rank}
              onChange={(e) =>
                onChange({ ...card, rank: Number(e.target.value) })
              }
            >
              {(card.suit === "J"
                ? [1, 2]
                : Array.from({ length: 13 }, (_, i) => i + 2)
              ).map((n) => (
                <option value={n} key={n}>
                  {card.suit === "J" ? n : rankLabel(n)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="duel-traits">
        <span>체력 100</span>
        <span>{kit.roleTrait}</span>
        <span>{kit.guardName}</span>
        <span>이동 {Math.round((kit.speed / 1.8) * 100)}%</span>
      </div>
      <dl className="duel-move-list">
        {(["basic", "combo", "special"] as const).map((k, i) => (
          <div key={k}>
            <dt>
              <kbd>{["J", "K", "I"][i]}</kbd>
              {kit.moves[k].name}
            </dt>
            <dd>
              {kit.moves[k].levels.map((l) => LEVEL_LABELS[l]).join(" → ")}
              <b>{displayDamage(kit.moves[k])}</b>
            </dd>
          </div>
        ))}
        <div>
          <dt>
            <kbd>L</kbd>방어 유지
          </dt>
          <dd>서서 상·중 / 앉아서 하</dd>
        </div>
      </dl>
    </section>
  );
}
function HoldButton({
  name,
  children,
  onHold,
  className = "",
}: {
  name: string;
  children: React.ReactNode;
  onHold: (held: boolean) => void;
  className?: string;
}) {
  const held = useRef(false);
  const release = () => {
    if (held.current) {
      held.current = false;
      onHold(false);
    }
  };
  return (
    <button
      type="button"
      className={`duel-hold ${className}`}
      aria-label={name}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        held.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          release();
      }}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          held.current = true;
          onHold(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          release();
        }
      }}
      onBlur={release}
    >
      {children}
    </button>
  );
}
function ActionButton({
  children,
  onAction,
  className = "",
  unavailable = false,
}: {
  children: React.ReactNode;
  onAction: () => void;
  className?: string;
  unavailable?: boolean;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-disabled={unavailable || undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onAction();
      }}
      onClick={(e) => {
        if (e.detail === 0) onAction();
      }}
    >
      {children}
    </button>
  );
}
function useDuelSound() {
  const context = useRef<AudioContext | null>(null);
  const enabled = useRef(true);
  useEffect(
    () => () => {
      void context.current?.close();
    },
    [],
  );
  function unlock() {
    if (!enabled.current) return;
    try {
      context.current ??= new AudioContext();
      void context.current.resume().catch(() => {});
    } catch {
      /* Visual feedback remains available. */
    }
  }
  function play(type: string) {
    const ctx = context.current;
    if (!ctx || !enabled.current || ctx.state !== "running") return;
    const frequencies: Record<string, number> = {
      hit: 110,
      block: 430,
      special: 660,
      finish: 220,
      dodge: 250,
      miss: 180,
      start: 520,
    };
    const osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      now = ctx.currentTime;
    osc.type = type === "special" || type === "finish" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(frequencies[type] || 220, now);
    osc.frequency.exponentialRampToValueAtTime(
      type === "special" ? 880 : 60,
      now + 0.12,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }
  return { unlock, play, enabled };
}
export function DuelLab({
  motion,
  onClose,
}: {
  motion: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [cards, setCards] = useState<[FighterCard, FighterCard]>(initialCards);
  const [playerTeam, setPlayerTeam] = useState<Team>(initialTeam);
  const teams: [Team, Team] = [playerTeam, playerTeam === "w" ? "b" : "w"];
  useEffect(() => {
    try {
      localStorage.setItem(TEAM_STORAGE, playerTeam);
    } catch {
      /* Optional preference. */
    }
  }, [playerTeam]);
  const [mode, setMode] = useState<OpponentMode>("ai"),
    [fullMeter, setFullMeter] = useState(false);
  const [route, setRoute] = useState<"setup" | "arena">("setup");
  const [paused, setPaused] = useState(false),
    [confirmExit, setConfirmExit] = useState(false);
  const [soundOn, setSoundOn] = useState(initialSound),
    [toast, setToast] = useState("");
  const [resultVisible, setResultVisible] = useState(false),
    [frame, setFrame] = useState(0),
    [bout, setBout] = useState(0);
  const battle = useRef<DuelState | null>(null),
    pausedRef = useRef(false),
    routeRef = useRef(route);
  const keyboard = useRef(new Set<string>()),
    touch = useRef(emptyInput());
  const lastEvent = useRef(0),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishElapsed = useRef(0);
  const finishPoses = useRef<number[]>([0, 0]);
  const audio = useDuelSound(),
    audioRef = useRef(audio);
  audio.enabled.current = soundOn;
  useEffect(() => {
    try {
      localStorage.setItem(SOUND_STORAGE, soundOn ? "on" : "off");
    } catch {
      /* Optional preference. */
    }
  }, [soundOn]);
  audioRef.current = audio;
  routeRef.current = route;
  const resetControls = () => {
    keyboard.current.clear();
    touch.current = emptyInput();
    if (battle.current) clearInputs(battle.current);
  };
  const pause = () => {
    if (routeRef.current !== "arena" || battle.current?.phase === "finished")
      return;
    pausedRef.current = true;
    setPaused(true);
    resetControls();
  };
  const resume = () => {
    resetControls();
    pausedRef.current = false;
    setPaused(false);
    setConfirmExit(false);
    audioRef.current.unlock();
  };
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1500);
  };
  function start() {
    resetControls();
    battle.current = createDuel(cards[0], cards[1], mode, fullMeter);
    lastEvent.current = 0;
    finishElapsed.current = 0;
    finishPoses.current = [0, 0];
    setResultVisible(false);
    setConfirmExit(false);
    setPaused(false);
    pausedRef.current = false;
    setToast("");
    audioRef.current.unlock();
    audioRef.current.play("start");
    setBout((v) => v + 1);
    setRoute("arena");
    try {
      localStorage.setItem(STORAGE, JSON.stringify(cards));
    } catch {
      /* Lab settings are optional. */
    }
  }
  function setup() {
    resetControls();
    battle.current = null;
    pausedRef.current = false;
    setPaused(false);
    setConfirmExit(false);
    setResultVisible(false);
    setRoute("setup");
  }
  function action(kind: ActionKind) {
    const s = battle.current;
    if (!s || pausedRef.current || s.phase !== "fight") return;
    const down =
      touch.current.down ||
      keyboard.current.has("KeyS") ||
      keyboard.current.has("ArrowDown");
    if (!queueAction(s, 0, kind === "basic" && down ? "sweep" : kind)) {
      if (kind === "special" && s.fighters[0].meter < 100)
        notify("필살기 게이지 100이 필요합니다.");
      else if (s.fighters[0].guard) notify("방어를 놓은 뒤 공격하세요.");
    }
  }
  const actionRef = useRef(action);
  actionRef.current = action;
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = old;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const loseFocus = () => pause();
    const visibility = () => {
      if (document.hidden) pause();
    };
    const down = (e: KeyboardEvent) => {
      if (routeRef.current !== "arena") return;
      if (e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        pause();
        return;
      }
      if (pausedRef.current || battle.current?.phase === "finished") return;
      if ((e.target as HTMLElement).closest("select,input,textarea")) return;
      if (
        [
          "KeyA",
          "KeyD",
          "KeyS",
          "ArrowLeft",
          "ArrowRight",
          "ArrowDown",
          "KeyJ",
          "KeyK",
          "KeyL",
          "KeyI",
        ].includes(e.code)
      ) {
        e.preventDefault();
        keyboard.current.add(e.code);
        if (!e.repeat) {
          if (e.code === "KeyJ") actionRef.current("basic");
          if (e.code === "KeyK") actionRef.current("combo");
          if (e.code === "KeyI") actionRef.current("special");
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      keyboard.current.delete(e.code);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", loseFocus);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("orientationchange", loseFocus);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", loseFocus);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("orientationchange", loseFocus);
    };
  }, []);
  useEffect(() => {
    if (route !== "arena") return;
    let raf = 0,
      previous = 0,
      accumulator = 0,
      lastPaint = 0;
    const animate = (now: number) => {
      const s = battle.current;
      if (!s) return;
      if (previous && now - previous > 1000 && s.phase !== "finished") pause();
      const dt = previous ? Math.min(100, now - previous) : 0;
      previous = now;
      if (!pausedRef.current && s.phase !== "finished") {
        accumulator += dt;
        const k = keyboard.current,
          t = touch.current;
        const input: Input = {
          left: t.left || k.has("KeyA") || k.has("ArrowLeft"),
          right: t.right || k.has("KeyD") || k.has("ArrowRight"),
          down: t.down || k.has("KeyS") || k.has("ArrowDown"),
          guard: t.guard || k.has("KeyL"),
        };
        while (accumulator >= 10) {
          const poses = s.fighters.map((f) => fighterPose(f, s.elapsed));
          advanceDuel(s, input, 10);
          // advanceDuel mutates phase; stop here to retain the final attack pose.
          if ((s as DuelState).phase === "finished") {
            finishPoses.current = poses;
            resetControls();
            accumulator = 0;
            break;
          }
          accumulator -= 10;
        }
      } else accumulator = 0;
      for (const e of s.events.filter((e) => e.id > lastEvent.current)) {
        audioRef.current.play(e.type);
        lastEvent.current = e.id;
      }
      if (s.phase === "finished" && !document.hidden) {
        finishElapsed.current = Math.min(
          FINISH_DURATION,
          finishElapsed.current + dt,
        );
        if (finishElapsed.current >= FINISH_DURATION) setResultVisible(true);
      }
      if (now - lastPaint >= 30) {
        setFrame((v) => v + 1);
        lastPaint = now;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [route, bout]);
  useEffect(() => {
    if (!paused && !resultVisible) return;
    const panel = dialog.current?.querySelector<HTMLElement>(
      ".duel-overlay .duel-panel",
    );
    panel?.querySelector<HTMLElement>("button")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>("button,summary"),
      );
      const first = items[0],
        last = items.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, [paused, resultVisible, confirmExit]);
  const s = battle.current;
  const setHeld = (key: keyof Input, value: boolean) => {
    if (pausedRef.current) return;
    touch.current[key] = value;
  };
  const changeCard = (side: Side, card: FighterCard) =>
    setCards((old) => (side === 0 ? [card, old[1]] : [old[0], card]));
  const endTitle =
    s?.winner === null
      ? "무승부"
      : s?.winner === 0
        ? "일기토 승리"
        : "일기토 패배";
  const lastHit = s?.events.filter((e) => e.type === "hit").at(-1);
  const endReason =
    s?.reason === "time"
      ? `시간 종료 · 내 체력 ${(s.fighters[0].hp / 100).toFixed(2)} / 상대 ${(s.fighters[1].hp / 100).toFixed(2)}`
      : s?.winner === null
        ? "동시 KO · 두 병사가 함께 쓰러졌습니다."
        : lastHit
          ? `${lastHit.actor === 0 ? "내" : "상대"} ${lastHit.move} · ${LEVEL_LABELS[lastHit.level!]}단 명중으로 KO`
          : "KO";
  return (
    <dialog
      ref={dialog}
      className={`duel-lab ${motion ? "" : "duel-reduced"}`}
      aria-label="카드 일기토 테스트"
      onCancel={(e) => {
        e.preventDefault();
        if (route === "arena" && s?.phase !== "finished") pause();
        else if (route === "arena") setup();
        else onClose();
      }}
    >
      <div className="duel-shell">
        <header className="duel-header">
          <div>
            <span className="duel-eyebrow">
              JOKER’S MATE / THE ROYAL GARDEN
            </span>
            <h1>
              카드 일기토 <small>테스트</small>
            </h1>
          </div>
          <button
            className="duel-close"
            aria-label="설정으로"
            onClick={() => {
              if (route === "arena" && s?.phase !== "finished") {
                pause();
                setConfirmExit(true);
              } else onClose();
            }}
          >
            설정으로 <span>↗</span>
          </button>
        </header>
        {route === "setup" ? (
          <div className="duel-setup">
            <div className="duel-introduction">
              <span className="duel-eyebrow">CHOOSE YOUR CHAMPIONS</span>
              <h2>오늘, 어떤 카드가 싸울까요?</h2>
              <p>기물의 전투 방식에 숫자의 연계 기술과 문양 특성을 더합니다.</p>
            </div>
            <div className="duel-roster">
              <CardPicker
                side={0}
                team={teams[0]}
                card={cards[0]}
                onChange={(c) => changeCard(0, c)}
              />
              <span className="duel-versus">VS</span>
              <CardPicker
                side={1}
                team={teams[1]}
                card={cards[1]}
                onChange={(c) => changeCard(1, c)}
              />
            </div>
            <section className="duel-options" aria-label="대결 테스트 옵션">
              <label>
                내 진영 · 상대는 반대색
                <select
                  aria-label="내 진영"
                  value={playerTeam}
                  onChange={(e) => setPlayerTeam(e.target.value as Team)}
                >
                  <option value="w">나 백 / 상대 흑</option>
                  <option value="b">나 흑 / 상대 백</option>
                </select>
              </label>
              <label>
                상대 행동
                <select
                  aria-label="상대 행동"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as OpponentMode)}
                >
                  {Object.entries(MODES).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="duel-check">
                <input
                  type="checkbox"
                  checked={fullMeter}
                  onChange={(e) => setFullMeter(e.target.checked)}
                />
                필살기 100으로 시작
              </label>
              <label className="duel-check">
                <input
                  type="checkbox"
                  checked={soundOn}
                  onChange={(e) => {
                    setSoundOn(e.target.checked);
                    audio.enabled.current = e.target.checked;
                  }}
                />
                효과음
              </label>
            </section>
            <div className="duel-start-row">
              <p>60초 · 체력 100 · 본편 금화와 진행에 영향 없음</p>
              <button
                className="duel-primary"
                aria-label="대결 시작"
                onClick={start}
              >
                대결 시작 <span>→</span>
              </button>
            </div>
            <details className="duel-help">
              <summary>조작과 방어 방법</summary>
              <p>
                A/D 또는 ←/→ 이동 · S/↓ 앉기 · J 기본기 · K 콤보 · L 유지 방어 ·
                I 필살기 · Esc 일시정지
              </p>
              <p>
                S+J: 하단 쓸기 · S+L: 하단 방어. 서서 상·중단을 막고, 앉아서
                하단을 막습니다. 모바일은 방향과 기술 버튼을 함께 누르세요.
              </p>
            </details>
          </div>
        ) : (
          s && (
            <div className="duel-match" data-phase={s.phase} data-frame={frame}>
              <div className="duel-hud">
                {s.fighters.map((f, i) => (
                  <section
                    key={i}
                    className={`duel-health ${i === 1 ? "rival" : ""}`}
                    aria-label={i === 0 ? "내 상태" : "상대 상태"}
                  >
                    <div className="duel-hud-name">
                      <span>
                        {i === 0
                          ? "나"
                          : mode === "ai"
                            ? "상대 AI"
                            : "연습 상대"}
                        {` · ${TEAM_LABEL[teams[i]]}`}
                      </span>
                      <b style={{ color: f.kit.color }}>{f.kit.name}</b>
                      <small>
                        {ROLES.find((r) => r.value === f.kit.card.role)?.name}
                      </small>
                    </div>
                    <div
                      className={`duel-health-track ${f.hp <= 2000 ? "critical" : f.hp <= 5000 ? "warning" : ""}`}
                      role="progressbar"
                      aria-label={i === 0 ? "내 체력" : "상대 체력"}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={f.hp / 100}
                    >
                      <span
                        className="duel-health-echo"
                        style={{ width: `${f.hp / 100}%` }}
                      />
                      <span
                        className="duel-health-fill"
                        style={{ width: `${f.hp / 100}%` }}
                      />
                      <i />
                    </div>
                    <div className="duel-hud-numbers">
                      <span>
                        {hp(f.hp)} <small>/ 100</small>
                      </span>
                      <span className={f.meter === 100 ? "ready" : ""}>
                        {f.meter === 100
                          ? "필살기 준비"
                          : `필살 ${f.meter}/100`}
                      </span>
                    </div>
                    <div
                      className={`duel-meter ${f.meter === 100 ? "ready" : ""}`}
                      role="progressbar"
                      aria-label={
                        i === 0 ? "내 필살기 게이지" : "상대 필살기 게이지"
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={f.meter}
                    >
                      <span style={{ width: `${f.meter}%` }} />
                      <i />
                    </div>
                  </section>
                ))}
                <div
                  className={`duel-timer ${s.elapsed >= 50000 ? "urgent" : ""}`}
                >
                  <small>ROUND 01</small>
                  <strong aria-label="남은 시간">
                    {Math.ceil((60000 - s.elapsed) / 1000)}
                  </strong>
                  <button aria-label="일시정지" onClick={pause}>
                    Ⅱ
                  </button>
                </div>
              </div>
              <div
                className={`duel-arena ${s.phase === "finished" ? "ended" : ""}`}
                style={{ backgroundImage: `url(${ART}garden.png)` }}
                aria-label="왕실 정원 결투 회랑"
              >
                <div className="duel-arena-vignette" />
                <div className="duel-stage-label">
                  왕실 정원 <span>· 결투 회랑</span>
                </div>
                {s.fighters.map((f, i) => {
                  const recent = s.events
                    .filter(
                      (e) =>
                        e.target === i &&
                        s.clock - e.clock < 600 &&
                        ["hit", "block", "dodge"].includes(e.type),
                    )
                    .at(-1);
                  const ending = s.phase === "finished";
                  const pose = ending
                    ? f.hp === 0
                      ? !motion || finishElapsed.current >= 950
                        ? 7
                        : 6
                      : finishElapsed.current < 220
                        ? finishPoses.current[i]
                        : 0
                    : fighterPose(f, s.elapsed);
                  return (
                    <div
                      key={i}
                      className={`duel-fighter ${i === 1 ? "enemy" : ""} ${f.moving ? "walking" : ""} ${f.hp === 0 ? "knocked-out finishing-loss" : ""} ${s.phase === "finished" && s.winner === i ? "winner" : ""} ${recent?.type === "hit" && !ending ? "struck" : ""} ${f.attack?.move.id === "sweep" ? "sweeping" : ""}`}
                      data-pose={pose}
                      style={
                        {
                          left: `calc(16% + ${(f.x / 8) * 68}% + var(--duel-separation))`,
                          "--fighter-color": f.kit.color,
                          "--duel-finish-delay": `-${finishElapsed.current}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="duel-floor-shadow" />
                      <FighterArt
                        card={f.kit.card}
                        team={teams[i]}
                        opponent={i === 1}
                        pose={pose}
                      />
                      {f.guard && (
                        <span
                          className={`duel-guard-arc ${f.down ? "low" : ""}`}
                        />
                      )}
                      {recent && (!ending || finishElapsed.current < 220) && (
                        <span
                          key={recent.id}
                          className={`duel-impact ${recent.type}`}
                          style={{
                            bottom:
                              recent.level === "high"
                                ? "68%"
                                : recent.level === "low"
                                  ? "12%"
                                  : "40%",
                          }}
                        >
                          {recent.type === "hit"
                            ? "✦"
                            : recent.type === "block"
                              ? "◈"
                              : "↘"}
                        </span>
                      )}
                      {recent && !ending && (
                        <span
                          key={`n${recent.id}`}
                          className={`duel-damage ${recent.type}`}
                        >
                          {effectLabels[recent.type]}
                          {recent.damage > 0 ? ` −${recent.damage / 100}` : ""}
                        </span>
                      )}
                      <div className="duel-fighter-tag">
                        {i === 0 ? "나" : "상대"} · {TEAM_LABEL[teams[i]]}{" "}
                        <b>{f.kit.name}</b>
                      </div>
                      {f.attack && (
                        <div className="duel-technique">
                          {f.attack.move.name}
                          <span>
                            {f.attack.move.levels
                              .map((l) => LEVEL_LABELS[l])
                              .join(" → ")}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {s.phase === "countdown" && (
                  <div className="duel-countdown" aria-live="polite">
                    <small>READY</small>
                    <strong>{Math.ceil(s.countdown / 1000)}</strong>
                    <p>J 기본기 · K 콤보 · L 방어 · I 필살기</p>
                  </div>
                )}
                {s.phase === "fight" && s.elapsed < 500 && (
                  <div className="duel-go">시작!</div>
                )}
                {s.events
                  .filter(
                    (e) => e.type === "special" && s.clock - e.clock < 550,
                  )
                  .slice(-1)
                  .map((e) => (
                    <div key={e.id} className="duel-special-banner">
                      <small>{e.actor === 0 ? "나" : "상대"} · 필살기</small>
                      <strong>{e.move}</strong>
                    </div>
                  ))}
                {s.phase === "finished" &&
                  !resultVisible &&
                  finishElapsed.current >= 950 && (
                    <div className="duel-finish-caption" role="status">
                      <strong>
                        {s.reason === "time"
                          ? "TIME UP"
                          : s.winner === null
                            ? "DOUBLE K.O."
                            : "K.O."}
                      </strong>
                      <span>{endTitle}</span>
                    </div>
                  )}
              </div>
              <div className="duel-controls" aria-label="대결 조작">
                <div className="duel-direction">
                  <HoldButton
                    name="왼쪽 이동"
                    onHold={(v) => setHeld("left", v)}
                  >
                    ←<kbd>A</kbd>
                  </HoldButton>
                  <HoldButton name="앉기" onHold={(v) => setHeld("down", v)}>
                    ↓<kbd>S</kbd>
                  </HoldButton>
                  <HoldButton
                    name="오른쪽 이동"
                    onHold={(v) => setHeld("right", v)}
                  >
                    →<kbd>D</kbd>
                  </HoldButton>
                </div>
                <div className="duel-control-note">
                  <b>{MODES[mode]}</b>
                  <span>L 유지 방어 · S+L 하단 방어</span>
                  <small>S+J 하단 쓸기 · 거리 {distance(s).toFixed(1)}</small>
                </div>
                <div className="duel-actions">
                  <ActionButton onAction={() => action("basic")}>
                    <kbd>J</kbd>
                    <span>{s.fighters[0].kit.moves.basic.name}</span>
                    <small>
                      {displayDamage(s.fighters[0].kit.moves.basic)}
                    </small>
                  </ActionButton>
                  <ActionButton onAction={() => action("combo")}>
                    <kbd>K</kbd>
                    <span>콤보</span>
                    <small>
                      {displayDamage(s.fighters[0].kit.moves.combo)}
                    </small>
                  </ActionButton>
                  <HoldButton
                    name="방어 유지"
                    className="duel-guard-button"
                    onHold={(v) => setHeld("guard", v)}
                  >
                    <kbd>L</kbd>
                    <span>방어</span>
                    <small>길게 유지</small>
                  </HoldButton>
                  <ActionButton
                    className={`duel-special-button ${s.fighters[0].meter === 100 ? "ready" : ""}`}
                    unavailable={s.fighters[0].meter < 100}
                    onAction={() => action("special")}
                  >
                    <kbd>I</kbd>
                    <span>필살기</span>
                    <small>
                      {s.fighters[0].meter === 100
                        ? "준비 완료"
                        : `${s.fighters[0].meter} / 100`}
                    </small>
                  </ActionButton>
                </div>
              </div>
              {toast && (
                <div className="duel-toast" role="status">
                  {toast}
                </div>
              )}
              {paused && (
                <div className="duel-overlay">
                  <section
                    className="duel-panel"
                    role="alertdialog"
                    aria-modal="true"
                    aria-label="대결 일시정지"
                  >
                    <span className="duel-eyebrow">PAUSED</span>
                    <h2>
                      {confirmExit ? "대결을 종료할까요?" : "잠시 쉬어갑니다"}
                    </h2>
                    <p>대결 시간과 상대의 움직임이 멈췄습니다.</p>
                    <button className="duel-primary" autoFocus onClick={resume}>
                      계속하기
                    </button>
                    {confirmExit ? (
                      <>
                        <button onClick={setup}>종료하고 카드 선택</button>
                        <button onClick={onClose}>종료하고 설정으로</button>
                      </>
                    ) : (
                      <>
                        <p className="duel-pause-help">
                          A/D 이동 · S 앉기
                          <br />J 기본기 · K 콤보 · L 유지 방어
                          <br />
                          S+L 하단 방어 · S+J 하단 쓸기 · I 필살기
                        </p>
                        <button onClick={() => setConfirmExit(true)}>
                          대결 종료
                        </button>
                      </>
                    )}
                  </section>
                </div>
              )}
              {s.phase === "finished" && resultVisible && (
                <div className="duel-overlay">
                  <section
                    className="duel-panel duel-result"
                    role="region"
                    aria-label="일기토 결과"
                  >
                    <span className="duel-eyebrow">DUEL COMPLETE</span>
                    <h2>{endTitle}</h2>
                    <p>
                      {s.fighters[0].kit.name} <span>vs</span>{" "}
                      {s.fighters[1].kit.name}
                    </p>
                    <p className="duel-verdict">{endReason}</p>
                    <table>
                      <thead>
                        <tr>
                          <th>기록</th>
                          <th>나</th>
                          <th>상대</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <th>남은 체력</th>
                          {s.fighters.map((f, i) => (
                            <td key={i}>{f.hp / 100}</td>
                          ))}
                        </tr>
                        <tr>
                          <th>준 피해</th>
                          {s.fighters.map((f, i) => (
                            <td key={i}>{f.stats.damage / 100}</td>
                          ))}
                        </tr>
                        <tr>
                          <th>명중 / 방어</th>
                          {s.fighters.map((f, i) => (
                            <td key={i}>
                              {f.stats.hits} / {f.stats.blocks}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <th>필살기</th>
                          {s.fighters.map((f, i) => (
                            <td key={i}>{f.stats.specials}회</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    <details>
                      <summary>
                        경기 상세 · {(s.elapsed / 1000).toFixed(1)}초
                      </summary>
                      <ol className="duel-event-log">
                        {s.events
                          .filter((e) => e.type !== "finish")
                          .map((e) => (
                            <li key={e.id}>
                              <time>{(e.at / 1000).toFixed(1)}초</time>{" "}
                              {e.actor === 0 ? "나" : "상대"} · {e.move} ·{" "}
                              {effectLabels[e.type]}
                              {e.damage ? ` −${e.damage / 100}` : ""}
                            </li>
                          ))}
                      </ol>
                    </details>
                    <button className="duel-primary" onClick={start}>
                      같은 카드로 다시 대결
                    </button>
                    <button onClick={setup}>카드 다시 선택</button>
                    <button onClick={onClose}>설정으로 돌아가기</button>
                  </section>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </dialog>
  );
}
