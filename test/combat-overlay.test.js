import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../src/desktop/draft-overlay.html", import.meta.url), "utf8");
const script = await readFile(new URL("../src/desktop/draft-overlay.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/desktop/draft-overlay.css", import.meta.url), "utf8");
const toolbarHtml = await readFile(new URL("../src/desktop/draft-toolbar.html", import.meta.url), "utf8");
const toolbarScript = await readFile(new URL("../src/desktop/draft-toolbar.js", import.meta.url), "utf8");

test("game overlay reserves non-interactive ultimate and BKB status beneath enemy portraits", () => {
  assert.match(html, /id="combat-cooldowns"/);
  assert.match(script, /大招/);
  assert.match(script, /BKB/);
  assert.match(script, /localSide/);
});

test("draft overlay draws only learned hero positions and keeps named recommendations as fallback", () => {
  assert.doesNotMatch(script, /createDraftGrid/);
  assert.match(script, /state\.observation\?\.layout/);
  assert.match(script, /--cell-x/);
  assert.match(styles, /left: var\(--cell-x\)/);
  assert.match(toolbarHtml, /id="recommendations"/);
  assert.match(toolbarScript, /recommendedHeroIds/);
  assert.match(toolbarScript, /heroesById/);
});
