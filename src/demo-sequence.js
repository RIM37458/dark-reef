function frame(phase, detail = {}) {
  return Object.freeze({
    status: Object.freeze({
      phase,
      observedAt: new Date().toISOString(),
      ...detail,
    }),
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
      game: {
        matchId: "8988000007",
        gameTime: 1287,
        radiantScore: 21,
        direScore: 18,
        radiantLead: 3642,
        spectators: 13,
      },
    })), 2800),
    setTimeoutFn(() => onFrame(frame("detailed_stats", {
      source: "dark_reef_drill",
      serverSteamId: "70000000000000007",
      game: {
        matchId: "8988000007",
        gameTime: 1307,
        radiantScore: 21,
        direScore: 19,
        radiantLead: 2804,
        spectators: 15,
      },
    })), 4800),
    setTimeoutFn(() => onFrame(frame("detailed_stats", {
      source: "dark_reef_drill",
      serverSteamId: "70000000000000007",
      game: {
        matchId: "8988000007",
        gameTime: 1327,
        radiantScore: 22,
        direScore: 19,
        radiantLead: 3410,
        spectators: 16,
      },
    })), 6800),
  ];
  return Object.freeze({
    cancel() {
      for (const timer of timers) clearTimeoutFn(timer);
    },
  });
}
