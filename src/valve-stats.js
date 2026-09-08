const ENDPOINT =
  "https://api.steampowered.com/IDOTA2MatchStats_570/GetRealtimeStats/v1/";
const SERVER_STEAM_ID_PATTERN = /^9\d{16}$/;

export function createValveStatsClient({
  apiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
}) {
  if (!apiKey) throw new Error("A Steam Web API key is required");
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");

  return Object.freeze({
    async getRealtimeStats(serverSteamId) {
      if (!SERVER_STEAM_ID_PATTERN.test(serverSteamId)) {
        throw new Error("Invalid Dota server Steam ID");
      }

      const url = new URL(ENDPOINT);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("server_steam_id", serverSteamId);
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Valve realtime stats returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Valve realtime stats returned invalid JSON");
      }
      return Object.keys(payload).length === 0 ? null : payload;
    },
  });
}
