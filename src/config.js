const STEAM_ID64_PATTERN = /^7656119\d{10}$/;

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function boundedInteger(raw, name, fallback, min, max) {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function boolean(raw, name, fallback) {
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function parseConfig(env) {
  const friendSteamId64 = required(env, "FRIEND_STEAM_ID64");
  if (!STEAM_ID64_PATTERN.test(friendSteamId64)) {
    throw new Error("FRIEND_STEAM_ID64 must be a valid individual SteamID64");
  }

  return Object.freeze({
    steam: Object.freeze({
      accountName: required(env, "STEAM_ACCOUNT"),
      password: env.STEAM_PASSWORD?.trim() || undefined,
      refreshToken: env.STEAM_REFRESH_TOKEN?.trim() || undefined,
      sessionFile: env.STEAM_SESSION_FILE?.trim() || "./data/session.json",
    }),
    friendSteamId64,
    steamWebApiKey: env.STEAM_WEB_API_KEY?.trim() || undefined,
    requestLive: boolean(env.REQUEST_LIVE, "REQUEST_LIVE", false),
    pollIntervalMs: boundedInteger(
      env.POLL_INTERVAL_MS,
      "POLL_INTERVAL_MS",
      30_000,
      5_000,
      300_000,
    ),
    http: Object.freeze({
      host: "127.0.0.1",
      port: boundedInteger(env.HTTP_PORT, "HTTP_PORT", 8787, 1, 65_535),
    }),
  });
}
