# Constraints

Last reviewed: 2026-09-10 by project owner and Codex

## Floor

- F1 No new checker suppressions such as `eslint-disable`, `@ts-ignore`, coverage ignores, or security-scanner allow comments.
- F2 No unimplemented stubs, empty catches, or TODOs standing in for required behavior.
- F3 No skipped or deleted tests and no removed assertions without an explicit review decision.
- F4 No credentials, refresh tokens, session data, private keys, or other secrets in source or logs.
- F5 Do not weaken this file, a test, or a check to make a change pass. Exceptions require an owner, a reason, and an expiry date.
- F6 Defensive handling is allowed only at an actual trust or failure boundary. Do not use guards, broad catches, optional values, or silent fallbacks as a substitute for defining and enforcing an invariant.
- F7 A caught error must be recovered from, translated into a domain state, or rethrown with its cause. Neutral catch-and-continue behavior is forbidden.
- F8 Every fallback must represent a specified product state, be observable to the caller, and have a behavior test. Otherwise fail visibly and fix the root cause.

## Engineering rules

- Validate environment, renderer, network, filesystem, Steam, and Valve data once at their owning boundary. Keep validated internal contracts explicit instead of rechecking the same shape throughout the call graph.
- Model expected operational states as named domain results. Reserve exceptions for violated contracts and unexpected failures.
- Fix the producer or contract when invalid internal state is possible; do not accumulate consumer-side null checks around it.
- Prefer the smallest direct design. New abstractions must remove duplication or branching rather than relocate it.
- Comments explain only non-obvious reasons. Intermediate attempts do not remain in source, comments, or pull request descriptions.
- Tests assert behavior, including the meaningful failure state, and do not depend on live Steam or Valve services.

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at | Reason |
|-----------|------|------------|---------|--------|
| Syntax | 0 invalid JavaScript files | `pnpm run check:syntax` | every edit | The project uses plain ESM without a separate compiler. |
| Floor | 0 floor violations | `pnpm run check:floor` | task end, review | Prevents the cheapest paths to a false green result. |
| Tests | 0 failed, skipped, or todo tests | `pnpm test` | task end | A disabled test is not verification. |
| Coverage: lines | ≥ 98% in `src/**` | `pnpm run test:coverage` | task end, CI | Baseline is 98.54%; the rounded floor holds the improved result. |
| Coverage: branches | ≥ 84% in `src/**` | `pnpm run test:coverage` | task end, CI | Baseline is 84.42%; the rounded floor allows less than 0.5% reporting drift. |
| Coverage: functions | ≥ 93.5% in `src/**` | `pnpm run test:coverage` | task end, CI | Baseline is 93.81%; the half-point floor holds the improved result. |
| Dependency security | 0 high or critical advisories | `pnpm run check:security` | review, CI | Moderate findings are reviewed; high and critical findings block delivery. |

`pnpm run check:task` is the local handoff gate and must complete within 90 seconds. `pnpm run check:full` adds the external dependency advisory database and is the review/CI gate.

## Measured baseline

| Metric | 2026-09-10 | Direction |
|--------|------------|-----------|
| Test count | 62 passing | must not lose behavior coverage |
| Line coverage | 98.54% | must not fall below 98% |
| Branch coverage | 84.42% | must not fall below 84% |
| Function coverage | 93.81% | must not fall below 93.5% |
| Dependency audit | 1 moderate, 0 high, 0 critical | high and critical remain zero |

## Exceptions

No active exceptions.

Any future exception must use this schema and be reviewed separately from the change that needs it:

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|
