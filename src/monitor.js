const UNLISTED_REASON =
  "Valve does not list most ordinary public matches in the SourceTV feed";

function observedAt(now) {
  return now().toISOString();
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
    try {
      const outcome = await liveClient.spectateFriend(friendSteamId64, {
        live: requestLive,
      });

      if (!outcome.ok) {
        status = Object.freeze({
          phase: "unavailable",
          reason: outcome.resultName,
          result: outcome.result,
          observedAt: observedAt(now),
        });
        return status;
      }

      const sourceTvGame = await liveClient.findGameByServerId(
        outcome.serverSteamId,
      );
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

      const apiStats = statsClient
        ? await statsClient.getRealtimeStats(outcome.serverSteamId)
        : null;
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
    } catch {
      status = Object.freeze({
        phase: "transient_error",
        reason: "Steam or Valve did not answer this poll",
        observedAt: observedAt(now),
      });
      return status;
    }
  }

  return Object.freeze({ poll, getStatus: () => status });
}
