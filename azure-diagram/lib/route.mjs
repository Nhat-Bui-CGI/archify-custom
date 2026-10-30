import { DiagramError } from './errors.mjs';

const SLOTS = [0, -16, 16];
const ICON_CLEARANCE = 6;
const STUB = 16;
const PASSES = 3;

const COST = {
  bend: 24,
  node: 1e7,
  overlap: 400,
  overlapPerPx: 6,
  crowding: 120,
  crossing: 90,
  groupLabel: 700,
  border: 220,
  borderPerPx: 3,
  borderCrossing: 8,
  sharedPort: 160,
  offCentrePort: 6,
};

export function nodeObstacles(node) {
  const { icon, text } = node;
  return [
    { x: icon.x - 5, y: icon.y - 5, w: icon.w + 10, h: icon.h + 10 },
    { x: text.x - 1, y: text.y, w: text.w + 2, h: text.h + 1 },
  ];
}

function portsOf(node) {
  const { icon, text, cx } = node;
  const midY = icon.y + icon.h / 2;
  const bottom = text.y + text.h + 4;
  return SLOTS.flatMap((slot) => [
    { side: 'right', slot, x: icon.x + icon.w + ICON_CLEARANCE, y: midY + slot, dx: 1, dy: 0 },
    { side: 'left', slot, x: icon.x - ICON_CLEARANCE, y: midY + slot, dx: -1, dy: 0 },
    { side: 'top', slot, x: cx + slot, y: icon.y - ICON_CLEARANCE, dx: 0, dy: -1 },
    { side: 'bottom', slot, x: cx + slot, y: bottom, dx: 0, dy: 1 },
  ]);
}

export function toSegments(points) {
  return points.slice(1).map((b, index) => {
    const a = points[index];
    return { a, b, horizontal: a.y === b.y, length: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) };
  });
}

export function segmentHitsRect({ a, b }, rect) {
  return Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.w
    && Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.h;
}

// Removes zero-length and collinear hops. Returns null for a path that doubles back.
function simplify(points) {
  const clean = [];
  for (const point of points) {
    const last = clean[clean.length - 1];
    if (last && last.x === point.x && last.y === point.y) continue;
    clean.push(point);
  }
  for (let i = 1; i < clean.length - 1;) {
    const [a, b, c] = [clean[i - 1], clean[i], clean[i + 1]];
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    if (a.x === c.x || a.y === c.y) {
      if (dot < 0) return null;
      clean.splice(i, 1);
    } else {
      i += 1;
    }
  }
  return clean.length >= 2 ? clean : null;
}

function overlapLength(s, t) {
  const axis = s.horizontal ? 'x' : 'y';
  const lo = Math.max(Math.min(s.a[axis], s.b[axis]), Math.min(t.a[axis], t.b[axis]));
  const hi = Math.min(Math.max(s.a[axis], s.b[axis]), Math.max(t.a[axis], t.b[axis]));
  return hi - lo;
}

function crosses(s, t) {
  const [h, v] = s.horizontal ? [s, t] : [t, s];
  const x = v.a.x;
  const y = h.a.y;
  return x > Math.min(h.a.x, h.b.x) && x < Math.max(h.a.x, h.b.x)
    && y > Math.min(v.a.y, v.b.y) && y < Math.max(v.a.y, v.b.y);
}

function nearParallel(s, t, distance) {
  const gap = s.horizontal ? Math.abs(s.a.y - t.a.y) : Math.abs(s.a.x - t.a.x);
  return gap < distance ? overlapLength(s, t) : 0;
}

function scorePath(points, from, to, context, limit) {
  const segments = toSegments(points);
  let score = (points.length - 2) * COST.bend + (from.slot ? COST.offCentrePort : 0) + (to.slot ? COST.offCentrePort : 0);
  for (const segment of segments) score += segment.length;
  score += (context.usedPorts.get(`${from.node}:${from.side}:${from.slot}`) ?? 0) * COST.sharedPort;
  score += (context.usedPorts.get(`${to.node}:${to.side}:${to.slot}`) ?? 0) * COST.sharedPort;
  if (score >= limit) return score;

  const blockers = [];
  for (const segment of segments) {
    for (const obstacle of context.obstacles) {
      if (segmentHitsRect(segment, obstacle.rect)) blockers.push(obstacle.id);
    }
  }
  score += blockers.length * COST.node;
  if (score >= limit) return score;

  for (const segment of segments) {
    for (const rect of context.groupLabels) if (segmentHitsRect(segment, rect)) score += COST.groupLabel;
    for (const border of context.borders) {
      if (border.horizontal === segment.horizontal) {
        const shared = nearParallel(segment, border, 14);
        if (shared > 0) score += COST.border + shared * COST.borderPerPx;
      } else if (crosses(segment, border)) {
        score += COST.borderCrossing;
      }
    }
    for (const other of context.others) {
      if (other.horizontal === segment.horizontal) {
        const shared = nearParallel(segment, other, 7);
        if (shared > 0) score += COST.overlap + shared * COST.overlapPerPx;
        else score += nearParallel(segment, other, 26) > 0 ? COST.crowding : 0;
      } else if (crosses(segment, other)) {
        score += COST.crossing;
      }
    }
  }
  return score;
}

function* paths(p, q, s, t, laneX, laneY, detours) {
  if (p.x === q.x || p.y === q.y) yield [p, q];
  if (s.x === t.x || s.y === t.y) yield [p, s, t, q];
  yield [p, s, { x: s.x, y: t.y }, t, q];
  yield [p, s, { x: t.x, y: s.y }, t, q];
  const xs = [...laneX, Math.round((s.x + t.x) / 2)];
  const ys = [...laneY, Math.round((s.y + t.y) / 2)];
  for (const x of xs) yield [p, s, { x, y: s.y }, { x, y: t.y }, t, q];
  for (const y of ys) yield [p, s, { x: s.x, y }, { x: t.x, y }, t, q];
  if (!detours) return;
  for (const x of xs) {
    for (const y of ys) {
      yield [p, s, { x, y: s.y }, { x, y }, { x: t.x, y }, t, q];
      yield [p, s, { x: s.x, y }, { x, y }, { x, y: t.y }, t, q];
    }
  }
}

function routeEdge(edge, diagram, context) {
  const search = (detours) => {
    let best = null;
    let bestScore = Infinity;
    for (const from of edge.ports.from) {
      for (const to of edge.ports.to) {
        const s = { x: from.x + from.dx * STUB, y: from.y + from.dy * STUB };
        const t = { x: to.x + to.dx * STUB, y: to.y + to.dy * STUB };
        const start = { x: from.x, y: from.y };
        const end = { x: to.x, y: to.y };
        for (const raw of paths(start, end, s, t, diagram.laneX, diagram.laneY, detours)) {
          const points = simplify(raw);
          if (!points) continue;
          const [first, second] = [points[0], points[1]];
          const leaves = Math.sign(second.x - first.x) === from.dx && Math.sign(second.y - first.y) === from.dy;
          const [last, previous] = [points[points.length - 1], points[points.length - 2]];
          const arrives = Math.sign(previous.x - last.x) === to.dx && Math.sign(previous.y - last.y) === to.dy;
          if (!leaves || !arrives) continue;
          if (Math.abs(last.x - previous.x) + Math.abs(last.y - previous.y) < 12) continue;
          const score = scorePath(points, from, to, context, bestScore);
          if (score < bestScore) {
            bestScore = score;
            best = { points, fromPort: from, toPort: to };
          }
        }
      }
    }
    return { best, bestScore };
  };
  let result = search(false);
  if (result.bestScore >= COST.node) result = search(true);
  return result;
}

function borderSegments(groups) {
  return groups.flatMap(({ rect: { x, y, w, h } }) => {
    const corners = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
    return toSegments(corners);
  });
}

// Each edge is routed around the others, then rerouted a few times now that all of them
// exist, so an early edge does not keep a poor path just because it went first.
export function routeEdges(diagram) {
  const obstacles = diagram.nodes.flatMap((node) => nodeObstacles(node).map((rect) => ({ id: node.id, rect })));
  const borders = borderSegments(diagram.groups);
  const groupLabels = diagram.groups.map((group) => group.labelRect);
  const edges = diagram.edges.map((edge, index) => ({
    ...edge,
    index,
    ports: {
      from: portsOf(diagram.placed.get(edge.from)).map((port) => ({ ...port, node: edge.from })),
      to: portsOf(diagram.placed.get(edge.to)).map((port) => ({ ...port, node: edge.to })),
    },
  }));

  for (let pass = 0; pass < PASSES; pass += 1) {
    for (const edge of edges) {
      const routed = edges.filter((other) => other !== edge && other.points);
      const usedPorts = new Map();
      for (const other of routed) {
        for (const port of [other.fromPort, other.toPort]) {
          const key = `${port.node}:${port.side}:${port.slot}`;
          usedPorts.set(key, (usedPorts.get(key) ?? 0) + 1);
        }
      }
      const context = {
        obstacles, borders, groupLabels, usedPorts,
        others: routed.flatMap((other) => toSegments(other.points)),
      };
      const { best, bestScore } = routeEdge(edge, diagram, context);
      if (!best || bestScore >= COST.node) {
        throw new DiagramError(`Edge ${edge.from} -> ${edge.to} cannot be routed without crossing a node. Move a node or leave a free row or column between them.`);
      }
      Object.assign(edge, best);
    }
  }
  return { ...diagram, edges };
}
