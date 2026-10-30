#!/usr/bin/env node
// Builds the icon set from the Archify brand marks.
//
//   node azure-diagram/scripts/build-icons.mjs [--out <dir>] [--source <brand-marks dir>]
//
// Writes <id>.svg and index.json. SVGs are copied unaltered, except that a missing
// viewBox is added. An unsafe SVG stops the build.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertSafeSvg, ensureViewBox } from '../lib/icons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function buildIcons({
  source = path.resolve(here, '..', '..', 'archify', 'brand-marks'),
  out = path.resolve(here, '..', 'icons'),
} = {}) {
  const catalogFile = path.join(source, 'catalog.local.json');
  if (!fs.existsSync(catalogFile)) throw new Error(`Catalog not found: ${catalogFile}`);
  const { marks } = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));

  fs.mkdirSync(out, { recursive: true });
  const icons = marks.map((mark) => {
    const svg = fs.readFileSync(path.join(source, mark.svgFile), 'utf8');
    assertSafeSvg(svg, mark.svgFile);
    const file = `${mark.id}.svg`;
    fs.writeFileSync(path.join(out, file), ensureViewBox(svg, mark.svgFile));
    const icon = { id: mark.id, title: mark.title, aliases: mark.aliases ?? [], file, note: mark.note ?? '' };
    // A reused mark stands in for a product that has no icon, so the user must be told.
    if (/^reuse/i.test(mark.note ?? '')) icon.warning = `${mark.id}: ${mark.note}`;
    return icon;
  });
  fs.writeFileSync(path.join(out, 'index.json'), `${JSON.stringify({ schemaVersion: 1, icons }, null, 2)}\n`);
  return icons;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => (args.includes(name) ? path.resolve(args[args.indexOf(name) + 1] ?? '') : undefined);
  try {
    const out = option('--out');
    const icons = buildIcons({ source: option('--source'), out });
    console.log(`Built ${icons.length} icons${out ? ` in ${out}` : ''}.`);
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
