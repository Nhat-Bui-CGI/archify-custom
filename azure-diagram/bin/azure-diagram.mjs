#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { DiagramError } from '../lib/errors.mjs';
import { loadIcons, searchIcons } from '../lib/icons.mjs';
import { renderDiagram } from '../lib/render.mjs';

const USAGE = `Usage:
  azure-diagram render <spec.json> --out <path-stem>   write <stem>.svg, .html and .drawio
  azure-diagram icons [query] [--json]                 list icons`;

function render(args) {
  const outIndex = args.indexOf('--out');
  const stem = outIndex >= 0 ? args[outIndex + 1] : undefined;
  const specFile = args.find((arg, index) => !arg.startsWith('--') && index !== outIndex + 1);
  if (!specFile || !stem) return usage('render needs a spec file and --out <path-stem>.');
  if (!fs.existsSync(specFile)) throw new DiagramError(`Spec file not found: ${specFile}`);
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  } catch (error) {
    throw new DiagramError(`${specFile} is not valid JSON: ${error.message}`);
  }
  const { svg, html, drawio, warnings } = renderDiagram(spec);
  const base = path.resolve(stem.replace(/\.(svg|html|drawio)$/i, ''));
  fs.mkdirSync(path.dirname(base), { recursive: true });
  for (const [extension, content] of [['svg', svg], ['html', html], ['drawio', drawio]]) {
    fs.writeFileSync(`${base}.${extension}`, content);
    console.log(`wrote ${base}.${extension}`);
  }
  for (const warning of warnings) console.error(`warning: ${warning}`);
  return 0;
}

function icons(args) {
  const json = args.includes('--json');
  const query = args.find((arg) => !arg.startsWith('--')) ?? '';
  const matches = searchIcons(loadIcons(), query);
  if (json) {
    console.log(JSON.stringify(matches, null, 2));
    return 0;
  }
  if (matches.length === 0) {
    console.error(`No icon matches "${query}". Use a neutral shape: generic:person, server, database, cloud or document.`);
    return 1;
  }
  for (const icon of matches) {
    const aliases = icon.aliases?.length ? `  (${icon.aliases.join(', ')})` : '';
    console.log(`${icon.id.padEnd(24)} ${icon.title}${aliases}`);
    if (icon.warning) console.log(`${''.padEnd(24)} note: ${icon.note}`);
  }
  return 0;
}

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error(USAGE);
  return 2;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'render') process.exitCode = render(args);
  else if (command === 'icons') process.exitCode = icons(args);
  else process.exitCode = usage(command ? `unknown command "${command}".` : undefined);
} catch (error) {
  if (!(error instanceof DiagramError)) throw error;
  for (const problem of error.problems) console.error(`error: ${problem}`);
  process.exitCode = 1;
}
