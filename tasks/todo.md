# Battle Assistant Tasks

## Task 1: Pure knowledge and timing contracts

- [x] Bundled patch and sanitized hero abilities are queryable.
- [x] Game times parse/format correctly, including pre-game values.
- [x] Cooldown observations return exact or bounded readiness.
- [x] Focused unit tests pass.

## Task 2: Personal plan repository

- [x] Renderer input is strictly normalized with bounded fields.
- [x] Plans survive repository re-open and writes replace atomically.
- [x] JSON import/export round-trips and rejects incompatible input.
- [x] Focused unit tests pass.

## Checkpoint: Foundation

- [x] Full test suite remains green.

## Task 3: No-login assistant screen

- [x] Entry and exit require no Steam credentials.
- [x] Five enemy slots render hero and active-ability controls.
- [x] Manual clock calibration drives cooldown displays.

## Task 4: Personal plan editor

- [x] Users can create, edit, delete, import, and export plans.
- [x] Official facts cannot be overwritten by plan edits.
- [x] Restart restores saved plans.

## Task 5: Screen clock adapter

- [x] Capture is opt-in and restricted to the chosen display/window.
- [x] Recognition rejects implausible jumps and exposes failure.
- [x] Manual calibration remains available.

## Checkpoint: Complete

- [x] `pnpm run check:task` passes within the project budget.
- [x] Windows installer and portable executable build successfully.
- [x] Main monitor and demo regression flows remain intact.
- [x] Independent code-quality review has no unresolved high-priority findings.

## Automatic Dota window binding increment

- [x] Resolve and validate the visible `dota2.exe` main-window handle without reading game memory.
- [x] Match the handle to one Electron window source with explicit operational states.
- [x] Auto-load and prefer the matched Dota source while preserving manual fallback.
- [x] Pass focused tests, the full handoff gate, security review, and Windows packaging.

## Draft overlay increment

- [x] Official roles and primary attributes are available to the recommendation engine.
- [x] Built-in and personal categories combine deterministically.
- [x] Personal categories and 1–5 proficiency persist in a versioned local profile.
- [x] Transparent hero grid ignores mouse input; the separate toolbar remains interactive.
- [x] Selected-window pixels can be calibrated and compared without Dota or Valve integration.
- [x] Full automated tests and coverage floor pass.

## Integrated draft-analysis increment

- [x] Item facts and professional purchase-count observations are available in the bundled catalog.
- [x] Private profile v2 stores directional counters and item plans; v1 migrates without loss.
- [x] Draft analysis explains role gaps, sample-backed recommendations, counter deltas, and item suggestions.
- [x] Ten-player demo advances pick by pick and hands off to the battle demo.
- [x] Draft room has its own entry and no draft deployment button remains in the tactical toolbar.
- [x] Full tests, review, and Windows packaging pass.

## Live/demo separation increment

- [x] Formal screen capture and ten-pick simulation have distinct entry labels and mode surfaces.
- [x] Formal mode contains no demo frames; demo mode never reads real capture sources.
- [x] The formal surface states exactly what visual recognition can and cannot infer.
- [x] Version 0.12.1 passes the full gate and Windows packaging.
- [x] Older generated Setup, Portable, and blockmap files are removed from `release`.

## Split application release increment

- [x] Formal and demo builds have different application IDs, names, shortcuts, and output directories.
- [x] Formal runtime excludes demo IPC; demo runtime excludes login, capture, OCR, and private-library IPC.
- [x] Demo starts directly in the ten-pick simulation and cannot navigate back to the formal login surface.
- [x] Version 0.13.0 produces installer and portable executables for both applications.

## Live Ranked Roles recognition increment

- [x] Define and test ten-slot, ban, phase, side, and position observation contracts.
- [x] Add bundled hero portrait references and unique confidence-bounded classification.
- [x] Require temporal consensus and retain stable lineups after the grid collapses.
- [x] Feed recognized enemy heroes into the tactical workbench with no manual hero selectors.
- [x] Read Chinese or English Ranked Roles responsibility labels locally and require temporal confirmation.
- [x] Present client responsibility names before the community 1–5 shorthand.
- [ ] Calibrate the Ranked Roles position marker against a real 7.41 Chinese-client draft screenshot.

## Checkpoint: Live recognition

- [x] Focused vision and observation tests pass.
- [x] Low-confidence, duplicate, and unsupported-layout frames never become recognized picks.

## Formal shell integration

- [x] Rename the formal application to `暗黑之礁` without merging formal and demo identities.
- [x] Make the landing surface show Tactical Workbench first and Monitor Room second.
- [x] Move live draft capture and analysis into the tactical workbench.
- [x] Keep Ranked Classic inference and Immortal Draft exclusion explicit.

## Checkpoint: Complete

- [ ] Full syntax, floor, test, coverage, and security gates pass after position calibration.
- [ ] Formal and demo Windows installer and portable builds succeed after position calibration.

## Mechanism-aware counter knowledge increment

- [x] Validate a bounded, patch-reviewed effect/trait interaction library without direct hero-pair scores.
- [x] Rank strong mechanism counters above candidates supported only by aggregate matchup results.
- [x] Recommend targeted items through the same interactions and selected-hero role applicability.
- [x] Bundle the Morphling example as an integration acceptance case, not a pair-specific rule.
- [x] Pass focused tests and the full local handoff gate; complete a five-axis diff review.

## Reviewed mechanic coverage increment

- [x] Add red acceptance tests for multiple independent mechanic families.
- [x] Expand reviewed hero effect and dependency profiles from bundled 7.41 facts.
- [x] Add role-filtered item responses for passive defence, mana, illusions, buffs, attacks, and evasion.
- [x] Pass focused tests and the full handoff gate, then review the final diff.

## Custom hero-grid order increment

- [ ] Prove that calibrated rectangles learn their current hero identities instead of using default manifest ids.
- [ ] Attribute visual changes to the learned hero and preserve repeated custom-category placements.
- [ ] Keep top-bar recognition active while unsupported grid geometry yields no unavailable-hero claims.
- [ ] Render learned positions only; show named recommendations when positional overlay is unsupported.
- [ ] Pass focused tests, the full project gate, and five-axis review.
