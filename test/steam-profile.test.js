import test from "node:test";
import assert from "node:assert/strict";

import { loadSteamProfile } from "../src/steam-profile.js";

test("loadSteamProfile turns a trusted Steam avatar into renderer-safe data", async () => {
  const calls = [];
  const profile = await loadSteamProfile({
    apiKey: "secret-key",
    steamId64: "76561198000000000",
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return Response.json({
          response: {
            players: [{
              personaname: "The Prisoner",
              avatarfull: "https://avatars.steamstatic.com/portrait.jpg",
            }],
          },
        });
      }
      return new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
      });
    },
  });

  assert.equal(profile.steamId64, "76561198000000000");
  assert.equal(profile.personaName, "The Prisoner");
  assert.equal(profile.avatarDataUrl, "data:image/jpeg;base64,AQID");
  assert.equal(profile.profileStatus, "available");
  assert.match(calls[0], /GetPlayerSummaries\/v0002/);
  assert.equal(calls[1], "https://avatars.steamstatic.com/portrait.jpg");
});

test("loadSteamProfile keeps a sealed placeholder without an API key", async () => {
  const profile = await loadSteamProfile({ steamId64: "76561198000000000" });
  assert.deepEqual(profile, {
    steamId64: "76561198000000000",
    profileStatus: "unavailable",
    profileReason: "no_profile_source",
  });
});

test("loadSteamProfile reads a friend's portrait from the logged-in Steam session", async () => {
  const profile = await loadSteamProfile({
    steamId64: "76561198000000000",
    steamUser: {
      async getPersonas() {
        return {
          personas: {
            "76561198000000000": {
              player_name: "Cell Seven",
              avatar_url_full: "https://steamcdn-a.akamaihd.net/avatar_full.jpg",
            },
          },
        };
      },
    },
    fetchImpl: async () => new Response(Uint8Array.from([4, 5]), {
      headers: { "content-type": "image/jpeg" },
    }),
  });

  assert.deepEqual(profile, {
    steamId64: "76561198000000000",
    personaName: "Cell Seven",
    avatarDataUrl: "data:image/jpeg;base64,BAU=",
    profileStatus: "available",
  });
});

test("loadSteamProfile refuses avatar hosts outside Steam infrastructure", async () => {
  const profile = await loadSteamProfile({
    apiKey: "secret-key",
    steamId64: "76561198000000000",
    fetchImpl: async () => Response.json({
      response: {
        players: [{ personaname: "Prisoner", avatarfull: "https://example.com/a.jpg" }],
      },
    }),
  });

  assert.deepEqual(profile, {
    steamId64: "76561198000000000",
    personaName: "Prisoner",
    profileStatus: "partial",
    profileReason: "avatar_unavailable",
  });
});

test("loadSteamProfile exposes Web API failures", async () => {
  const profile = await loadSteamProfile({
    apiKey: "secret-key",
    steamId64: "76561198000000000",
    fetchImpl: async () => {
      throw new Error("connection reset");
    },
  });

  assert.deepEqual(profile, {
    steamId64: "76561198000000000",
    profileStatus: "error",
    profileReason: "steam_web_api_failed",
  });
});

test("loadSteamProfile distinguishes persona failure from a missing profile", async () => {
  const failed = await loadSteamProfile({
    steamId64: "76561198000000000",
    steamUser: {
      getPersonas: async () => {
        throw new Error("persona service unavailable");
      },
    },
  });
  const missing = await loadSteamProfile({
    steamId64: "76561198000000000",
    steamUser: { getPersonas: async () => ({ personas: {} }) },
  });

  assert.equal(failed.profileStatus, "error");
  assert.equal(failed.profileReason, "persona_lookup_failed");
  assert.equal(missing.profileStatus, "unavailable");
  assert.equal(missing.profileReason, "profile_not_found");
});

test("loadSteamProfile exposes Web API HTTP failures", async () => {
  const profile = await loadSteamProfile({
    apiKey: "secret-key",
    steamId64: "76561198000000000",
    fetchImpl: async () => new Response("unavailable", { status: 503 }),
  });

  assert.equal(profile.profileStatus, "error");
  assert.equal(profile.profileReason, "steam_web_api_http_error");
});

test("loadSteamProfile cancels a chunked avatar response above the byte limit", async () => {
  let request = 0;
  let pulls = 0;
  let cancelled = false;
  const oversizedAvatar = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls > 2) throw new Error("avatar reader consumed past its limit");
      controller.enqueue(new Uint8Array(600 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });

  const profile = await loadSteamProfile({
    apiKey: "secret-key",
    steamId64: "76561198000000000",
    fetchImpl: async () => {
      request += 1;
      if (request === 1) {
        return Response.json({ response: { players: [{
          personaname: "Prisoner",
          avatarfull: "https://avatars.steamstatic.com/portrait.jpg",
        }] } });
      }
      return new Response(oversizedAvatar, { headers: { "content-type": "image/jpeg" } });
    },
  });

  assert.equal(cancelled, true);
  assert.equal(pulls, 2);
  assert.deepEqual(profile, {
    steamId64: "76561198000000000",
    personaName: "Prisoner",
    profileStatus: "partial",
    profileReason: "avatar_unavailable",
  });
});
