import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { Chess } from "chess.js";
import { createServer } from "vite";

test("quality uses the mover’s perspective and only completed evaluations", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null } });
  try {
    const { classifyMove } = await server.ssrLoadModule("/src/pages/game/moveQuality.ts");
    for (const [prefix, move, best] of [[[], "f3", "e4"], [["e4"], "f6", "e5"]]) {
      const board = new Chess();
      prefix.forEach(san => board.move(san));
      const ply = prefix.length + 1, sign = ply === 1 ? 1 : -1;
      const before = { value: 0, legalCount: board.moves().length, best, alternativeGap: 100 };
      assert.ok(board.moves().includes(move) && board.moves().includes(best));
      const classify = loss => classifyMove(before, { value: -sign * loss }, ply, move);
      assert.equal(classify(49), undefined);
      assert.equal(classify(50), "inaccuracy");
      assert.equal(classify(100), "mistake");
      assert.equal(classify(99999), "mistake");
      assert.equal(classifyMove(before, undefined, ply, best), undefined);
      assert.equal(classifyMove(before, { value: -sign * 25 }, ply, best), "strong");
      assert.equal(classifyMove(before, { value: -sign * 26 }, ply, best), "recommended");
    }
    for (const [prefix, blunder, reply, escape] of [
      [["f3", "e5"], "g4", "Qh4#", "e4"],
      [["e4", "f6", "d4"], "g5", "Qh5#", "e5"],
    ]) {
      const board = new Chess();
      prefix.forEach(move => board.move(move));
      assert.ok(board.moves().includes(escape));
      board.move(blunder);
      assert.equal(board.move(reply).san, reply);
      assert.ok(board.isCheckmate());
      const mateScore = prefix.length % 2 ? 99999 : -99999;
      assert.equal(classifyMove({ value: 0, best: escape }, { value: mateScore }, prefix.length + 1, blunder), "mistake");
    }
    const forced = new Chess("7k/8/5K2/8/8/8/8/7R b - - 0 1");
    assert.deepEqual(forced.moves(), ["Kg8"]);
    assert.equal(classifyMove({ value: -10, legalCount: 1, best: "Kg8" }, { value: 190 }, 2, "Kg8"), "forced");
  } finally { await server.close(); }
});
