export const TRAINING_CAPTURE_INTERVAL_MS = 250;
export const TRAINING_CAPTURE_MAXIMUM_BYTES = 768 * 1024 * 1024;
export const TRAINING_CAPTURE_FRAME_SIZE = Object.freeze({ width: 960, height: 540 });

export function assertVerifiedDotaSource(sourceId, binding) {
  if (binding?.status !== "bound" || binding.sourceId !== sourceId || !String(sourceId).startsWith("window:")) {
    throw new RangeError("视觉训练只允许捕获已验证的 Dota 2 窗口");
  }
  return sourceId;
}

export function captureDirectoriesToRemove({ sessions, maximumBytes, activeName }) {
  if (!Array.isArray(sessions) || !Number.isFinite(maximumBytes) || maximumBytes < 0) {
    throw new TypeError("视觉训练存储策略无效");
  }
  const completed = sessions
    .filter(({ name }) => name !== activeName)
    .sort((left, right) => left.modifiedAt - right.modifiedAt || left.name.localeCompare(right.name));
  let total = sessions.reduce((sum, { bytes }) => sum + Math.max(0, Number(bytes) || 0), 0);
  const remove = [];
  for (const session of completed) {
    if (total <= maximumBytes) break;
    remove.push(session.name);
    total -= Math.max(0, Number(session.bytes) || 0);
  }
  return Object.freeze(remove);
}
