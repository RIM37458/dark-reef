import test from "node:test";
import assert from "node:assert/strict";

import { createMonitor } from "../src/monitor.js";

const clock = () => new Date("2026-09-08T10:00:00.000Z");

test("monitor reports an unavailable friend match without throwing", async () => {
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({
        ok: false,
        result: 4,
        resultName: "ERROR_LOBBY_NOT_FOUND",
      }),
    },
    now: clock,
  });

  const status = await monitor.poll();

  assert.equal(status.phase, "unavailable");
  assert.equal(status.reason, "ERROR_LOBBY_NOT_FOUND");
  assert.equal(status.observedAt, "2026-09-08T10:00:00.000Z");
});

test("monitor preserves a successful server id when the pub is not listed", async () => {
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({ ok: true, serverSteamId: "90123456789012345" }),
      findGameByServerId: async () => null,
    },
    now: clock,
  });

  const status = await monitor.poll();

  assert.equal(status.phase, "spectating_unlisted");
  assert.equal(status.serverSteamId, "90123456789012345");
  assert.match(status.reason, /ordinary public matches/i);
});

test("monitor publishes SourceTV game state when Valve lists the match", async () => {
  const game = {
    matchId: "8988000000",
    serverSteamId: "90123456789012345",
    gameTime: 900,
    radiantScore: 12,
    direScore: 9,
  };
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({ ok: true, serverSteamId: game.serverSteamId }),
      findGameByServerId: async () => game,
    },
    now: clock,
  });

  const status = await monitor.poll();

  assert.equal(status.phase, "detailed_stats");
  assert.equal(status.source, "gc_source_tv");
  assert.deepEqual(status.game, game);
});

test("monitor falls back to the Valve Web API when SourceTV has no entry", async () => {
  const apiStats = { match: { match_id: "8988000000", game_time: 900 } };
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({ ok: true, serverSteamId: "90123456789012345" }),
      findGameByServerId: async () => null,
    },
    statsClient: { getRealtimeStats: async () => apiStats },
    now: clock,
  });

  const status = await monitor.poll();

  assert.equal(status.phase, "detailed_stats");
  assert.equal(status.source, "valve_web_api");
  assert.deepEqual(status.game, apiStats);
});

test("monitor reports which external operation failed", async () => {
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => {
        throw new Error("connection reset");
      },
    },
    now: clock,
  });

  assert.deepEqual(await monitor.poll(), {
    phase: "transient_error",
    operation: "spectate_friend",
    reason: "Steam or Valve did not answer this poll",
    observedAt: "2026-09-08T10:00:00.000Z",
  });
});

test("monitor rejects a malformed successful spectate outcome", async () => {
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({ ok: true }),
      findGameByServerId: async () => null,
    },
    now: clock,
  });

  await assert.rejects(() => monitor.poll(), /server Steam ID/);
});

test("monitor rejects a response that violates the spectate contract", async () => {
  const monitor = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: { spectateFriend: async () => null },
    now: clock,
  });

  await assert.rejects(() => monitor.poll(), /result contract/);
});

test("monitor identifies SourceTV and realtime-stat failures", async () => {
  const sourceTvFailure = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({ ok: true, serverSteamId: "90123456789012345" }),
      findGameByServerId: async () => {
        throw new Error("SourceTV unavailable");
      },
    },
    now: clock,
  });
  const statsFailure = createMonitor({
    friendSteamId64: "76561198000000000",
    requestLive: false,
    liveClient: {
      spectateFriend: async () => ({ ok: true, serverSteamId: "90123456789012345" }),
      findGameByServerId: async () => null,
    },
    statsClient: {
      getRealtimeStats: async () => {
        throw new Error("Web API unavailable");
      },
    },
    now: clock,
  });

  assert.equal((await sourceTvFailure.poll()).operation, "source_tv");
  assert.equal((await statsFailure.poll()).operation, "realtime_stats");
});
