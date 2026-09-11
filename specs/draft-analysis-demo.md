# Spec: Draft Analysis and Integrated Demo

## Objective

Make hero selection visible and understandable before a live Dota window is available. One complete demonstration starts with a ten-player draft board, updates analysis after every simulated pick, and then continues into the existing Slark battle simulation. Real draft entry is a separate product surface rather than another battle-assistant toolbar button.

## Commands

- Focused tests: `node --test test/assistant-catalog.test.js test/draft-analysis.test.js test/draft-demo.test.js test/draft-profile.test.js`
- Full gate: `pnpm run check:task`
- Windows package: `pnpm exec electron-builder --win nsis portable --x64`

## Project structure

- `src/assistant/` owns item facts, versioned matchup snapshots, personal relationship/build schemas, and pure draft analysis.
- `scripts/sync-matchups.js` refreshes a bundled offline snapshot from a named public provider.
- `src/demo-draft.js` owns deterministic ten-player demonstration frames.
- `src/desktop/draft-room-*` owns the visible draft surface and its presentation logic.
- `test/` verifies facts, migrations, scoring, and demo sequencing without Dota or network access.

## Code style

```js
const analysis = analyzeDraft({ radiantHeroIds, direHeroIds, catalog, profile });
return Object.freeze({ coverage: analysis.coverage, recommendations: analysis.recommendations });
```

Pure functions accept normalized data and return immutable renderer-safe results. Comments explain only non-obvious decisions.

## Testing strategy

- Unit tests cover item sanitization, matchup provenance/sample validation, profile v1-to-v2 migration, evidence-weighted counter scoring, role gaps, item rules, and sequence order.
- Existing coverage floors remain unchanged.
- Runtime UI verification must not require Steam, Dota, or external network access.

## Boundaries

- Always: show the statistical scope, sample size, fetch time, and provider; keep low-sample rows out of ranking; preserve existing v1 private hero pools; encode UI text with DOM text nodes.
- Ask first: telemetry, account upload, or an automatic background update channel.
- Never: label personal/curated counter relations as Valve facts; infer hidden picks; automate a Dota selection; place demo controls back in the battle-assistant toolbar.

## Success criteria

- Catalog includes sanitized purchasable item facts from the bundled Dota dataset.
- Private profile stores directional hero relations and situational item plans, while existing v1 files migrate without loss.
- Analysis updates for every visible pick and explains role gaps, statistically supported counter edges, familiarity, and item situations.
- Demo shows ten pick slots and the hero grid before continuing into the existing battle simulation.
- The draft feature has a dedicated entry/screen, and the tactical toolbar no longer contains the draft deployment button.

## Assumptions

- The bundled matchup layer is an OpenDota professional-match snapshot and is never described as all-player or Valve-official data.
- Objective matchup evidence is primary; personal proficiency and notes are a separate secondary weight.
- Rows below the configured minimum sample size remain inspectable but do not affect recommendations.
- A later high-rank public-match provider can coexist without blending populations or changing personal data.
