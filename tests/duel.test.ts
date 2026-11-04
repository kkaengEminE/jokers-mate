import { describe, it, expect } from "vitest";
import {
  fighterKit,
  ROLES,
  type FighterCard,
  type DuelSuit,
} from "../src/duel/cards";
import {
  createDuel,
  advanceDuel,
  queueAction,
  emptyInput,
  fighterPose,
  type OpponentMode,
  type DuelState,
} from "../src/duel/engine";
const heart9: FighterCard = { role: "q", suit: "H", rank: 9 };
function duel(
  mode: OpponentMode = "idle",
  full = true,
  a = heart9,
  b = heart9,
): DuelState {
  const s = createDuel(a, b, mode, full);
  s.phase = "fight";
  s.fighters[0].x = 2;
  s.fighters[1].x = 3.2;
  return s;
}
const run = (s: DuelState, ms: number) => advanceDuel(s, emptyInput(), ms);
describe("card duel rules", () => {
  it("preserves the queen heart 9 baseline in formula v2", () => {
    const a = fighterKit(heart9);
    expect(a.formulaVersion).toBe(2);
    expect(a.moves.basic.damage).toEqual([600]);
    expect(a.moves.combo.damage).toEqual([500, 700]);
    expect(a.moves.special.damage).toEqual([800, 800, 1000]);
    expect(a.moves.special.levels).toEqual(["high", "mid", "low"]);
    expect(a.moves.special.startup).toBe(350);
    expect(a.moves.special.interval).toBe(300);
  });
  it("applies club damage and rounding without changing hit count", () => {
    const k = fighterKit({ role: "q", suit: "C", rank: 13 });
    expect(k.moves.combo.damage).toEqual([1540]);
    expect(k.moves.special.damage).toEqual([3080]);
    expect(k.moves.special.recovery).toBe(748);
  });
  it("changes king and queen spade 10 attacks in combat, not just their names", () => {
    const queen = fighterKit({ role: "q", suit: "S", rank: 10 });
    const king = fighterKit({ role: "k", suit: "S", rank: 10 });
    expect(queen.moves.basic.levels).toEqual(["low"]);
    expect(king.moves.basic.levels).toEqual(["mid"]);
    expect(king.moves.basic.damage).toEqual([665]);
    expect(queen.moves.combo.levels).toEqual(["low", "low"]);
    expect(king.moves.combo.levels).toEqual(["low", "mid"]);
    expect(king.moves.combo.damage).toEqual([499, 599]);
    const guardedQueen = duel("low-guard", false, {
      role: "q",
      suit: "S",
      rank: 10,
    });
    const guardedKing = duel("low-guard", false, {
      role: "k",
      suit: "S",
      rank: 10,
    });
    queueAction(guardedQueen, 0, "basic");
    queueAction(guardedKing, 0, "basic");
    run(guardedQueen, 1000);
    run(guardedKing, 1000);
    expect(guardedQueen.fighters[1].hp).toBe(10000);
    expect(guardedKing.fighters[1].hp).toBe(9335);
  });
  it("gives every role distinct attacks while each input retains its own job", () => {
    const kits = ROLES.map(({ value }) =>
      fighterKit({ ...heart9, role: value }),
    );
    const mechanicalSignature = (k: ReturnType<typeof fighterKit>) =>
      JSON.stringify(
        Object.values(k.moves).map(
          ({ name: _name, ...mechanics }) => mechanics,
        ),
      );
    expect(new Set(kits.map(mechanicalSignature)).size).toBe(6);
    for (const k of kits) {
      expect(k.roleTrait.length).toBeGreaterThan(0);
      expect(k.guardLevel).toBe("high");
      expect(k.guardScale).toBe(0.75);
    }
    const pawn9 = fighterKit({ ...heart9, role: "p" });
    const pawn10 = fighterKit({ role: "p", suit: "H", rank: 10 });
    expect(pawn9.moves.basic).toEqual(pawn10.moves.basic);
    expect(pawn9.moves.combo).not.toEqual(pawn10.moves.combo);
    const clubPawn = fighterKit({ role: "p", suit: "C", rank: 9 });
    expect(clubPawn.moves.basic.damage).toEqual([440]);
    expect(clubPawn.guardLevel).toBe("all");
  });
  it("mixes the number's opening attack with the role's final attack pose", () => {
    const s = duel("idle", false, { ...heart9, role: "r" });
    queueAction(s, 0, "combo");
    run(s, 290);
    expect(s.fighters[0].attack?.next).toBe(1);
    expect(fighterPose(s.fighters[0], s.elapsed)).toBe(3);
    run(s, 330);
    expect(s.fighters[0].attack?.next).toBe(2);
    expect(fighterPose(s.fighters[0], s.elapsed)).toBe(2);
  });
  it("builds all 312 regular combinations and 12 joker combinations with valid bounded attacks", () => {
    const cards: FighterCard[] = ROLES.flatMap(({ value: role }) => [
      ...(["H", "S", "D", "C"] as DuelSuit[]).flatMap((suit) =>
        Array.from({ length: 13 }, (_, i) => ({ role, suit, rank: i + 2 })),
      ),
      { role, suit: "J" as const, rank: 1 },
      { role, suit: "J" as const, rank: 2 },
    ]);
    expect(cards).toHaveLength(324);
    for (const card of cards) {
      const kit = fighterKit(card);
      expect(fighterKit(card)).toEqual(kit);
      for (const attack of Object.values(kit.moves)) {
        expect(attack.levels.length).toBe(attack.damage.length);
        expect(attack.damage.length).toBeGreaterThan(0);
        expect(attack.damage.every((n) => Number.isInteger(n) && n > 0)).toBe(
          true,
        );
        expect(
          attack.damage.reduce((sum, n) => sum + n, 0),
        ).toBeLessThanOrEqual(3500);
        expect(attack.range).toBeGreaterThan(0);
        expect(Number.isInteger(attack.startup)).toBe(true);
        expect(Number.isInteger(attack.recovery)).toBe(true);
        expect(attack.startup).toBeGreaterThan(0);
        expect(attack.recovery).toBeGreaterThan(0);
      }
    }
    for (const { value: role } of ROLES) {
      expect(fighterKit({ role, suit: "J", rank: 1 }).moves).toEqual(
        fighterKit({ role, suit: "S", rank: 5 }).moves,
      );
      expect(fighterKit({ role, suit: "J", rank: 2 }).moves).toEqual(
        fighterKit({ role, suit: "D", rank: 7 }).moves,
      );
    }
  });
  it("resolves jokers predictably and rejects malformed selections", () => {
    expect(fighterKit({ role: "b", suit: "J", rank: 1 }).moves).toEqual(
      fighterKit({ role: "b", suit: "S", rank: 5 }).moves,
    );
    expect(() => fighterKit({ ...heart9, rank: 99 })).toThrow();
  });
  it("does not damage before contact and applies a single punch only once", () => {
    const s = duel();
    queueAction(s, 0, "basic");
    run(s, 110);
    expect(s.fighters[1].hp).toBe(10000);
    run(s, 10);
    expect(s.fighters[1].hp).toBe(9400);
    run(s, 1000);
    expect(s.fighters[1].hp).toBe(9400);
    expect(s.fighters[0].stats.hits).toBe(1);
  });
  it("misses at a distance and grants no meter for misses", () => {
    const s = duel("idle", false);
    s.fighters[1].x = 6;
    queueAction(s, 0, "combo");
    run(s, 1200);
    expect(s.fighters[1].hp).toBe(10000);
    expect(s.fighters[0].meter).toBe(0);
    expect(s.events.filter((e) => e.type === "miss")).toHaveLength(2);
  });
  it("blocks high and middle, but takes the low special hit while standing", () => {
    const s = duel("high-guard");
    queueAction(s, 0, "special");
    run(s, 2200);
    expect(s.fighters[1].hp).toBe(8680);
    expect(s.fighters[1].stats.blocks).toBe(2);
    expect(s.fighters[0].stats.hits).toBe(1);
  });
  it("rechecks posture between hits and deals 5.2 total chip when every special hit is guarded", () => {
    const s = duel("high-guard");
    queueAction(s, 0, "special");
    run(s, 1000);
    s.mode = "low-guard";
    run(s, 1300);
    expect(s.fighters[1].hp).toBe(9480);
    expect(s.fighters[1].stats.blocks).toBe(3);
  });
  it("crouching evades high attacks but not middle attacks", () => {
    const high = duel("low-guard", false, { ...heart9, rank: 2 });
    queueAction(high, 0, "basic");
    run(high, 600);
    expect(high.fighters[1].hp).toBe(10000);
    expect(high.events[0].type).toBe("dodge");
    const mid = duel("low-guard", false);
    queueAction(mid, 0, "basic");
    run(mid, 600);
    expect(mid.fighters[1].hp).toBe(9400);
  });
  it("grants meter per move instead of per combo hit", () => {
    const s = duel("idle", false);
    queueAction(s, 0, "combo");
    run(s, 1200);
    expect(s.fighters[0].meter).toBe(12);
    expect(s.fighters[1].meter).toBe(5);
    expect(s.fighters[0].stats.damage).toBe(1200);
  });
  it("does not allow chip damage to KO", () => {
    const s = duel("high-guard", true, { ...heart9, rank: 14 });
    s.fighters[1].hp = 200;
    queueAction(s, 0, "special");
    run(s, 2000);
    expect(s.fighters[1].hp).toBe(100);
    expect(s.phase).toBe("fight");
  });
  it("spends the special once, with no refund when interrupted", () => {
    const s = duel();
    queueAction(s, 0, "special");
    queueAction(s, 1, "basic");
    run(s, 2200);
    expect(s.fighters[0].hp).toBe(9400);
    expect(s.fighters[0].meter).toBe(5);
    expect(s.fighters[0].stats.specials).toBe(1);
    expect(s.fighters[1].hp).toBe(10000);
  });
  it("rejects a special without meter", () => {
    const s = duel("idle", false);
    expect(queueAction(s, 0, "special")).toBe(false);
    run(s, 1000);
    expect(s.fighters[0].stats.specials).toBe(0);
  });
  it("processes simultaneous lethal contacts as a draw", () => {
    const s = duel();
    s.fighters.forEach((f) => (f.hp = 600));
    queueAction(s, 0, "basic");
    queueAction(s, 1, "basic");
    run(s, 500);
    expect(s.phase).toBe("finished");
    expect(s.winner).toBe(null);
    expect(s.fighters.map((f) => f.hp)).toEqual([0, 0]);
  });
  it("caps damage stats at actual health and cannot hit after KO", () => {
    const s = duel();
    s.fighters[1].hp = 300;
    queueAction(s, 0, "combo");
    run(s, 2000);
    expect(s.fighters[0].stats.damage).toBe(300);
    expect(s.fighters[0].stats.hits).toBe(1);
    expect(queueAction(s, 0, "basic")).toBe(false);
  });
  it("ends at 60 seconds with exact health, ignoring queued attacks at the deadline", () => {
    const s = duel();
    s.elapsed = 59990;
    s.fighters[0].hp = 5001;
    s.fighters[1].hp = 5000;
    queueAction(s, 1, "basic");
    run(s, 50);
    expect(s.elapsed).toBe(60000);
    expect(s.reason).toBe("time");
    expect(s.winner).toBe(0);
    expect(s.fighters[0].hp).toBe(5001);
  });
  it("freezes battle time during countdown and hit stop", () => {
    const s = createDuel(heart9, heart9, "idle");
    run(s, 3000);
    expect(s.phase).toBe("fight");
    expect(s.elapsed).toBe(0);
    s.fighters[1].x = 3.5;
    queueAction(s, 0, "basic");
    run(s, 120);
    const elapsed = s.elapsed;
    run(s, 45);
    expect(s.elapsed).toBe(elapsed);
  });
  it("prevents crossing and leaving the arena", () => {
    const s = duel();
    advanceDuel(s, { ...emptyInput(), right: true }, 5000);
    expect(s.fighters[1].x - s.fighters[0].x).toBeGreaterThanOrEqual(0.5);
    advanceDuel(s, { ...emptyInput(), left: true }, 10000);
    expect(s.fighters[0].x).toBe(0.25);
  });
});
