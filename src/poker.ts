export type Suit = "S" | "D" | "H" | "C";
export interface Card {
  id: string;
  rank: number;
  suit: Suit | "J";
}
export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const SYMBOLS = { S: "♠", D: "♦", H: "♥", C: "♣", J: "✦" };
export const NAMES = [
  "하이카드",
  "원페어",
  "투페어",
  "트리플",
  "스트레이트",
  "플러시",
  "풀하우스",
  "포카드",
  "스트레이트 플러시",
  "로열 플러시",
];
export const label = (c: Card) =>
  c.suit === "J"
    ? "JOKER"
    : `${SYMBOLS[c.suit]} ${({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[c.rank] ?? c.rank}`;
export const deck = (): Card[] => [
  ...SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({
      id: `${i + 2}${suit}`,
      rank: i + 2,
      suit,
    })),
  ),
  { id: "J1", rank: 0, suit: "J" },
  { id: "J2", rank: 0, suit: "J" },
];
export const compare = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
};
export interface Hand {
  key: number[];
  category: number;
  name: string;
  cards: Card[];
  resolved: Card[];
}
const suitValue = (c: Card) => 4 - SUITS.indexOf(c.suit as Suit);
function natural(cards: Card[]): Hand {
  const ordered = [...cards].sort(
    (a, b) => b.rank - a.rank || suitValue(b) - suitValue(a),
  );
  const groups = new Map<number, Card[]>();
  for (const c of ordered)
    groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  const grouped = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length || b[0] - a[0],
  );
  const ranks = [...groups.keys()].sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const straight =
    ranks.length === 5 &&
    (ranks[0] - ranks[4] === 4 || ranks.join(",") === "14,5,4,3,2");
  const high = straight && ranks[0] === 14 && ranks[1] === 5 ? 5 : ranks[0];
  let category = 0,
    rankKey: number[] = ranks,
    suitCards = ordered;
  if (straight && flush) {
    category = high === 14 ? 9 : 8;
    rankKey = [high];
  } else if (grouped[0][1].length === 4) {
    category = 7;
    rankKey = grouped.map((g) => g[0]);
    suitCards = grouped.flatMap((g) => g[1]);
  } else if (grouped[0][1].length === 3 && grouped[1][1].length === 2) {
    category = 6;
    rankKey = grouped.map((g) => g[0]);
    suitCards = grouped.flatMap((g) => g[1]);
  } else if (flush) category = 5;
  else if (straight) {
    category = 4;
    rankKey = [high];
  } else if (grouped[0][1].length === 3) {
    category = 3;
    rankKey = grouped.map((g) => g[0]);
    suitCards = grouped.flatMap((g) => g[1]);
  } else if (grouped[0][1].length === 2) {
    category = grouped[1][1].length === 2 ? 2 : 1;
    rankKey = grouped.map((g) => g[0]);
    suitCards = grouped.flatMap((g) => g[1]);
  }
  if (straight)
    suitCards = [...ordered].sort(
      (a, b) =>
        (b.rank === 14 && high === 5 ? 1 : b.rank) -
        (a.rank === 14 && high === 5 ? 1 : a.rank),
    );
  return {
    key: [category, ...rankKey, ...suitCards.map(suitValue)],
    category,
    name: NAMES[category],
    cards,
    resolved: cards,
  };
}
export function evaluate(cards: Card[]): Hand {
  if (cards.length !== 5 || new Set(cards.map((c) => c.id)).size !== 5)
    throw new Error("서로 다른 카드 다섯 장이 필요합니다.");
  const fixed = cards.filter((c) => c.suit !== "J"),
    jokers = cards.length - fixed.length;
  if (jokers > 2) throw new Error("조커는 두 장까지입니다.");
  if (!jokers) return natural(cards);
  const choices = deck().filter(
    (c) =>
      c.suit !== "J" &&
      !fixed.some((f) => f.rank === c.rank && f.suit === c.suit),
  );
  let best: Hand | undefined;
  for (let i = 0; i < choices.length; i++) {
    const end = jokers === 2 ? choices.length : i + 2;
    for (let j = i + 1; j < end; j++) {
      const resolved = [
        ...fixed,
        choices[i],
        ...(jokers === 2 ? [choices[j]] : []),
      ];
      const h = natural(resolved);
      if (!best || compare(h.key, best.key) > 0) best = h;
    }
  }
  return { ...best!, cards };
}
function* selections(cards: Card[]): Generator<Hand> {
  if (cards.length < 5) throw new Error("생존 카드가 부족합니다.");
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++)
            yield evaluate([cards[a], cards[b], cards[c], cards[d], cards[e]]);
}
export function bestHand(cards: Card[]): Hand {
  let best: Hand | undefined;
  for (const h of selections(cards))
    if (!best || compare(h.key, best.key) > 0) best = h;
  return best!;
}
export async function bestHandAsync(
  cards: Card[],
  signal?: AbortSignal,
): Promise<Hand> {
  let best: Hand | undefined,
    deadline = performance.now() + 12;
  for (const h of selections(cards)) {
    if (signal?.aborted) throw new DOMException("계산 취소", "AbortError");
    if (!best || compare(h.key, best.key) > 0) best = h;
    if (performance.now() >= deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      deadline = performance.now() + 12;
    }
  }
  return best!;
}
