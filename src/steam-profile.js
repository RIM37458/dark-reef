const MAX_AVATAR_BYTES = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isTrustedAvatarUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname.endsWith(".steamstatic.com") ||
      url.hostname.endsWith(".akamaihd.net")
    );
  } catch {
    return false;
  }
}

async function fetchAvatarDataUrl(url, fetchImpl) {
  if (!isTrustedAvatarUrl(url)) return undefined;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) return undefined;
  const type = response.headers.get("content-type")?.split(";", 1)[0].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(type)) return undefined;
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_AVATAR_BYTES) return undefined;
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AVATAR_BYTES) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks, totalBytes);
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

function profileResult({ steamId64, personaName, avatarDataUrl }) {
  return Object.fromEntries(Object.entries({
    steamId64,
    personaName,
    avatarDataUrl,
    profileStatus: avatarDataUrl ? "available" : "partial",
    profileReason: avatarDataUrl ? undefined : "avatar_unavailable",
  }).filter(([, value]) => value !== undefined));
}

function unavailableProfile(steamId64, profileStatus, profileReason) {
  return { steamId64, profileStatus, profileReason };
}

export async function loadSteamProfile({ apiKey, steamId64, steamUser, fetchImpl = fetch }) {
  let personaLookupFailed = false;

  if (steamUser?.getPersonas) {
    try {
      const persona = (await steamUser.getPersonas([steamId64]))?.personas?.[steamId64];
      if (persona) {
        const personaName = typeof persona.player_name === "string"
          ? persona.player_name.slice(0, 128)
          : undefined;
        const avatarDataUrl = await fetchAvatarDataUrl(persona.avatar_url_full, fetchImpl);
        return profileResult({ steamId64, personaName, avatarDataUrl });
      }
    } catch {
      personaLookupFailed = true;
    }
  }

  if (!apiKey) {
    if (personaLookupFailed) {
      return unavailableProfile(steamId64, "error", "persona_lookup_failed");
    }
    const reason = steamUser?.getPersonas ? "profile_not_found" : "no_profile_source";
    return unavailableProfile(steamId64, "unavailable", reason);
  }

  try {
    const endpoint = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("steamids", steamId64);
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      return unavailableProfile(steamId64, "error", "steam_web_api_http_error");
    }
    const player = (await response.json())?.response?.players?.[0];
    if (!player) return unavailableProfile(steamId64, "unavailable", "profile_not_found");
    const personaName = typeof player.personaname === "string"
      ? player.personaname.slice(0, 128)
      : undefined;
    const avatarDataUrl = await fetchAvatarDataUrl(player.avatarfull, fetchImpl);
    return profileResult({ steamId64, personaName, avatarDataUrl });
  } catch {
    return unavailableProfile(steamId64, "error", "steam_web_api_failed");
  }
}
