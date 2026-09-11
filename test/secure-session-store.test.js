import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createSecureSessionStore } from "../src/desktop/secure-session-store.js";

const encryption = Object.freeze({
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`protected:${value}`, "utf8"),
  decryptString: (value) => value.toString("utf8").replace(/^protected:/, ""),
});

test("secure session store persists only encrypted token bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-session-"));
  const file = path.join(directory, "steam-session.encrypted");
  const store = createSecureSessionStore({ file, encryption });

  assert.equal(store.save("watcher_bot", "sensitive-refresh-token"), true);
  assert.equal(await readFile(file, "utf8").then((value) => value.includes("sensitive-refresh-token")), false);
  assert.equal(store.load("watcher_bot"), "sensitive-refresh-token");
  assert.equal(store.load("different_account"), undefined);
});

test("secure session store never falls back to plaintext when Windows encryption is unavailable", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-session-"));
  const file = path.join(directory, "steam-session.encrypted");
  const store = createSecureSessionStore({
    file,
    encryption: { ...encryption, isEncryptionAvailable: () => false },
  });

  assert.equal(store.save("watcher_bot", "sensitive-refresh-token"), false);
  assert.equal(store.load("watcher_bot"), undefined);
  await assert.rejects(() => readFile(file), /ENOENT/);
});

test("secure session store migrates and removes the legacy plaintext session", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-session-"));
  const file = path.join(directory, "steam-session.encrypted");
  const legacyFile = path.join(directory, "steam-session.json");
  await writeFile(legacyFile, JSON.stringify({ refreshToken: "legacy-refresh-token" }), "utf8");
  const store = createSecureSessionStore({ file, legacyFile, encryption });

  assert.equal(store.load("watcher_bot"), "legacy-refresh-token");
  await assert.rejects(() => readFile(legacyFile), /ENOENT/);
  assert.equal(await readFile(file, "utf8").then((value) => value.includes("legacy-refresh-token")), false);
});
