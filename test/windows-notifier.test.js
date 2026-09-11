import test from "node:test";
import assert from "node:assert/strict";

import {
  createConfiguredDesktopNotifier,
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
    title: "侵蚀雾霭：目标已显形",
    body: "斯拉达已为囚徒点灯，战场进入监视（服务器 123456）。",
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

test("createConfiguredDesktopNotifier attempts delivery only when the user enables it", () => {
  let shown = 0;
  class FakeNotification {
    static isSupported() {
      return true;
    }

    on() {}

    show() {
      shown += 1;
    }
  }

  const enabled = createConfiguredDesktopNotifier({
    enabled: true,
    NotificationImpl: FakeNotification,
  });
  const disabled = createConfiguredDesktopNotifier({
    enabled: false,
    NotificationImpl: FakeNotification,
  });

  assert.equal(enabled({ phase: "spectating_unlisted" }), true);
  assert.equal(disabled({ phase: "spectating_unlisted" }), false);
  assert.equal(shown, 1);
});
