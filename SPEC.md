# Spec: Dota 2 Friend Watcher

## Objective

Run as a Windows desktop application, log a Steam account into the Dota 2 Game Coordinator, request delayed spectating for one Steam friend, show the current state in a main window, expose the latest discovery and optional Valve realtime-stat result as JSON, and notify the signed-in Windows desktop when a game is first discovered.

The service must be honest about Valve's boundary: an ordinary public match may yield a spectate server id but no detailed live scoreboard. That state is reported as `spectating_unlisted`, not treated as an application failure.

## Tech Stack

- Node.js 24 or newer, ECMAScript modules
- pnpm 11.19.0
- `dotakit` 0.4.0 for Steam login and Dota 2 GC messages
- `steam-user` 5.3.0 as dotakit's peer dependency
- Node's built-in test runner and HTTP server

## Commands

- Install: `pnpm install --frozen-lockfile`
- Test: `pnpm test`
- Static check: `pnpm run check`
- Run: `pnpm start`

## Project Structure

- `src/` — configuration, monitor, Valve API adapter, HTTP server, entry point
- `src/desktop/` — sandboxed renderer, narrow preload bridge, and Electron lifecycle
- `test/` — unit and local integration tests
- `tasks/` — implementation plan and checklist
- `data/` — ignored local Steam session data

## Code Style

Use small ESM modules, explicit dependency injection at network boundaries, and structured state rather than log parsing.

```js
export function createMonitor({ liveClient, statsClient, now }) {
  return { async poll() { /* return one immutable status snapshot */ } };
}
```

Comments explain only non-obvious protocol reasons.

## Testing Strategy

- Pure unit tests for configuration and status transitions.
- Boundary tests with fake GC and fetch clients.
- Localhost-only integration test for the HTTP status endpoint.
- No test logs into Steam or depends on a live match.

## Boundaries

- Always: validate environment input, bind HTTP to loopback, redact credentials, time out network calls, report GC limitations explicitly.
- Ask first: add persistent match storage, public network binding, or additional third-party services.
- Never: commit Steam credentials/tokens, bypass fog-of-war, read Dota process memory, or claim full ordinary-pub telemetry when Valve does not expose it.

## Success Criteria

- Starts without the Dota 2 desktop client.
- Ships as an installable Windows `.exe` and a portable Windows `.exe`.
- Accepts account, target friend, optional password/Steam Guard code, and optional Web API key in the main window.
- Logs in through a session file/refresh token or first-run password flow.
- Requests delayed friend spectating (`live: false` by default).
- Exposes `GET /health` and `GET /status` on `127.0.0.1`.
- Shows one Windows desktop notification when monitoring changes from no discovered game to a discovered game; repeated polls do not repeat it.
- Keeps monitoring from the notification-area tray when the main window is closed.
- Allows desktop notifications to be disabled through validated configuration.
- Optionally calls Valve `GetRealtimeStats` when a Web API key is configured.
- Distinguishes offline, unavailable, server-id-only, detailed-stats, authentication, and transient failures.
- Tests and static checks pass without Steam credentials.

## Open Questions

- None required for the first version. The target SteamID64 and credentials are runtime configuration.
