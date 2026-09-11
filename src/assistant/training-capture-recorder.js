import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertVerifiedDotaSource,
  captureDirectoriesToRemove,
  TRAINING_CAPTURE_FRAME_SIZE,
  TRAINING_CAPTURE_INTERVAL_MS,
  TRAINING_CAPTURE_MAXIMUM_BYTES,
} from "./training-capture-policy.js";

const CAPTURE_OPTIONS = Object.freeze({
  types: Object.freeze(["window"]),
  thumbnailSize: TRAINING_CAPTURE_FRAME_SIZE,
  fetchWindowIcons: false,
});
const JPEG_QUALITY = 55;
const VERIFY_EVERY_MS = 15_000;
const PRUNE_EVERY_FRAMES = 240;

function sessionName(timestamp) {
  return new Date(timestamp).toISOString().replaceAll(":", "-").replace(".", "-");
}

async function directoryBytes(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    total += entry.isDirectory() ? await directoryBytes(file) : (await stat(file)).size;
  }
  return total;
}

async function captureSessions(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const target = path.join(directory, entry.name);
    const details = await stat(target);
    return Object.freeze({ name: entry.name, bytes: await directoryBytes(target), modifiedAt: details.mtimeMs });
  }));
}

export function createTrainingCaptureRecorder({
  directory,
  getSources,
  locate,
  schedule = setInterval,
  cancel = clearInterval,
  now = Date.now,
  maximumBytes = TRAINING_CAPTURE_MAXIMUM_BYTES,
} = {}) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) throw new TypeError("视觉训练目录无效");
  if (typeof getSources !== "function" || typeof locate !== "function") throw new TypeError("视觉训练画面来源无效");
  let active;
  let timer;
  let pending;

  function state() {
    return Object.freeze({
      running: Boolean(active),
      frames: active?.frames ?? 0,
      bytes: active?.bytes ?? 0,
      startedAt: active?.startedAt,
      error: active?.error,
    });
  }

  async function prune() {
    await mkdir(directory, { recursive: true });
    const remove = captureDirectoriesToRemove({
      sessions: await captureSessions(directory),
      maximumBytes,
      activeName: active?.name,
    });
    for (const name of remove) {
      const target = path.resolve(directory, name);
      if (path.dirname(target) !== path.resolve(directory)) throw new RangeError("视觉训练清理路径越界");
      await rm(target, { recursive: true, force: true });
    }
  }

  async function verify(sourceId, sources) {
    assertVerifiedDotaSource(sourceId, await locate(sources));
    if (!sources.some(({ id }) => id === sourceId)) throw new RangeError("已验证的 Dota 2 窗口当前不可见");
  }

  async function captureFrame(existingSources) {
    if (!active) return;
    const session = active;
    const capturedAt = now();
    const sources = existingSources ?? await getSources(CAPTURE_OPTIONS);
    if (capturedAt - session.verifiedAt >= VERIFY_EVERY_MS) {
      await verify(session.sourceId, sources);
      session.verifiedAt = capturedAt;
    }
    const source = sources.find(({ id }) => id === session.sourceId);
    if (!source?.thumbnail || source.thumbnail.isEmpty()) throw new RangeError("Dota 2 窗口当前没有可记录画面");
    const jpeg = source.thumbnail.toJPEG(JPEG_QUALITY);
    if (!Buffer.isBuffer(jpeg) || jpeg.length === 0) throw new RangeError("Dota 2 画面编码失败");
    const frameNumber = session.frames + 1;
    const filename = `frame-${String(frameNumber).padStart(7, "0")}-${capturedAt}.jpg`;
    await writeFile(path.join(session.path, filename), jpeg, { flag: "wx" });
    if (active !== session) return;
    session.frames = frameNumber;
    session.bytes += jpeg.length;
    session.error = undefined;
    if (frameNumber % PRUNE_EVERY_FRAMES === 0) await prune();
  }

  function queueCapture() {
    if (!active || pending) return;
    const session = active;
    pending = captureFrame()
      .catch((error) => {
        if (active === session) session.error = error instanceof Error ? error.message : "视觉训练采集失败";
      })
      .finally(() => {
        pending = undefined;
      });
  }

  return Object.freeze({
    async start(sourceId) {
      if (active?.sourceId === sourceId) return state();
      if (active) await this.stop();
      const sources = await getSources(CAPTURE_OPTIONS);
      await verify(sourceId, sources);
      await mkdir(directory, { recursive: true });
      const startedAt = now();
      const name = sessionName(startedAt);
      const sessionPath = path.join(directory, name);
      await mkdir(sessionPath, { recursive: false });
      await writeFile(path.join(sessionPath, "session.json"), `${JSON.stringify({
        schemaVersion: 1,
        startedAt: new Date(startedAt).toISOString(),
        sourceKind: "verified-dota-window",
        audio: false,
        frameIntervalMs: TRAINING_CAPTURE_INTERVAL_MS,
        frameSize: TRAINING_CAPTURE_FRAME_SIZE,
        jpegQuality: JPEG_QUALITY,
      }, null, 2)}\n`, { flag: "wx" });
      active = { name, path: sessionPath, sourceId, startedAt, verifiedAt: startedAt, frames: 0, bytes: 0, error: undefined };
      await captureFrame(sources);
      await prune();
      timer = schedule(queueCapture, TRAINING_CAPTURE_INTERVAL_MS);
      return state();
    },
    async stop() {
      if (timer !== undefined) cancel(timer);
      timer = undefined;
      const inFlight = pending;
      active = undefined;
      if (inFlight) await inFlight;
      return state();
    },
    getState: state,
  });
}
