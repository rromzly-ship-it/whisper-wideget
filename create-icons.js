// Generates a clean 32x32 and 64x64 PNG icon of a Blue Circle with White Microphone
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(size) {
  const width = size;
  const height = size;
  const radius = size / 2;
  const center = size / 2;

  // Buffer for raw uncompressed image data (RGBA) with 1 filter byte per scanline
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Antialiasing border
      let alpha = 0;
      if (dist <= radius - 1) {
        alpha = 1;
      } else if (dist < radius) {
        alpha = radius - dist;
      }

      if (alpha <= 0) {
        // Transparent
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }

      // Base background: Blue (#2563EB -> R: 37, G: 99, B: 235)
      let r = 37;
      let g = 99;
      let b = 235;

      // Draw Microphone glyph in white (#FFFFFF)
      // Normalized coordinates [-1, 1]
      const nx = dx / radius;
      const ny = dy / radius;

      let isMic = false;

      // 1. Mic capsule: rounded rect from y = -0.55 to 0.15, width = [-0.22, 0.22]
      if (nx >= -0.22 && nx <= 0.22 && ny >= -0.55 && ny <= 0.12) {
        // Round top
        if (ny < -0.32) {
          const capDist = Math.sqrt(nx * nx + Math.pow(ny - (-0.32), 2));
          if (capDist <= 0.22) isMic = true;
        } else if (ny > -0.1) {
          // Round bottom
          const capDist = Math.sqrt(nx * nx + Math.pow(ny - (-0.1), 2));
          if (capDist <= 0.22) isMic = true;
        } else {
          isMic = true;
        }
      }

      // 2. Mic U-cradle arc
      const cradleDist = Math.sqrt(nx * nx + ny * ny);
      if (cradleDist >= 0.32 && cradleDist <= 0.44 && ny >= -0.15 && ny <= 0.38) {
        isMic = true;
      }

      // 3. Mic stem: from y = 0.38 to 0.62, width [-0.07, 0.07]
      if (nx >= -0.07 && nx <= 0.07 && ny >= 0.38 && ny <= 0.62) {
        isMic = true;
      }

      // 4. Mic base horizontal line: y = [0.55, 0.66], width [-0.28, 0.28]
      if (nx >= -0.28 && nx <= 0.28 && ny >= 0.55 && ny <= 0.67) {
        isMic = true;
      }

      if (isMic) {
        r = 255;
        g = 255;
        b = 255;
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = Math.round(alpha * 255);
    }
  }

  // Deflate compressed data
  const compressedData = zlib.deflateSync(rawData);

  // Build PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(4 + 4 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.slice(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const icon32 = createPng(32);
const icon64 = createPng(64);

fs.writeFileSync(path.join(__dirname, 'icon.png'), icon32);
fs.writeFileSync(path.join(__dirname, 'icon-large.png'), icon64);
console.log('Successfully generated icon.png and icon-large.png!');

