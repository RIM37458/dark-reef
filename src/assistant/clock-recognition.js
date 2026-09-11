import { parseGameTime } from "./game-clock.js";

export function parseRecognizedClock(input) {
  const raw = String(input ?? "").trim().toUpperCase();
  if (/[A-NP-Z]/.test(raw)) throw new TypeError("could not recognize a game clock");
  const normalized = raw
    .replaceAll("O", "0")
    .replace(/[;.]/g, ":")
    .replace(/\s/g, "");
  const match = normalized.match(/-?\d{1,3}:\d{2}/);
  if (!match) throw new TypeError("could not recognize a game clock");
  return parseGameTime(match[0]);
}

export function acceptClockSample({ previous, sample, elapsedSeconds }) {
  if (!Number.isInteger(sample) || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return false;
  if (!Number.isInteger(previous)) return true;
  const expected = previous + elapsedSeconds;
  return Math.abs(sample - expected) <= Math.max(3, Math.ceil(elapsedSeconds * 0.5));
}
