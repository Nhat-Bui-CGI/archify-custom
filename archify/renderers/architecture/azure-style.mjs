import { brandMarkFor } from '../shared/brand-marks.mjs';
import { esc, renderSemanticSigil } from '../shared/utils.mjs';
import { fittedNodeFontSize } from '../shared/text-fit.mjs';

const productKey = (value) => String(value).toLowerCase().replace(/\b(microsoft|azure)\b/g, '').replace(/[^a-z0-9]/g, '');

// The Azure view fits inside the existing node bounds, so switching styles
// preserves topology, routing, authored geometry, and the viewer's hit targets.
export function azureNodeAppearance(node, labelY, sublabelY) {
  const mark = brandMarkFor(node);
  const product = mark && productKey(mark.title) !== productKey(node.label) ? mark.title : '';
  const hasSub = Boolean(node.sublabel);
  const labelFont = fittedNodeFontSize(node.label, node.width, 11, 8);
  const productFont = fittedNodeFontSize(product, node.width, 9, 8);
  const rowsHeight = 14 + (product ? 12 : 0) + (hasSub ? 12 : 0) + (node.tag ? 11 : 0);
  const iconSize = Math.max(8, Math.min(64, node.width - 8, node.height - rowsHeight - 8));
  const top = node.y + Math.max(3, (node.height - rowsHeight - iconSize) / 2);
  const x = node.cx - iconSize / 2;
  let artwork;
  if (mark?.svg || mark?.dataUrl) {
    artwork = `<image x="${x}" y="${top}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet" href="${esc(mark.svg || mark.dataUrl)}"/>`;
  } else if (mark?.path) {
    artwork = `<path d="${esc(mark.path)}" fill="#${esc(mark.hex)}" transform="translate(${x} ${top}) scale(${iconSize / mark.viewBox})"/>`;
  } else {
    artwork = renderSemanticSigil(node.type, { icon: node.icon, x, y: top, size: iconSize })
      .replace('data-semantic-sigil=', 'data-azure-symbol=');
  }
  const labelBaseline = top + iconSize + 12;
  const productBaseline = labelBaseline + 12;
  const subBaseline = labelBaseline + (product ? 24 : 12);
  const productLine = product
    ? `<text class="t-muted" data-azure-product="" x="${node.cx}" y="${productBaseline}" text-anchor="middle" font-size="${productFont}">${esc(product)}</text>`
    : '';
  return {
    style: `--azure-label-dy:${labelBaseline - labelY}px;--azure-label-font:${labelFont}px;--azure-sub-dy:${hasSub ? subBaseline - sublabelY : 0}px;--azure-tag-dy:${node.tag ? top + iconSize + rowsHeight - (node.y + node.height - 8) : 0}px`,
    visual: `<g class="architecture-azure-visual" aria-hidden="true" pointer-events="none">${artwork}${productLine}</g>`,
  };
}
