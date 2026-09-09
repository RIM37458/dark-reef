import test from "node:test";
import assert from "node:assert/strict";

import {
  createDesktopNotifier,
  shouldNotifyGameFound,
} from "../src/windows-notifier.js";

test("shouldNotifyGameFound only reports a transition into a discovered game", () => {
  assert.equal(
    shouldNotifyGameFound(
      { phase: "starting" },
      { phase: "spectating_unlisted", serverSteamId: "123" },
    ),
    true,
  );
  assert.equal(
    shouldNotifyGameFound(
      { phase: "spectating_unlisted" },
      { phase: "detailed_stats" },
    ),
    false,
  );
  assert.equal(
    shouldNotifyGameFound({ phase: "unavailable" }, { phase: "transient_error" }),
    false,
  );
});

test("createDesktopNotifier shows a native notification and restores the window", () => {
  let shown = false;
  let clicked;
  let options;
  class FakeNotification {
    static isSupported() {
      return true;
    }

    constructor(value) {
      options = value;
    }

    on(name, callback) {
      if (name === "click") clicked = callback;
    }

    show() {
      shown = true;
    }
  }
  let restored = false;
  const notify = createDesktopNotifier({
    NotificationImpl: FakeNotification,
    onClick: () => {
      restored = true;
    },
  });

  assert.equal(
    notify({ phase: "spectating_unlisted", serverSteamId: "123456" }),
    true,
  );
  assert.deepEqual(options, {
    title: "Dota 2 好友已开局",
    body: "已发现可观战比赛（服务器 123456）。",
  });
  assert.equal(shown, true);
  clicked();
  assert.equal(restored, true);
});

test("createDesktopNotifier is a no-op when native notifications are unsupported", () => {
  const notify = createDesktopNotifier({
    NotificationImpl: class {
      static isSupported() {
        return false;
      }
    },
  });

  assert.equal(notify({ phase: "spectating_unlisted" }), false);
});
