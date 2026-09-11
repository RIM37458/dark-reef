import { createStatusServer } from "./http-server.js";
import { createMonitor } from "./monitor.js";
import { createValveStatsClient } from "./valve-stats.js";
import { shouldNotifyGameFound } from "./windows-notifier.js";

function buildLoginOptions(steam, tokenStore, storedRefreshToken, onTokenError) {
  const options = {
    accountName: steam.accountName,
    waitForGC: true,
  };
  if (!tokenStore && steam.sessionFile) options.sessionFile = steam.sessionFile;
  if (steam.refreshToken ?? storedRefreshToken) options.refreshToken = steam.refreshToken ?? storedRefreshToken;
  else if (steam.password) options.password = steam.password;
  if (steam.guardCode) options.guardCode = steam.guardCode;
  if (tokenStore) {
    options.onSession = (session) => session.on("token", (token) => {
      try {
        tokenStore.save(steam.accountName, token);
      } catch (error) {
        onTokenError(error);
      }
    });
  }
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
    notify = () => false,
    onNotificationError = console.warn,
    tokenStore,
    onTokenError = console.warn,
    onStatus = () => {},
    onConnected = () => {},
  },
) {
  const storedRefreshToken = tokenStore && !config.steam.refreshToken
    ? tokenStore.load(config.steam.accountName)
    : undefined;
  const bot = await loginDota(buildLoginOptions(config.steam, tokenStore, storedRefreshToken, onTokenError));
  let server;
  try {
    onConnected(bot);
    const statsClient = config.steamWebApiKey
      ? statsClientFactory({ apiKey: config.steamWebApiKey })
      : undefined;
    const monitor = monitorFactory({
      friendSteamId64: config.friendSteamId64,
      requestLive: config.requestLive,
      liveClient: bot.live,
      statsClient,
    });
    server = serverFactory({ getStatus: monitor.getStatus });

    let polling = false;
    let previousStatus = monitor.getStatus();
    const pollOnce = async () => {
      if (polling) return;
      polling = true;
      try {
        const nextStatus = (await monitor.poll()) ?? monitor.getStatus();
        if (shouldNotifyGameFound(previousStatus, nextStatus)) {
          try {
            notify(nextStatus);
          } catch (error) {
            onNotificationError(error);
          }
        }
        previousStatus = nextStatus;
        onStatus(nextStatus);
      } finally {
        polling = false;
      }
    };

    await server.listen(config.http);
    await pollOnce();

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
  } catch (error) {
    try {
      if (server) await server.close();
    } finally {
      bot.logout();
    }
    throw error;
  }
}
