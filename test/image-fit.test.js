import test from "node:test";
import assert from "node:assert/strict";

import { fitImageWithin } from "../src/image-fit.js";

test("fitImageWithin preserves a wide avatar's aspect ratio", () => {
  assert.deepEqual(fitImageWithin({ width: 256, height: 144 }, 256), { width: 256 });
});

test("fitImageWithin constrains a tall avatar by height", () => {
  assert.deepEqual(fitImageWithin({ width: 144, height: 256 }, 256), { height: 256 });
});
