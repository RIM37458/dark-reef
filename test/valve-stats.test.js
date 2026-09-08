import test from "node:test";
import assert from "node:assert/strict";

import { createValveStatsClient } from "../src/valve-stats.js";

test("Valve stats client calls only the fixed HTTPS endpoint", async () => {
  let requestedUrl;
  const client = createValveStatsClient({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({ match: { match_id: "8988000000" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.getRealtimeStats("90123456789012345");

  assert.equal(requestedUrl.origin, "https://api.steampowered.com");
  assert.equal(
    requestedUrl.pathname,
    "/IDOTA2MatchStats_570/GetRealtimeStats/v1/",
  );
  assert.equal(requestedUrl.searchParams.get("server_steam_id"), "90123456789012345");
  assert.equal(result.match.match_id, "8988000000");
});

test("Valve stats client rejects malformed server ids before fetching", async () => {
  const client = createValveStatsClient({
    apiKey: "test-key",
    fetchImpl: async () => assert.fail("fetch must not run"),
  });

  await assert.rejects(() => client.getRealtimeStats("https://example.com"), /server Steam ID/);
});

test("Valve stats client maps an empty object to unavailable stats", async () => {
  const client = createValveStatsClient({
    apiKey: "test-key",
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });

  assert.equal(await client.getRealtimeStats("90123456789012345"), null);
});
