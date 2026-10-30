#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as simpleIcons from 'simple-icons';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const catalogPath = path.join(root, 'brand-marks', 'catalog.json');
const outputPath = path.join(root, 'renderers', 'shared', 'generated-brand-marks.mjs');
const localCatalogPath = path.join(root, 'brand-marks', 'catalog.local.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
// Local marks stay out of the upstream catalog so upstream updates cannot conflict with them.
catalog.marks.push(...JSON.parse(fs.readFileSync(localCatalogPath, 'utf8')).marks);
const simpleIconsVersion = JSON.parse(fs.readFileSync(
  path.join(root, 'node_modules', 'simple-icons', 'package.json'),
  'utf8',
)).version;
const simpleBySlug = new Map(Object.values(simpleIcons)
  .filter((icon) => icon && typeof icon === 'object' && icon.slug && icon.path)
  .map((icon) => [icon.slug, icon]));

function normalizedList(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item).trim())
    .filter(Boolean))];
}

function lookupForms(value) {
  const raw = String(value ?? '').trim().toLocaleLowerCase('en-US');
  if (!raw) return [];
  return [...new Set([
    raw,
    raw.replace(/[\s_]+/g, '-'),
    raw.replace(/[\s_.-]+/g, ''),
  ])];
}

function fail(message) {
  console.error(`brand catalog: ${message}`);
  process.exit(1);
}

function svgMark(entry) {
  if (!entry.title || !entry.source || !/^[0-9A-F]{6}$/i.test(entry.hex || '')) {
    fail(`${entry.id} svgFile mark requires title, source, and six-digit hex`);
  }
  const svgPath = path.join(root, 'brand-marks', entry.svgFile);
  if (!fs.existsSync(svgPath)) fail(`${entry.id} references missing file ${entry.svgFile}`);
  const svg = fs.readFileSync(svgPath, 'utf8').trim();
  // Official full-colour artwork is embedded unaltered, so unsafe files are rejected rather than cleaned.
  if (!svg.startsWith('<svg')) fail(`${entry.svgFile} must start with an svg element`);
  if (/<script|<foreignObject|\son[a-z]+\s*=/i.test(svg)) fail(`${entry.svgFile} contains script or event handlers`);
  const references = [...svg.matchAll(/(?:href\s*=\s*["']|url\(\s*["']?)([^"')\s]+)/gi)].map((match) => match[1]);
  if (references.some((reference) => !reference.startsWith('#'))) fail(`${entry.svgFile} contains an external reference`);
  const box = svg.match(/viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/);
  const size = box
    ? [box[1], box[2]]
    : [svg.match(/\swidth="([\d.]+)"/)?.[1], svg.match(/\sheight="([\d.]+)"/)?.[1]];
  const viewBox = Math.max(...size.map(Number));
  if (!Number.isFinite(viewBox) || viewBox <= 0) fail(`${entry.svgFile} needs a viewBox or width and height`);
  return { viewBox, svg: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
}

if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.marks) || catalog.marks.length === 0) {
  fail('catalog.json must contain a non-empty schemaVersion 1 marks array');
}

const ids = new Set();
const lookupKeys = new Map();
const domains = new Map();
const generated = catalog.marks.map((entry, index) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id || '')) fail(`marks[${index}] has an invalid id`);
  if (ids.has(entry.id)) fail(`duplicate id ${entry.id}`);
  ids.add(entry.id);

  const aliases = normalizedList(entry.aliases);
  const entryDomains = normalizedList(entry.domains).map((domain) => domain.toLowerCase());
  for (const key of [entry.id, ...aliases]) {
    for (const form of lookupForms(key)) {
      if (lookupKeys.has(form) && lookupKeys.get(form) !== entry.id) {
        fail(`lookup key ${JSON.stringify(key)} is shared by ${lookupKeys.get(form)} and ${entry.id}`);
      }
      lookupKeys.set(form, entry.id);
    }
  }
  for (const domain of entryDomains) {
    if (domains.has(domain) && domains.get(domain) !== entry.id) {
      fail(`domain ${domain} is shared by ${domains.get(domain)} and ${entry.id}`);
    }
    domains.set(domain, entry.id);
  }

  let mark;
  if (entry.simpleIcon) {
    const icon = simpleBySlug.get(entry.simpleIcon);
    if (!icon) fail(`${entry.id} references missing Simple Icons slug ${entry.simpleIcon}`);
    mark = {
      id: entry.id,
      title: entry.title || icon.title,
      category: entry.category,
      aliases,
      domains: entryDomains,
      viewBox: 24,
      hex: icon.hex,
      path: icon.path,
      provenance: {
        provider: 'Simple Icons',
        providerVersion: simpleIconsVersion,
        source: icon.source,
        ...(icon.guidelines ? { guidelines: icon.guidelines } : {}),
        ...(icon.license ? { license: icon.license } : {}),
      },
    };
  } else if (entry.custom) {
    const custom = entry.custom;
    if (!entry.title || !custom.path || !custom.source || !/^[0-9A-F]{6}$/i.test(custom.hex || '')) {
      fail(`${entry.id} custom mark requires title, path, source, and six-digit hex`);
    }
    mark = {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      aliases,
      domains: entryDomains,
      viewBox: custom.viewBox || 24,
      hex: custom.hex.toUpperCase(),
      path: custom.path,
      provenance: {
        provider: 'Official brand asset',
        source: custom.source,
        ...(custom.guidelines ? { guidelines: custom.guidelines } : {}),
      },
    };
  } else if (entry.svgFile) {
    const { viewBox, svg } = svgMark(entry);
    mark = {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      aliases,
      domains: entryDomains,
      viewBox,
      hex: entry.hex.toUpperCase(),
      svg,
      provenance: {
        provider: entry.provider || 'Official brand asset',
        source: entry.source,
        ...(entry.guidelines ? { guidelines: entry.guidelines } : {}),
        ...(entry.note ? { note: entry.note } : {}),
      },
    };
  } else {
    fail(`${entry.id} must provide simpleIcon, custom, or svgFile`);
  }
  if (!mark.category || !mark.title) fail(`${entry.id} is missing category or title`);
  for (const form of lookupForms(mark.title)) {
    if (lookupKeys.has(form) && lookupKeys.get(form) !== entry.id) {
      fail(`title ${JSON.stringify(mark.title)} is shared by ${lookupKeys.get(form)} and ${entry.id}`);
    }
    lookupKeys.set(form, entry.id);
  }
  return mark;
}).sort((left, right) => left.id.localeCompare(right.id));

const banner = `// Generated by scripts/generate-brand-marks.mjs from brand-marks/catalog.json.\n// Simple Icons ${simpleIconsVersion}. Do not edit by hand.\n`;
const source = `${banner}export const BRAND_MARKS = Object.freeze(${JSON.stringify(generated, null, 2)});\n`;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, 'utf8').replace(/\r\n?/g, '\n')
    : '';
  if (current !== source) {
    console.error('generated brand marks are stale — run npm run generate:brand-marks');
    process.exit(1);
  }
} else {
  const temporary = `${outputPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, source);
  fs.renameSync(temporary, outputPath);
  console.log(`generated ${path.relative(root, outputPath)} (${generated.length} marks)`);
}
