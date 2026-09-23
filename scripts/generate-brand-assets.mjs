// Regenerates every static brand asset (favicons, app icons, PWA icons, logo files) from the
// constants in lib/brand.ts. Run with `npm run brand:assets` after changing the mark.
// Requires Node >= 22.18 (native TypeScript type stripping for the lib/brand.ts import).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { logoSvg } from "../lib/brand.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const rounded = logoSvg();
const fullBleed = logoSvg({ shape: "square" });
// Maskable icons get cropped to a circle by the OS; keep the hawk inside the 80% safe zone.
const maskable = logoSvg({ shape: "square", hawkScale: 0.8 });

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: Math.max(72, size * 4) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ICO container holding PNG-encoded images (supported by every browser since IE Vista-era).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

async function write(relativePath, contents) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents);
  console.log(`  wrote ${relativePath}`);
}

console.log("Generating Tallyhawk brand assets…");

await write("app/icon.svg", rounded);
await write("public/logo.svg", rounded);
await write("public/logo.png", await png(rounded, 512));
await write("app/apple-icon.png", await png(fullBleed, 180));
await write("public/icons/icon-192.png", await png(rounded, 192));
await write("public/icons/icon-512.png", await png(rounded, 512));
await write("public/icons/icon-maskable-512.png", await png(maskable, 512));
await write(
  "app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) }))))
);

console.log("Done.");
