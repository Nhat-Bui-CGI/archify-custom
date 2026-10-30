import { DiagramError } from './errors.mjs';

// Sizes in px. Column pitch is NODE_W + GAP_X (220) and row pitch about 170, plus whatever
// room the group borders at that boundary need.
export const NODE_W = 180;
export const ICON = 64;
const MIN_ROW_H = 118;
const GAP_X = 40;
const GAP_Y = 36;
const LABEL_SIZE = 13;
const LABEL_LINE = 17;
const SUB_SIZE = 11.5;
const SUB_LINE = 15;
const LABEL_GAP = 8;
const GROUP_PAD = 14;
const GROUP_PAD_PER_LEVEL = 4;
const GROUP_LABEL_H = 22;
export const ORIGIN = 140;

export const fonts = { LABEL_SIZE, LABEL_LINE, SUB_SIZE, SUB_LINE };

// Close enough to Segoe UI for wrapping; browsers do the real shaping.
export function textWidth(text, size, bold = false) {
  let units = 0;
  for (const ch of String(text)) {
    if (/[iljI.,:;'|!]/.test(ch)) units += 0.28;
    else if (/[ftr()[\]\- ]/.test(ch)) units += 0.36;
    else if (/[mwMW@%]/.test(ch)) units += 0.86;
    else if (/[A-Z0-9&]/.test(ch)) units += 0.64;
    else units += 0.54;
  }
  return units * size * (bold ? 1.06 : 1);
}

export function wrapText(text, maxWidth, size, bold, onTooWide) {
  const lines = [];
  let line = '';
  for (const word of String(text).trim().split(/\s+/)) {
    if (textWidth(word, size, bold) > maxWidth) onTooWide?.(word);
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, size, bold) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function buildGroups(diagram) {
  const nodes = new Map(diagram.nodes.map((node) => [node.id, node]));
  const groups = new Map(diagram.groups.map((group) => [group.id, { ...group, children: [], nodeIds: [] }]));
  for (const group of groups.values()) {
    for (const member of group.contains) {
      if (nodes.has(member)) group.nodeIds.push(member);
      else group.children.push(groups.get(member));
    }
  }
  const measure = (group) => {
    group.children.forEach(measure);
    const inner = group.children;
    group.level = inner.length ? Math.max(...inner.map((child) => child.level)) + 1 : 0;
    group.pad = GROUP_PAD + GROUP_PAD_PER_LEVEL * group.level;
    group.outset = group.pad + Math.max(0, ...inner.map((child) => child.outset));
    group.outsetTop = group.pad + GROUP_LABEL_H + Math.max(0, ...inner.map((child) => child.outsetTop));
    const members = group.nodeIds.map((id) => nodes.get(id));
    const span = (key) => [
      ...members.map((node) => node[key]),
      ...inner.flatMap((child) => [child.span[key].min, child.span[key].max]),
    ];
    group.span = {
      col: { min: Math.min(...span('col')), max: Math.max(...span('col')) },
      row: { min: Math.min(...span('row')), max: Math.max(...span('row')) },
    };
    group.descendants = new Set([...group.nodeIds, ...inner.flatMap((child) => [child.id, ...child.descendants])]);
  };
  const nested = new Set([...groups.values()].flatMap((group) => group.children.map((child) => child.id)));
  const roots = [...groups.values()].filter((group) => !nested.has(group.id));
  roots.forEach(measure);
  return { list: [...groups.values()], roots };
}

function place(diagram, groups) {
  const cols = Math.max(...diagram.nodes.map((node) => node.col)) + 1;
  const rows = Math.max(...diagram.nodes.map((node) => node.row)) + 1;
  const need = (axis, end, index, key) => Math.max(0, ...groups.list
    .filter((group) => group.span[axis][end] === index)
    .map((group) => group[key]));

  const rowH = Array(rows).fill(MIN_ROW_H);
  for (const node of diagram.nodes) rowH[node.row] = Math.max(rowH[node.row], node.boxH);

  const colX = [ORIGIN];
  for (let c = 1; c < cols; c += 1) {
    colX[c] = colX[c - 1] + NODE_W + GAP_X + need('col', 'max', c - 1, 'outset') + need('col', 'min', c, 'outset');
  }
  const rowY = [ORIGIN];
  for (let r = 1; r < rows; r += 1) {
    rowY[r] = rowY[r - 1] + rowH[r - 1] + GAP_Y + need('row', 'max', r - 1, 'outset') + need('row', 'min', r, 'outsetTop');
  }
  return { cols, rows, colX, rowY, rowH };
}

// Lanes are candidate positions for long segments: the free space around each cell.
function lanes(starts, sizes, before, after) {
  const positions = [];
  const count = starts.length;
  for (let i = 0; i < count - 1; i += 1) {
    const from = starts[i] + sizes[i];
    const free = starts[i + 1] - from;
    for (let part = 1; part <= 5; part += 1) positions.push(Math.round(from + (free * part) / 6));
  }
  positions.push(before - 22, before - 40, after + 22, after + 40);
  return [...new Set(positions)];
}

export function layout(diagram) {
  const warnings = [];
  const tooWide = (where) => (word) => warnings.push(`${where}: "${word}" is wider than a cell, so the text may touch its neighbour.`);
  const nodes = diagram.nodes.map((node) => {
    const labelLines = wrapText(node.label, NODE_W - 6, LABEL_SIZE, true, tooWide(`Node ${node.id}`));
    const subLines = node.sublabel ? wrapText(node.sublabel, NODE_W - 6, SUB_SIZE, false, tooWide(`Node ${node.id}`)) : [];
    if (labelLines.length > 3) warnings.push(`Node ${node.id}: the label takes ${labelLines.length} lines. Use the product name and move detail to sublabel.`);
    const textH = labelLines.length * LABEL_LINE + subLines.length * SUB_LINE;
    return { ...node, labelLines, subLines, boxH: ICON + LABEL_GAP + textH };
  });
  const withText = { ...diagram, nodes };
  const groups = buildGroups(withText);
  const grid = place(withText, groups);

  const placed = new Map();
  for (const node of nodes) {
    const x = grid.colX[node.col];
    const y = grid.rowY[node.row];
    const cx = x + NODE_W / 2;
    const textW = Math.max(ICON, ...node.labelLines.map((line) => textWidth(line, LABEL_SIZE, true)),
      ...node.subLines.map((line) => textWidth(line, SUB_SIZE)));
    const textY = y + ICON + LABEL_GAP;
    node.cell = { x, y, w: NODE_W, h: grid.rowH[node.row] };
    node.cx = cx;
    node.icon = { x: cx - ICON / 2, y, w: ICON, h: ICON };
    node.text = { x: cx - textW / 2, y: textY - 2, w: textW, h: node.boxH - ICON - LABEL_GAP + 2 };
    node.textY = textY;
    placed.set(node.id, node);
  }

  const rectOf = (group) => {
    const boxes = [
      ...group.nodeIds.map((id) => placed.get(id).cell),
      ...group.children.map(rectOf),
    ];
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.w));
    const bottom = Math.max(...boxes.map((box) => box.y + box.h));
    const y = top - group.pad - GROUP_LABEL_H;
    group.rect = { x: left - group.pad, y, w: right - left + 2 * group.pad, h: bottom + group.pad - y };
    return group.rect;
  };
  groups.roots.forEach(rectOf);

  const problems = [];
  groups.list.forEach((group, index) => {
    group.labelRect = { x: group.rect.x + 4, y: group.rect.y + 2, w: textWidth(group.label, 12, true) + 16, h: 20 };
    if (group.labelRect.w > group.rect.w) warnings.push(`Group ${group.id}: the label is wider than the group.`);
    for (const node of nodes) {
      if (!group.descendants.has(node.id) && intersects(group.rect, node.cell)) {
        problems.push(`Node "${node.id}" lies inside group "${group.id}" but is not a member. Add it to contains or move it.`);
      }
    }
    for (const other of groups.list.slice(index + 1)) {
      const related = group.descendants.has(other.id) || other.descendants.has(group.id);
      if (!related && intersects(group.rect, other.rect)) {
        problems.push(`Groups "${group.id}" and "${other.id}" overlap. Separate them on the grid or nest one with contains.`);
      }
    }
  });
  if (problems.length) throw new DiagramError(problems);

  const leftEdge = Math.min(grid.colX[0], ...groups.list.map((group) => group.rect.x));
  const rightEdge = Math.max(grid.colX[grid.cols - 1] + NODE_W, ...groups.list.map((group) => group.rect.x + group.rect.w));
  const topEdge = Math.min(grid.rowY[0], ...groups.list.map((group) => group.rect.y));
  const bottomEdge = Math.max(grid.rowY[grid.rows - 1] + grid.rowH[grid.rows - 1], ...groups.list.map((group) => group.rect.y + group.rect.h));

  return {
    ...diagram,
    nodes,
    placed,
    groups: groups.list,
    warnings: [...diagram.warnings, ...warnings],
    laneX: lanes(grid.colX, grid.colX.map(() => NODE_W), leftEdge, rightEdge),
    laneY: lanes(grid.rowY, grid.rowH, topEdge, bottomEdge),
  };
}
