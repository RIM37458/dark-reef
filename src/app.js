import { createStatusServer } from "./http-server.js";
import { createMonitor } from "./monitor.js";
import { createValveStatsClient } from "./valve-stats.js";

function buildLoginOptions(steam) {
  const options = {
    accountName: steam.accountName,
    sessionFile: steam.sessionFile,
    waitForGC: true,
  };
  if (steam.refreshToken) options.refreshToken = steam.refreshToken;
  else if (steam.password) options.password = steam.password;
  return options;
}

export async function startWatcher(
  config,
  {
    loginDota,
    monitorFactory = createMonitor,
    statsClientFactory = createValveStatsClient,
    serverFactory = createStatusServer,
    setIntervalFn = globalThis.setInterval,
    clearIntervalFn = globalThis.clearInterval,
  },
) {
  const bot = await loginDota(buildLoginOptions(config.steam));
  const statsClient = config.steamWebApiKey
    ? statsClientFactory({ apiKey: config.steamWebApiKey })
    : undefined;
  const monitor = monitorFactory({
    friendSteamId64: config.friendSteamId64,
    requestLive: config.requestLive,
    liveClient: bot.live,
    statsClient,
  });
  const server = serverFactory({ getStatus: monitor.getStatus });

  try {
    await server.listen(config.http);
    await monitor.poll();
  } catch (error) {
    await server.close();
    bot.logout();
    throw error;
  }

  let polling = false;
  const pollOnce = async () => {
    if (polling) return;
    polling = true;
    try {
      await monitor.poll();
    } finally {
      polling = false;
    }
  };
  const interval = setIntervalFn(pollOnce, config.pollIntervalMs);
  interval.unref?.();
  let stopped = false;

  return Object.freeze({
    getStatus: monitor.getStatus,
    async stop() {
      if (stopped) return;
      stopped = true;
      clearIntervalFn(interval);
      try {
        await server.close();
      } finally {
        bot.logout();
      }
    },
  });
}
