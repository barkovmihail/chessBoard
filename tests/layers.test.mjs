import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

test("UI slices use public entry points and import towards lower layers", () => {
  const root = path.resolve("src");
  const layers = ["shared", "entities", "features", "widgets", "pages", "app"];
  for (const file of ts.sys.readDirectory(root, [".ts", ".tsx"])) {
    const [sourceLayer, sourceSlice] = path.relative(root, file).split(path.sep);
    const imports = ts.preProcessFile(readFileSync(file, "utf8")).importedFiles;
    for (const { fileName } of imports) {
      if (!fileName.startsWith(".")) continue;
      const target = path.resolve(path.dirname(file), fileName);
      const [layer, slice, ...internal] = path.relative(root, target).split(path.sep);
      if (!layers.includes(sourceLayer)) continue; // React entry point and type declarations
      assert.ok(layers.includes(layer), `${file}: unknown layer in ${fileName}`);
      if (layer === sourceLayer && (slice === sourceSlice || ["app", "shared"].includes(layer))) continue;
      assert.ok(layers.indexOf(layer) < layers.indexOf(sourceLayer) ||
        (layer === "entities" && sourceLayer === "entities"), `${file}: invalid dependency on ${fileName}`);
      if (layer !== "shared") assert.deepEqual(internal, [], `${file}: import through the public index of ${slice}`);
    }
  }
});
