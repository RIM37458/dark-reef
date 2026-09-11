import test from "node:test";
import assert from "node:assert/strict";

import { analyzeDiff } from "../scripts/floor-guard.js";

function diffFor(file, { added = [], removed = [] }) {
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1 +1 @@",
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join("\n");
}

test("floor guard blocks attempts to silence checks or leave unfinished code", () => {
  const suppression = "@" + "ts-ignore";
  const unfinished = "TO" + "DO implement this";
  const diff = diffFor("src/example.js", {
    added: [`// ${suppression}`, `// ${unfinished}`],
  });

  assert.deepEqual(
    analyzeDiff(diff).map(({ rule }) => rule),
    ["silenced-checker", "unfinished-work"],
  );
});

test("floor guard blocks weakened tests", () => {
  const skipped = "." + "skip";
  const diff = [
    diffFor("test/example.test.js", { added: [`test${skipped}("later", () => {})`] }),
    diffFor("test/other.test.js", { removed: ["assert.equal(actual, expected);"] }),
  ].join("\n");

  assert.deepEqual(
    analyzeDiff(diff).map(({ rule }) => rule),
    ["test-made-easier", "assertion-removed"],
  );
});

test("floor guard allows replacing an assertion without reducing verification", () => {
  const diff = diffFor("test/example.test.js", {
    removed: ["assert.equal(actual, oldExpected);"],
    added: ["assert.equal(actual, newExpected);"],
  });

  assert.deepEqual(analyzeDiff(diff), []);
});

test("floor guard blocks deleting an entire test file", () => {
  const diff = [
    "diff --git a/test/removed.test.js b/test/removed.test.js",
    "deleted file mode 100644",
    "--- a/test/removed.test.js",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-assert.equal(actual, expected);",
  ].join("\n");

  assert.deepEqual(analyzeDiff(diff), [{
    rule: "test-file-deleted",
    file: "test/removed.test.js",
  }]);
});

test("floor guard blocks weakened constraints and undeclared exceptions", () => {
  const diff = [
    diffFor("CONSTRAINTS.md", {
      removed: ["| Coverage: lines | >= 96% |"],
      added: ["| Coverage: lines | >= 90% |"],
    }),
    diffFor("CONSTRAINTS.md", {
      added: ["| E1 | coverage | src/legacy/** | migration | owner | 2026-12-01 |"],
    }),
  ].join("\n");

  assert.deepEqual(
    analyzeDiff(diff).map(({ rule }) => rule),
    ["new-exception", "threshold-lowered"],
  );
});

test("floor guard does not treat policy documentation as executable code", () => {
  const suppression = "eslint" + "-disable";
  const diff = diffFor("CONSTRAINTS.md", {
    added: [`- Do not add ${suppression} comments.`],
  });

  assert.deepEqual(analyzeDiff(diff), []);
});
