import test from "node:test";
import assert from "node:assert/strict";

import {
  isTargetMarked,
  presentLiveMatch,
  presentStatus,
  screenForState,
} from "../src/desktop/status-view.js";

test("presentStatus gives every watcher phase a user-facing state", () => {
  assert.equal(presentStatus(null).title, "深渊囚室静默");
  assert.deepEqual(presentStatus({ phase: "starting" }), {
    tone: "working",
    title: "斯拉达正在巡视暗黑之礁",
    detail: "深海卫士正在核验看守者铭牌，并聆听战场的回响。",
  });
  assert.equal(presentStatus({ phase: "unavailable" }).title, "深海卫士仍在巡猎");
  assert.equal(
    presentStatus({ phase: "spectating_unlisted", serverSteamId: "42" }).detail,
    "斯拉达已为囚徒点灯，战场编号：42。暗流遮住了更深层的战况。",
  );
  assert.equal(presentStatus({ phase: "detailed_stats" }).tone, "success");
  assert.equal(presentStatus({ phase: "transient_error" }).tone, "error");
});

test("isTargetMarked invokes Corrosive Haze only after a match is found", () => {
  assert.equal(isTargetMarked({ phase: "unavailable" }), false);
  assert.equal(isTargetMarked({ phase: "spectating_unlisted" }), true);
  assert.equal(isTargetMarked({ phase: "detailed_stats" }), true);
});

test("screenForState separates the entry console from the prison watch floor", () => {
  assert.equal(screenForState({ running: false }), "login");
  assert.equal(screenForState({ running: "connecting" }), "watch");
  assert.equal(screenForState({ running: "demo" }), "watch");
  assert.equal(screenForState({ running: true }), "watch");
});

test("presentLiveMatch formats the current score, clock, lead, and source", () => {
  assert.deepEqual(presentLiveMatch({
    phase: "detailed_stats",
    source: "gc_source_tv",
    match: {
      matchId: "8988000000",
      gameTime: 901,
      radiantScore: 12,
      direScore: 9,
      radiantLead: -2345,
      spectators: 81,
      radiantName: "天辉",
      direName: "夜魇",
      target: {
        heroId: 93,
        heroName: "Slark",
        heroImageUrl: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/slark.png",
        level: 21,
        kills: 9,
        deaths: 3,
        assists: 14,
        lastHits: 221,
        denies: 8,
        netWorth: 17320,
        items: [{ id: 116, name: "Black King Bar", imageUrl: "https://cdn.example/item.png" }],
      },
    },
  }), {
    matchId: "8988000000",
    gameTime: "15:01",
    radiantScore: "12",
    direScore: "9",
    radiantLead: "夜魇领先 2,345",
    spectators: "81",
    radiantName: "天辉",
    direName: "夜魇",
    source: "Dota 2 协调服务器 · 延迟直播",
    target: {
      heroName: "Slark",
      heroImageUrl: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/slark.png",
      level: "21",
      kda: "9 / 3 / 14",
      lastHits: "221 / 8",
      netWorth: "17,320",
      items: [{ id: 116, name: "Black King Bar", imageUrl: "https://cdn.example/item.png" }],
    },
  });
  assert.equal(presentLiveMatch({ phase: "spectating_unlisted" }), null);
});
