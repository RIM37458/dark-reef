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
        guardCode: "12345",
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
    guardCode: "12345",
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

test("startWatcher notifies once per transition into a discovered game", async () => {
  let scheduledPoll;
  let status = { phase: "starting" };
  const results = [
    { phase: "spectating_unlisted", serverSteamId: "1" },
    { phase: "detailed_stats", serverSteamId: "1" },
    { phase: "unavailable" },
    { phase: "spectating_unlisted", serverSteamId: "2" },
  ];
  const notifications = [];
  const app = await startWatcher(
    {
      steam: { accountName: "watcher_bot", password: "secret", sessionFile: "session" },
      friendSteamId64: "76561198000000000",
      requestLive: false,
      pollIntervalMs: 30_000,
      http: { host: "127.0.0.1", port: 8787 },
    },
    {
      loginDota: async () => ({ live: {}, logout() {} }),
      monitorFactory: () => ({
        getStatus: () => status,
        poll: async () => {
          status = results.shift();
          return status;
        },
      }),
      serverFactory: () => ({ listen: async () => {}, close: async () => {} }),
      notify: (next) => notifications.push(next.serverSteamId),
      setIntervalFn: (callback) => {
        scheduledPoll = callback;
        return 1;
      },
      clearIntervalFn: () => {},
    },
  );

  await scheduledPoll();
  await scheduledPoll();
  await scheduledPoll();

  assert.deepEqual(notifications, ["1", "2"]);
  await app.stop();
});
