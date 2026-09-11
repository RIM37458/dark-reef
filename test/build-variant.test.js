import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createVariantBuild } = require("../build/variant-config.cjs");

test("Windows variants have distinct identities, output folders, and artifact names", () => {
  const formal = createVariantBuild("formal");
  const demo = createVariantBuild("demo");

  assert.equal(formal.appId, "com.codex.dota-friend-watcher");
  assert.equal(demo.appId, "com.codex.dota-friend-watcher.demo");
  assert.notEqual(formal.productName, demo.productName);
  assert.deepEqual(formal.extraMetadata, { appVariant: "formal", productName: "暗黑之礁" });
  assert.deepEqual(demo.extraMetadata, { appVariant: "demo", productName: "暗黑之礁演示回廊" });
  assert.equal(formal.directories.output, "release/formal");
  assert.equal(demo.directories.output, "release/demo");
  assert.match(formal.nsis.artifactName, /Formal-\$\{version\}/);
  assert.match(demo.nsis.artifactName, /Demo-\$\{version\}/);
  assert.doesNotMatch(formal.nsis.artifactName, /Monitor|Watcher/i);
  assert.doesNotMatch(formal.portable.artifactName, /Monitor|Watcher/i);
  assert.notEqual(formal.nsis.shortcutName, demo.nsis.shortcutName);
});

test("build variants reject an unknown target", () => {
  assert.throws(() => createVariantBuild("combined"), /Unknown build variant/);
});
