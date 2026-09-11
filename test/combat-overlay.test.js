import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../src/desktop/draft-overlay.html", import.meta.url), "utf8");
const script = await readFile(new URL("../src/desktop/draft-overlay.js", import.meta.url), "utf8");

test("game overlay reserves non-interactive ultimate and BKB status beneath enemy portraits", () => {
  assert.match(html, /id="combat-cooldowns"/);
  assert.match(script, /大招/);
  assert.match(script, /BKB/);
  assert.match(script, /localSide/);
});
