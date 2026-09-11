const UNLISTED_REASON =
  "Valve does not list most ordinary public matches in the SourceTV feed";
const SERVER_STEAM_ID = /^9\d{16}$/;

function observedAt(now) {
  return now().toISOString();
}

function assertSpectateOutcome(outcome) {
  if (!outcome || typeof outcome !== "object" || typeof outcome.ok !== "boolean") {
    throw new TypeError("Steam spectate response violated its result contract");
  }
  if (outcome.ok && !SERVER_STEAM_ID.test(String(outcome.serverSteamId))) {
    throw new TypeError("Steam spectate response contained an invalid server Steam ID");
  }
}

export function createMonitor({
  friendSteamId64,
  requestLive,
  liveClient,
  statsClient,
  now = () => new Date(),
}) {
  let status = Object.freeze({
    phase: "starting",
    observedAt: observedAt(now),
  });

  async function poll() {
    let outcome;
    try {
      outcome = await liveClient.spectateFriend(friendSteamId64, {
        live: requestLive,
      });
    } catch {
      status = Object.freeze({
        phase: "transient_error",
        operation: "spectate_friend",
        reason: "Steam or Valve did not answer this poll",
        observedAt: observedAt(now),
      });
      return status;
    }
    assertSpectateOutcome(outcome);

    if (!outcome.ok) {
      status = Object.freeze({
        phase: "unavailable",
        reason: outcome.resultName,
        result: outcome.result,
        observedAt: observedAt(now),
      });
      return status;
    }

    let sourceTvGame;
    try {
      sourceTvGame = await liveClient.findGameByServerId(
        outcome.serverSteamId,
      );
    } catch {
      status = Object.freeze({
        phase: "transient_error",
        operation: "source_tv",
        reason: "Steam or Valve did not answer this poll",
        observedAt: observedAt(now),
      });
      return status;
    }
    if (sourceTvGame) {
      status = Object.freeze({
        phase: "detailed_stats",
        source: "gc_source_tv",
        serverSteamId: outcome.serverSteamId,
        game: sourceTvGame,
        observedAt: observedAt(now),
      });
      return status;
    }

    let apiStats = null;
    if (statsClient) {
      try {
        apiStats = await statsClient.getRealtimeStats(outcome.serverSteamId);
      } catch {
        status = Object.freeze({
          phase: "transient_error",
          operation: "realtime_stats",
          reason: "Steam or Valve did not answer this poll",
          observedAt: observedAt(now),
        });
        return status;
      }
    }
    status = apiStats
      ? Object.freeze({
          phase: "detailed_stats",
          source: "valve_web_api",
          serverSteamId: outcome.serverSteamId,
          game: apiStats,
          observedAt: observedAt(now),
        })
      : Object.freeze({
          phase: "spectating_unlisted",
          serverSteamId: outcome.serverSteamId,
          reason: UNLISTED_REASON,
          observedAt: observedAt(now),
        });
    return status;
  }

  return Object.freeze({ poll, getStatus: () => status });
}
