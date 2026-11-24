import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ChromeVisualBrowser, findChrome } from '../archify/bin/visual-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.ARCHIFY_CHROME ? findChrome() : null;

function fixture(t, preset = 'classic', icon) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-azure-style-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const spec = {
    schema_version: 1, diagram_type: 'architecture',
    meta: { title: 'Azure style test', output: 'test.html', visual_preset: preset },
    components: [
      { id: 'partner', type: 'external', label: 'Partner', sublabel: 'Send order', pos: [40, 40], size: [160, 120] },
      { id: 'api', type: 'cloud', label: 'Orders API', sublabel: 'Public endpoint', brand: 'api-management', pos: [330, 40], size: [220, 120] },
      { id: 'worker', type: 'backend', label: 'Azure Functions', brand: 'azure-functions', pos: [680, 40], size: [220, 120] },
    ],
    connections: [{ id: 'request', from: 'partner', to: 'api', label: 'HTTPS' }, { id: 'invoke', from: 'api', to: 'worker', label: 'Invoke' }],
  };
  const input = path.join(dir, 'test.json');
  spec.components[0].icon = icon;
  const output = path.join(dir, 'test.html');
  fs.writeFileSync(input, JSON.stringify(spec));
  execFileSync(process.execPath, [path.join(root, 'archify/renderers/architecture/render-architecture.mjs'), input, output]);
  return { output, html: fs.readFileSync(output, 'utf8') };
}

test('Azure is authorable and carries distinct resource and product labels with original SVG artwork', (t) => {
  const { html } = fixture(t, 'azure');
  assert.match(html, /data-preset="azure"/);
  assert.match(html, /data-preset-value="azure"/);
  assert.match(html, /data-azure-product=""[^>]+>Azure API Management<\/text>/);
  assert.equal((html.match(/data-azure-product=""/g) || []).length, 1, 'a product name matching the resource label is not repeated');
  assert.match(html, /width="64" height="64" preserveAspectRatio="xMidYMid meet" href="data:image\/svg\+xml;base64,/);
});

test('Azure fallback artwork respects authored icon overrides and hiding', (t) => {
  assert.match(fixture(t, 'azure', 'calendar').html, /data-azure-symbol="calendar"/);
  assert.doesNotMatch(fixture(t, 'azure', 'none').html, /data-azure-symbol=/);
});

test('Azure picker preserves geometry and focus, switches back, and exports the selected design', {
  skip: chrome ? false : 'Set ARCHIFY_CHROME to exercise the real style picker and SVG export.',
}, async (t) => {
  const { output } = fixture(t);
  const browser = new ChromeVisualBrowser(chrome);
  try {
    await browser.inspect({ artifactPath: output, width: 1440, height: 900, theme: 'light' });
    const session = await browser.sessionPromise;
    const response = await browser.cdp.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const svg = document.querySelector('.diagram-container svg');
      const node = document.getElementById('node-api');
      const geometry = () => [...svg.querySelectorAll('[data-edge-from]')].map(edge => edge.getAttribute('d'));
      const original = geometry();
      const frame = () => getComputedStyle(node.querySelector('rect:not(.c-mask)')).stroke;
      const classicStroke = frame();
      document.getElementById('btn-preset').click();
      document.querySelector('[data-preset-value="azure"]').click();
      const azure = { preset: svg.dataset.preset, label: document.getElementById('preset-label').textContent,
        checked: document.querySelector('[data-preset-value="azure"]').getAttribute('aria-checked'),
        frame: frame(), iconDisplay: getComputedStyle(node.querySelector('.architecture-azure-visual')).display,
        iconWidth: node.querySelector('.architecture-azure-visual image').getAttribute('width'),
        edgeGeometryUnchanged: JSON.stringify(original) === JSON.stringify(geometry()) };
      Archify.theme.toggle();
      azure.darkFrame = frame();
      Archify.theme.toggle();
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      azure.focused = node.getAttribute('aria-pressed');
      const originalUrl = URL.createObjectURL;
      let captured;
      URL.createObjectURL = (blob) => { captured = blob; return originalUrl.call(URL, blob); };
      let exported;
      try {
        await Archify.exportMenu.run('svg-light');
        const text = await captured.text();
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        exported = { parserError: Boolean(doc.querySelector('parsererror')), preset: doc.documentElement.getAttribute('data-preset'),
          azureRules: text.includes('svg[data-preset="azure"]'), artwork: doc.querySelectorAll('.architecture-azure-visual image').length,
          selectedStateClean: !doc.querySelector('[data-focus-selected]') };
        await Archify.exportMenu.run('svg-dark');
        const dark = new DOMParser().parseFromString(await captured.text(), 'image/svg+xml');
        exported.darkTheme = dark.documentElement.getAttribute('data-theme');
        await Archify.exportMenu.run('png');
        const png = new Uint8Array(await captured.arrayBuffer());
        exported.pngHeader = [...png.slice(0, 8)];
      } finally { URL.createObjectURL = originalUrl; }
      Archify.preset.apply('classic');
      return { azure, exported, classicRestored: frame() === classicStroke,
        iconHiddenAgain: getComputedStyle(node.querySelector('.architecture-azure-visual')).display === 'none' };
    })()` }, session);
    assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails));
    const result = response.result.value;
    assert.equal(result.azure.preset, 'azure');
    assert.equal(result.azure.label, 'Azure');
    assert.equal(result.azure.checked, 'true');
    assert.ok(['transparent', 'rgba(0, 0, 0, 0)'].includes(result.azure.frame), JSON.stringify(result));
    assert.ok(['transparent', 'rgba(0, 0, 0, 0)'].includes(result.azure.darkFrame), JSON.stringify(result));
    assert.equal(result.azure.iconDisplay, 'inline');
    assert.equal(result.azure.iconWidth, '64');
    assert.equal(result.azure.edgeGeometryUnchanged, true);
    assert.equal(result.azure.focused, 'true');
    assert.deepEqual(result.exported, { parserError: false, preset: 'azure', azureRules: true, artwork: 2, selectedStateClean: true,
      darkTheme: 'dark', pngHeader: [137, 80, 78, 71, 13, 10, 26, 10] });
    assert.equal(result.classicRestored, true);
    assert.equal(result.iconHiddenAgain, true);
  } finally { await browser.close(); }
});
