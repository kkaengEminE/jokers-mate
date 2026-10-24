const newLobby = (...args: Parameters<typeof basenewLobby>) =>
  basenewLobby(args[0], args[1], "r3");
import { expect, it } from "vitest";
import { newLobby as basenewLobby, enterGame, applyMove } from "../src/engine";
import { restore } from "../src/persistence";
it("reserves no gold before entry and charges exactly once", () => {
  const lobby = newLobby({ w: 980, b: 1020 }, 2);
  expect(lobby.committed).toEqual({ w: 0, b: 0 });
  expect(restore(JSON.stringify(lobby))).toEqual(lobby);
  expect(() => applyMove(lobby, "e4")).toThrow();
  const game = enterGame(lobby);
  expect(game.committed).toEqual({ w: 20, b: 20 });
  expect(game.banks).toEqual(lobby.banks);
  expect(restore(JSON.stringify(game))).toEqual(game);
  expect(() => enterGame(game)).toThrow();
  expect(applyMove(game, "e4").moves).toEqual(["e4"]);
});
it("rejects paid or moved lobby snapshots", () => {
  const lobby = newLobby();
  expect(
    restore(JSON.stringify({ ...lobby, committed: { w: 20, b: 20 } })),
  ).toBeNull();
  expect(restore(JSON.stringify({ ...lobby, moves: ["e4"] }))).toBeNull();
  expect(() => newLobby({ w: 19, b: 1981 })).toThrow();
});
