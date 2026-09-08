import test from "node:test";
import assert from "node:assert/strict";

import { createStatusServer } from "../src/http-server.js";

test("status server exposes health and the latest snapshot on loopback", async (t) => {
  const snapshot = { phase: "unavailable", observedAt: "2026-09-08T10:00:00.000Z" };
  const server = createStatusServer({ getStatus: () => snapshot });
  await server.listen({ host: "127.0.0.1", port: 0 });
  t.after(() => server.close());

  const address = server.address();
  const health = await fetch(`http://127.0.0.1:${address.port}/health`).then((r) => r.json());
  const status = await fetch(`http://127.0.0.1:${address.port}/status`).then((r) => r.json());

  assert.deepEqual(health, { ok: true });
  assert.deepEqual(status, snapshot);
});
