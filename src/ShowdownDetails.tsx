import { evaluate, label, SYMBOLS, SUITS, type Card } from "./poker";

const rankName = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[rank] ?? String(rank);

export function ShowdownDetails({ own, opponent }: { own: Card[]; opponent: Card[] }) {
  const a = evaluate(own), b = evaluate(opponent);
  const rankCount = a.key.length - 6;
  const difference = a.key.findIndex((value, index) => value !== b.key[index]);
  const ownWins = difference >= 0 && a.key[difference] > b.key[difference];
  const winner = ownWins ? "내" : "상대";
  let reason: string;
  if (a.category !== b.category) {
    reason = `${ownWins ? a.name : b.name} 족보가 ${ownWins ? b.name : a.name}보다 높아 ${winner} 승리입니다.`;
  } else if (difference < 0) {
    reason = "족보와 비교 숫자, 무늬가 모두 같아 무승부입니다.";
  } else if (difference <= rankCount) {
    const position = difference;
    reason = `${a.name}끼리 비교한 결과, ${position === 1 ? "첫 번째" : `${position}번째`} 비교 숫자에서 내 ${rankName(a.key[difference])}와 상대 ${rankName(b.key[difference])}가 달라 ${winner} 승리입니다. ${position > 1 ? "그 앞의 비교 숫자는 모두 같습니다. " : ""}무늬 우선순위는 적용되지 않았습니다.`;
  } else {
    const suit = (value: number) => SYMBOLS[SUITS[4 - value]];
    reason = `족보와 비교 숫자가 모두 같아 ${difference - rankCount}번째 무늬로 결정됐습니다. 내 ${suit(a.key[difference])}와 상대 ${suit(b.key[difference])}를 비교해 ${winner} 승리입니다.`;
  }
  const ranks = (hand: typeof a) => hand.key.slice(1, -5).map(rankName).join(" → ");
  return <details className="showdown-details">
    <summary>판정 상세 보기</summary>
    <p className="showdown-reason">{reason}</p>
    <dl>
      {([["나", a], ["상대", b]] as const).map(([name, hand]) => <div key={name}>
        <dt>{name} · {hand.name}</dt>
        <dd>{[...hand.resolved].sort((x, y) => y.rank - x.rank).map(label).join(" · ")}</dd>
        <dd>비교 숫자: {ranks(hand)}</dd>
        {hand.cards.some(card => card.suit === "J") && <dd>조커는 위 패가 되도록 치환했습니다.</dd>}
      </div>)}
    </dl>
    <p>족보 → 비교 숫자 → 무늬 순으로 판정합니다. 숫자는 왼쪽부터 비교하며, 처음 차이가 나는 곳에서 결정됩니다.</p>
    <p>플러시는 높은 숫자부터 다섯 장을 비교합니다. 무늬는 비교 숫자가 모두 같을 때만 ♠ &gt; ♥ &gt; ♦ &gt; ♣ 순으로 적용합니다. 체스 기물의 종류는 포커 우선순위에 영향을 주지 않습니다.</p>
  </details>;
}
