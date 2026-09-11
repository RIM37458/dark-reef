import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const lockfile = await readFile(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");

test("the vulnerable adm-zip release cannot re-enter the resolved dependency graph", () => {
  assert.match(workspace, /^\s{2}adm-zip: 0\.6\.1$/m);
  assert.match(lockfile, /adm-zip@0\.6\.1/);
  assert.doesNotMatch(lockfile, /adm-zip@0\.6\.0/);
});
