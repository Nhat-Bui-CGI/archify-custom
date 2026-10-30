import { esc } from './escape.mjs';
import { BADGE_R } from './annotate.mjs';
import { fonts } from './layout.mjs';

const FONT = "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif";
export const INK = '#323130';
export const MUTED = '#605E5C';
export const EDGE = '#605E5C';
export const BADGE = '#0078D4';

export const GROUP_STYLES = {
  subscription: { stroke: '#8A8886', dash: '6 4', fill: 'none', text: '#605E5C' },
  'resource-group': { stroke: '#A19F9D', dash: '4 4', fill: 'none', text: '#605E5C' },
  region: { stroke: '#C8C6C4', dash: '', fill: 'none', text: '#605E5C' },
  vnet: { stroke: '#0078D4', dash: '', fill: '#F3F9FD', text: '#005A9E' },
  subnet: { stroke: '#71AFE5', dash: '5 3', fill: 'none', text: '#005A9E' },
  'on-premises': { stroke: '#8A8886', dash: '', fill: '#F3F2F1', text: '#323130' },
  external: { stroke: '#C8C6C4', dash: '2 3', fill: 'none', text: '#605E5C' },
};

export const dataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

function roundedPath(points) {
  const radius = 5;
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    const inLength = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    const outLength = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const entry = { x: b.x - Math.sign(b.x - a.x) * r, y: b.y - Math.sign(b.y - a.y) * r };
    const exit = { x: b.x + Math.sign(c.x - b.x) * r, y: b.y + Math.sign(c.y - b.y) * r };
    d += ` L${entry.x} ${entry.y} Q${b.x} ${b.y} ${exit.x} ${exit.y}`;
  }
  const end = points[points.length - 1];
  return `${d} L${end.x} ${end.y}`;
}

const ARROW_LENGTH = 9;
const ARROW_HALF_WIDTH = 4;

function arrowHead(tip, from) {
  const dx = Math.sign(tip.x - from.x);
  const dy = Math.sign(tip.y - from.y);
  const base = { x: tip.x - dx * ARROW_LENGTH, y: tip.y - dy * ARROW_LENGTH };
  const side = { x: -dy * ARROW_HALF_WIDTH, y: dx * ARROW_HALF_WIDTH };
  return `${tip.x},${tip.y} ${base.x + side.x},${base.y + side.y} ${base.x - side.x},${base.y - side.y}`;
}

function shortened(points, bidirectional) {
  // The line stops inside the arrow head, so its width never shows past the tip.
  const copy = points.map((point) => ({ ...point }));
  const trim = (end, neighbour) => {
    end.x -= Math.sign(end.x - neighbour.x) * 6;
    end.y -= Math.sign(end.y - neighbour.y) * 6;
  };
  trim(copy[copy.length - 1], copy[copy.length - 2]);
  if (bidirectional) trim(copy[0], copy[1]);
  return copy;
}

function drawEdge(edge) {
  const { points } = edge;
  const dash = edge.style === 'dashed' ? ' stroke-dasharray="6 4"' : '';
  const heads = [`<polygon points="${arrowHead(points[points.length - 1], points[points.length - 2])}" fill="${EDGE}"/>`];
  if (edge.bidirectional) heads.push(`<polygon points="${arrowHead(points[0], points[1])}" fill="${EDGE}"/>`);
  return `<g><path d="${roundedPath(shortened(points, edge.bidirectional))}" fill="none" stroke="${EDGE}" stroke-width="1.5"${dash}/>${heads.join('')}</g>`;
}

function drawGroup(group) {
  const style = GROUP_STYLES[group.kind];
  const { x, y, w, h } = group.rect;
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : '';
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.25"${dash}/>`
    + `<text x="${x + 10}" y="${y + 17}" font-size="12" font-weight="600" fill="${style.text}">${esc(group.label)}</text></g>`;
}

function drawNode(node) {
  const { icon, cx, textY } = node;
  const lines = [];
  let y = textY;
  for (const line of node.labelLines) {
    y += fonts.LABEL_LINE;
    lines.push(`<text x="${cx}" y="${y - 4}" text-anchor="middle" font-size="${fonts.LABEL_SIZE}" font-weight="600" fill="${INK}">${esc(line)}</text>`);
  }
  for (const line of node.subLines) {
    y += fonts.SUB_LINE;
    lines.push(`<text x="${cx}" y="${y - 3}" text-anchor="middle" font-size="${fonts.SUB_SIZE}" fill="${MUTED}">${esc(line)}</text>`);
  }
  return `<g><title>${esc(node.label)}</title><image x="${icon.x}" y="${icon.y}" width="${icon.w}" height="${icon.h}" preserveAspectRatio="xMidYMid meet" href="${dataUri(node.iconData.svg)}"/>${lines.join('')}</g>`;
}

function drawBadge({ x, y, step }) {
  return `<g><circle cx="${x}" cy="${y}" r="${BADGE_R}" fill="${BADGE}" stroke="#FFFFFF" stroke-width="1.5"/>`
    + `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#FFFFFF">${step}</text></g>`;
}

function drawEdgeLabel({ labelBox: { x, y, w, h, lines } }, { size, line }) {
  const text = lines.map((content, index) => `<text x="${x + w / 2}" y="${y + 2 + line * (index + 1) - 3}" text-anchor="middle" font-size="${size}" fill="${INK}">${esc(content)}</text>`);
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#FFFFFF"/>${text.join('')}</g>`;
}

// The HTML page has its own heading, so it asks for the drawing without the title block.
export function renderSvg(diagram, view, { heading = true } = {}) {
  const y = heading ? view.y : view.y + view.headerH;
  const h = heading ? view.h : view.h - view.headerH;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.x} ${y} ${view.w} ${h}" width="${view.w}" height="${h}" role="img" aria-labelledby="azd-title" font-family="${FONT}">`,
    `<title id="azd-title">${esc(diagram.title)}</title>`,
    `<rect x="${view.x}" y="${y}" width="${view.w}" height="${h}" fill="#FFFFFF"/>`,
  ];
  if (heading) parts.push(`<text x="${view.titleX}" y="${view.titleY}" font-size="22" font-weight="600" fill="${INK}">${esc(diagram.title)}</text>`);
  if (heading && diagram.subtitle) parts.push(`<text x="${view.titleX}" y="${view.subtitleY}" font-size="13" fill="${MUTED}">${esc(diagram.subtitle)}</text>`);
  const outerFirst = [...diagram.groups].sort((a, b) => b.level - a.level);
  parts.push(...outerFirst.map(drawGroup));
  parts.push(...diagram.edges.map(drawEdge));
  parts.push(...diagram.nodes.map(drawNode));
  parts.push(...diagram.edges.filter((edge) => edge.labelBox).map((edge) => drawEdgeLabel(edge, diagram.labelStyle)));
  parts.push(...diagram.edges.filter((edge) => edge.badge).map((edge) => drawBadge(edge.badge)));
  parts.push('</svg>');
  return parts.join('\n');
}

export function renderHtml(diagram, svg) {
  const steps = diagram.steps.length
    ? `<section aria-labelledby="flow"><h2 id="flow">Data flow</h2><ol>${diagram.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol></section>`
    : '';
  const subtitle = diagram.subtitle ? `<p class="sub">${esc(diagram.subtitle)}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(diagram.title)}</title>
<style>
:root { color-scheme: light; --ink: ${INK}; --muted: ${MUTED}; --line: #EDEBE9; --accent: ${BADGE}; }
* { box-sizing: border-box; }
body { margin: 0; background: #FFFFFF; color: var(--ink); font-family: ${FONT}; line-height: 1.5; }
main { max-width: 1320px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { margin: 0; font-size: 26px; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
.sub { margin: 4px 0 16px; color: var(--muted); }
.canvas { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--line); border-radius: 4px; }
.canvas svg { display: block; width: 100%; min-width: 1200px; height: auto; }
.hint { display: none; margin: 6px 0 0; color: var(--muted); font-size: 13px; }
h2 { margin: 28px 0 8px; font-size: 18px; font-weight: 600; }
ol { margin: 0; padding: 0; list-style: none; counter-reset: step; }
li { counter-increment: step; position: relative; padding: 6px 0 6px 36px; max-width: 72ch; }
li::before { content: counter(step); position: absolute; left: 0; top: 7px; width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent); color: #FFFFFF; font-size: 12px; font-weight: 700; line-height: 24px; text-align: center; }
@media (max-width: 1200px) { .hint { display: block; } h1 { font-size: 22px; } }
@media print { .canvas { overflow: visible; border: 0; } .canvas svg { min-width: 0; } }
</style>
</head>
<body>
<main>
<h1>${esc(diagram.title)}</h1>
${subtitle}
<div class="canvas" tabindex="0" role="region" aria-label="Diagram">
${svg}
</div>
<p class="hint">Swipe the diagram sideways to see all of it.</p>
${steps}
</main>
</body>
</html>
`;
}
