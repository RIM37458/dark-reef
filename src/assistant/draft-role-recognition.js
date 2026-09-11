import simplifiedChineseData from "@tesseract.js-data/chi_sim";
import { PSM, createWorker } from "tesseract.js";

const POSITION_PATTERNS = Object.freeze([
  Object.freeze({ value: 5, patterns: Object.freeze([/hardsupport/u, /纯辅助/u, /硬辅/u, /(?:位置5|pos5|5号位|五号位)/u]) }),
  Object.freeze({ value: 4, patterns: Object.freeze([/softsupport/u, /辅助/u, /软辅/u, /(?:位置4|pos4|4号位|四号位)/u]) }),
  Object.freeze({ value: 3, patterns: Object.freeze([/offlane(?:r)?/u, /劣势路/u, /(?:位置3|pos3|3号位|三号位)/u]) }),
  Object.freeze({ value: 2, patterns: Object.freeze([/mid(?:dle)?lane/u, /中路/u, /(?:位置2|pos2|2号位|二号位)/u]) }),
  Object.freeze({ value: 1, patterns: Object.freeze([/safelane/u, /carry/u, /优势路/u, /(?:位置1|pos1|1号位|一号位)/u]) }),
]);

function normalizedText(value) {
  return String(value ?? "").toLocaleLowerCase("en-US").replace(/[\s:：·_\-—]+/gu, "");
}

export function parseAssignedPositionText(value) {
  const text = normalizedText(value);
  return POSITION_PATTERNS.find(({ patterns }) => patterns.some((pattern) => pattern.test(text)))?.value;
}

function cropRect(image, slot) {
  const size = image.getSize();
  const x = Math.max(0, slot.x - slot.width * 0.25);
  const width = Math.min(1 - x, slot.width * 2);
  return {
    x: Math.round(size.width * x),
    y: 0,
    width: Math.max(1, Math.round(size.width * width)),
    height: Math.max(1, Math.round(size.height * 0.14)),
  };
}

export function createDraftRoleReader({
  cachePath,
  createOcrWorker = createWorker,
  languageData = simplifiedChineseData,
  minimumConfidence = 45,
  pageSegMode = PSM.SPARSE_TEXT,
}) {
  if (typeof cachePath !== "string" || !cachePath) throw new TypeError("职责识别缓存路径无效");
  let workerPromise;

  async function worker() {
    workerPromise ??= createOcrWorker(languageData.code, 1, {
      langPath: languageData.langPath,
      cachePath,
    }).then(async (instance) => {
      await instance.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: pageSegMode,
      });
      return instance;
    });
    return workerPromise;
  }

  return Object.freeze({
    async read(image, localSlot) {
      if (!image || !localSlot) return undefined;
      const crop = image.crop(cropRect(image, localSlot)).resize({ width: 480, quality: "best" });
      const result = await (await worker()).recognize(crop.toPNG());
      const confidence = Number(result.data.confidence ?? 0);
      const value = parseAssignedPositionText(result.data.text);
      if (!value || !Number.isFinite(confidence) || confidence < minimumConfidence) return undefined;
      return Object.freeze({
        value,
        confidence: Math.max(0, Math.min(1, confidence / 100)),
        source: "ranked-roles-marker",
      });
    },
    async close() {
      if (!workerPromise) return;
      const instance = await workerPromise;
      workerPromise = undefined;
      await instance.terminate();
    },
  });
}
