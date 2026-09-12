import { createDraftObservationTracker } from "./draft-observation.js";
import { classifyVisualRect, compareDraftCells, detectDraftGridPhase, findLocalPlayerSlot, learnDraftLayout } from "./draft-vision.js";

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
  let layout = Object.freeze({ status: "unknown", recognizedCount: 0, candidateCount: 0, coverage: 0, cells: Object.freeze([]) });
  let tracker = createDraftObservationTracker({ confirmationFrames });
  let confirmedPosition;

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
      layout = learnDraftLayout(baseline, cells, heroReferences);
      return Object.freeze({
        width: baseline.width,
        height: baseline.height,
        cellCount: cells.length,
        layoutStatus: layout.status,
        recognizedCount: layout.recognizedCount,
      });
    },
    async scan(sourceId, cells) {
      if (!baseline) throw new RangeError("请先在未禁用英雄的选人画面完成校准");
      if (layout.status !== "learned") throw new RangeError("当前英雄布局无法可靠识别，请重新校准");
      const current = (await capture(sourceId)).frame;
      const changes = compareDraftCells({ baseline, current, cells: layout.cells });
      return Object.freeze({
        unavailableHeroIds: Object.freeze([...new Set(changes.map(({ heroId }) => heroId))]),
        changes: Object.freeze(changes),
      });
    },
    async observe(sourceId, { cells, slotRects, phase, mode, assignedPosition }) {
      const captured = await capture(sourceId);
      const current = captured.frame;
      let learnedNow = false;
      if (layout.status !== "learned" && cells.length) {
        layout = learnDraftLayout(current, cells, heroReferences);
        if (layout.status === "learned") {
          baseline = current;
          learnedNow = true;
        }
      }
      const changes = !learnedNow && baseline && layout.status === "learned"
        ? compareDraftCells({ baseline, current, cells: layout.cells })
        : [];
      const slots = slotRects.map((rect, index) => {
        if (!(rect.width > 0) || !(rect.height > 0)) return Object.freeze({ index, status: "empty" });
        return Object.freeze({ index, ...classifyVisualRect(current, rect, heroReferences) });
      });
      const local = findLocalPlayerSlot(current, slotRects.filter(({ width, height }) => width > 0 && height > 0));
      const detectedPosition = assignedPosition ?? confirmedPosition ?? (local && roleReader
        ? await roleReader.read(captured.thumbnail, slotRects.find(({ index }) => index === local.index))
        : undefined);
      const observation = tracker.update({
        phase: phase ?? (layout.status === "learned" ? detectDraftGridPhase(current, layout.cells, heroReferences) : "unknown"),
        mode,
        slots,
        bannedHeroIds: [...new Set(changes.map(({ heroId }) => heroId))],
        localSlotIndex: local?.index,
        assignedPosition: detectedPosition,
      });
      if (observation.assignedPosition?.certainty === "confirmed") {
        confirmedPosition = observation.assignedPosition;
      }
      return Object.freeze({ ...observation, layout });
    },
    clear() {
      baseline = undefined;
      layout = Object.freeze({ status: "unknown", recognizedCount: 0, candidateCount: 0, coverage: 0, cells: Object.freeze([]) });
      tracker = createDraftObservationTracker({ confirmationFrames });
      confirmedPosition = undefined;
    },
  });
}
