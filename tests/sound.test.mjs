import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createServer } from "vite";

test("a confirmed transition selects a single cue, including overlapping events", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null } });
  try {
    const { gameCue } = await server.ssrLoadModule("/src/features/play/sound.ts");
    const before = { id: "game", moves: [], result: null, waiting: false };
    for (const [san, cue] of [["e4","move"], ["exd6","capture"], ["O-O-O","castle"],
      ["axb8=N","promotion"], ["O-O+","check"], ["exd8=Q+","check"], ["Qxh7#","finish"]]) {
      const after = { ...before, moves: [san], result: san.endsWith("#") ? "1-0" : null };
      assert.equal(gameCue(before, after), cue);
      assert.equal(gameCue(after, after), undefined);
    }
    assert.equal(gameCue({ ...before, waiting: true }, before), "start");
    assert.equal(gameCue(before, { ...before, result: "1/2-1/2" }), "finish");
  } finally { await server.close(); }
});
