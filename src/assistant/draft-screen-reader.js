import { createDraftObservationTracker } from "./draft-observation.js";
import { classifyVisualRect, compareDraftCells, detectDraftGridPhase, findLocalPlayerSlot } from "./draft-vision.js";

const CAPTURE_OPTIONS = Object.freeze({
  types: Object.freeze(["window", "screen"]),
  thumbnailSize: Object.freeze({ width: 1280, height: 720 }),
  fetchWindowIcons: false,
});

function toFrame(thumbnail) {
  if (!thumbnail || thumbnail.isEmpty()) throw new RangeError("所选画面当前不可用");
  const { width, height } = thumbnail.getSize();
  return Object.freeze({ width, height, data: Buffer.from(thumbnail.getBitmap()) });
}

export function createDraftScreenReader({ getSources, heroReferences = [], confirmationFrames = 2, roleReader }) {
  if (typeof getSources !== "function") throw new TypeError("选人识图需要画面来源");
  let baseline;
  let tracker = createDraftObservationTracker({ confirmationFrames });

  async function capture(sourceId) {
    if (typeof sourceId !== "string" || !sourceId) throw new RangeError("请选择 Dota 2 画面");
    const sources = await getSources(CAPTURE_OPTIONS);
    const source = sources.find(({ id }) => id === sourceId);
    if (!source) throw new RangeError("所选 Dota 2 画面当前不可用");
    return Object.freeze({ frame: toFrame(source.thumbnail), thumbnail: source.thumbnail });
  }

  return Object.freeze({
    async calibrate(sourceId, cells) {
      baseline = (await capture(sourceId)).frame;
      return Object.freeze({ width: baseline.width, height: baseline.height, cellCount: cells.length });
    },
    async scan(sourceId, cells) {
      if (!baseline) throw new RangeError("请先在未禁用英雄的选人画面完成校准");
      const current = (await capture(sourceId)).frame;
      const changes = compareDraftCells({ baseline, current, cells });
      return Object.freeze({
        unavailableHeroIds: Object.freeze(changes.map(({ heroId }) => heroId)),
        changes: Object.freeze(changes),
      });
    },
    async observe(sourceId, { cells, slotRects, phase, mode, assignedPosition }) {
      const captured = await capture(sourceId);
      const current = captured.frame;
      const changes = baseline && cells.length ? compareDraftCells({ baseline, current, cells }) : [];
      if (!baseline && cells.length) baseline = current;
      const slots = slotRects.map((rect, index) => {
        if (!(rect.width > 0) || !(rect.height > 0)) return Object.freeze({ index, status: "empty" });
        return Object.freeze({ index, ...classifyVisualRect(current, rect, heroReferences) });
      });
      const local = findLocalPlayerSlot(current, slotRects.filter(({ width, height }) => width > 0 && height > 0));
      const detectedPosition = assignedPosition ?? (local && roleReader
        ? await roleReader.read(captured.thumbnail, slotRects.find(({ index }) => index === local.index))
        : undefined);
      return tracker.update({
        phase: phase ?? detectDraftGridPhase(current, cells, heroReferences),
        mode,
        slots,
        bannedHeroIds: changes.map(({ heroId }) => heroId),
        localSlotIndex: local?.index,
        assignedPosition: detectedPosition,
      });
    },
    clear() {
      baseline = undefined;
      tracker = createDraftObservationTracker({ confirmationFrames });
    },
  });
}
