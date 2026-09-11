# Spec: Mechanism-aware Counter Knowledge

## Objective

Rank counters and targeted items from patch-reviewed game mechanics without treating noisy head-to-head win rates as causal truth. Hero-to-hero relationships emerge from reusable effect-to-trait interactions; direct pair exceptions are not part of the bundled expert contract.

## Commands

- Focused tests: `node --test test/expert-counter-library.test.js test/draft-analysis.test.js test/bundled-statistics.test.js`
- Full gate: `pnpm run check:task`

## Project structure

- `assets/data/expert-counter-rules.json` stores patch-reviewed hero traits, hero/item effects, and reusable interaction rules.
- `src/assistant/expert-counter-library.js` validates the trust boundary and computes immutable hero and item evidence.
- `src/assistant/draft-analysis.js` combines expert evidence with statistical, personal, proficiency, synergy, and role evidence.
- `test/` verifies generic interaction matching, ranking precedence, item applicability, and bundled examples.

## Code style

```js
const evidence = expertCounterEvidence(library, candidate, enemy);
score += evidence.score * EXPERT_COUNTER_WEIGHT;
reasons.push(...evidence.reasons.map(({ text }) => text));
```

Pure functions consume normalized, bounded data. Explanations identify the matched mechanics. Comments are reserved for non-obvious reasons.

## Testing strategy

- Unit tests use invented mechanic names and hero ids to prove the engine is generic rather than pair-coded.
- Integration tests require Ancient Apparition and Doom to outrank candidates supported only by the current Morphling matchup snapshot.
- Item tests require role-applicable anti-restoration items and reject unrelated roles and targets.
- Existing project coverage floors and offline test constraints remain unchanged.

## Reviewed coverage increment

The bundled 7.41 library covers several independent mechanic families rather than growing around one example:

- restoration denial against heroes whose survival loop depends on healing or regeneration;
- passive disable against heroes whose durability depends on passive abilities;
- mana pressure against mana-based survival and sustained high-mana movement or damage;
- leash and distance-based movement punishment against mobility-dependent heroes;
- illusion removal and unit-count punishment against illusion-army carries;
- offensive dispel against dispellable defensive buffs;
- disarm against attack-output carries and accuracy against evasion-based defence.

Only explicit current ability/item text and reviewed semantic dependencies enter the executable library. Keyword candidates are not imported automatically, and missing coverage remains unknown.

## Boundaries

- Always: validate ids, strengths, bounded collection sizes, source ids, and patch metadata; keep expert and statistical evidence distinguishable; prefer unknown over an unreviewed inference.
- Ask first: automatic model-generated annotations, downloading raw match history, telemetry, or changing the bundled patch outside the existing update workflow.
- Never: encode direct hero-pair scores in the expert data; claim the aggregate matchup endpoint corrects pick/ban or team-strength selection bias; let an outcome-only score outrank a strong reviewed mechanism edge.

## Success criteria

- One reusable interaction rule can apply to multiple heroes and items without naming a hero pair.
- Strong reviewed mechanism edges contribute enough bounded score that aggregate matchup noise cannot overtake them.
- Hero recommendations explain which effect meets which enemy trait.
- Targeted item recommendations use the same interaction graph, filter by the selected hero's role, and take precedence over generic purchase popularity for the same item.
- The bundled Morphling example ranks Ancient Apparition and Doom above outcome-only candidates and recommends role-appropriate restoration reduction.
- Bundled cross-family checks prove that the same graph produces Break, mana, mobility, illusion, dispel, disarm, and accuracy responses without direct pair records.

## Evidence model

1. Patch-reviewed mechanics provide the causal prior and a bounded strength from 0 to 3.
2. Draft availability and pick-order evidence is a future independent layer; the current aggregate endpoint cannot provide it.
3. Head-to-head outcomes remain a confidence-weighted secondary adjustment and retain provider, sample, and timestamp provenance.
4. Personal proficiency and notes remain separate so they cannot be mistaken for game facts.

## Assumptions

- The first bundled annotation set proves the general contract with a small reviewed set; missing annotations produce no expert claim.
- `dotaconstants` remains the local source for hero, ability, item, and patch facts; semantic annotations require review when those facts change.
- A later raw-draft corpus can add ban availability and pick-order evidence without changing the mechanism contract.
