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
