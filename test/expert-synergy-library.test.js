import test from "node:test";
import assert from "node:assert/strict";

import { expertSynergyEvidence, normalizeExpertSynergyLibrary } from "../src/assistant/expert-synergy-library.js";

const library = normalizeExpertSynergyLibrary({
  schemaVersion: 1,
  reviewedPatch: "7.41",
  sources: [{ id: "coach", author: "Coach", url: "https://example.com/guide", publishedAt: "2026-01-01", kind: "expert-teaching" }],
  rules: [{ id: "chain", allyAnyRole: ["Initiator"], candidateAnyRole: ["Nuker"], score: 1.5, reason: "接续控制后的伤害窗口", sourceId: "coach" }],
});

test("expert synergy keeps explanation and author separate from statistics", () => {
  assert.deepEqual(expertSynergyEvidence(library, { roles: ["Nuker"] }, [{ roles: ["Initiator"] }]), {
    score: 1.5,
    reasons: [{
      text: "接续控制后的伤害窗口",
      score: 1.5,
      source: { id: "coach", author: "Coach", url: "https://example.com/guide", publishedAt: "2026-01-01", kind: "expert-teaching" },
    }],
  });
  assert.deepEqual(expertSynergyEvidence(library, { roles: ["Carry"] }, [{ roles: ["Initiator"] }]), { score: 0, reasons: [] });
});

test("expert synergy rejects unbounded and unattributed rules", () => {
  assert.throws(() => normalizeExpertSynergyLibrary({ schemaVersion: 1, reviewedPatch: "7.41", sources: [], rules: [{
    id: "bad", allyAnyRole: ["Unknown"], candidateAnyRole: ["Carry"], score: 4, reason: "bad", sourceId: "missing",
  }] }), /规则/);
});
