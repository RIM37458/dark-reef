import test from "node:test";
import assert from "node:assert/strict";

import { parseConfig } from "../src/config.js";

test("parseConfig accepts the minimal headless configuration", () => {
  const config = parseConfig({
    STEAM_ACCOUNT: "watcher_bot",
    FRIEND_STEAM_ID64: "76561198000000000",
  });

  assert.equal(config.steam.accountName, "watcher_bot");
  assert.equal(config.friendSteamId64, "76561198000000000");
  assert.equal(config.requestLive, false);
  assert.equal(config.pollIntervalMs, 30_000);
  assert.deepEqual(config.http, { host: "127.0.0.1", port: 8787 });
});

test("parseConfig rejects a non-SteamID64 friend id", () => {
  assert.throws(
    () =>
      parseConfig({
        STEAM_ACCOUNT: "watcher_bot",
        FRIEND_STEAM_ID64: "1234",
      }),
    /FRIEND_STEAM_ID64/,
  );
});

test("parseConfig rejects unsafe polling and port values", () => {
  assert.throws(
    () =>
      parseConfig({
        STEAM_ACCOUNT: "watcher_bot",
        FRIEND_STEAM_ID64: "76561198000000000",
        POLL_INTERVAL_MS: "500",
      }),
    /POLL_INTERVAL_MS/,
  );
  assert.throws(
    () =>
      parseConfig({
        STEAM_ACCOUNT: "watcher_bot",
        FRIEND_STEAM_ID64: "76561198000000000",
        HTTP_PORT: "70000",
      }),
    /HTTP_PORT/,
  );
});
