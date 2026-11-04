import type { ChessRole } from "../Checard";

export type DuelSuit = "H" | "S" | "D" | "C" | "J";
export type Level = "high" | "mid" | "low";
export type ActionKind = "basic" | "combo" | "sweep" | "special";
export interface FighterCard {
  role: ChessRole;
  suit: DuelSuit;
  rank: number;
}
export interface Technique {
  id: ActionKind;
  name: string;
  levels: Level[];
  damage: number[];
  range: number;
  startup: number;
  interval: number;
  recovery: number;
  animation: "punch" | "kick" | "sweep";
  finisherAnimation?: "punch" | "kick" | "sweep";
}
export interface FighterKit {
  formulaVersion: 2;
  card: FighterCard;
  name: string;
  roleName: string;
  roleTrait: string;
  prefix: string;
  color: string;
  speed: number;
  guardName: string;
  guardLevel: Level | "all";
  guardScale: number;
  moves: Record<ActionKind, Technique>;
}
export const ROLES: { value: ChessRole; name: string; row: number }[] = [
  { value: "p", name: "폰", row: 0 },
  { value: "n", name: "나이트", row: 1 },
  { value: "b", name: "비숍", row: 2 },
  { value: "r", name: "룩", row: 3 },
  { value: "q", name: "퀸", row: 4 },
  { value: "k", name: "킹", row: 5 },
];
export const SUIT_LABELS: Record<DuelSuit, string> = {
  H: "♥ 하트",
  S: "♠ 스페이드",
  D: "♦ 다이아",
  C: "♣ 클럽",
  J: "조커",
};
export const LEVEL_LABELS: Record<Level, string> = {
  high: "상",
  mid: "중",
  low: "하",
};
export const rankLabel = (rank: number) =>
  (({ 11: "J", 12: "Q", 13: "K", 14: "A" }) as Record<number, string>)[rank] ||
  String(rank);
export const cardLabel = (card: FighterCard) =>
  card.suit === "J"
    ? `조커 ${card.rank}`
    : `${SUIT_LABELS[card.suit][0]} ${rankLabel(card.rank)}`;
const suits = {
  H: {
    prefix: "홍련",
    color: "#cf756a",
    speed: 1.05,
    damage: 1,
    range: 1,
    startup: 1,
    recovery: 1,
    guard: "high" as const,
    guardScale: 0.75,
    guardName: "상단 방어 특화",
  },
  S: {
    prefix: "흑영",
    color: "#b3b7cc",
    speed: 1,
    damage: 0.95,
    range: 1,
    startup: 0.9,
    recovery: 1.05,
    guard: "mid" as const,
    guardScale: 0.75,
    guardName: "중단 방어 특화",
  },
  D: {
    prefix: "수정",
    color: "#8cc5cc",
    speed: 1,
    damage: 0.95,
    range: 1.12,
    startup: 1.1,
    recovery: 1.05,
    guard: "low" as const,
    guardScale: 0.75,
    guardName: "하단 방어 특화",
  },
  C: {
    prefix: "철목",
    color: "#a6b97a",
    speed: 0.95,
    damage: 1.1,
    range: 0.95,
    startup: 1.1,
    recovery: 1.15,
    guard: "all" as const,
    guardScale: 0.9,
    guardName: "안정 방어",
  },
};
type Basic = [string, Level, number, number, number, number];
const basics: Record<string, Basic> = {
  P: ["정권", "mid", 6, 1, 120, 220],
  J: ["빠른 잽", "high", 4, 0.9, 90, 180],
  L: ["하단 차기", "low", 5, 1.1, 200, 300],
  E: ["팔꿈치", "mid", 8, 0.75, 180, 320],
  T: ["긴 찌르기", "mid", 5, 1.25, 220, 320],
};
interface RoleStyle {
  name: string;
  trait: string;
  basic: Basic | null;
  animation: Technique["animation"] | null;
  finisher: Level | null;
  damage: number;
  range: number;
  startup: number;
  recovery: number;
  comboInterval: number;
  specialInterval: number;
  speed: number;
}
// Percentages use integer arithmetic, then round only the final combined value.
const roleStyles: Record<ChessRole, RoleStyle> = {
  p: {
    name: "폰",
    trait: "속공 · 짧은 사거리, 빠른 중단 마무리",
    basic: ["보병 잽", "high", 4, 0.9, 90, 180],
    animation: "punch",
    finisher: "mid",
    damage: 90,
    range: 90,
    startup: 80,
    recovery: 85,
    comboInterval: 200,
    specialInterval: 260,
    speed: 105,
  },
  n: {
    name: "나이트",
    trait: "기동 · 하단 차기와 낮은 마무리",
    basic: ["측면 차기", "low", 5.5, 1.15, 170, 280],
    animation: "kick",
    finisher: "low",
    damage: 100,
    range: 105,
    startup: 105,
    recovery: 110,
    comboInterval: 260,
    specialInterval: 320,
    speed: 110,
  },
  b: {
    name: "비숍",
    trait: "견제 · 긴 찌르기, 상단 마무리",
    basic: ["사선 찌르기", "mid", 5, 1.4, 220, 330],
    animation: "punch",
    finisher: "high",
    damage: 90,
    range: 115,
    startup: 110,
    recovery: 105,
    comboInterval: 260,
    specialInterval: 330,
    speed: 100,
  },
  r: {
    name: "룩",
    trait: "강타 · 짧고 강한 공격, 긴 회복",
    basic: ["성벽 팔꿈치", "mid", 8, 0.75, 200, 340],
    animation: "punch",
    finisher: "mid",
    damage: 110,
    range: 85,
    startup: 120,
    recovery: 120,
    comboInterval: 280,
    specialInterval: 350,
    speed: 90,
  },
  q: {
    name: "퀸",
    trait: "변화 · 숫자 고유 기술과 높이 유지",
    basic: null,
    animation: null,
    finisher: null,
    damage: 100,
    range: 100,
    startup: 100,
    recovery: 100,
    comboInterval: 240,
    specialInterval: 300,
    speed: 100,
  },
  k: {
    name: "킹",
    trait: "압박 · 장타와 묵직한 중단 마무리",
    basic: ["왕관 장타", "mid", 7, 0.9, 180, 300],
    animation: "punch",
    finisher: "mid",
    damage: 105,
    range: 95,
    startup: 115,
    recovery: 110,
    comboInterval: 260,
    specialInterval: 330,
    speed: 95,
  },
};
type Row = [
  string,
  string,
  string,
  number[],
  number,
  number,
  number,
  string,
  number[],
  number,
];
// Basic, combo name, levels, damage, reach, startup, recovery, special name/damage/reach.
const rows: Record<number, Row> = {
  2: ["J", "쌍권", "HM", [4, 5], 1, 160, 280, "쌍성권", [10, 12], 1.25],
  3: [
    "L",
    "쓸어차기",
    "LM",
    [4, 6],
    1.15,
    240,
    380,
    "지면 연각",
    [10, 12],
    1.4,
  ],
  4: [
    "E",
    "팔꿈치 연격",
    "MM",
    [6, 6],
    0.9,
    220,
    380,
    "파쇄 연격",
    [12, 12],
    1.1,
  ],
  5: [
    "P",
    "교차 연격",
    "HL",
    [5, 5],
    1.2,
    240,
    380,
    "교차 섬격",
    [11, 11],
    1.45,
  ],
  6: [
    "T",
    "연속 찌르기",
    "MH",
    [4, 6],
    1.5,
    280,
    440,
    "관통 연권",
    [10, 12],
    1.8,
  ],
  7: [
    "J",
    "삼연권",
    "HMH",
    [3, 3, 4],
    1.1,
    200,
    420,
    "삼연 쇄권",
    [7, 7, 8],
    1.35,
  ],
  8: [
    "E",
    "무릎 연격",
    "ML",
    [7, 6],
    0.95,
    300,
    480,
    "철산 연격",
    [14, 12],
    1.15,
  ],
  9: [
    "P",
    "발차기 콤보",
    "HM",
    [5, 7],
    1.5,
    240,
    420,
    "삼단 연환각",
    [8, 8, 10],
    1.6,
  ],
  10: [
    "L",
    "이단 쓸기",
    "LL",
    [5, 6],
    1.3,
    300,
    460,
    "지면 파쇄각",
    [11, 13],
    1.55,
  ],
  11: [
    "J",
    "잔상 연권",
    "HHM",
    [3, 3, 3],
    1,
    160,
    340,
    "잔상 사연권",
    [5, 5, 6, 6],
    1.2,
  ],
  12: [
    "T",
    "교차 차기",
    "LH",
    [5, 5],
    1.4,
    280,
    420,
    "반월 교차각",
    [7, 8, 8],
    1.65,
  ],
  13: ["E", "왕관 강타", "M", [14], 1, 400, 600, "왕관 파쇄권", [28], 1.15],
  14: [
    "P",
    "정권 연계",
    "MM",
    [5, 5],
    1.15,
    220,
    360,
    "일섬 연권",
    [11, 11],
    1.4,
  ],
};
const levels = (value: string): Level[] =>
  [...value].map(
    (v) => (({ H: "high", M: "mid", L: "low" }) as const)[v as "H" | "M" | "L"],
  );
export function isFighterCard(value: unknown): value is FighterCard {
  if (!value || typeof value !== "object") return false;
  const c = value as FighterCard;
  return (
    ROLES.some((r) => r.value === c.role) &&
    Object.hasOwn(SUIT_LABELS, c.suit) &&
    Number.isInteger(c.rank) &&
    (c.suit === "J"
      ? c.rank === 1 || c.rank === 2
      : c.rank >= 2 && c.rank <= 14)
  );
}
export function fighterKit(card: FighterCard): FighterKit {
  if (!isFighterCard(card))
    throw new Error("올바른 기물·문양·숫자를 선택해 주세요.");
  const suit = card.suit === "J" ? (card.rank === 1 ? "S" : "D") : card.suit;
  const rank = card.suit === "J" ? (card.rank === 1 ? 5 : 7) : card.rank;
  const mod = suits[suit],
    row = rows[rank],
    role = roleStyles[card.role],
    basic = role.basic ?? basics[row[0]];
  const move = (
    id: ActionKind,
    name: string,
    lv: Level[],
    damage: number[],
    range: number,
    startup: number,
    interval: number,
    recovery: number,
    animation: Technique["animation"],
  ): Technique => {
    const linked = id === "combo" || id === "special";
    const rolePercent = (key: "damage" | "range" | "startup" | "recovery") =>
      linked ? role[key] : 100;
    return {
      id,
      name: linked && card.role !== "q" ? `${role.name} · ${name}` : name,
      levels: lv.map((level, i) =>
        linked && i === lv.length - 1 && role.finisher ? role.finisher : level,
      ),
      damage: damage.map((n) =>
        Math.round(
          (n * rolePercent("damage") * Math.round(mod.damage * 100)) / 100,
        ),
      ),
      range:
        Math.round(
          (range * rolePercent("range") * Math.round(mod.range * 100)) / 10,
        ) / 1000,
      startup: Math.round(
        (startup * rolePercent("startup") * Math.round(mod.startup * 100)) /
          10000,
      ),
      interval,
      recovery: Math.round(
        (recovery * rolePercent("recovery") * Math.round(mod.recovery * 100)) /
          10000,
      ),
      animation,
      finisherAnimation: linked ? (role.animation ?? undefined) : undefined,
    };
  };
  const kick = [3, 8, 9, 10, 12].includes(rank);
  const specialLevels =
    rank === 9 ? "HML" : rank === 11 ? "HHMH" : rank === 12 ? "LHM" : row[2];
  return {
    formulaVersion: 2,
    card: { ...card },
    name: cardLabel(card),
    roleName: role.name,
    roleTrait: role.trait,
    prefix: mod.prefix,
    color: mod.color,
    speed: (1.8 * mod.speed * role.speed) / 100,
    guardName: mod.guardName,
    guardLevel: mod.guard,
    guardScale: mod.guardScale,
    moves: {
      basic: move(
        "basic",
        basic[0],
        [basic[1]],
        [basic[2]],
        basic[3],
        basic[4],
        0,
        basic[5],
        role.animation ?? (row[0] === "L" ? "kick" : "punch"),
      ),
      sweep: move(
        "sweep",
        "하단 쓸기",
        ["low"],
        [4],
        0.9,
        260,
        0,
        400,
        "sweep",
      ),
      combo: move(
        "combo",
        row[1],
        levels(row[2]),
        row[3],
        row[4],
        row[5],
        role.comboInterval,
        row[6],
        kick ? "kick" : "punch",
      ),
      special: move(
        "special",
        `${mod.prefix} · ${row[7]}`,
        levels(specialLevels),
        row[8],
        row[9],
        350,
        role.specialInterval,
        650,
        kick ? "kick" : "punch",
      ),
    },
  };
}
export const displayDamage = (move: Technique) =>
  move.damage.map((n) => String(n / 100)).join(" + ");
export const duration = (move: Technique) =>
  move.startup + (move.levels.length - 1) * move.interval + move.recovery;
