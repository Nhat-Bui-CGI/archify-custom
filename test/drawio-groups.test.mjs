import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { SaxesParser } from 'saxes';
import { ChromeVisualBrowser, findChrome } from '../archify/bin/visual-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const renderer = path.join(root, 'archify/renderers/architecture/render-architecture.mjs');
const chrome = process.env.ARCHIFY_CHROME ? findChrome() : null;

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-drawio-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const spec = {
    schema_version: 1, diagram_type: 'architecture',
    meta: { title: 'Orders & integration <test>', output: 'test.html', visual_preset: 'azure' },
    components: [
      { id: 'api', type: 'cloud', label: 'Orders API', brand: 'api-management', pos: [250, 250], size: [200, 120] },
      { id: 'worker', type: 'backend', label: 'Worker', brand: 'azure-functions', pos: [700, 250], size: [200, 120] },
    ],
    boundaries: [
      { id: 'sub', kind: 'subscription', label: 'Production', wraps: ['rg'] },
      { id: 'rg', kind: 'resource-group', label: 'Integration', wraps: ['region'] },
      { id: 'region', kind: 'region', label: 'West Europe', wraps: ['vnet'] },
      { id: 'vnet', kind: 'vnet', label: 'Integration network', wraps: ['snet'] },
      { id: 'snet', kind: 'subnet', label: 'Workloads', wraps: ['api', 'worker'] },
    ],
    connections: [{ from: 'api', to: 'worker', label: 'Invoke & reply' }],
  };
  const input = path.join(dir, 'test.json');
  const output = path.join(dir, 'test.html');
  function save() { fs.writeFileSync(input, JSON.stringify(spec)); }
  function run(...args) { save(); return execFileSync(process.execPath, [renderer, input, output, ...args], { encoding: 'utf8' }); }
  return { input, output, spec, save, run };
}

function parseCells(xml) {
  const cells = new Map();
  const parser = new SaxesParser();
  let current;
  parser.on('opentag', tag => {
    if (tag.name === 'mxCell') {
      current = { ...tag.attributes, points: [] };
      assert.ok(!cells.has(current.id), 'unique cell IDs');
      cells.set(current.id, current);
    }
    if (tag.name === 'mxGeometry') current.geometry = tag.attributes;
    if (tag.name === 'mxPoint') current.points.push(tag.attributes);
  });
  parser.write(xml).close();
  return cells;
}

test('nested Azure boundaries render and retain leaf membership, identity, and measured containment', t => {
  const f = fixture(t);
  const layout = JSON.parse(f.run('--layout-json'));
  assert.equal(layout.boundaries.length, 5);
  for (let index = 1; index < layout.boundaries.length; index++) {
    const outer = layout.boundaries[index - 1], inner = layout.boundaries[index];
    assert.equal(inner.parentId, outer.id);
    assert.ok(inner.x > outer.x && inner.y > outer.y);
    assert.ok(inner.x + inner.width < outer.x + outer.width);
    assert.ok(inner.y + inner.height < outer.y + outer.height);
    assert.deepEqual(inner.wraps, ['api', 'worker']);
  }
  f.run();
  assert.match(fs.readFileSync(f.output, 'utf8'), /id="archify-architecture-data"/);
});

for (const [name, mutate, message] of [
  ['cycles', s => { s.boundaries[4].wraps = ['sub']; }, /cycle/],
  ['unknown members', s => { s.boundaries[4].wraps = ['missing']; }, /unknown component/],
  ['colliding IDs', s => { s.boundaries[0].id = 'api'; }, /must be unique/],
  ['duplicate IDs', s => { s.boundaries[0].id = 'rg'; }, /must be unique/],
  ['multiple parents', s => { s.boundaries[0].wraps.push('snet'); }, /more than one parent/],
]) {
  test('invalid group hierarchy rejects ' + name + ' without overwriting an artifact', t => {
    const f = fixture(t);
    mutate(f.spec); f.save();
    fs.writeFileSync(f.output, 'previous artifact');
    const result = spawnSync(process.execPath, [renderer, f.input, f.output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, message);
    assert.equal(fs.readFileSync(f.output, 'utf8'), 'previous artifact');
  });
}

test('draw.io preserves editable vertices, nested parents, relative geometry, artwork, labels, and edge terminals', t => {
  const f = fixture(t);
  f.run();
  const html = fs.readFileSync(f.output, 'utf8');
  // Decode the XML text node exactly as a browser does.
  let json = '';
  const parser = new SaxesParser();
  parser.on('text', value => { json += value; });
  parser.write(html.match(/<metadata id="archify-architecture-data">[\s\S]*?<\/metadata>/)[0]).close();
  const model = JSON.parse(json);
  const context = { Archify: {}, btoa: value => Buffer.from(value, 'binary').toString('base64') };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'viewer/drawio-export.js'), 'utf8'), context);
  for (const preset of ['azure', 'classic']) {
    const xml = context.Archify.drawio.serialize(model, { preset });
    const cells = parseCells(xml);
    assert.equal(cells.get('group:rg').parent, 'group:sub');
    assert.equal(cells.get('group:snet').parent, 'group:vnet');
    assert.equal(cells.get('node:api').parent, 'group:snet');
    assert.equal(cells.get('edge:0').parent, 'group:snet');
    assert.equal(cells.get('edge:0').source, 'node:api');
    assert.equal(cells.get('edge:0').target, 'node:worker');
    assert.equal(cells.get('edge:0').value, 'Invoke & reply');
    assert.equal(cells.get('edge:0').edge, '1');
    const api = cells.get('node:api');
    assert.equal(api.vertex, '1');
    const group = model.groups.find(g => g.id === 'snet');
    assert.equal(Number(api.geometry.x) + group.x, 250);
    assert.equal(Number(api.geometry.y) + group.y, 250);
    const icon = cells.get('icon:api');
    assert.equal(icon.parent, 'node:api');
    assert.ok(icon.style.includes(model.nodes[0].brand.svg.replace('image/svg+xml;base64,', 'image/svg+xml,')), 'original artwork embedded');
    if (preset === 'azure') assert.match(api.value, /Azure API Management/);
    assert.doesNotMatch(xml, /data-focus|data-camera|data-lens/);
  }
});

test('hierarchy failure includes a repairable CLI diagnostic', t => {
  const f = fixture(t);
  f.spec.boundaries[4].wraps = ['sub']; f.save();
  const result = spawnSync(process.execPath, [path.join(root, 'archify/bin/archify.mjs'), 'validate', 'architecture', f.input, '--json'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  const receipt = JSON.parse(result.stdout);
  const diagnostic = receipt.diagnostics.find(d => d.code === 'layout/group-hierarchy');
  assert.ok(diagnostic, result.stdout);
  assert.ok(diagnostic.subject.boundary);
  assert.ok(diagnostic.supportedFixes.length);
});

test('draw.io embeds custom raster brands without breaking the style delimiter', () => {
  const context = { Archify: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'viewer/drawio-export.js'), 'utf8'), context);
  const data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const xml = context.Archify.drawio.serialize({ title: 'Raster brand', viewBox: [400, 300],
    nodes: [{ id: 'custom', label: 'Custom', x: 20, y: 20, width: 160, height: 120,
      brand: { title: 'Custom', dataUrl: 'data:image/png;base64,' + data } }],
  }, { preset: 'azure' });
  const icon = parseCells(xml).get('icon:custom');
  assert.ok(icon.style.includes('image=data:image/png,' + data + ';'));
  assert.doesNotMatch(icon.style, /;base64/);
});

test('browser Export menu downloads editable draw.io independent of focus and theme', {
  skip: chrome ? false : 'Set ARCHIFY_CHROME for the actual export flow.',
}, async t => {
  const f = fixture(t); f.run();
  const browser = new ChromeVisualBrowser(chrome);
  try {
    await browser.inspect({ artifactPath: f.output, width: 1440, height: 900, theme: 'light' });
    const session = await browser.sessionPromise;
    const result = await browser.cdp.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      document.getElementById('node-api').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      let blob;
      URL.createObjectURL = value => { blob = value; return 'blob:test'; };
      HTMLAnchorElement.prototype.click = function () {};
      const item = document.querySelector('[data-format="drawio"]');
      await Archify.exportMenu.run('drawio');
      const light = await blob.text();
      Archify.theme.toggle();
      await Archify.exportMenu.run('drawio');
      const dark = await blob.text();
      return { light, dark, enabled: !item.disabled && !item.hidden, mime: blob.type };
    })()` }, session);
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    assert.equal(result.result.value.enabled, true);
    assert.equal(result.result.value.mime, 'application/xml;charset=utf-8');
    for (const xml of [result.result.value.light, result.result.value.dark]) {
      const cells = parseCells(xml);
      assert.equal(cells.get('node:worker').parent, 'group:snet');
      assert.equal(cells.get('edge:0').source, 'node:api');
    }
  } finally { await browser.close(); }
});
