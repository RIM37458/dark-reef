function frame(phase, detail = {}) {
  return Object.freeze({
    status: Object.freeze({
      phase,
      observedAt: new Date().toISOString(),
      ...detail,
    }),
    notify: phase === "detailed_stats",
  });
}

export function createDemoSequence({
  onFrame,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
}) {
  onFrame(frame("starting"));
  const timers = [
    setTimeoutFn(() => onFrame(frame("unavailable")), 1200),
    setTimeoutFn(() => onFrame(frame("detailed_stats", {
      source: "dark_reef_drill",
      serverSteamId: "70000000000000007",
    })), 2800),
  ];
  return Object.freeze({
    cancel() {
      for (const timer of timers) clearTimeoutFn(timer);
    },
  });
}
