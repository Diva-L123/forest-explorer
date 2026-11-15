const fs = require('fs');
const width = 16;
const height = 16;
const bmpHeaderSize = 40;
const pixelDataSize = width * height * 4;
const andMaskSize = (Math.ceil(width / 32) * 4) * height;
const imageSize = bmpHeaderSize + pixelDataSize + andMaskSize;

const ico = Buffer.alloc(6 + 16 + imageSize);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);

ico.writeUInt8(width, 6);
ico.writeUInt8(height, 7);
ico.writeUInt8(0, 8);
ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(imageSize, 14);
ico.writeUInt32LE(22, 18);

const offset = 22;
ico.writeUInt32LE(bmpHeaderSize, offset);
ico.writeInt32LE(width, offset + 4);
ico.writeInt32LE(height * 2, offset + 8);
ico.writeUInt16LE(1, offset + 12);
ico.writeUInt16LE(32, offset + 14);
ico.writeUInt32LE(0, offset + 16);
ico.writeUInt32LE(pixelDataSize + andMaskSize, offset + 20);
ico.writeInt32LE(0, offset + 24);
ico.writeInt32LE(0, offset + 28);
ico.writeUInt32LE(0, offset + 32);
ico.writeUInt32LE(0, offset + 36);

let p = offset + bmpHeaderSize;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const dx = x - 7.5;
    const dy = y - 7.5;
    if (dx * dx + dy * dy <= 36) {
      ico.writeUInt8(46, p);
      ico.writeUInt8(160, p + 1);
      ico.writeUInt8(67, p + 2);
      ico.writeUInt8(255, p + 3);
    } else {
      ico.writeUInt32LE(0, p);
    }
    p += 4;
  }
}

fs.writeFileSync('favicon.ico', ico);
console.log('favicon.ico created, length:', ico.length);
