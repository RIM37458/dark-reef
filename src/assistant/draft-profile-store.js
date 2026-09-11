import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeDraftProfile } from "./draft-profile.js";

export function createDraftProfileStore({ file } = {}) {
  if (typeof file !== "string" || !path.isAbsolute(file)) throw new TypeError("draft profile file must be an absolute path");

  async function load() {
    try {
      return normalizeDraftProfile(JSON.parse(await readFile(file, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") return normalizeDraftProfile();
      throw error;
    }
  }

  return Object.freeze({
    load,
    async save(input) {
      const profile = normalizeDraftProfile(input);
      await mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.new`;
      await writeFile(temporary, `${JSON.stringify(profile, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, file);
      return profile;
    },
  });
}
