import { esc } from './escape.mjs';
import { BADGE_R } from './annotate.mjs';
import { ICON } from './layout.mjs';
import { BADGE, EDGE, GROUP_STYLES, INK, MUTED } from './svg.mjs';

const FONT = 'Segoe UI';

// draw.io takes the image as data:<type>,<base64> with no ";base64" part, because ";"
// separates style keys.
const imageUri = (svg) => `data:image/svg+xml,${Buffer.from(svg, 'utf8').toString('base64')}`;

const vertex = (id, value, style, { x, y, w, h }) => `<mxCell id="${id}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;

function nodeCell(node, id) {
  const label = node.labelLines.map(esc).join('<br>');
  const sub = node.subLines.length
    ? `<br><font style="font-size:11px" color="${MUTED}">${node.subLines.map(esc).join('<br>')}</font>`
    : '';
  const style = [
    'shape=image', 'html=1', 'imageAspect=1', 'aspect=fixed', 'verticalLabelPosition=bottom', 'verticalAlign=top',
    'labelPosition=center', 'align=center', 'fontStyle=1', 'fontSize=13', `fontFamily=${FONT}`, `fontColor=${INK}`,
    'spacingTop=4', `image=${imageUri(node.iconData.svg)}`,
  ].join(';');
  return vertex(id, label + sub, style, node.icon);
}

function groupCell(group, id) {
  const look = GROUP_STYLES[group.kind];
  const style = [
    'rounded=1', 'arcSize=2', 'html=1', 'whiteSpace=wrap', 'align=left', 'verticalAlign=top', 'spacingLeft=8', 'spacingTop=2',
    `fontFamily=${FONT}`, 'fontSize=12', 'fontStyle=1', `fontColor=${look.text}`, `strokeColor=${look.stroke}`, 'strokeWidth=1.25',
    `fillColor=${look.fill === 'none' ? 'none' : look.fill}`,
    ...(look.dash ? ['dashed=1', `dashPattern=${look.dash}`] : []),
  ].join(';');
  return vertex(id, esc(group.label), style, group.rect);
}

// Attachment point on the 64 px image cell. The route starts a little off the image, and
// below the text for the bottom port, so dx and dy carry that offset.
function constraint(prefix, port, node) {
  const { icon } = node;
  const side = {
    right: [1, 0.5 + port.slot / ICON, port.x - icon.x - icon.w, 0],
    left: [0, 0.5 + port.slot / ICON, port.x - icon.x, 0],
    top: [0.5 + port.slot / ICON, 0, 0, port.y - icon.y],
    bottom: [0.5 + port.slot / ICON, 1, 0, port.y - icon.y - icon.h],
  }[port.side];
  const [x, y, dx, dy] = side;
  return [`${prefix}X=${x}`, `${prefix}Y=${y}`, `${prefix}Dx=${dx}`, `${prefix}Dy=${dy}`, `${prefix}Perimeter=0`];
}

function edgeCell(edge, id, cellIds, diagram) {
  const style = [
    'edgeStyle=none', 'rounded=1', 'html=1', 'jettySize=auto', `strokeColor=${EDGE}`, 'strokeWidth=1.5',
    'endArrow=classic', 'endFill=1', `startArrow=${edge.bidirectional ? 'classic' : 'none'}`, 'startFill=1',
    ...(edge.style === 'dashed' ? ['dashed=1', 'dashPattern=6 4'] : []),
    ...constraint('exit', edge.fromPort, diagram.placed.get(edge.from)),
    ...constraint('entry', edge.toPort, diagram.placed.get(edge.to)),
  ].join(';');
  const waypoints = edge.points.slice(1, -1).map(({ x, y }) => `<mxPoint x="${x}" y="${y}"/>`).join('');
  return `<mxCell id="${id}" style="${esc(style)}" edge="1" parent="1" source="${cellIds.get(edge.from)}" target="${cellIds.get(edge.to)}"><mxGeometry relative="1" as="geometry"><Array as="points">${waypoints}</Array></mxGeometry></mxCell>`;
}

function badgeCell({ x, y, step }, id) {
  const style = `ellipse;html=1;whiteSpace=wrap;fillColor=${BADGE};strokeColor=#FFFFFF;fontColor=#FFFFFF;fontFamily=${FONT};fontSize=12;fontStyle=1;spacing=0;aspect=fixed`;
  return vertex(id, String(step), style, { x: x - BADGE_R, y: y - BADGE_R, w: 2 * BADGE_R, h: 2 * BADGE_R });
}

function textCell(id, html, style, box) {
  return vertex(id, html, `text;html=1;whiteSpace=wrap;fontFamily=${FONT};${style}`, box);
}

export function renderDrawio(diagram, view) {
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  let next = 2;
  const newId = () => `azd-${next++}`;

  cells.push(textCell(newId(), esc(diagram.title), `align=left;verticalAlign=middle;fontSize=22;fontStyle=1;fontColor=${INK}`,
    { x: view.titleX, y: view.titleY - 24, w: Math.max(view.w - 48, 200), h: 32 }));
  if (diagram.subtitle) {
    cells.push(textCell(newId(), esc(diagram.subtitle), `align=left;verticalAlign=middle;fontSize=13;fontColor=${MUTED}`,
      { x: view.titleX, y: view.subtitleY - 15, w: Math.max(view.w - 48, 200), h: 22 }));
  }
  for (const group of [...diagram.groups].sort((a, b) => b.level - a.level)) cells.push(groupCell(group, newId()));

  const cellIds = new Map();
  const nodeCells = diagram.nodes.map((node) => {
    const id = newId();
    cellIds.set(node.id, id);
    return nodeCell(node, id);
  });
  // Edges go first so icons sit above the lines, as in the SVG.
  for (const edge of diagram.edges) cells.push(edgeCell(edge, newId(), cellIds, diagram));
  cells.push(...nodeCells);
  for (const edge of diagram.edges) {
    if (edge.labelBox) {
      const html = edge.labelBox.lines.map(esc).join('<br>');
      cells.push(textCell(newId(), html, `align=center;verticalAlign=middle;fontSize=11;fontColor=${INK};fillColor=#FFFFFF;spacing=0`, edge.labelBox));
    }
  }
  for (const edge of diagram.edges) if (edge.badge) cells.push(badgeCell(edge.badge, newId()));

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="azure-diagram" version="1.0"><diagram id="azure-diagram" name="${esc(diagram.title)}"><mxGraphModel dx="${view.w}" dy="${view.h}" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${view.w}" pageHeight="${view.h}" background="#FFFFFF" math="0" shadow="0"><root>
${cells.join('\n')}
</root></mxGraphModel></diagram></mxfile>
`;
}
