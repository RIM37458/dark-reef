import englishData from "@tesseract.js-data/eng";
import { PSM, createWorker } from "tesseract.js";

import { parseRecognizedClock } from "./clock-recognition.js";

const THUMBNAIL_SIZE = Object.freeze({ width: 1920, height: 1080 });

export function createScreenClockReader({
  getSources,
  cachePath,
  createOcrWorker = createWorker,
  languageData = englishData,
  pageSegMode = PSM.SINGLE_LINE,
}) {
  if (typeof cachePath !== "string" || cachePath.length === 0) {
    throw new TypeError("OCR cache path is required");
  }
  let workerPromise;

  async function sources() {
    return getSources({
      types: ["window", "screen"],
      thumbnailSize: THUMBNAIL_SIZE,
      fetchWindowIcons: false,
    });
  }

  async function worker() {
    workerPromise ??= createOcrWorker(languageData.code, 1, {
      langPath: languageData.langPath,
      cachePath,
    })
      .then(async (instance) => {
        await instance.setParameters({
          tessedit_char_whitelist: "0123456789:-.;O",
          tessedit_pageseg_mode: pageSegMode,
        });
        return instance;
      });
    return workerPromise;
  }

  return Object.freeze({
    async listSources() {
      return (await sources()).map((source) => Object.freeze({
        id: source.id,
        name: String(source.name).slice(0, 160),
      }));
    },
    async read(sourceId) {
      const source = (await sources()).find((entry) => entry.id === sourceId);
      if (!source || source.thumbnail.isEmpty()) throw new RangeError("所选画面已不可用，请重新选择");
      const size = source.thumbnail.getSize();
      const crop = source.thumbnail.crop({
        x: Math.floor(size.width * 0.42),
        y: 0,
        width: Math.max(1, Math.floor(size.width * 0.16)),
        height: Math.max(1, Math.floor(size.height * 0.11)),
      }).resize({ width: 900, quality: "best" });
      const result = await (await worker()).recognize(crop.toPNG());
      return Object.freeze({
        gameTime: parseRecognizedClock(result.data.text),
        confidence: Math.max(0, Math.min(100, Math.round(result.data.confidence ?? 0))),
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
