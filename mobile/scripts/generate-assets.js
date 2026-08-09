#!/usr/bin/env node
// Generates minimal placeholder PNG assets required by Expo for builds.
// Run once: node scripts/generate-assets.js
// Replace output files with real artwork before publishing to stores.

const fs = require('fs');
const path = require('path');

// 1x1 dark green PNG (raw bytes, valid PNG format)
const DARK_BG = '#0a0a0f';

function createSolidPng(width, height, r, g, b, outPath) {
  // PNG header
  const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([len, typeB, data, crcVal]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // bit depth 8, color type RGB

  // IDAT — raw scanlines
  const zlib = require('zlib');
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type none
    for (let x = 0; x < width; x++) {
      raw.push(r, g, b);
    }
  }
  const idat = zlib.deflateSync(Buffer.from(raw));

  const png = Buffer.concat([
    PNG_HEADER,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${width}x${height})`);
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

// Dark background color: #0a0a0f = rgb(10,10,15)
createSolidPng(1024, 1024, 10, 10, 15, path.join(assetsDir, 'icon.png'));
createSolidPng(1284, 2778, 10, 10, 15, path.join(assetsDir, 'splash.png'));
createSolidPng(1024, 1024, 10, 10, 15, path.join(assetsDir, 'adaptive-icon.png'));
createSolidPng(32, 32, 10, 10, 15, path.join(assetsDir, 'favicon.png'));

console.log('\nDone! Replace these placeholder assets with real artwork before submitting to stores.');
