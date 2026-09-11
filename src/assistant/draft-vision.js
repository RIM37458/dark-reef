function validateFrame(frame) {
  if (!frame || !Number.isInteger(frame.width) || !Number.isInteger(frame.height)) {
    throw new TypeError("选人画面格式无效");
  }
  if (!frame.data || frame.data.length !== frame.width * frame.height * 4) {
    throw new RangeError("选人画面像素尺寸无效");
  }
}

function cellDifference(baseline, current, cell) {
  const startX = Math.max(0, Math.floor(cell.x * baseline.width));
  const endX = Math.min(baseline.width, Math.ceil((cell.x + cell.width) * baseline.width));
  const startY = Math.max(0, Math.floor(cell.y * baseline.height));
  const endY = Math.min(baseline.height, Math.ceil((cell.y + cell.height) * baseline.height));
  let difference = 0;
  let channels = 0;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * baseline.width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        difference += Math.abs(baseline.data[offset + channel] - current.data[offset + channel]);
        channels += 1;
      }
    }
  }
  return channels ? Math.round(difference / channels) : 0;
}

function rectBounds(frame, rect) {
  return Object.freeze({
    startX: Math.max(0, Math.floor(rect.x * frame.width)),
    endX: Math.min(frame.width, Math.ceil((rect.x + rect.width) * frame.width)),
    startY: Math.max(0, Math.floor(rect.y * frame.height)),
    endY: Math.min(frame.height, Math.ceil((rect.y + rect.height) * frame.height)),
  });
}

export function visualSignature(frame, rect, columns = 8, rows = 4) {
  validateFrame(frame);
  const bounds = rectBounds(frame, rect);
  const values = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.min(bounds.endX - 1, Math.floor(bounds.startX + (column + 0.5) * (bounds.endX - bounds.startX) / columns));
      const y = Math.min(bounds.endY - 1, Math.floor(bounds.startY + (row + 0.5) * (bounds.endY - bounds.startY) / rows));
      const offset = (y * frame.width + x) * 4;
      values.push(frame.data[offset] / 255, frame.data[offset + 1] / 255, frame.data[offset + 2] / 255);
    }
  }
  return Object.freeze(values);
}

function signatureDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) {
    throw new RangeError("英雄肖像特征尺寸无效");
  }
  return left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0) / left.length;
}

export function classifyVisualRect(frame, rect, references, { maximumDistance = 0.18, minimumMargin = 0.035 } = {}) {
  const signature = visualSignature(frame, rect);
  const ranked = references
    .map(({ heroId, signature: reference }) => ({ heroId, distance: signatureDistance(signature, reference) }))
    .sort((left, right) => left.distance - right.distance);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best || best.distance > maximumDistance || (runnerUp && runnerUp.distance - best.distance < minimumMargin)) {
    return Object.freeze({ status: "uncertain" });
  }
  return Object.freeze({ status: "recognized", heroId: best.heroId, confidence: Number((1 - best.distance / maximumDistance).toFixed(3)) });
}

export function detectDraftGridPhase(frame, cells, references, { maximumDistance = 0.3, minimumRatio = 0.3 } = {}) {
  const byHeroId = new Map(references.map((reference) => [reference.heroId, reference.signature]));
  const comparable = cells.filter((cell) => byHeroId.has(cell.heroId));
  if (comparable.length === 0) return "unknown";
  const matches = comparable.filter((cell) => (
    signatureDistance(visualSignature(frame, cell), byHeroId.get(cell.heroId)) <= maximumDistance
  )).length;
  return matches / comparable.length >= minimumRatio ? "grid-visible" : "strategy";
}

function goldBorderScore(frame, rect) {
  const { startX, endX, startY, endY } = rectBounds(frame, rect);
  let gold = 0;
  let border = 0;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (x !== startX && x !== endX - 1 && y !== startY && y !== endY - 1) continue;
      const offset = (y * frame.width + x) * 4;
      const blue = frame.data[offset];
      const green = frame.data[offset + 1];
      const red = frame.data[offset + 2];
      if (red >= 150 && green >= 95 && red > blue * 1.4 && green > blue * 1.3) gold += 1;
      border += 1;
    }
  }
  return border ? gold / border : 0;
}

export function findLocalPlayerSlot(frame, slots, { minimumScore = 0.4, minimumMargin = 0.2 } = {}) {
  validateFrame(frame);
  const ranked = slots.map((slot) => ({ index: slot.index, score: goldBorderScore(frame, slot) }))
    .sort((left, right) => right.score - left.score);
  if (!ranked[0] || ranked[0].score < minimumScore || ranked[0].score - (ranked[1]?.score ?? 0) < minimumMargin) return undefined;
  return Object.freeze({ index: ranked[0].index, confidence: Number(Math.min(1, ranked[0].score).toFixed(3)) });
}

export function compareDraftCells({ baseline, current, cells, threshold = 24 }) {
  validateFrame(baseline);
  validateFrame(current);
  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new RangeError("两次选人画面尺寸不一致，请重新校准");
  }
  return cells.flatMap((cell) => {
    const difference = cellDifference(baseline, current, cell);
    return difference >= threshold ? [{ heroId: cell.heroId, difference }] : [];
  });
}
