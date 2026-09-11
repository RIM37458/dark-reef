import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function accountName(value) {
  if (typeof value !== "string" || !value || value.length > 128) throw new TypeError("Steam account name is invalid");
  return value;
}

function refreshToken(value) {
  if (typeof value !== "string" || !value || value.length > 16_384) throw new TypeError("Steam refresh token is invalid");
  return value;
}

export function createSecureSessionStore({ file, legacyFile, encryption }) {
  if (!path.isAbsolute(file)) throw new TypeError("Encrypted session path must be absolute");
  if (!encryption || typeof encryption.isEncryptionAvailable !== "function" || typeof encryption.encryptString !== "function" || typeof encryption.decryptString !== "function") {
    throw new TypeError("Windows session encryption is unavailable");
  }

  function available() {
    return encryption.isEncryptionAvailable();
  }

  function save(rawAccountName, rawToken) {
    if (!available()) return false;
    const payload = JSON.stringify({ accountName: accountName(rawAccountName), refreshToken: refreshToken(rawToken) });
    const protectedBytes = encryption.encryptString(payload);
    const temporary = `${file}.${randomUUID()}.tmp`;
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      writeFileSync(temporary, protectedBytes.toString("base64"), { encoding: "utf8", mode: 0o600, flag: "wx" });
      renameSync(temporary, file);
    } catch (cause) {
      if (existsSync(temporary)) unlinkSync(temporary);
      throw new Error("Encrypted Steam session could not be saved", { cause });
    }
    return true;
  }

  function readEncrypted(rawAccountName) {
    try {
      const protectedBytes = Buffer.from(readFileSync(file, "utf8"), "base64");
      const parsed = JSON.parse(encryption.decryptString(protectedBytes));
      if (accountName(parsed.accountName) !== rawAccountName) return undefined;
      return refreshToken(parsed.refreshToken);
    } catch (cause) {
      throw new Error("Encrypted Steam session could not be read", { cause });
    }
  }

  function migrateLegacy(rawAccountName) {
    try {
      const parsed = JSON.parse(readFileSync(legacyFile, "utf8"));
      const token = refreshToken(parsed.refreshToken);
      save(rawAccountName, token);
      unlinkSync(legacyFile);
      return token;
    } catch (cause) {
      throw new Error("Legacy Steam session could not be secured", { cause });
    }
  }

  function load(rawAccountName) {
    const name = accountName(rawAccountName);
    if (!available()) return undefined;
    if (existsSync(file)) return readEncrypted(name);
    if (legacyFile && existsSync(legacyFile)) return migrateLegacy(name);
    return undefined;
  }

  return Object.freeze({ load, save });
}
