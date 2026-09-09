import test from "node:test";
import assert from "node:assert/strict";

import { describeBattleChanges } from "../src/battle-feed.js";

test("describeBattleChanges narrates score, target deaths, and new equipment", () => {
  const previous = {
    matchId: "1",
    radiantScore: 10,
    direScore: 9,
    radiantLead: 800,
    target: { kills: 8, deaths: 1, items: [{ id: 63, name: "Power Treads" }] },
  };
  const current = {
    matchId: "1",
    radiantScore: 11,
    direScore: 9,
    radiantLead: -350,
    target: {
      kills: 9,
      deaths: 2,
      items: [
        { id: 63, name: "Power Treads" },
        { id: 116, name: "Black King Bar" },
      ],
    },
  };

  assert.deepEqual(describeBattleChanges(previous, current), [
    "天辉新增 1 次击杀，比分来到 11:9。",
    "目标击杀数增至 9。",
    "目标阵亡次数增至 2。",
    "目标装备栏出现 Black King Bar。",
    "经济优势已转向夜魇。",
  ]);
});

test("describeBattleChanges announces a new monitored match without inventing events", () => {
  assert.deepEqual(describeBattleChanges(null, { matchId: "2" }), [
    "监视之眼已接入战场，开始记录目标动向。",
  ]);
  assert.deepEqual(describeBattleChanges({ matchId: "1" }, { matchId: "2" }), [
    "监视之眼已接入战场，开始记录目标动向。",
  ]);
});
