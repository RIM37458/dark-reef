# Capability Map: Dark Reef Suite

## Product surfaces

1. **Friend watch room** — Existing Steam/GC login, friend discovery, delayed public telemetry, notifications, and demo battle.
2. **Battle assistant** — No-login workspace for recording only what the player observes and timing skills or items against a game clock.
3. **Knowledge forge** — Versioned Valve-derived hero, ability, and item facts plus editable personal categories, matchup relations, proficiency, and item plans.
4. **Community archive** — Future authenticated plan distribution with moderation, history, compatibility, and reports.
5. **Draft analysis** — Deterministic role coverage, personal counter relations, proficiency-aware candidates, and situational item suggestions.
6. **Integrated demo** — A ten-player draft sequence that feeds draft analysis before continuing into the existing battle simulation.
7. **Analysis and commentary** — Future evidence-backed statistical matchup suggestions and event narration with visible sources and confidence.

## Data ownership layers

| Layer | Mutability | Update source | Conflict rule |
|---|---|---|---|
| Official facts | Read-only | Signed application/data release | Never overwritten locally |
| Personal plans | Editable | Local user | Always retained across updates |
| Community plans | Imported snapshot | Community service or file | Copy before editing |

## Delivery order

1. Local fact catalog, plan schema, migrations, and cooldown clock.
2. No-login five-hero assistant and personal plan editor.
3. Screen-clock capture/OCR with explicit manual fallback.
4. Item facts, personal counter/build rules, draft analysis, and integrated demo.
5. Signed data manifests and application update channel.
6. Community service and evidence-backed statistical analytics.
