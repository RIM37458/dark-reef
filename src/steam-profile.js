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
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_AVATAR_BYTES) return undefined;
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function loadSteamProfile({ apiKey, steamId64, steamUser, fetchImpl = fetch }) {
  const fallback = { steamId64 };

  if (steamUser?.getPersonas) {
    try {
      const persona = (await steamUser.getPersonas([steamId64]))?.personas?.[steamId64];
      if (persona) {
        const personaName = typeof persona.player_name === "string"
          ? persona.player_name.slice(0, 128)
          : undefined;
        const avatarDataUrl = await fetchAvatarDataUrl(persona.avatar_url_full, fetchImpl);
        return Object.fromEntries(Object.entries({ steamId64, personaName, avatarDataUrl }).filter(([, value]) => value));
      }
    } catch {
      // A public Web API lookup can still recover the portrait when the persona request times out.
    }
  }

  if (!apiKey) return fallback;

  try {
    const endpoint = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("steamids", steamId64);
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return fallback;
    const player = (await response.json())?.response?.players?.[0];
    if (!player) return fallback;
    const personaName = typeof player.personaname === "string"
      ? player.personaname.slice(0, 128)
      : undefined;
    const avatarDataUrl = await fetchAvatarDataUrl(player.avatarfull, fetchImpl);
    return Object.fromEntries(Object.entries({ steamId64, personaName, avatarDataUrl }).filter(([, value]) => value));
  } catch {
    return fallback;
  }
}
