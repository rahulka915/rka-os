import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('apps/mobile/assets/ronin/side-view-vector-only.svg');
const outputDirectory = path.resolve('apps/mobile/assets/ronin/for-rive/side-layer-pack-v1');
const source = await readFile(sourcePath, 'utf8');

const layers = [
  ['cat', 'CAT', 'Cat_Root'],
  ['legs-and-boots', 'LEGS_AND_BOOTS', 'Side_Legs'],
  ['hair-and-headband', 'HAIR_AND_HEADBAND', 'Side_Head_Secondary'],
  ['torso-and-sash', 'TORSO_AND_SASH', 'Side_Torso'],
  ['face-and-front-hand', 'FACE_AND_FRONT_HAND', 'Side_Head_FrontHand'],
  ['backpack', 'BACKPACK', 'Side_Backpack'],
  ['back-hand-and-sword', 'BACK_HAND_AND_SWORD', 'Side_BackHand_Sword'],
];

function extractGroup(id) {
  const startPattern = new RegExp(`<g\\s+id="${id}"[^>]*>`);
  const match = startPattern.exec(source);
  if (!match) throw new Error(`Missing group: ${id}`);

  let depth = 1;
  let cursor = match.index + match[0].length;
  const tagPattern = /<g\b[^>]*>|<\/g>/g;
  tagPattern.lastIndex = cursor;
  while (depth > 0) {
    const tag = tagPattern.exec(source);
    if (!tag) throw new Error(`Unclosed group: ${id}`);
    depth += tag[0].startsWith('</') ? -1 : 1;
    cursor = tagPattern.lastIndex;
  }
  return source.slice(match.index, cursor);
}

await mkdir(outputDirectory, { recursive: true });

const manifest = {
  status: 'coarse_import_pack_requires_contour_separation_for_deformation',
  source: '../../side-view-vector-only.svg',
  viewBox: '0 0 1255 1255',
  importOrderBackToFront: layers.map(([file]) => `${file}.svg`),
  layers: [],
  limitations: [
    'The source outline still spans Ronin and cat.',
    'Upper/lower limbs remain fused inside coarse Illustrator buckets.',
    'Use these files for independent rigid transforms and redraw shared contours before mesh weighting.',
  ],
};

for (const [file, sourceId, riveName] of layers) {
  const group = extractGroup(sourceId)
    .replace(`<g id="${sourceId}"`, `<g id="${riveName}" data-source-id="${sourceId}"`);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1255" height="1255" viewBox="0 0 1255 1255" fill="none">\n  <g id="SOURCE_COORDINATE_OFFSET" transform="translate(-1290.4463 0)">\n${group}\n  </g>\n</svg>\n`;
  await writeFile(path.join(outputDirectory, `${file}.svg`), svg);
  manifest.layers.push({ file: `${file}.svg`, sourceId, riveName });
}

await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
