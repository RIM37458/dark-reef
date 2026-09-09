function frame(phase, detail = {}) {
  return Object.freeze({
    status: Object.freeze({
      phase,
      observedAt: new Date().toISOString(),
      ...detail,
    }),
  });
}

const DEMO_ROSTER = Object.freeze([
  { accountId: 7, team: 2, heroId: 93 },
  { accountId: 8, team: 2, heroId: 2 },
  { accountId: 9, team: 2, heroId: 5 },
  { accountId: 10, team: 2, heroId: 8 },
  { accountId: 11, team: 2, heroId: 26 },
  { accountId: 12, team: 3, heroId: 28 },
  { accountId: 13, team: 3, heroId: 6 },
  { accountId: 14, team: 3, heroId: 14 },
  { accountId: 15, team: 3, heroId: 74 },
  { accountId: 16, team: 3, heroId: 11 },
]);

const DEMO_POSITIONS = Object.freeze([
  [[-3800, -1200], [-3000, -2500], [-5200, -3500], [-1000, -5000], [-5800, 500], [2600, 2200], [4800, 4100], [5400, 900], [1600, 4800], [500, 900]],
  [[-2500, -200], [-2100, -1400], [-4200, -2600], [100, -3900], [-4700, 1200], [1700, 1100], [3900, 3300], [4300, 200], [700, 3900], [-300, 300]],
  [[-900, 700], [-1200, -400], [-3200, -1700], [1200, -2700], [-3500, 1800], [600, 400], [3000, 2500], [3300, -500], [-100, 3000], [-1100, -500]],
]);

const DEMO_BUILDINGS = Object.freeze([
  { team: 2, type: 1, lane: 1, tier: 1, x: -6200, y: 2100, destroyed: false },
  { team: 2, type: 1, lane: 1, tier: 2, x: -6100, y: -1800, destroyed: false },
  { team: 2, type: 1, lane: 2, tier: 1, x: -3600, y: -3600, destroyed: false },
  { team: 2, type: 1, lane: 2, tier: 2, x: -5100, y: -5100, destroyed: false },
  { team: 2, type: 1, lane: 3, tier: 1, x: 1800, y: -6100, destroyed: false },
  { team: 2, type: 1, lane: 3, tier: 2, x: -2100, y: -6200, destroyed: false },
  { team: 3, type: 1, lane: 1, tier: 1, x: -1800, y: 6100, destroyed: false },
  { team: 3, type: 1, lane: 1, tier: 2, x: 2100, y: 6200, destroyed: false },
  { team: 3, type: 1, lane: 2, tier: 1, x: 3600, y: 3600, destroyed: false },
  { team: 3, type: 1, lane: 2, tier: 2, x: 5100, y: 5100, destroyed: false },
  { team: 3, type: 1, lane: 3, tier: 1, x: 6200, y: -2100, destroyed: false },
  { team: 3, type: 1, lane: 3, tier: 2, x: 6100, y: 1800, destroyed: false },
]);

function demoPlayer(player, position, deaths, items) {
  const target = player.accountId === 7;
  return {
    ...player,
    x: position[0],
    y: position[1],
    level: target ? 21 : 19,
    kills: target ? 9 : 5,
    deaths: target ? deaths : 6,
    assists: target ? 14 : 11,
    lastHits: target ? 221 : 154,
    denies: target ? 8 : 4,
    netWorth: target ? 17_320 : 13_200,
    respawnTime: target && deaths === 4 ? 18 : 0,
    items: target ? items : [],
  };
}

function demoGame({ step, gameTime, radiantScore, direScore, radiantLead, spectators, deaths, items }) {
  const players = DEMO_ROSTER.map((player, index) => (
    demoPlayer(player, DEMO_POSITIONS[step][index], deaths, items)
  ));
  return {
    match: { matchId: "8988000007", gameTime },
    spectators,
    buildings: DEMO_BUILDINGS,
    teams: [
      {
        teamNumber: 2,
        score: radiantScore,
        netWorth: 60_000 + radiantLead,
        players: players.filter(({ team }) => team === 2),
      },
      { teamNumber: 3, score: direScore, netWorth: 60_000, players: players.filter(({ team }) => team === 3) },
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
      step: 0,
      gameTime: 1287,
      radiantScore: 21,
      direScore: 18,
      radiantLead: 3642,
      spectators: 13,
      deaths: 3,
      items: [63, 174, 152],
    })), 2800),
    setTimeoutFn(() => onFrame(battleFrame({
      step: 1,
      gameTime: 1307,
      radiantScore: 21,
      direScore: 19,
      radiantLead: 2804,
      spectators: 15,
      deaths: 4,
      items: [63, 174, 152, 116],
    })), 4800),
    setTimeoutFn(() => onFrame(battleFrame({
      step: 2,
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
