import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DiagramError } from '../lib/errors.mjs';
import { assertSafeSvg, DEFAULT_ICONS_DIR, ensureViewBox, loadIcons } from '../lib/icons.mjs';
import { renderDiagram } from '../lib/render.mjs';
import { nodeObstacles, segmentHitsRect, toSegments } from '../lib/route.mjs';
import { buildIcons } from '../scripts/build-icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'azure-diagram.mjs');
const example = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'd365-integration.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'azure-diagram-test-'));

before(() => {
  // The installed skill ships its icons; a repo checkout builds them on first use.
  if (!fs.existsSync(path.join(DEFAULT_ICONS_DIR, 'index.json'))) buildIcons();
});

const spec = (overrides) => ({
  title: 'T',
  nodes: [
    { id: 'a', icon: 'logic-apps', label: 'A', col: 0, row: 0 },
    { id: 'b', icon: 'service-bus', label: 'B', col: 1, row: 0 },
  ],
  ...overrides,
});

function problems(input) {
  try {
    renderDiagram(input);
  } catch (error) {
    assert.ok(error instanceof DiagramError, `expected a DiagramError, got ${error.stack}`);
    return error.message;
  }
  return assert.fail('expected the render to fail');
}

// A strict tag-balance parser: enough to catch unescaped text and unbalanced elements.
function assertWellFormed(xml) {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const stack = [];
  const token = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/y;
  let at = 0;
  let depthSeen = 0;
  while (at < body.length) {
    const open = body.indexOf('<', at);
    const text = body.slice(at, open === -1 ? body.length : open);
    assert.ok(!/&(?!(amp|lt|gt|quot|#39);)/.test(text), `stray ampersand near: ${text.slice(0, 40)}`);
    if (open === -1) break;
    token.lastIndex = open;
    const match = token.exec(body);
    assert.ok(match, `malformed tag near: ${body.slice(open, open + 60)}`);
    const [, closing, name, attributes, selfClosing] = match;
    assert.ok(!/&(?!(amp|lt|gt|quot|#39);)/.test(attributes), `stray ampersand in attributes of ${name}`);
    if (closing) assert.equal(stack.pop(), name);
    else if (!selfClosing) {
      stack.push(name);
      depthSeen += 1;
    }
    at = token.lastIndex;
  }
  assert.deepEqual(stack, []);
  assert.ok(depthSeen > 0);
}

test('the example renders all three outputs and warns about the AX 2012 mark', () => {
  const stem = path.join(tmp, 'nested', 'example');
  const result = spawnSync(process.execPath, [cli, 'render', path.join(root, 'examples', 'd365-integration.json'), '--out', stem], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const extension of ['svg', 'html', 'drawio']) assert.ok(fs.statSync(`${stem}.${extension}`).size > 1000);
  assert.match(result.stderr, /warning: dynamics-ax-2012: Reuse of the Dynamics 365 icon/);
});

test('no edge in the example passes through a node', () => {
  const { diagram } = renderDiagram(example);
  const rects = diagram.nodes.flatMap(nodeObstacles);
  for (const edge of diagram.edges) {
    for (const segment of toSegments(edge.points)) {
      assert.ok(!rects.some((rect) => segmentHitsRect(segment, rect)), `${edge.from} -> ${edge.to}`);
      assert.ok(segment.a.x === segment.b.x || segment.a.y === segment.b.y, `${edge.from} -> ${edge.to} is not orthogonal`);
    }
  }
});

test('step badges in the example stay apart', () => {
  const { diagram } = renderDiagram(example);
  const badges = diagram.edges.map((edge) => edge.badge);
  assert.equal(badges.filter(Boolean).length, example.steps.length);
  badges.forEach((a, i) => badges.slice(i + 1).forEach((b) => {
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 22);
  }));
});

test('an unknown icon is an error that suggests the neutral shapes', () => {
  const message = problems(spec({ nodes: [{ id: 'a', icon: 'no-such-thing', label: 'A', col: 0, row: 0 }] }));
  assert.match(message, /unknown icon "no-such-thing"/);
  assert.match(message, /generic:person/);
});

test('the CLI reports errors with a nonzero exit', () => {
  const file = path.join(tmp, 'bad.json');
  fs.writeFileSync(file, JSON.stringify(spec({ nodes: [{ id: 'a', icon: 'nope', label: 'A', col: 0, row: 0 }] })));
  const result = spawnSync(process.execPath, [cli, 'render', file, '--out', path.join(tmp, 'bad')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /error: .*unknown icon/);
  assert.ok(!fs.existsSync(path.join(tmp, 'bad.svg')));
});

test('Microsoft icons are searchable, unaltered and do not replace curated marks', () => {
  const { lookup } = loadIcons();
  assert.equal(lookup.get('dataverse').title, 'Microsoft Dataverse');
  assert.equal(lookup.get('azure openai').id, 'azure-openai');
  const firewall = lookup.get('firewalls');
  assert.equal(firewall.title, 'Firewalls');
  assert.match(firewall.note, /Azure Public Service Icons V24: networking/);
  const original = path.join(root, 'test', 'fixtures', 'firewalls.svg');
  assert.equal(fs.readFileSync(path.join(DEFAULT_ICONS_DIR, firewall.file), 'utf8'), fs.readFileSync(original, 'utf8'));
  assert.ok(lookup.size > 600);
  assert.doesNotThrow(() => renderDiagram(spec({ nodes: [{ id: 'a', icon: 'firewalls', label: 'Edge firewall', col: 0, row: 0 }] })));
});

test('the resource name comes first and the product name is shown once', () => {
  const texts = (node) => {
    const { svg } = renderDiagram(spec({ nodes: [node] }));
    return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]).filter((text) => text !== 'T');
  };
  const node = { id: 'a', icon: 'dataverse', col: 0, row: 0 };
  assert.deepEqual(texts({ ...node, label: 'Orders', sublabel: 'Active' }), ['Orders', 'Microsoft Dataverse', 'Active']);
  assert.deepEqual(texts({ ...node, label: 'Microsoft Dataverse', sublabel: 'Active' }), ['Microsoft Dataverse', 'Active']);
  assert.deepEqual(texts({ ...node, label: 'Orders', sublabel: 'Microsoft Dataverse table' }), ['Orders', 'Microsoft Dataverse table']);
  assert.deepEqual(texts({ ...node, icon: 'generic:person', label: 'User' }), ['User']);
});

test('label text is escaped in every output', () => {
  const nasty = '<script>alert("x")</script> & co';
  const { svg, html, drawio } = renderDiagram(spec({
    title: nasty,
    subtitle: nasty,
    nodes: [
      { id: 'a', icon: 'logic-apps', label: nasty, sublabel: nasty, col: 0, row: 0 },
      { id: 'b', icon: 'service-bus', label: 'B', col: 1, row: 0 },
    ],
    groups: [{ id: 'g', label: nasty, kind: 'vnet', contains: ['a', 'b'] }],
    edges: [{ from: 'a', to: 'b', step: 1, label: nasty }],
    steps: [nasty],
  }));
  for (const output of [svg, html, drawio]) assert.ok(!output.includes('<script>alert'));
  assert.ok(html.includes('aria-label="&lt;script&gt;'));
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(html.includes('<li>&lt;script&gt;'));
  assertWellFormed(svg);
  assertWellFormed(drawio);
});

test('two nodes in one cell are an error', () => {
  const message = problems(spec({
    nodes: [
      { id: 'a', icon: 'logic-apps', label: 'A', col: 1, row: 1 },
      { id: 'b', icon: 'service-bus', label: 'B', col: 1, row: 1 },
    ],
  }));
  assert.match(message, /"a" and "b" both use col 1, row 1/);
});

test('a non-member inside a group is an error', () => {
  const nodes = [
    { id: 'a', icon: 'logic-apps', label: 'A', col: 0, row: 0 },
    { id: 'b', icon: 'service-bus', label: 'B', col: 1, row: 0 },
    { id: 'c', icon: 'key-vault', label: 'C', col: 2, row: 0 },
  ];
  const message = problems(spec({ nodes, groups: [{ id: 'g', label: 'G', kind: 'vnet', contains: ['a', 'c'] }] }));
  assert.match(message, /"b" lies inside group "g"/);
});

test('partly overlapping groups are an error', () => {
  const nodes = [
    { id: 'a', icon: 'logic-apps', label: 'A', col: 0, row: 0 },
    { id: 'b', icon: 'service-bus', label: 'B', col: 1, row: 1 },
    { id: 'c', icon: 'key-vault', label: 'C', col: 1, row: 0 },
    { id: 'd', icon: 'entra-id', label: 'D', col: 0, row: 1 },
  ];
  const message = problems(spec({
    nodes,
    groups: [
      { id: 'g', label: 'G', kind: 'vnet', contains: ['a', 'b'] },
      { id: 'h', label: 'H', kind: 'subnet', contains: ['c', 'd'] },
    ],
  }));
  assert.match(message, /overlap/);
});

test('an edge blocked by a node in the same row routes around it', () => {
  const nodes = [
    { id: 'a', icon: 'logic-apps', label: 'A', col: 0, row: 0 },
    { id: 'b', icon: 'service-bus', label: 'B', col: 1, row: 0 },
    { id: 'c', icon: 'key-vault', label: 'C', col: 2, row: 0 },
  ];
  const { diagram } = renderDiagram(spec({ nodes, edges: [{ from: 'a', to: 'c' }] }));
  const middle = nodeObstacles(diagram.placed.get('b'));
  for (const segment of toSegments(diagram.edges[0].points)) {
    assert.ok(!middle.some((rect) => segmentHitsRect(segment, rect)));
  }
});

test('the drawio file is well-formed and editable', () => {
  const { drawio } = renderDiagram(example);
  assertWellFormed(drawio);
  assert.match(drawio, /^<\?xml[^]*<mxfile[^]*<mxGraphModel[^]*<root>/);
  const cells = drawio.match(/<mxCell\b[^>]*>/g);
  const images = cells.filter((cell) => cell.includes('shape=image'));
  assert.equal(images.length, example.nodes.length);
  for (const image of images) {
    assert.match(image, /image=data:image\/svg\+xml,[A-Za-z0-9+/=]+/);
    assert.ok(!image.includes(';base64'));
    assert.match(image, /verticalLabelPosition=bottom/);
  }
  const edges = cells.filter((cell) => cell.includes('edge="1"'));
  assert.equal(edges.length, example.edges.length);
  const ids = new Set(cells.map((cell) => cell.match(/ id="([^"]+)"/)[1]));
  assert.equal(ids.size, cells.length);
  for (const edge of edges) {
    assert.ok(ids.has(edge.match(/source="([^"]+)"/)[1]));
    assert.ok(ids.has(edge.match(/target="([^"]+)"/)[1]));
  }
  assert.equal(cells.filter((cell) => cell.includes('style="ellipse')).length, example.steps.length);
  assert.match(drawio, /<Array as="points"><mxPoint/);
});

test('the HTML is standalone', () => {
  const { html } = renderDiagram(example);
  const external = html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '').match(/(?:src|href)="(?!data:)[^"]*"|https?:\/\/|<link|<script\s/g);
  assert.equal(external, null);
  assert.match(html, /name="viewport"/);
  assert.equal(html.match(/<li>/g).length, example.steps.length);
});

test('the viewer hooks are in the HTML and not in the SVG file', () => {
  const { svg, html, diagram } = renderDiagram(example);
  assert.doesNotMatch(svg, /data-(?:node|edge|from)|class="flow"/);
  assert.match(svg, /role="img"/);
  assert.equal(html.match(/data-node="/g).length, example.nodes.length);
  assert.equal(html.match(/data-from="/g).length, example.edges.length);
  assert.equal(html.match(/class="flow"/g).length, example.edges.length);
  const twoWay = diagram.edges.filter((edge) => edge.bidirectional).length;
  assert.equal(html.match(/data-both=""/g).length, twoWay);
  assert.ok(!html.slice(html.indexOf('<script>')).includes(example.title));
});

test('icons keep their aspect ratio and exact bytes', () => {
  const { svg } = renderDiagram(example);
  const image = svg.match(/<image\b[^>]*>/g);
  assert.equal(image.length, example.nodes.length);
  for (const tag of image) {
    assert.match(tag, /width="64" height="64"/);
    assert.match(tag, /preserveAspectRatio="xMidYMid meet"/);
  }
  const logic = fs.readFileSync(path.join(DEFAULT_ICONS_DIR, 'logic-apps.svg'));
  assert.ok(svg.includes(logic.toString('base64')));
});

test('a viewBox is added only when missing', () => {
  const bare = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0"/></svg>';
  assert.match(ensureViewBox(bare, 'x'), /^<svg viewBox="0 0 16 16" xmlns=/);
  const fine = '<svg viewBox="0 0 18 18"><path/></svg>';
  assert.equal(ensureViewBox(fine, 'x'), fine);
  assert.throws(() => ensureViewBox('<svg><path/></svg>', 'x'), /no viewBox/);
  const fabric = fs.readFileSync(path.join(DEFAULT_ICONS_DIR, 'microsoft-fabric.svg'), 'utf8');
  assert.match(fabric, /viewBox="0 0 16 16"/);
});

test('unsafe SVG is rejected', () => {
  const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">${body}</svg>`;
  const unsafe = [
    '<script>x()</script>',
    '<rect onload="x()"/>',
    '<image href="https://example.com/a.png"/>',
    '<use xlink:href="https://example.com/a.svg#b"/>',
    '<rect fill="url(https://example.com/a.svg#b)"/>',
    '<foreignObject/>',
    '<style>@import "x.css";</style>',
  ];
  for (const body of unsafe) assert.throws(() => assertSafeSvg(wrap(body), 'x'), /unsafe SVG/, body);
  assert.doesNotThrow(() => assertSafeSvg(wrap('<use xlink:href="#a"/><rect fill="url(#a)"/>'), 'x'));
});

test('icons lists matches by alias and includes the neutral shapes', () => {
  const search = spawnSync(process.execPath, [cli, 'icons', 'apim'], { encoding: 'utf8' });
  assert.equal(search.status, 0);
  assert.match(search.stdout, /api-management/);
  const all = spawnSync(process.execPath, [cli, 'icons'], { encoding: 'utf8' });
  assert.match(all.stdout, /generic:database/);
});
