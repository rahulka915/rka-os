import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const ASSET_DIRECTORY = join(SCRIPT_DIRECTORY, '../assets/ronin/idle-v2');
const CANVAS_SIZE = 640;
const GROUND_BASELINE_Y = 580;
const FOOT_ANCHOR_TOLERANCE_PX = 2;
const ALPHA_THRESHOLD = 10;

const CLIPS = [
  ['calm', 8],
  ['look-around', 8],
  ['blink-dip', 6],
  ['yawn', 10],
  ['adjust-wrap', 10],
  ['shoulder-stretch', 10],
];
const SPECIAL_CLIPS = new Set(['yawn', 'adjust-wrap', 'shoulder-stretch']);

const expectedFrames = CLIPS.flatMap(([clip, count]) =>
  Array.from({ length: count }, (_, index) => ({
    clip,
    filename: `${clip}-${String(index + 1).padStart(2, '0')}.png`,
  })),
);

function visibleBounds(png) {
  let left = png.width;
  let top = png.height;
  let right = -1;
  let bottom = -1;
  let hasTransparentPixel = false;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if (alpha === 0) hasTransparentPixel = true;
      if (alpha > ALPHA_THRESHOLD) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  return { hasTransparentPixel, bounds: right < 0 ? null : { left, top, right, bottom } };
}

function isRgbaPng(png) {
  return png.colorType === 6 && png.bpp === 4;
}

function validateFrame(frame, errors) {
  const path = join(ASSET_DIRECTORY, frame.filename);
  let png;
  try {
    png = PNG.sync.read(readFileSync(path));
  } catch (error) {
    errors.push(`Unreadable frame: ${frame.filename} (${error.message})`);
    return;
  }

  if (png.width !== CANVAS_SIZE || png.height !== CANVAS_SIZE) {
    errors.push(`Invalid dimensions: ${frame.filename} is ${png.width}×${png.height}; expected 640×640`);
    return;
  }
  if (!isRgbaPng(png)) {
    errors.push(`Missing RGBA channels: ${frame.filename} is PNG color type ${png.colorType}; expected RGBA`);
    return;
  }

  const { hasTransparentPixel, bounds } = visibleBounds(png);
  if (!hasTransparentPixel) {
    errors.push(`Missing transparent background: ${frame.filename}`);
  }
  if (!bounds) {
    errors.push(`Empty visible bounds: ${frame.filename}`);
    return;
  }
  if (Math.abs(bounds.bottom - GROUND_BASELINE_Y) > FOOT_ANCHOR_TOLERANCE_PX) {
    errors.push(
      `Foot anchor drift: ${frame.filename} bottom is y=${bounds.bottom}; expected ${GROUND_BASELINE_Y}±${FOOT_ANCHOR_TOLERANCE_PX}`,
    );
  }
}

function main() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== '--allow-missing-specials')) {
    console.error('ERROR: Usage: node scripts/validate-ronin-idle-assets.mjs [--allow-missing-specials]');
    process.exitCode = 1;
    return;
  }
  const allowMissingSpecials = arguments_.includes('--allow-missing-specials');
  const errors = [];
  const allowedMissing = [];

  if (!existsSync(ASSET_DIRECTORY)) {
    errors.push(`Missing asset directory: ${ASSET_DIRECTORY}`);
  }
  const actualPngs = existsSync(ASSET_DIRECTORY)
    ? readdirSync(ASSET_DIRECTORY).filter((filename) => filename.endsWith('.png')).sort()
    : [];
  const expectedPngs = expectedFrames.map(({ filename }) => filename).sort();
  const expectedSet = new Set(expectedPngs);

  for (const frame of expectedFrames) {
    if (!existsSync(join(ASSET_DIRECTORY, frame.filename))) {
      if (allowMissingSpecials && SPECIAL_CLIPS.has(frame.clip)) {
        allowedMissing.push(frame.filename);
      } else {
        errors.push(`Missing frame: ${frame.filename}`);
      }
      continue;
    }
    validateFrame(frame, errors);
  }
  for (const filename of actualPngs) {
    if (!expectedSet.has(filename)) errors.push(`Unexpected runtime frame: ${filename}`);
  }

  if (allowedMissing.length > 0) {
    console.log(`ALLOWED MISSING SPECIAL FRAMES (${allowedMissing.length}): ${allowedMissing.join(', ')}`);
  }
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: 52 approved Ronin idle-v2 frames; foot anchor ${GROUND_BASELINE_Y}±${FOOT_ANCHOR_TOLERANCE_PX}px.`);
}

main();
