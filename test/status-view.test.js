import test from "node:test";
import assert from "node:assert/strict";

import { presentStatus } from "../src/desktop/status-view.js";

test("presentStatus gives every watcher phase a user-facing state", () => {
  assert.equal(presentStatus(null).title, "尚未开始监控");
  assert.deepEqual(presentStatus({ phase: "starting" }), {
    tone: "working",
    title: "正在连接",
    detail: "正在登录 Steam 并连接 Dota 2 协调服务器。",
  });
  assert.equal(presentStatus({ phase: "unavailable" }).title, "等待好友开局");
  assert.equal(
    presentStatus({ phase: "spectating_unlisted", serverSteamId: "42" }).detail,
    "已发现可观战比赛，服务器 ID：42。普通路人局可能没有详细比分。",
  );
  assert.equal(presentStatus({ phase: "detailed_stats" }).tone, "success");
  assert.equal(presentStatus({ phase: "transient_error" }).tone, "error");
});
