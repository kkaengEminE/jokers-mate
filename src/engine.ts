import { Chess, type Color } from "chess.js";
import { deck, type Card, compare, evaluate } from "./poker";
export type Side = Color;
export const other = (s: Side): Side => (s === "w" ? "b" : "w");
export const sideName = (s: Side) => (s === "w" ? "플레이어" : "정원의 기사");
export type Pair = Record<Side, number>;
export interface Result {
  winner: Side | null;
  reason: string;
}
export interface Settlement {
  final: Pair;
  returned: Pair;
  award: Pair;
  protection: number;
  chessAward?: Pair;
  pot: number;
}
export interface Betting {
  turn: Side;
  acted: Side[];
  lastRaise: number;
  raiseLocked: Side | null;
  done: boolean;
  folded: Side | null;
  log: string[];
}
export interface Game {
  version: 2;
  economy?: "split-15-5" | "r3" | "r4";
  journey?: {
    opponent: "roan" | "emperor";
    screen: "play" | "prologue" | "ending" | "failed" | "complete";
  };
  abandoned?: boolean;
  id: string;
  round: number;
  phase: "lobby" | "chess" | "selection" | "betting" | "result";
  moves: string[];
  identities: Record<string, Card>;
  captured: Record<Side, Card[]>;
  banks: Pair;
  committed: Pair;
  chessResult: Result | null;
  chessReviewed?: boolean;
  hands: Record<Side, Card[]>;
  betting: Betting | null;
  result: Result | null;
  settlement: Settlement | null;
  achievements: string[];
}
export interface RecordEntry {
  economy?: Game["economy"];
  id: string;
  date: string;
  round: number;
  chess: string;
  poker: string;
  final: Pair;
  pgn: string;
  achievements: string[];
  hands: Record<Side, Card[]>;
  captured: Record<Side, Card[]>;
  settlement: Settlement;
}
export const entryFee = (economy?: Game["economy"]) =>
  economy === "r4" ? 50 : 20;
export const chessPool = (economy?: Game["economy"]) =>
  economy === "r4" ? 40 : 30;
export const CURRENT_ENTRY = 50;
export function shuffle<T>(a: T[], rng = Math.random): T[] {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function newGame(
  banks: Pair = { w: 1000, b: 1000 },
  round = 1,
  economy: Game["economy"] = "r4",
): Game {
  if (Math.min(banks.w, banks.b) < entryFee(economy))
    throw new Error("참가금이 부족합니다.");
  const kings = shuffle(deck().filter((c) => c.rank === 13)).slice(0, 2),
    queens = shuffle(deck().filter((c) => c.rank === 12)).slice(0, 2);
  const remaining = shuffle(
    deck().filter((c) => ![...kings, ...queens].some((x) => x.id === c.id)),
  );
  const identities: Record<string, Card> = {
    e1: kings[0],
    e8: kings[1],
    d1: queens[0],
    d8: queens[1],
  };
  for (const row of new Chess().board())
    for (const piece of row)
      if (piece && !identities[piece.square])
        identities[piece.square] = remaining.pop()!;
  return {
    version: 2,
    economy,
    id: crypto.randomUUID(),
    round,
    phase: "chess",
    moves: [],
    identities,
    captured: { w: [], b: [] },
    banks: { ...banks },
    committed: { w: entryFee(economy), b: entryFee(economy) },
    chessResult: null,
    hands: { w: [], b: [] },
    betting: null,
    result: null,
    settlement: null,
    achievements: [],
  };
}
export function newLobby(
  banks: Pair = { w: 1000, b: 1000 },
  round = 1,
  economy: Game["economy"] = "r4",
): Game {
  return {
    ...newGame(banks, round, economy),
    phase: "lobby",
    committed: { w: 0, b: 0 },
  };
}
export function enterGame(g: Game): Game {
  if (g.phase !== "lobby" || g.committed.w || g.committed.b)
    throw new Error("이미 참가한 판입니다.");
  return {
    ...g,
    phase: "chess",
    committed: { w: entryFee(g.economy), b: entryFee(g.economy) },
  };
}
export function chessOf(game: Pick<Game, "moves">): Chess {
  const c = new Chess();
  for (const move of game.moves) c.move(move);
  return c;
}
export function survivors(
  chess: Chess,
  ids: Record<string, Card>,
  side: Side,
): Card[] {
  return chess
    .board()
    .flat()
    .filter((p) => p?.color === side)
    .map((p) => ids[p!.square])
    .filter(Boolean);
}
export function chessEnd(chess: Chess): Result | null {
  const mover = other(chess.turn());
  if (chess.isCheckmate()) return { winner: mover, reason: "체크메이트" };
  const counts = { w: 0, b: 0 };
  for (const p of chess.board().flat()) if (p) counts[p.color]++;
  if (Math.min(counts.w, counts.b) < 5)
    throw new Error("5기물 경계를 넘은 잘못된 상태입니다.");
  if (counts.w === 5 || counts.b === 5)
    return {
      winner: chess.isCheck() ? mover : null,
      reason: chess.isCheck() ? "5기물 · 체크 승리" : "5기물 · 무승부",
    };
  if (chess.isStalemate()) return { winner: null, reason: "스테일메이트" };
  if (chess.isThreefoldRepetition())
    return { winner: null, reason: "3회 반복 무승부" };
  if (chess.isDrawByFiftyMoves())
    return { winner: null, reason: "50수 무승부" };
  if (chess.isInsufficientMaterial())
    return { winner: null, reason: "기물 부족 무승부" };
  return null;
}
export function applyMove(
  g: Game,
  input: { from: string; to: string; promotion?: string } | string,
): Game {
  if (g.phase !== "chess") throw new Error("체스가 종료되었습니다.");
  const c = chessOf(g),
    m = c.move(input),
    n: Game = structuredClone(g);
  const captureSquare = m.isEnPassant() ? `${m.to[0]}${m.from[1]}` : m.to;
  if (m.captured) {
    const card = n.identities[captureSquare];
    if (!card) throw new Error("캡처 카드 누락");
    n.captured[m.color].push(card);
    delete n.identities[captureSquare];
  }
  n.identities[m.to] = n.identities[m.from];
  delete n.identities[m.from];
  if (m.isKingsideCastle() || m.isQueensideCastle()) {
    const rank = m.from[1],
      from = `${m.isKingsideCastle() ? "h" : "a"}${rank}`,
      to = `${m.isKingsideCastle() ? "f" : "d"}${rank}`;
    n.identities[to] = n.identities[from];
    delete n.identities[from];
  }
  n.moves.push(m.san);
  const award = (label: string) => {
    if (m.color === "w" && !n.achievements.includes(label))
      n.achievements.push(label);
  };
  if (m.isKingsideCastle() || m.isQueensideCastle())
    award("왕의 피난처 · 캐슬링");
  if (m.isEnPassant()) award("스쳐간 기회 · 앙파상");
  if (m.promotion) award("새로운 왕관 · 승격");
  const opening = n.moves.join(" ");
  if (opening === "e4 c5" && !n.achievements.includes("시실리안 디펜스"))
    n.achievements.push("시실리안 디펜스");
  if (opening === "e4 e5 Nf3 Nc6 Bc4") award("이탈리안 게임");
  if (opening === "d4 d5 c4") award("퀸즈 갬빗");
  n.chessResult = chessEnd(c);
  if (n.chessResult) {
    n.phase = "selection";
    if (n.chessResult.reason === "체크메이트" && n.chessResult.winner === "w")
      award("체크메이트");
  }
  return n;
}
export function settle(
  banks: Pair,
  c: Pair,
  chessWinner: Side | null,
  pokerWinner: Side | null,
  economy?: Game["economy"],
): Settlement {
  for (const s of ["w", "b"] as Side[])
    if (
      !Number.isSafeInteger(banks[s]) ||
      !Number.isSafeInteger(c[s]) ||
      banks[s] < entryFee(economy) ||
      c[s] < entryFee(economy) ||
      c[s] > banks[s]
    )
      throw new Error("유효하지 않은 원장");
  const supply = banks.w + banks.b;
  if (economy !== "r3" && economy !== "r4" && supply !== 2000)
    throw new Error("이전 원장의 총 골드 불일치");
  if (!Number.isSafeInteger(supply)) throw new Error("총 골드 범위 오류");
  if (economy === "split-15-5" || economy === "r3" || economy === "r4") {
    if ((economy === "r3" || economy === "r4") && !pokerWinner)
      throw new Error("포커 승자가 필요합니다.");
    const m = Math.min(c.w, c.b);
    const drawCarry =
      (economy === "r3" || economy === "r4") && chessWinner === null;
    const pot = 2 * m - (drawCarry ? 0 : chessPool(economy));
    const returned = { w: c.w - m, b: c.b - m };
    const chessAward = {
      w:
        chessWinner === "w"
          ? chessPool(economy)
          : chessWinner === null && !drawCarry
            ? 15
            : 0,
      b:
        chessWinner === "b"
          ? chessPool(economy)
          : chessWinner === null && !drawCarry
            ? 15
            : 0,
    };
    const award = {
      w: pokerWinner === "w" ? pot : pokerWinner === null ? pot / 2 : 0,
      b: pokerWinner === "b" ? pot : pokerWinner === null ? pot / 2 : 0,
    };
    const final = {
      w: banks.w - m + chessAward.w + award.w,
      b: banks.b - m + chessAward.b + award.b,
    };
    if (final.w + final.b !== supply || Math.min(final.w, final.b) < 0)
      throw new Error("보존 실패");
    return { final, returned, award, chessAward, protection: 0, pot };
  }
  const m = Math.min(c.w, c.b),
    pot = 2 * m,
    returned = { w: c.w - m, b: c.b - m },
    award = {
      w: pokerWinner === "w" ? pot : pokerWinner === null ? m : 0,
      b: pokerWinner === "b" ? pot : pokerWinner === null ? m : 0,
    };
  const final = { w: banks.w - m + award.w, b: banks.b - m + award.b };
  const protection = chessWinner ? Math.max(0, 20 - final[chessWinner]) : 0;
  if (chessWinner) {
    if (protection > award[other(chessWinner)])
      throw new Error("보호금 원천 부족");
    final[chessWinner] += protection;
    final[other(chessWinner)] -= protection;
  }
  if (final.w + final.b !== supply || Math.min(final.w, final.b) < 0)
    throw new Error("보존 실패");
  return { final, returned, award, protection, pot };
}
export function startBetting(g: Game, player: Card[], opponent: Card[]): Game {
  if (g.phase !== "selection")
    throw new Error("카드를 선택할 단계가 아닙니다.");
  const c = chessOf(g);
  for (const [s, cards] of [
    ["w", player],
    ["b", opponent],
  ] as [Side, Card[]][]) {
    const valid = survivors(c, g.identities, s);
    if (
      cards.length !== 5 ||
      new Set(cards.map((x) => x.id)).size !== 5 ||
      cards.some((x) => !valid.some((v) => v.id === x.id))
    )
      throw new Error("생존 카드 다섯 장을 선택하세요.");
  }
  const n = structuredClone(g);
  n.phase = "betting";
  n.hands = {
    w: player.map((x) =>
      survivors(c, g.identities, "w").find((v) => v.id === x.id)!,
    ),
    b: opponent.map((x) =>
      survivors(c, g.identities, "b").find((v) => v.id === x.id)!,
    ),
  };
  n.betting = {
    turn: g.round % 2 === 1 ? "w" : "b",
    acted: [],
    lastRaise: 20,
    raiseLocked: null,
    done: false,
    folded: null,
    log: [],
  };
  if (n.committed.w === n.banks.w || n.committed.b === n.banks.b) {
    n.betting.done = true;
    return finish(n);
  }
  return n;
}
export type Action =
  | { type: "check" }
  | { type: "call" }
  | { type: "fold" }
  | { type: "allin" }
  | { type: "raise"; amount: number };
export function actions(g: Game, side: Side) {
  const bet = g.betting,
    owed = g.committed[other(side)] - g.committed[side],
    left = g.banks[side] - g.committed[side];
  const active = g.phase === "betting" && bet?.turn === side && !bet.done;
  const canRaise =
    !!active &&
    bet.raiseLocked !== side &&
    left > Math.max(0, owed) &&
    g.banks[other(side)] > g.committed[other(side)];
  return {
    active,
    owed: Math.max(0, owed),
    left,
    check: !!active && owed <= 0,
    call: !!active && owed > 0,
    raise: canRaise,
    allin: !!active && left > 0 && (owed >= left || canRaise),
    minTotal: Math.max(g.committed.w, g.committed.b) + (bet?.lastRaise ?? 20),
    maxTotal: g.banks[side],
  };
}
export function act(g: Game, side: Side, action: Action): Game {
  const allowed = actions(g, side);
  if (!allowed.active) throw new Error("현재 차례가 아닙니다.");
  const n = structuredClone(g),
    b = n.betting!,
    opp = other(side);
  if (action.type === "fold") {
    b.folded = side;
    b.done = true;
    b.log.push(`${sideName(side)} · 폴드 ⚑`);
    return finish(n);
  }
  if (action.type === "check") {
    if (!allowed.check) throw new Error("콜 또는 폴드를 선택하세요.");
    b.acted.push(side);
    b.log.push(`${sideName(side)} · 체크`);
  } else {
    let target: number;
    if (action.type === "call") {
      if (!allowed.call) throw new Error("콜할 금액이 없습니다.");
      target = Math.min(g.banks[side], g.committed[opp]);
    } else if (action.type === "allin") {
      if (!allowed.allin) throw new Error("올인할 수 없습니다.");
      target = g.banks[side];
    } else {
      if (!allowed.raise || !Number.isSafeInteger(action.amount))
        throw new Error("유효하지 않은 레이즈");
      target = action.amount;
      if (target < allowed.minTotal || target > allowed.maxTotal)
        throw new Error("레이즈 범위를 확인하세요.");
    }
    const high = Math.max(g.committed.w, g.committed.b),
      increase = target - high;
    if (increase > 0) {
      if (!allowed.raise) throw new Error("레이즈가 다시 열리지 않았습니다.");
      if (increase < b.lastRaise && target !== g.banks[side])
        throw new Error("최소 레이즈 미달");
      b.raiseLocked =
        increase < b.lastRaise && b.acted.includes(opp) ? opp : null;
      if (increase >= b.lastRaise) b.lastRaise = increase;
      b.acted = [side];
    } else b.acted.push(side);
    n.committed[side] = target;
    b.log.push(
      `${sideName(side)} · ${action.type === "allin" ? "올인" : action.type === "call" ? "콜" : high === entryFee(g.economy) ? "베트" : "레이즈"} (+${target - g.committed[side]})`,
    );
  }
  b.turn = opp;
  const bothActed = b.acted.includes("w") && b.acted.includes("b");
  const bothEqual = n.committed.w === n.committed.b;
  const shortAllin =
    (n.committed.w === n.banks.w && n.committed.w <= n.committed.b) ||
    (n.committed.b === n.banks.b && n.committed.b <= n.committed.w);
  if ((bothActed && bothEqual) || shortAllin) {
    b.done = true;
    return finish(n);
  }
  return n;
}
function finish(n: Game): Game {
  if (n.settlement) return n;
  const folded = n.betting!.folded;
  let winner: Side | null;
  if (folded) winner = other(folded);
  else {
    const cmp = compare(evaluate(n.hands.w).key, evaluate(n.hands.b).key);
    if (cmp === 0)
      throw new Error(
        "카드 배정 불일치: 합법적인 단일 덱에서는 포커 동률이 발생하지 않습니다.",
      );
    winner = cmp > 0 ? "w" : "b";
  }
  n.result = {
    winner,
    reason: folded ? "폴드" : winner ? "쇼다운" : "쇼다운 동률",
  };
  n.settlement = settle(
    n.banks,
    n.committed,
    n.chessResult!.winner,
    winner,
    n.economy,
  );
  n.phase = "result";
  if (!folded) {
    const h = evaluate(n.hands.w);
    n.achievements.push(h.name);
    if (n.hands.w.some((c) => c.suit === "J"))
      n.achievements.push("조커의 미소");
    if (winner === "w") n.achievements.push("쇼다운 승리");
  }
  if (
    n.betting!.log.some((l) => l.startsWith("플레이어") && l.includes("올인"))
  )
    n.achievements.push("모든 것을 걸다");
  if (
    n.betting!.log.some((l) => l.startsWith("플레이어") && l.includes("레이즈"))
  )
    n.achievements.push("판돈을 높이다");
  if (
    folded === "b" &&
    evaluate(n.hands.w).category <= 1 &&
    n.betting!.log.some(
      (l) => l.startsWith("플레이어") && /베트|레이즈|올인/.test(l),
    )
  )
    n.achievements.push("블러프 성공 · 낮은 족보로 폴드 유도");
  if (n.settlement.final.w < CURRENT_ENTRY)
    n.achievements.push("다음 기회를 기다리며 · 파산");
  if (n.chessResult!.winner === "b" && winner === "w")
    n.achievements.push(
      n.economy ? "포커 설욕 · 체스 패배 후 포커 승리" : "역전의 한 장",
    );
  if (n.settlement.final.b < CURRENT_ENTRY) n.achievements.push("정원의 주인");
  n.achievements = [...new Set(n.achievements)];
  return n;
}
export function makeRecord(g: Game): RecordEntry {
  if (!g.settlement) throw new Error("미완료 판");
  // Never store a folded hand or unselected identities in the public history.
  const hands = g.abandoned || g.betting?.folded ? { w: [], b: [] } : g.hands;
  return {
    id: g.id,
    economy: g.economy,
    date: new Date().toISOString(),
    round: g.round,
    chess: g.chessResult
      ? `${g.chessResult.reason} · ${g.chessResult.winner ? sideName(g.chessResult.winner) : "무승부"}`
      : "도주 · 미완료",
    poker: `${g.result!.reason} · ${g.result!.winner ? sideName(g.result!.winner) : "무승부"}`,
    final: g.settlement.final,
    pgn: chessOf(g).pgn(),
    achievements: g.achievements,
    hands,
    captured: g.captured,
    settlement: g.settlement,
  };
}
export type PublicChessView = {
  fen: string;
  ownCards: Record<string, Card>;
  side: Side;
};
export function aiView(g: Game): PublicChessView {
  const c = chessOf(g),
    ownCards: Record<string, Card> = {};
  for (const p of c.board().flat())
    if (p?.color === "b") ownCards[p.square] = g.identities[p.square];
  return { fen: c.fen(), ownCards, side: "b" };
}
const values = { p: 100, n: 310, b: 325, r: 500, q: 900, k: 0 };
function material(c: Chess, side: Side): number {
  return c
    .board()
    .flat()
    .reduce(
      (sum, p) => sum + (p ? (p.color === side ? 1 : -1) * values[p.type] : 0),
      0,
    );
}
export function chooseMove(
  view: PublicChessView,
  rng = Math.random,
): { from: string; to: string; promotion?: string } {
  const c = new Chess(view.fen),
    legal = c.moves({ verbose: true });
  let best = -Infinity,
    choice = legal[0];
  const counts = { w: 0, b: 0 };
  for (const p of c.board().flat()) if (p) counts[p.color]++;
  const myCards = Object.values(view.ownCards);
  const potential = (card: Card) =>
    card.suit === "J"
      ? 110
      : card.rank * 2 +
        18 * myCards.filter((x) => x.rank === card.rank).length +
        5 * myCards.filter((x) => x.suit === card.suit).length +
        4 * myCards.filter((x) => Math.abs(x.rank - card.rank) <= 2).length;
  for (const move of legal) {
    c.move(move);
    let score = material(c, view.side);
    if (c.isCheckmate()) score = 100000;
    else if (move.captured && counts[other(view.side)] === 6)
      score = c.isCheck() ? 50000 : 0;
    else {
      let worst = Infinity;
      for (const reply of c.moves({ verbose: true })) {
        c.move(reply);
        let s = material(c, view.side);
        if (c.isCheckmate()) s = -100000;
        else if (reply.captured && counts[view.side] === 6)
          s = c.isCheck() ? -50000 : 0;
        const capturedOwn =
          reply.to === move.to
            ? view.ownCards[move.from]
            : view.ownCards[reply.to];
        if (reply.captured && capturedOwn) s -= potential(capturedOwn);
        worst = Math.min(worst, s);
        c.undo();
      }
      if (worst !== Infinity) score = worst;
      if (move.isKingsideCastle() || move.isQueensideCastle()) score += 35;
      score += 3 * (3.5 - Math.abs(3.5 - "abcdefgh".indexOf(move.to[0])));
    }
    score += rng() * 35;
    c.undo();
    if (score > best) {
      best = score;
      choice = move;
    }
  }
  if (!choice) throw new Error("가능한 수 없음");
  return { from: choice.from, to: choice.to, promotion: choice.promotion };
}
export interface PokerView {
  ownHand: Card[];
  banks: Pair;
  committed: Pair;
  turn: Side;
  lastRaise: number;
  raiseLocked: Side | null;
}
export function chooseBet(view: PokerView, rng = Math.random): Action {
  const { turn: s, banks, committed: c } = view,
    opp = other(s),
    owed = Math.max(0, c[opp] - c[s]),
    left = banks[s] - c[s],
    strength = evaluate(view.ownHand).category,
    roll = rng();
  const raiseAllowed =
    view.raiseLocked !== s && banks[opp] > c[opp] && left > owed;
  if (
    owed > 0 &&
    strength < 2 &&
    owed > Math.max(40, left * 0.3) &&
    roll > 0.18
  )
    return { type: "fold" };
  if (
    raiseAllowed &&
    ((strength >= 3 && roll < 0.65) || (strength >= 1 && roll < 0.22))
  ) {
    const total =
      Math.max(c.w, c.b) +
      Math.max(
        view.lastRaise,
        Math.min(100, Math.floor((left * 0.2) / 20) * 20),
      );
    if (total <= banks[s]) return { type: "raise", amount: total };
  }
  return { type: owed ? "call" : "check" };
}
