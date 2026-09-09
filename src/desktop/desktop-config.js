import { parseConfig } from "../config.js";

function boundedText(input, name, maxLength) {
  const value = input[name];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`${name} must be text no longer than ${maxLength} characters`);
  }
  return value;
}

export function createDesktopConfig(input, { sessionFile }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("A configuration object is required");
  }
  if (typeof sessionFile !== "string" || !sessionFile) {
    throw new Error("A session file is required");
  }
  return parseConfig({
    STEAM_ACCOUNT: boundedText(input, "accountName", 128),
    STEAM_PASSWORD: boundedText(input, "password", 256),
    STEAM_GUARD_CODE: boundedText(input, "guardCode", 32),
    STEAM_SESSION_FILE: sessionFile,
    FRIEND_STEAM_ID64: boundedText(input, "friendSteamId64", 17),
    STEAM_WEB_API_KEY: boundedText(input, "webApiKey", 128),
    WINDOWS_NOTIFICATIONS: "false",
    POLL_INTERVAL_MS: "20000",
  });
}
