/**
 * Zero-dependency PNG Icon Generator for Chrome Extension
 * Creates valid 16x16, 48x48, and 128x128 RGBA PNG icons + SVG vector
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// CRC32 implementation for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

function generatePng(size) {
  // 1. Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk("IHDR", ihdr);

  // 3. Image Raw Scanlines (filter byte 0x00 + RGBA)
  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowSize);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.45;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // None filter

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Rounded badge background: Gradient from Indigo (#4f46e5) to Purple (#9333ea)
        const t = (x + y) / (size * 2);
        let r = Math.round(79 * (1 - t) + 147 * t);
        let g = Math.round(70 * (1 - t) + 51 * t);
        let b = Math.round(229 * (1 - t) + 234 * t);
        let a = 255;

        // Inner border highlight
        if (dist > radius - (size > 32 ? 2.5 : 1)) {
          r = Math.min(255, r + 60);
          g = Math.min(255, g + 60);
          b = Math.min(255, b + 40);
        }

        // Central stylized Lightning Bolt / Robot Spark
        const nx = (x - cx) / (radius * 0.7);
        const ny = (y - cy) / (radius * 0.7);

        // Lightning bolt polygon approximation
        const inBolt =
          (ny > -0.7 && ny < -0.1 && nx > ny * 0.3 - 0.25 && nx < ny * 0.3 + 0.25) ||
          (ny >= -0.1 && ny <= 0.1 && nx > -0.35 && nx < 0.35) ||
          (ny > 0.1 && ny < 0.7 && nx > ny * 0.3 - 0.25 && nx < ny * 0.3 + 0.25);

        if (inBolt) {
          // Glowing Gold / Amber (#fbbf24) to Electric Emerald (#34d399)
          r = 251;
          g = 191;
          b = 36;
        }

        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      } else {
        // Transparent outside badge
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // 4. IDAT Chunk (zlib compressed)
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", compressed);

  // 5. IEND Chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function generateSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#9333ea" />
    </linearGradient>
    <linearGradient id="bolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bg)" stroke="#a855f7" stroke-width="2" />
  <path d="M68 24 L36 68 L60 68 L54 104 L92 56 L68 56 Z" fill="url(#bolt)" filter="url(#glow)" />
</svg>`;
}

export function buildIcons(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const pngBuf = generatePng(size);
    const dest = path.join(targetDir, `icon${size}.png`);
    fs.writeFileSync(dest, pngBuf);
    console.log(`[IconGen] Generated ${dest} (${pngBuf.length} bytes)`);
  }

  const svgContent = generateSvg();
  const svgDest = path.join(targetDir, "icon.svg");
  fs.writeFileSync(svgDest, svgContent, "utf8");
  console.log(`[IconGen] Generated ${svgDest}`);
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] || path.resolve(process.cwd(), "../extension/icons");
  buildIcons(outDir);
}
