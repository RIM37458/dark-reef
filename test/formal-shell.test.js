import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../src/desktop/index.html", import.meta.url), "utf8");
const assistant = await readFile(new URL("../src/desktop/assistant-view.js", import.meta.url), "utf8");
const renderer = await readFile(new URL("../src/desktop/renderer.js", import.meta.url), "utf8");
const main = await readFile(new URL("../src/desktop/main.js", import.meta.url), "utf8");

test("formal landing presents assistant, armory, then monitor room", () => {
  const tactical = html.indexOf('id="assistant-button"');
  const armory = html.indexOf('id="armory-button"');
  const monitor = html.indexOf('id="monitor-room-button"');
  assert.ok(tactical > 0);
  assert.ok(armory > tactical);
  assert.ok(monitor > armory);
  assert.doesNotMatch(html, /id="draft-room-button"/);
  assert.doesNotMatch(html, /战术台负责本机战场识读/);
});

test("tactical workbench has ten-slot recognition and no enemy hero selector", () => {
  assert.match(html, /id="assistant-radiant-slots"/);
  assert.match(html, /id="assistant-dire-slots"/);
  assert.match(assistant, /api\.observeDraft/);
  assert.doesNotMatch(assistant, /选择英雄/);
});

test("tactical workbench follows process, position, overlay order and calibrates time automatically", () => {
  const process = html.indexOf('id="assistant-connection"');
  const position = html.indexOf('id="assistant-position"');
  const overlay = html.indexOf('id="assistant-overlay"');
  assert.ok(process > 0);
  assert.ok(position > process);
  assert.ok(overlay > position);
  assert.doesNotMatch(html, /id="clock-input"|id="clock-sync"|id="clock-toggle"|id="clock-scan"/);
  assert.doesNotMatch(html, /class="plan-editor"/);
  assert.match(assistant, /api\.readClock/);
  assert.match(assistant, /api\.openDraftOverlay/);
});

test("deep sea armory exposes plans, hero pools, and personal matchups", () => {
  assert.match(html, /id="armory-screen"/);
  assert.match(html, />深海军备</);
  assert.match(html, /绝活/);
  assert.match(html, /赢过/);
  assert.match(html, /玩过/);
  assert.match(html, /id="armory-matchup-save"/);
});

test("every formal feature page has one persistent header route back home", () => {
  assert.match(html, /id="home-button"[^>]*>返回首页</);
  assert.match(renderer, /homeButton\.hidden = screen === "home"/);
  assert.match(renderer, /homeButton\.addEventListener\("click"/);
  assert.match(renderer, /assistantView\.close\(\)/);
});

test("desktop build does not advertise or start the headless status service", () => {
  assert.doesNotMatch(html, /127\.0\.0\.1|\/status/);
  assert.match(main, /serverFactory: createDisabledDesktopStatusServer/);
});
