function frame(phase, detail = {}) {
  return Object.freeze({
    status: Object.freeze({
      phase,
      observedAt: new Date().toISOString(),
      ...detail,
    }),
  });
}

function demoGame({ gameTime, radiantScore, direScore, radiantLead, spectators, deaths, items }) {
  return {
    match: { matchId: "8988000007", gameTime },
    spectators,
    teams: [
      {
        teamNumber: 2,
        score: radiantScore,
        netWorth: 60_000 + radiantLead,
        players: [{
          accountId: 7,
          heroId: 93,
          level: 21,
          kills: 9,
          deaths,
          assists: 14,
          lastHits: 221,
          denies: 8,
          netWorth: 17_320,
          items,
        }],
      },
      { teamNumber: 3, score: direScore, netWorth: 60_000, players: [] },
    ],
  };
}

function battleFrame(detail) {
  return frame("detailed_stats", {
    source: "dark_reef_drill",
    serverSteamId: "70000000000000007",
    game: demoGame(detail),
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
    setTimeoutFn(() => onFrame(battleFrame({
      gameTime: 1287,
      radiantScore: 21,
      direScore: 18,
      radiantLead: 3642,
      spectators: 13,
      deaths: 3,
      items: [63, 174, 152],
    })), 2800),
    setTimeoutFn(() => onFrame(battleFrame({
      gameTime: 1307,
      radiantScore: 21,
      direScore: 19,
      radiantLead: 2804,
      spectators: 15,
      deaths: 4,
      items: [63, 174, 152, 116],
    })), 4800),
    setTimeoutFn(() => onFrame(battleFrame({
      gameTime: 1327,
      radiantScore: 22,
      direScore: 19,
      radiantLead: 3410,
      spectators: 16,
      deaths: 4,
      items: [63, 174, 152, 116, 143],
    })), 6800),
  ];
  return Object.freeze({
    cancel() {
      for (const timer of timers) clearTimeoutFn(timer);
    },
  });
}
