import {
  duration,
  fighterKit,
  type ActionKind,
  type FighterCard,
  type FighterKit,
  type Level,
  type Technique,
} from "./cards";
export type Side = 0 | 1;
export type OpponentMode = "ai" | "idle" | "high-guard" | "low-guard";
export interface Input {
  left: boolean;
  right: boolean;
  down: boolean;
  guard: boolean;
}
export const emptyInput = (): Input => ({
  left: false,
  right: false,
  down: false,
  guard: false,
});
interface Attack {
  move: Technique;
  age: number;
  next: number;
  hitGain: boolean;
  blockGain: boolean;
  hurtGain: boolean;
}
export interface Fighter {
  kit: FighterKit;
  x: number;
  hp: number;
  meter: number;
  attack: Attack | null;
  stun: number;
  down: boolean;
  guard: boolean;
  moving: number;
  queued: { kind: ActionKind; expires: number } | null;
  stats: { damage: number; hits: number; blocks: number; specials: number };
}
export interface DuelEvent {
  id: number;
  at: number;
  clock: number;
  actor: Side;
  target: Side;
  type: "hit" | "block" | "dodge" | "miss" | "special" | "finish";
  move: string;
  level?: Level;
  damage: number;
  hp: number;
}
export interface DuelState {
  phase: "countdown" | "fight" | "finished";
  countdown: number;
  elapsed: number;
  clock: number;
  freeze: number;
  fighters: [Fighter, Fighter];
  events: DuelEvent[];
  eventId: number;
  winner: Side | null;
  reason: "ko" | "time" | null;
  mode: OpponentMode;
  aiWait: number;
  aiInput: Input;
  seed: number;
}
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const opposite = (s: Side): Side => (s === 0 ? 1 : 0);
export function createDuel(
  a: FighterCard,
  b: FighterCard,
  mode: OpponentMode = "ai",
  fullMeter = false,
): DuelState {
  const fighter = (c: FighterCard, x: number): Fighter => ({
    kit: fighterKit(c),
    x,
    hp: 10000,
    meter: fullMeter ? 100 : 0,
    attack: null,
    stun: 0,
    down: false,
    guard: false,
    moving: 0,
    queued: null,
    stats: { damage: 0, hits: 0, blocks: 0, specials: 0 },
  });
  return {
    phase: "countdown",
    countdown: 3000,
    elapsed: 0,
    clock: 0,
    freeze: 0,
    fighters: [fighter(a, 2.4), fighter(b, 5.6)],
    events: [],
    eventId: 0,
    winner: null,
    reason: null,
    mode,
    aiWait: 350,
    aiInput: emptyInput(),
    seed: 0x912abc,
  };
}
export const distance = (s: DuelState) =>
  Math.max(0, s.fighters[1].x - s.fighters[0].x - 0.5);
export function queueAction(
  s: DuelState,
  side: Side,
  kind: ActionKind,
): boolean {
  const f = s.fighters[side];
  if (
    s.phase !== "fight" ||
    f.hp <= 0 ||
    f.guard ||
    f.stun > 100 ||
    (f.attack && duration(f.attack.move) - f.attack.age > 100) ||
    (kind === "special" && f.meter < 100)
  )
    return false;
  f.queued = { kind, expires: s.elapsed + 100 };
  return true;
}
export function clearInputs(s: DuelState) {
  s.aiInput = emptyInput();
  for (const f of s.fighters) {
    f.queued = null;
    f.guard = false;
    f.moving = 0;
  }
}
function event(s: DuelState, e: Omit<DuelEvent, "id" | "at" | "clock">) {
  s.events.push({ ...e, id: ++s.eventId, at: s.elapsed, clock: s.clock });
  if (s.events.length > 500) s.events.shift();
}
function random(s: DuelState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function ai(s: DuelState, dt: number): Input {
  if (s.mode !== "ai")
    return {
      ...emptyInput(),
      guard: s.mode !== "idle",
      down: s.mode === "low-guard",
    };
  s.aiWait -= dt;
  if (s.aiWait <= 0) {
    s.aiWait = 300 + random(s) * 200;
    const f = s.fighters[1],
      p = s.fighters[0],
      gap = distance(s);
    s.aiInput = emptyInput();
    if (f.stun <= 0 && !f.attack) {
      if (p.attack && gap < p.attack.move.range + 0.2 && random(s) < 0.55) {
        s.aiInput.guard = true;
        s.aiInput.down =
          p.attack.move.levels[
            Math.min(p.attack.next, p.attack.move.levels.length - 1)
          ] === "low";
      } else if (gap > f.kit.moves.combo.range * 0.8) {
        s.aiInput.left = true;
      } else {
        const roll = random(s);
        const action: ActionKind =
          f.meter === 100 && roll < 0.28
            ? "special"
            : roll < 0.5
              ? "combo"
              : roll < 0.7
                ? "sweep"
                : "basic";
        queueAction(s, 1, action);
      }
    }
  }
  // Do not walk through the opponent while waiting for the next decision.
  return distance(s) < 0.15 ? { ...s.aiInput, left: false } : s.aiInput;
}
function finish(s: DuelState, reason: "ko" | "time") {
  s.phase = "finished";
  s.reason = reason;
  s.freeze = 0;
  s.winner =
    s.fighters[0].hp === s.fighters[1].hp
      ? null
      : s.fighters[0].hp > s.fighters[1].hp
        ? 0
        : 1;
  for (const f of s.fighters) {
    f.attack = null;
    f.queued = null;
    f.moving = 0;
    f.guard = false;
  }
  event(s, {
    type: "finish",
    actor: s.winner ?? 0,
    target: s.winner === 0 ? 1 : 0,
    move: reason,
    damage: 0,
    hp: 0,
  });
}
function start(s: DuelState, side: Side, input: Input) {
  const f = s.fighters[side];
  if (f.queued && f.queued.expires < s.elapsed) f.queued = null;
  if (f.stun > 0 || f.attack) {
    if (f.attack) f.guard = false;
    f.moving = 0;
    return;
  }
  f.down = input.down;
  f.guard = input.guard;
  if (f.guard) {
    f.queued = null;
    return;
  }
  if (!f.queued) return;
  const kind =
    f.queued.kind === "basic" && input.down ? "sweep" : f.queued.kind;
  f.queued = null;
  if (kind === "special" && f.meter < 100) return;
  f.attack = {
    move: f.kit.moves[kind],
    age: 0,
    next: 0,
    hitGain: false,
    blockGain: false,
    hurtGain: false,
  };
  f.down = kind === "sweep";
  f.moving = 0;
  if (kind === "special") {
    f.meter = 0;
    f.stats.specials++;
    s.freeze = Math.max(s.freeze, 200);
    event(s, {
      actor: side,
      target: opposite(side),
      type: "special",
      move: f.kit.moves.special.name,
      damage: 0,
      hp: s.fighters[opposite(side)].hp,
    });
  }
}
function tick(s: DuelState, input: Input, dt: number) {
  s.clock += dt;
  if (s.phase === "finished") return;
  if (s.phase === "countdown") {
    s.countdown = Math.max(0, s.countdown - dt);
    if (!s.countdown) s.phase = "fight";
    return;
  }
  if (s.freeze > 0) {
    s.freeze = Math.max(0, s.freeze - dt);
    return;
  }
  if (s.elapsed + dt >= 60000) {
    s.elapsed = 60000;
    finish(s, "time");
    return;
  }
  const inputs: [Input, Input] = [input, ai(s, dt)];
  for (const side of [0, 1] as Side[]) {
    const f = s.fighters[side];
    f.stun = Math.max(0, f.stun - dt);
    if (f.attack && f.attack.age >= duration(f.attack.move)) f.attack = null;
    start(s, side, inputs[side]);
  }
  if (s.freeze > 0) return;
  s.elapsed += dt;
  const old = s.fighters.map((f) => f.x);
  for (const side of [0, 1] as Side[]) {
    const f = s.fighters[side],
      i = inputs[side];
    f.moving =
      f.attack || f.stun || f.down ? 0 : Number(i.right) - Number(i.left);
    f.x = clamp(
      f.x + (f.moving * f.kit.speed * (f.guard ? 0.5 : 1) * dt) / 1000,
      0.25,
      7.75,
    );
  }
  if (s.fighters[1].x - s.fighters[0].x < 0.5) {
    if (s.fighters[0].moving > 0 && s.fighters[1].moving >= 0)
      s.fighters[0].x = s.fighters[1].x - 0.5;
    else if (s.fighters[1].moving < 0 && s.fighters[0].moving <= 0)
      s.fighters[1].x = s.fighters[0].x + 0.5;
    else {
      const mid = clamp((s.fighters[0].x + s.fighters[1].x) / 2, 0.5, 7.5);
      s.fighters[0].x = mid - 0.25;
      s.fighters[1].x = mid + 0.25;
    }
  }
  for (const side of [0, 1] as Side[])
    if (s.fighters[side].x === old[side]) s.fighters[side].moving = 0;
  // Capture both contacts before applying either hit, allowing simultaneous KO.
  const contacts: {
    side: Side;
    attack: Attack;
    level: Level;
    index: number;
    type: "hit" | "block" | "dodge" | "miss";
  }[] = [];
  for (const side of [0, 1] as Side[]) {
    const f = s.fighters[side],
      a = f.attack;
    if (!a) continue;
    a.age += dt;
    while (
      a.next < a.move.levels.length &&
      a.age >= a.move.startup + a.next * a.move.interval
    ) {
      const index = a.next++,
        level = a.move.levels[index],
        other = s.fighters[opposite(side)];
      const type =
        distance(s) > a.move.range
          ? "miss"
          : level === "high" && other.down
            ? "dodge"
            : other.guard && (other.down ? level === "low" : level !== "low")
              ? "block"
              : "hit";
      contacts.push({ side, attack: a, level, index, type });
    }
  }
  for (const hit of contacts) {
    const { side, attack: a, level, index, type } = hit,
      target = opposite(side),
      f = s.fighters[side],
      other = s.fighters[target];
    const nominal = a.move.damage[index],
      special = a.move.id === "special";
    let damage = 0;
    if (type === "hit") {
      damage = Math.min(other.hp, nominal);
      other.hp -= damage;
      other.stun = Math.max(other.stun, 160);
      other.attack = null;
      other.queued = null;
      other.guard = false;
      f.stats.hits++;
      f.stats.damage += damage;
      if (!special && !a.hitGain) {
        f.meter = clamp(f.meter + 12, 0, 100);
        a.hitGain = true;
      }
      if (!a.hurtGain) {
        other.meter = clamp(other.meter + 5, 0, 100);
        a.hurtGain = true;
      }
      s.freeze = Math.max(
        s.freeze,
        special && index === a.move.levels.length - 1 ? 90 : 45,
      );
    } else if (type === "block") {
      damage = special
        ? Math.min(Math.max(0, other.hp - 100), Math.round(nominal * 0.2))
        : 0;
      other.hp -= damage;
      f.stats.damage += damage;
      other.stats.blocks++;
      const scale =
        other.kit.guardLevel === "all" || other.kit.guardLevel === level
          ? other.kit.guardScale
          : 1;
      other.stun = Math.max(other.stun, Math.round(120 * scale));
      if (!a.blockGain) {
        other.meter = clamp(other.meter + 8, 0, 100);
        a.blockGain = true;
      }
      s.freeze = Math.max(s.freeze, 30);
    }
    if (type === "hit" || type === "block") {
      const push =
        a.move.id === "combo" || special ? 0.03 : type === "hit" ? 0.1 : 0.05;
      other.x = clamp(other.x + (target === 1 ? push : -push), 0.25, 7.75);
    }
    event(s, {
      actor: side,
      target,
      type,
      move: a.move.name,
      level,
      damage,
      hp: other.hp,
    });
  }
  if (s.fighters.some((f) => f.hp === 0)) finish(s, "ko");
}
/** Advance in bounded deterministic steps; UI pauses by not advancing this state. */
export function advanceDuel(s: DuelState, input: Input, ms: number) {
  let remaining = Math.max(0, ms);
  while (remaining > 0 && s.phase !== "finished") {
    const dt = Math.min(10, remaining, s.freeze > 0 ? s.freeze : 10);
    tick(s, input, dt);
    remaining -= dt;
  }
}
export function fighterPose(f: Fighter, clock: number): number {
  if (f.hp <= 0) return 7;
  if (f.stun > 0) return f.guard ? (f.down ? 5 : 0) : 6;
  if (f.attack) {
    const { move, age, next } = f.attack;
    const contact = move.startup + Math.max(0, next - 1) * move.interval;
    if (age < move.startup * 0.65) return move.animation === "punch" ? 0 : 1;
    if (age > contact + 160 && next === move.levels.length) return 0;
    const index =
      age < move.startup
        ? 0
        : Math.min(
            move.levels.length - 1,
            move.interval
              ? Math.floor((age - move.startup) / move.interval)
              : 0,
          );
    const lv = move.levels[index];
    if (move.animation === "sweep") return 5;
    return move.animation === "punch" ? 2 : lv === "high" ? 3 : 4;
  }
  return f.down ? 5 : f.moving ? (Math.floor(clock / 150) % 2 ? 1 : 0) : 0;
}
