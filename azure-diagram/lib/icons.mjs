import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DiagramError } from './errors.mjs';

export const DEFAULT_ICONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const stroke = 'fill="none" stroke="#605E5C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

// Neutral shapes for anything that has no mark of its own. They are deliberately not
// lookalikes of any vendor's icon.
const GENERIC = {
  person: {
    title: 'Person',
    svg: wrap(`<g ${stroke}><circle cx="32" cy="21" r="12"/><path d="M10 56c2-13 11-20 22-20s20 7 22 20"/></g>`),
  },
  server: {
    title: 'Server',
    svg: wrap(`<g ${stroke}><rect x="10" y="9" width="44" height="20" rx="3"/><rect x="10" y="35" width="44" height="20" rx="3"/><path d="M19 19h.01M19 45h.01M29 19h16M29 45h16"/></g>`),
  },
  database: {
    title: 'Database',
    svg: wrap(`<g ${stroke}><ellipse cx="32" cy="14" rx="21" ry="8"/><path d="M11 14v36c0 4.4 9.4 8 21 8s21-3.6 21-8V14M11 32c0 4.4 9.4 8 21 8s21-3.6 21-8"/></g>`),
  },
  cloud: {
    title: 'Cloud',
    svg: wrap(`<g ${stroke}><path d="M18 50a12 12 0 0 1-1.5-23.9A16 16 0 0 1 47 23.5 13.5 13.5 0 0 1 46.5 50z"/></g>`),
  },
  document: {
    title: 'Document',
    svg: wrap(`<g ${stroke}><path d="M15 6h24l12 12v40H15z"/><path d="M39 6v12h12M23 31h20M23 40h20M23 49h12"/></g>`),
  },
};

export const normalise = (text) => String(text).trim().toLowerCase().replace(/[\s_]+/g, ' ');

const UNSAFE = [
  [/<\s*script\b/i, 'a <script> element'],
  [/<\s*(foreignObject|iframe|embed|object|audio|video|image|animate|set)\b/i, 'an embedded or active element'],
  [/\son[a-z]+\s*=/i, 'an event handler attribute'],
  [/<!(DOCTYPE|ENTITY)/i, 'a DOCTYPE or ENTITY declaration'],
  [/javascript:/i, 'a javascript: URL'],
  [/@import/i, 'an @import rule'],
  [/url\(\s*(?!['"]?#)/i, 'a url() reference outside the file'],
  [/\b(?:xlink:)?href\s*=\s*(?!["']?#)/i, 'a link outside the file'],
];

export function assertSafeSvg(svg, name) {
  if (!/<svg\b/i.test(svg)) throw new DiagramError(`${name}: not an SVG file`);
  for (const [pattern, what] of UNSAFE) {
    if (pattern.test(svg)) throw new DiagramError(`${name}: unsafe SVG, contains ${what}`);
  }
}

// Only adds a viewBox when the root has none; every other byte stays as published.
export function ensureViewBox(svg, name) {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) throw new DiagramError(`${name}: not an SVG file`);
  if (/\sviewBox\s*=/i.test(root)) return svg;
  const size = (attr) => root.match(new RegExp(`\\s${attr}\\s*=\\s*["']([\\d.]+)(?:px)?["']`, 'i'))?.[1];
  const [width, height] = [size('width'), size('height')];
  if (!width || !height) throw new DiagramError(`${name}: has no viewBox and no numeric width and height`);
  return svg.replace(root, root.replace(/^<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`));
}

export function loadIcons(dir = DEFAULT_ICONS_DIR) {
  const indexFile = path.join(dir, 'index.json');
  if (!fs.existsSync(indexFile)) {
    throw new DiagramError(`Icon index not found at ${indexFile}. In the repo, run: node azure-diagram/scripts/build-icons.mjs`);
  }
  const { icons } = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const lookup = new Map();
  const add = (key, icon) => {
    const id = normalise(key);
    if (!lookup.has(id)) lookup.set(id, icon);
  };
  // An exact id or title beats another icon's alias: "Azure OpenAI" is its own icon.
  for (const icon of icons) [icon.id, icon.title].forEach((key) => add(key, icon));
  for (const icon of icons) (icon.aliases ?? []).forEach((key) => add(key, icon));
  return { dir, icons, lookup };
}

export function genericIds() {
  return Object.keys(GENERIC).map((name) => `generic:${name}`);
}

// Returns { id, title, svg, warning? }, or undefined for an unknown reference.
export function resolveIcon(library, reference) {
  const key = normalise(reference);
  if (key.startsWith('generic:')) {
    const generic = GENERIC[key.slice('generic:'.length)];
    return generic && { id: key, title: generic.title, svg: generic.svg };
  }
  const icon = library.lookup.get(key);
  if (!icon) return undefined;
  const svg = fs.readFileSync(path.join(library.dir, icon.file), 'utf8');
  assertSafeSvg(svg, icon.file);
  return { id: icon.id, title: icon.title, svg, warning: icon.warning };
}

export function suggest(library, reference) {
  const key = normalise(reference);
  return library.icons
    .filter((icon) => [icon.id, icon.title, ...(icon.aliases ?? [])].some((name) => {
      const candidate = normalise(name);
      return candidate.includes(key) || key.includes(candidate);
    }))
    .slice(0, 4)
    .map((icon) => icon.id);
}

export function searchIcons(library, query = '') {
  const key = normalise(query);
  const entries = [
    ...library.icons,
    ...Object.entries(GENERIC).map(([name, { title }]) => ({
      id: `generic:${name}`, title: `${title} (neutral shape)`, aliases: [],
    })),
  ];
  return entries.filter((icon) => [icon.id, icon.title, ...(icon.aliases ?? [])].some((name) => normalise(name).includes(key)));
}
