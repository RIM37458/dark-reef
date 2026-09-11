# Implementation Plan: Battle Assistant Foundation

## Architecture decisions

- Keep Valve-derived facts read-only in `dotaconstants`; persist only normalized personal plans under Electron `userData`.
- Keep time/cooldown calculations pure and independent of Electron so uncertainty rules are testable.
- Expose a narrow assistant IPC API rather than Node or filesystem access to the sandboxed renderer.
- Deliver manual calibration first and isolate the capture/OCR adapter so recognition failure never blocks the assistant.

## Dependency graph

Catalog + plan schema + clock rules → local repository → IPC bridge → assistant screen → capture/OCR adapter → packaging.

## Task list

1. Define and test catalog, plan, clock, and cooldown contracts.
2. Persist versioned plans with atomic replacement and migration.
3. Add the narrow assistant IPC bridge and no-login navigation.
4. Build the five-slot timer and personal plan editor.
5. Add screen-clock capture with visible consent and manual fallback.
6. Verify regression tests, coverage, security, UI behavior, and Windows packaging.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Patch data becomes stale | High | Display bundled patch/version and update facts separately from plans |
| Cooldown modifiers create false precision | High | Use ranges and confidence labels; allow manual override |
| OCR fails across HUD scales | Medium | Calibrated crop, validation, and always-available manual clock |
| Imported community JSON is hostile | High | Size limits, strict normalization, no HTML rendering |
| Existing dirty worktree overlaps | Medium | Add focused modules and minimal wiring; do not reset or commit unrelated work |

## Open questions deferred from the foundation slice

- Community identity provider, hosting, moderation, and licensing.
- Trusted signing infrastructure for data-only and application updates.
- Patch-specific or rank-specific public-match corpora beyond the bundled professional snapshot.

## Automatic Dota window binding increment

- Resolve the visible main-window handle for `dota2.exe` from fixed, local Windows process metadata only.
- Match that handle against Electron capture-source ids and return an explicit bound, not-running, no-window, or unavailable state.
- Load capture sources automatically in the draft room, prefer the matched Dota window, and retain manual display/window fallback.
- Keep ban-versus-pick and team classification outside this slice until a separately verified visual classifier exists.

## Draft overlay increment

- Keep the in-game surface limited to category selection, recognition calibration, automatic scanning, and closing.
- Store custom categories and 1–5 proficiency locally, independently from Valve-derived catalog facts.
- Use a transparent mouse-through grid window and a separate interactive toolbar; never synthesize game input.
- Compare explicitly selected Dota window pixels against a user-captured clean baseline and expose changed cells as uncertain visual observations.

## Integrated draft-analysis increment

Item facts + private profile v2 → pure draft analysis → deterministic ten-player demo → dedicated draft-room screen → existing battle demo handoff.

- Migrate private profile v1 without losing categories or proficiency.
- Keep matchup direction explicit: `heroId` is the proposed hero and `againstHeroId` is the visible opponent.
- Use OpenDota professional matchup samples as the auditable base layer; compare pair win rate against each hero's professional baseline and exclude rows below 40 matches.
- Treat item popularity as purchase counts because the provider does not expose a denominator on that endpoint.
- Keep personal proficiency and notes as a separate secondary layer.
- Remove draft deployment from the battle-assistant toolbar after the dedicated draft-room entry works.

## Live/demo separation increment

- Give screen-only live capture and deterministic ten-pick simulation distinct entry labels and mode presentations.
- Never instantiate demo draft frames in live mode, and never enumerate capture sources in demo mode.
- State the current vision boundary inside live mode: changed-cell detection is available, pick/ban and team classification are not.
- Package one current Windows release and remove only older generated release artifacts.

## Split application release increment

- Build formal and demo as separate Electron identities with independent application IDs, product names, shortcuts, and output directories.
- Register Steam monitoring, capture, OCR, and private-library IPC only in the formal process; register demo playback only in the demo process.
- Open the demo executable directly into its deterministic ten-pick flow without exposing the formal login surface.
- Publish installer and portable delivery options for each identity and remove superseded monolithic artifacts.

## Live Ranked Roles recognition increment

Capture contract + portrait references → confidence-bounded ten-slot observation → side/position evidence → tactical workbench integration → two-entry shell and renamed formal build.

- Treat the top ten slots as the durable lineup source and the hero grid as the ban source while it remains visible.
- Confirm a hero only after a unique visual match remains stable across consecutive frames.
- Confirm side only from the local-player marker and position only from Ranked Roles assignment evidence.
- Keep Ranked Classic position inference visibly distinct and exclude Immortal Draft from standard recommendations.
- Make the formal landing surface contain only Tactical Workbench first and Monitor Room second.

### Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| HUD scale, language, or cosmetic treatment changes the pixels | High | Normalized geometry, brightness-tolerant fingerprints, confidence threshold, and an explicit unsupported-layout state |
| A portrait briefly animates or is covered | High | Temporal consensus and duplicate rejection |
| Side or position evidence is ambiguous | High | Preserve `unknown`; never derive a confirmed position from team composition |
| Hero grid collapses after lock-in | Medium | Keep the ten top slots as the persistent lineup source |

## Mechanism-aware counter knowledge increment

Patch-reviewed hero traits + reusable effect interactions → expert counter evidence → ranking precedence → role-applicable item responses.

- Keep aggregate professional win rates as secondary observations because the current endpoint contains no pick order, ban availability, or team-strength controls.
- Derive hero relations from reusable mechanics rather than storing direct hero-pair scores.
- Use the same interaction graph for hero and item responses, with selected-hero role applicability for items.
- Preserve unknown when a hero has not been reviewed instead of inferring certainty from natural-language keyword matches.

### Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Patch changes invalidate semantic tags | High | Store reviewed patch metadata and keep annotations separate from generated catalog facts |
| Small annotation coverage looks comprehensive | High | Emit expert evidence only for reviewed profiles and keep statistics visibly separate |
| Mechanic weight overwhelms all player context | Medium | Bound expert strength to 0–3 and retain proficiency, role, and personal layers |
| Item is mechanically relevant but unsuitable for the selected role | Medium | Require explicit buyer-role applicability before recommending it |

## Reviewed mechanic coverage increment

Current 7.41 ability/item text → conservative semantic profiles → cross-family acceptance tests → full project gate.

- Review candidate tags manually; do not ingest keyword matches.
- Add only reusable effect/trait relations with explicit present-patch evidence.
- Cover restoration, passive defence, mana, mobility, illusions, dispels, attacks, and evasion.
- Keep unreviewed heroes unknown and keep draft pick/ban causality outside the mechanism layer.
