import { intersects, textWidth, wrapText } from './layout.mjs';
import { nodeObstacles, segmentHitsRect, toSegments } from './route.mjs';

export const BADGE_R = 11;
const EDGE_LABEL_SIZE = 11.5;
const EDGE_LABEL_LINE = 14;
const EDGE_LABEL_MAX = 130;
const POSITIONS = [0.5, 0.38, 0.62, 0.26, 0.74, 0.15, 0.85];
const CLASH = 5000;

const inflate = (rect, by) => ({ x: rect.x - by, y: rect.y - by, w: rect.w + 2 * by, h: rect.h + 2 * by });
const badgeBox = ({ x, y }) => ({ x: x - BADGE_R, y: y - BADGE_R, w: 2 * BADGE_R, h: 2 * BADGE_R });

function samples(edge) {
  const segments = toSegments(edge.points);
  const longest = Math.max(...segments.map((segment) => segment.length));
  return segments.flatMap((segment) => POSITIONS.map((t) => ({
    x: Math.round(segment.a.x + (segment.b.x - segment.a.x) * t),
    y: Math.round(segment.a.y + (segment.b.y - segment.a.y) * t),
    segment,
    drift: (longest - segment.length) + Math.abs(t - 0.5) * 60,
  })));
}

function borders(groups) {
  return groups.flatMap(({ rect: { x, y, w, h } }) => {
    const corners = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
    return toSegments(corners);
  });
}

// Puts each step number on the longest free stretch of its edge, then each edge label as
// close to that number as the surroundings allow.
export function annotate(diagram) {
  const obstacles = diagram.nodes.flatMap(nodeObstacles);
  const groupLabels = diagram.groups.map((group) => group.labelRect);
  const groupLines = borders(diagram.groups);
  const allSegments = diagram.edges.map((edge) => toSegments(edge.points));
  const badges = [];
  const labels = [];

  const edges = diagram.edges.map((edge) => {
    if (edge.step === undefined) return edge;
    const otherSegments = allSegments.filter((_, index) => index !== edge.index).flat();
    let best = null;
    let bestCost = Infinity;
    for (const point of samples(edge)) {
      const box = inflate(badgeBox(point), 3);
      let cost = point.drift;
      const fromEnd = Math.min(...[edge.points[0], edge.points[edge.points.length - 1]]
        .map((end) => Math.abs(end.x - point.x) + Math.abs(end.y - point.y)));
      if (fromEnd < 22) cost += 400;
      if (obstacles.some((rect) => intersects(box, rect))) cost += CLASH;
      if (badges.some((badge) => intersects(box, inflate(badgeBox(badge), 4)))) cost += CLASH;
      if (groupLabels.some((rect) => intersects(box, rect))) cost += 900;
      cost += otherSegments.filter((segment) => segmentHitsRect(segment, box)).length * 350;
      cost += groupLines.filter((segment) => segmentHitsRect(segment, box)).length * 180;
      if (cost < bestCost) {
        bestCost = cost;
        best = point;
      }
    }
    const badge = { x: best.x, y: best.y, step: edge.step, horizontal: best.segment.horizontal };
    badges.push(badge);
    return { ...edge, badge };
  });

  const placed = edges.map((edge) => {
    if (!edge.label) return edge;
    const lines = wrapText(edge.label, EDGE_LABEL_MAX, EDGE_LABEL_SIZE, false);
    const w = Math.ceil(Math.max(...lines.map((line) => textWidth(line, EDGE_LABEL_SIZE)))) + 8;
    const h = lines.length * EDGE_LABEL_LINE + 4;
    const otherSegments = allSegments.filter((_, index) => index !== edge.index).flat();
    const own = allSegments[edge.index];

    const anchors = edge.badge ? [{ ...edge.badge, drift: 0, segment: { horizontal: edge.badge.horizontal } }, ...samples(edge)] : samples(edge);
    const clearAcross = BADGE_R + 4;
    let best = null;
    let bestCost = Infinity;
    for (const anchor of anchors) {
      const offsets = anchor.segment.horizontal
        ? [[0, -(h / 2 + 5)], [0, h / 2 + 5], [0, -(h / 2 + clearAcross)], [0, h / 2 + clearAcross], [w / 2 + clearAcross, -(h / 2 + 4)], [-(w / 2 + clearAcross), -(h / 2 + 4)]]
        : [[w / 2 + 5, 0], [-(w / 2 + 5), 0], [w / 2 + clearAcross, 0], [-(w / 2 + clearAcross), 0], [w / 2 + 5, -(h / 2 + clearAcross)], [-(w / 2 + 5), -(h / 2 + clearAcross)]];
      for (const [dx, dy] of offsets) {
        const rect = { x: Math.round(anchor.x + dx - w / 2), y: Math.round(anchor.y + dy - h / 2), w, h };
        let cost = anchor.drift;
        if (edge.badge) cost += (Math.abs(anchor.x + dx - edge.badge.x) + Math.abs(anchor.y + dy - edge.badge.y)) * 0.8;
        if (obstacles.some((box) => intersects(rect, box))) cost += CLASH;
        if (badges.some((badge) => intersects(rect, inflate(badgeBox(badge), 2)))) cost += CLASH;
        if (labels.some((label) => intersects(rect, inflate(label, 3)))) cost += CLASH;
        if (groupLabels.some((box) => intersects(rect, box))) cost += 1200;
        cost += otherSegments.filter((segment) => segmentHitsRect(segment, rect)).length * 500;
        cost += own.filter((segment) => segmentHitsRect(segment, rect)).length * 120;
        cost += groupLines.filter((segment) => segmentHitsRect(segment, rect)).length * 260;
        if (cost < bestCost) {
          bestCost = cost;
          best = rect;
        }
      }
    }
    labels.push(best);
    return { ...edge, labelBox: { ...best, lines } };
  });

  return { ...diagram, edges: placed, labelStyle: { size: EDGE_LABEL_SIZE, line: EDGE_LABEL_LINE } };
}

// The drawing's bounds, padded by a margin and with room for the title block.
export function canvas(diagram) {
  const boxes = [
    ...diagram.nodes.map((node) => node.cell),
    ...diagram.groups.map((group) => group.rect),
    ...diagram.edges.flatMap((edge) => [
      ...edge.points.map(({ x, y }) => ({ x, y, w: 0, h: 0 })),
      ...(edge.labelBox ? [edge.labelBox] : []),
    ]),
  ];
  const margin = 24;
  const left = Math.min(...boxes.map((box) => box.x)) - margin;
  const top = Math.min(...boxes.map((box) => box.y));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h)) + margin;
  const right = Math.max(...boxes.map((box) => box.x + box.w)) + margin;
  const headerH = diagram.subtitle ? 74 : 54;
  const y = top - headerH;
  const titleW = Math.max(textWidth(diagram.title, 22, true), textWidth(diagram.subtitle, 13)) + 2 * margin;
  return {
    x: left,
    y,
    w: Math.ceil(Math.max(right - left, titleW)),
    h: Math.ceil(bottom - y),
    headerH: headerH - 12,
    titleX: left + margin,
    titleY: y + 32,
    subtitleY: y + 54,
  };
}
