import test from "node:test";
import assert from "node:assert/strict";

import { startWatcher } from "../src/app.js";

test("startWatcher logs in, polls immediately, schedules polling, and shuts down", async () => {
  const events = [];
  let loginOptions;
  const bot = {
    live: {},
    logout: () => events.push("logout"),
  };
  const statusServer = {
    listen: async (address) => events.push(["listen", address]),
    close: async () => events.push("close"),
  };
  const monitor = {
    poll: async () => events.push("poll"),
    getStatus: () => ({ phase: "starting" }),
  };
  const timer = { id: 1 };

  const app = await startWatcher(
    {
      steam: {
        accountName: "watcher_bot",
        password: "private-password",
        sessionFile: "./data/session.json",
      },
      friendSteamId64: "76561198000000000",
      requestLive: false,
      pollIntervalMs: 30_000,
      http: { host: "127.0.0.1", port: 8787 },
    },
    {
      loginDota: async (options) => {
        loginOptions = options;
        return bot;
      },
      monitorFactory: () => monitor,
      serverFactory: ({ getStatus }) => {
        assert.deepEqual(getStatus(), { phase: "starting" });
        return statusServer;
      },
      setIntervalFn: (callback, delay) => {
        assert.equal(typeof callback, "function");
        assert.equal(delay, 30_000);
        return timer;
      },
      clearIntervalFn: (value) => {
        assert.equal(value, timer);
        events.push("clearInterval");
      },
    },
  );

  assert.deepEqual(loginOptions, {
    accountName: "watcher_bot",
    password: "private-password",
    sessionFile: "./data/session.json",
    waitForGC: true,
  });
  assert.deepEqual(events.slice(0, 2), [
    ["listen", { host: "127.0.0.1", port: 8787 }],
    "poll",
  ]);

  await app.stop();
  assert.deepEqual(events.slice(-3), ["clearInterval", "close", "logout"]);
});

test("startWatcher prefers an explicit refresh token over a password", async () => {
  let loginOptions;
  const app = await startWatcher(
    {
      steam: {
        accountName: "watcher_bot",
        password: "private-password",
        refreshToken: "private-token",
        sessionFile: "./data/session.json",
      },
      friendSteamId64: "76561198000000000",
      requestLive: false,
      pollIntervalMs: 30_000,
      http: { host: "127.0.0.1", port: 8787 },
    },
    {
      loginDota: async (options) => {
        loginOptions = options;
        return { live: {}, logout() {} };
      },
      monitorFactory: () => ({ poll: async () => {}, getStatus: () => ({}) }),
      serverFactory: () => ({ listen: async () => {}, close: async () => {} }),
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    },
  );

  assert.equal(loginOptions.refreshToken, "private-token");
  assert.equal("password" in loginOptions, false);
  await app.stop();
});
