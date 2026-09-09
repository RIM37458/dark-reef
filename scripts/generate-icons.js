import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const size = 256;
const pixels = Buffer.alloc((size * 4 + 1) * size);

function insideTriangle(x, y, [a, b, c]) {
  const area = (p1, p2, p3) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = area([x, y], a, b);
  const d2 = area([x, y], b, c);
  const d3 = area([x, y], c, a);
  return !(d1 < 0 || d2 < 0 || d3 < 0) || !(d1 > 0 || d2 > 0 || d3 > 0);
}

const blades = [
  [[52, 48], [112, 76], [84, 112]],
  [[204, 52], [174, 120], [134, 82]],
  [[50, 204], [82, 138], [120, 176]],
  [[204, 204], [136, 174], [174, 132]],
];

for (let y = 0; y < size; y += 1) {
  const row = y * (size * 4 + 1);
  pixels[row] = 0;
  for (let x = 0; x < size; x += 1) {
    const offset = row + 1 + x * 4;
    const corner = Math.min(x, y, size - 1 - x, size - 1 - y);
    const rounded = (x >= 30 && x <= 225) || (y >= 30 && y <= 225) ||
      (x - 30) ** 2 + (y - 30) ** 2 <= 30 ** 2 ||
      (x - 225) ** 2 + (y - 30) ** 2 <= 30 ** 2 ||
      (x - 30) ** 2 + (y - 225) ** 2 <= 30 ** 2 ||
      (x - 225) ** 2 + (y - 225) ** 2 <= 30 ** 2;
    const blade = blades.some((triangle) => insideTriangle(x, y, triangle));
    const color = blade ? [245, 233, 229, 255] : [201, 70, 61, rounded ? 255 : 0];
    pixels.set(color, offset);
  }
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);

const icoHeader = Buffer.from("0000010001000000000001002000", "hex");
const icoEntry = Buffer.alloc(8);
icoEntry.writeUInt32LE(png.length, 0);
icoEntry.writeUInt32LE(22, 4);

writeFileSync(resolve("assets/icon.png"), png);
writeFileSync(resolve("assets/icon.ico"), Buffer.concat([icoHeader, icoEntry, png]));
