import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

function createPng(width, height, r, g, b) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.42;
      
      if (dist < radius) {
        rawData[pixelOffset] = Math.min(255, 99 + Math.floor(x / width * 80)); // R
        rawData[pixelOffset + 1] = Math.min(255, 102 + Math.floor(y / height * 60)); // G
        rawData[pixelOffset + 2] = 241; // B
        rawData[pixelOffset + 3] = 255; // A
      } else {
        rawData[pixelOffset] = 15; // R
        rawData[pixelOffset + 1] = 23; // G
        rawData[pixelOffset + 2] = 42; // B
        rawData[pixelOffset + 3] = 255; // A
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function run() {
  const p192 = createPng(192, 192, 99, 102, 241);
  const p512 = createPng(512, 512, 99, 102, 241);
  const appleTouch = createPng(180, 180, 99, 102, 241);

  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), p192);
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), p512);
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), p512);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), appleTouch);
  console.log('Generated PWA PNG assets successfully!');
}

run();
