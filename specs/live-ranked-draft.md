# Module Spec: Live Ranked Draft Recognition

## Purpose

Turn the formal tactical workbench into the single live draft entry. It reads only the selected Dota 2 capture source, observes the hero grid and ten top-bar hero slots, and publishes confidence-bounded draft state to the workbench.

## Inputs

- A capture source already verified as the visible `dota2.exe` window, or a user-selected screen fallback.
- Versioned normalized rectangles for the current 16:9 Dota draft layout.
- Bundled hero portrait references derived from the catalog's Valve CDN assets.
- Consecutive captured frames.

## Outputs

- Draft phase: `grid-visible`, `strategy`, or `unknown`.
- Ten ordered slots, each `empty`, `recognized`, or `uncertain`, with hero id and confidence only when recognized.
- Banned hero ids observed from changed hero-grid cells.
- Local player side: `radiant`, `dire`, or `unknown`.
- Ranked position: confirmed `1`–`5`, inferred `1`–`5`, or `unknown`, including its evidence source.

## Invariants

- No Dota process memory, game files, input synthesis, or Valve match-server calls.
- A hero is published only after independent visual confidence and temporal-consensus thresholds pass.
- The same hero cannot occupy more than one recognized slot.
- Side is never inferred from a selected hero alone; it requires a local-player visual marker.
- Position is confirmed only from the Ranked Roles assignment marker. Team composition may produce an explicitly labelled inference, never a confirmed position.
- Ranked Classic remains an inferred/unknown position flow. Immortal Draft is detected and excluded from standard recommendations.
- When the hero grid collapses, recognized top-bar slots remain the authoritative lineup.

## Failure states

- No Dota window: keep the workbench idle and explain that no visible window was found.
- Unsupported aspect ratio or layout: publish `unknown` and request layout calibration; do not guess.
- Low-confidence slot, side, or role: preserve the previous confirmed observation briefly, then expire it to `unknown`.
- Duplicate or unstable hero matches: mark affected slots uncertain.

## Acceptance tests

- Synthetic frames classify only a uniquely matching hero reference.
- Two agreeing frames are required before a slot becomes recognized.
- Grid changes and ten-slot picks are emitted in one observation.
- A collapsed grid does not erase the last stable lineup.
- Confirmed and inferred positions remain distinguishable end to end.

## Custom hero-grid order

- Hero identity is learned from the pixels inside each calibrated portrait rectangle; the default four-attribute manifest supplies geometry only and never supplies the observed hero id.
- A learned layout may contain repeated hero ids because custom categories can place one hero more than once.
- Grid phase and unavailable-state inference use only a confidence-qualified learned layout.
- If too few portrait rectangles can be identified, layout status is `unsupported`: top-bar lineup recognition continues, grid-derived unavailable heroes stay empty, and the overlay presents recommendations as text instead of drawing them over unverified positions.
- Changing the custom layout or using geometry outside the calibrated rectangles must never silently fall back to the default hero order.

### Custom-order acceptance tests

- Swapping heroes between calibrated rectangles produces the swapped runtime mapping without editing the bundled manifest.
- A changed rectangle is attributed to the hero learned at that rectangle, not to the default hero assigned there.
- Insufficient visual matches produce `unsupported` and no grid-derived unavailable heroes while ten-slot recognition remains available.
