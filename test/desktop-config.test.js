import test from "node:test";
import assert from "node:assert/strict";

import { createDesktopConfig } from "../src/desktop/desktop-config.js";

test("createDesktopConfig converts bounded form input into runtime configuration", () => {
  const config = createDesktopConfig(
    {
      accountName: " watcher_bot ",
      password: "secret",
      guardCode: "12345",
      friendSteamId64: "76561198000000000",
      webApiKey: "api-key",
      notifications: true,
    },
    { sessionFile: "C:\\AppData\\steam-session.json" },
  );

  assert.equal(config.steam.accountName, "watcher_bot");
  assert.equal(config.steam.password, "secret");
  assert.equal(config.steam.guardCode, "12345");
  assert.equal(config.steam.sessionFile, "C:\\AppData\\steam-session.json");
  assert.equal(config.friendSteamId64, "76561198000000000");
  assert.equal(config.steamWebApiKey, "api-key");
  assert.equal(config.windowsNotifications, true);
});

test("createDesktopConfig rejects oversized and non-object renderer input", () => {
  assert.throws(
    () => createDesktopConfig(null, { sessionFile: "session" }),
    /configuration object/,
  );
  assert.throws(
    () =>
      createDesktopConfig(
        {
          accountName: "x".repeat(129),
          friendSteamId64: "76561198000000000",
        },
        { sessionFile: "session" },
      ),
    /accountName/,
  );
});
