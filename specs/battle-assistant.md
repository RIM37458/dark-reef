# Spec: Battle Assistant Foundation

## Objective

Add a no-login desktop workspace that lets a player select five enemy heroes, record ability usage manually, and see cooldown readiness against a calibrated Dota game clock. The same workspace edits and stores personal matchup plans independently from bundled facts.

## Safety boundary

- Capture only pixels from a user-selected desktop source for clock recognition.
- Do not inspect Dota processes, memory, files, input, or network traffic.
- Do not automate gameplay or infer unseen enemy actions.
- Treat imported plans as untrusted data and validate every field.
- Never claim exact readiness when ability level, cooldown modifiers, charges, or reset effects are unknown.

## Functional requirements

- The entry screen exposes the assistant without Steam credentials.
- The catalog exposes heroes and active abilities from bundled `dotaconstants`, with its Dota patch label.
- Five enemy slots can independently select a hero and ability level.
- Clicking an ability records a user observation and displays exact or bounded readiness.
- The game clock supports negative pre-game time, pause, resume, and manual calibration.
- Personal plans support create/update, list, delete, JSON import, and JSON export.
- Official facts and personal plans remain physically and logically separate.
- Existing friend-monitor behavior remains unchanged.

## Data contract

Personal plans use schema version 1 and contain a stable id, title, optional description, five enemy slots, optional item ids, timestamps, and source metadata. Unknown fields are discarded during normalization; invalid or oversized input is rejected.

## Update/community boundary

This slice defines versioned import/export data compatible with future remote delivery. Network update and upload controls are excluded until a service origin, authentication policy, signing key, moderation policy, and privacy terms exist.

## Success criteria

- Pure catalog, clock, cooldown, and plan-storage tests pass without Steam or a live Dota client.
- Invalid imported files cannot escape the application data directory or inject markup.
- A packaged Windows build can enter and leave the assistant while the monitor is stopped.
- Closing/reopening the app preserves personal plans.
