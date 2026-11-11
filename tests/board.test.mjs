import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("game page renders the initial position with a8 at the top left", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null } });
  try {
    const { default: App } = await server.ssrLoadModule("/src/app/App.tsx");
    const html = renderToStaticMarkup(React.createElement(App));
    const squares = Array.from(html.matchAll(/data-square="([a-h][1-8])"/g), match => match[1]);
    assert.equal(squares.length, 64);
    assert.equal(new Set(squares).size, 64);
    assert.equal(squares[0], "a8");
    assert.equal(squares[63], "h1");
    for (const [backRank, pawnRank, color] of [[1, 2, "white"], [8, 7, "black"]]) {
      const backRow = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
      for (const [i, file] of [..."abcdefgh"].entries()) {
        for (const [rank, type] of [[backRank, backRow[i]], [pawnRank, "pawn"]]) {
          assert.match(html, new RegExp(`data-square="${file}${rank}"[^>]*><div role="img" aria-label="${color} ${type} ${file}${rank}"`));
        }
      }
    }
    assert.equal(html.match(/role="img"/g).length, 32);
  } finally {
    await server.close();
  }
});
