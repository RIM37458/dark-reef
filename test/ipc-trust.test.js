import test from "node:test";
import assert from "node:assert/strict";

import { assertTrustedIpcSender } from "../src/desktop/ipc-trust.js";

function windowFor(webContents, destroyed = false) {
  return { webContents, isDestroyed: () => destroyed };
}

test("IPC accepts only a sender owned by a live application window", () => {
  const sender = {};
  assert.doesNotThrow(() => assertTrustedIpcSender({ sender }, [windowFor(sender)]));
  assert.throws(
    () => assertTrustedIpcSender({ sender: {} }, [windowFor(sender)]),
    /Untrusted IPC sender/,
  );
  assert.throws(
    () => assertTrustedIpcSender({ sender }, [windowFor(sender, true)]),
    /Untrusted IPC sender/,
  );
});
