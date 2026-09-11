import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizePlan, PLAN_SCHEMA_VERSION } from "./plan-schema.js";

const IMPORT_LIMIT = 100_000;

function parseJson(value, message) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new TypeError(message, { cause: error });
  }
}

export function createPlanStore({ file, createId, now } = {}) {
  if (typeof file !== "string" || !path.isAbsolute(file)) {
    throw new TypeError("plan store file must be an absolute path");
  }

  async function load() {
    let raw;
    try {
      raw = await readFile(file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
    const document = parseJson(raw, "stored plans are not valid JSON");
    if (document?.schemaVersion !== PLAN_SCHEMA_VERSION || !Array.isArray(document.plans)) {
      throw new TypeError("stored plans use an unsupported schema version");
    }
    return document.plans.map((plan) => normalizePlan(plan, { createId, now }));
  }

  async function persist(plans) {
    await mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.new`;
    await writeFile(temporary, `${JSON.stringify({ schemaVersion: PLAN_SCHEMA_VERSION, plans }, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, file);
  }

  return Object.freeze({
    list: load,
    async save(input) {
      const plans = await load();
      const existing = input?.id ? plans.find((plan) => plan.id === input.id) : undefined;
      const plan = normalizePlan(
        existing ? { ...input, createdAt: existing.createdAt, updatedAt: undefined } : input,
        { createId, now },
      );
      const next = plans.filter((entry) => entry.id !== plan.id);
      next.push(plan);
      await persist(next);
      return plan;
    },
    async delete(id) {
      const safeId = String(id ?? "");
      const plans = await load();
      const next = plans.filter((plan) => plan.id !== safeId);
      if (next.length === plans.length) return false;
      await persist(next);
      return true;
    },
    async exportJson(id) {
      const plan = (await load()).find((entry) => entry.id === id);
      if (!plan) throw new RangeError("plan was not found");
      return JSON.stringify(plan, null, 2);
    },
    async importJson(raw) {
      if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > IMPORT_LIMIT) {
        throw new RangeError("import is too large");
      }
      const imported = parseJson(raw, "import must be valid JSON");
      const plan = normalizePlan({ ...imported, id: undefined, source: "personal" }, { createId, now });
      const plans = await load();
      plans.push(plan);
      await persist(plans);
      return plan;
    },
  });
}
