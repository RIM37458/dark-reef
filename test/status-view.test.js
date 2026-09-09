import test from "node:test";
import assert from "node:assert/strict";

import { isTargetMarked, presentStatus } from "../src/desktop/status-view.js";

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
