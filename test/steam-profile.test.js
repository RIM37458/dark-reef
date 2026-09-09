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
  assert.match(calls[0], /GetPlayerSummaries\/v0002/);
  assert.equal(calls[1], "https://avatars.steamstatic.com/portrait.jpg");
});

test("loadSteamProfile keeps a sealed placeholder without an API key", async () => {
  const profile = await loadSteamProfile({ steamId64: "76561198000000000" });
  assert.deepEqual(profile, { steamId64: "76561198000000000" });
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
  });
});
