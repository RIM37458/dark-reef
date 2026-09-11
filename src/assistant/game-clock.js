const GAME_TIME_PATTERN = /^(-)?(\d{1,3}):(\d{2})$/;

export function parseGameTime(value) {
  const match = GAME_TIME_PATTERN.exec(String(value).trim());
  if (!match || Number(match[3]) > 59) throw new TypeError("game time must use [-]m:ss");
  const seconds = Number(match[2]) * 60 + Number(match[3]);
  return match[1] ? -seconds : seconds;
}

export function formatGameTime(value) {
  if (!Number.isInteger(value)) throw new TypeError("game time must be an integer");
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
}

function validCooldowns(values) {
  if (!Array.isArray(values)) return [];
  return values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
}

export function cooldownObservation({ observedAt, cooldowns, level, reductionPercent = 0 }) {
  if (!Number.isInteger(observedAt)) throw new TypeError("observed game time must be an integer");
  const values = validCooldowns(cooldowns);
  if (values.length === 0) throw new TypeError("cooldown values are required");
  if (!Number.isFinite(reductionPercent) || reductionPercent < 0 || reductionPercent > 75) {
    throw new RangeError("cooldown reduction must be between 0 and 75");
  }
  let candidates = values;
  if (level !== undefined && level !== null) {
    if (!Number.isInteger(level) || level < 1 || level > values.length) {
      throw new RangeError("ability level is outside the cooldown table");
    }
    candidates = [values[level - 1]];
  }
  const multiplier = 1 - reductionPercent / 100;
  const durations = candidates.map((value) => Math.ceil(value * multiplier));
  const shortest = Math.min(...durations);
  const longest = Math.max(...durations);
  return Object.freeze({
    observedAt,
    readyFrom: observedAt + shortest,
    readyTo: observedAt + longest,
    confidence: shortest === longest ? "exact" : "range",
  });
}

export function presentCooldown(observation, currentTime) {
  if (!observation || !Number.isInteger(currentTime)) return { state: "unknown", label: "未记录" };
  if (currentTime >= observation.readyTo) return { state: "ready", label: "已就绪" };
  if (currentTime >= observation.readyFrom) {
    return {
      state: "uncertain",
      label: `可能就绪 · 最迟${observation.readyTo - currentTime}秒`,
    };
  }
  const remainingFrom = observation.readyFrom - currentTime;
  const remainingTo = observation.readyTo - currentTime;
  return {
    state: "cooling",
    label: remainingFrom === remainingTo ? `${remainingTo}秒` : `${remainingFrom}–${remainingTo}秒`,
  };
}
