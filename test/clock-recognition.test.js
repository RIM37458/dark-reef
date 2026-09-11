import test from "node:test";
import assert from "node:assert/strict";

import { acceptClockSample, parseRecognizedClock } from "../src/assistant/clock-recognition.js";

test("recognized clock tolerates common OCR punctuation but rejects prose", () => {
  assert.equal(parseRecognizedClock(" 12;34\n"), 754);
  assert.equal(parseRecognizedClock("O:09"), 9);
  assert.equal(parseRecognizedClock("-0.45"), -45);
  assert.throws(() => parseRecognizedClock("score 12 to 3"), /recognize/);
});

test("clock sample gate rejects implausible jumps", () => {
  assert.equal(acceptClockSample({ previous: 100, sample: 102, elapsedSeconds: 2 }), true);
  assert.equal(acceptClockSample({ previous: 100, sample: 140, elapsedSeconds: 2 }), false);
  assert.equal(acceptClockSample({ previous: undefined, sample: -30, elapsedSeconds: 0 }), true);
  assert.equal(acceptClockSample({ previous: 1, sample: 2.5, elapsedSeconds: 1 }), false);
  assert.equal(acceptClockSample({ previous: 1, sample: 2, elapsedSeconds: -1 }), false);
});
