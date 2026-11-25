#!/usr/bin/env node
// Builds the icon set from the Archify brand marks and Microsoft's Azure icon download.
//
//   node azure-diagram/scripts/build-icons.mjs [--out <dir>] [--source <brand-marks dir>] [--azure <dir>]
//
// Writes the icon index and a single file of SVG artwork. A missing
// viewBox is added. An unsafe SVG stops the build.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertSafeSvg, ensureViewBox, normalise } from '../lib/icons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const AZURE_SET = 'Azure Public Service Icons V24';

// Microsoft's file names carry the product name, as in 00028-icon-service-Batch-AI.svg.
const titleOf = (file) => file.replace(/\.svg$/i, '').replace(/^\d+\s*-icon-service-/, '').replace(/-/g, ' ');
const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The curated marks win, so their names and ids keep meaning what they did. Microsoft
// repeats some icons across categories, and those are kept once.
function azureIcons(dir, curated, write) {
  const names = new Set(curated.map((icon) => normalise(icon.title)));
  const ids = new Set(curated.map((icon) => icon.id));
  const art = new Map();
  const icons = [];
  for (const category of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, category);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const file of fs.readdirSync(folder).sort()) {
      const svg = fs.readFileSync(path.join(folder, file), 'utf8');
      assertSafeSvg(svg, file);
      const title = titleOf(file);
      const key = normalise(title);
      const base = slug(title);
      if (names.has(key) || (ids.has(base) && !art.has(key)) || art.get(key)?.has(svg)) continue;
      art.set(key, (art.get(key) ?? new Set()).add(svg));
      let id = base;
      for (let copy = 2; ids.has(id); copy += 1) id = `${base}-${copy}`;
      ids.add(id);
      write(`${id}.svg`, svg, file);
      icons.push({ id, title, aliases: [], file: `${id}.svg`, note: `${AZURE_SET}: ${category}` });
    }
  }
  return icons;
}

export function buildIcons({
  source = path.resolve(here, '..', '..', 'archify', 'brand-marks'),
  azure = path.resolve(here, '..', 'azure-icons'),
  out = path.resolve(here, '..', 'icons'),
} = {}) {
  const catalogFile = path.join(source, 'catalog.local.json');
  if (!fs.existsSync(catalogFile)) throw new Error(`Catalog not found: ${catalogFile}`);
  const { marks } = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));

  fs.mkdirSync(out, { recursive: true });
  const artwork = Object.create(null);
  const write = (file, svg, name) => { artwork[file] = ensureViewBox(svg, name); };
  const curated = marks.map((mark) => {
    const svg = fs.readFileSync(path.join(source, mark.svgFile), 'utf8');
    assertSafeSvg(svg, mark.svgFile);
    const file = `${mark.id}.svg`;
    write(file, svg, mark.svgFile);
    const icon = { id: mark.id, title: mark.title, aliases: mark.aliases ?? [], file, note: mark.note ?? '' };
    // A reused mark stands in for a product that has no icon, so the user must be told.
    if (/^reuse/i.test(mark.note ?? '')) icon.warning = `${mark.id}: ${mark.note}`;
    return icon;
  });
  const icons = [...curated, ...azureIcons(azure, curated, write)];
  fs.writeFileSync(path.join(out, 'index.json'), `${JSON.stringify({ schemaVersion: 1, icons }, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'artwork.json'), JSON.stringify(artwork));
  return icons;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => (args.includes(name) ? path.resolve(args[args.indexOf(name) + 1] ?? '') : undefined);
  try {
    const out = option('--out');
    const icons = buildIcons({ source: option('--source'), azure: option('--azure'), out });
    console.log(`Built ${icons.length} icons${out ? ` in ${out}` : ''}.`);
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
