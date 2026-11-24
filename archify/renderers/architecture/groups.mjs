import { throwDiagnosticError } from '../shared/diagnostics.mjs';

function invalid(boundary, message, supportedFixes) {
  throwDiagnosticError(message, [{
    code: 'layout/group-hierarchy', severity: 'error', message,
    subject: { diagramType: 'architecture', boundary: boundary.id || boundary.label },
    evidence: { wraps: boundary.wraps }, supportedFixes,
  }]);
}

// Resolve explicit nested groups without changing legacy overlapping node sets.
// A boundary's wraps list may reference component IDs and named boundary IDs.
export function resolveGroups(boundaries, components, measure) {
  const named = new Map();
  for (const boundary of boundaries) {
    if (!boundary.id) continue;
    if (named.has(boundary.id) || components.has(boundary.id)) {
      invalid(boundary, `Boundary ID "${boundary.id}" must be unique across components and boundaries.`, ['assign a unique boundary id and update its wraps references']);
    }
    named.set(boundary.id, boundary);
  }
  const parents = new Map();
  const resolved = new Map();
  const visiting = new Set();
  function visit(boundary) {
    if (visiting.has(boundary)) invalid(boundary, `Boundary hierarchy contains a cycle at "${boundary.label}".`, ['remove the wraps reference that creates a cycle']);
    if (resolved.has(boundary)) return resolved.get(boundary);
    visiting.add(boundary);
    const members = [];
    const leaves = new Set();
    const children = [];
    for (const id of boundary.wraps) {
      if (components.has(id)) {
        members.push(components.get(id));
        leaves.add(id);
      } else if (named.has(id)) {
        if (!boundary.id) invalid(boundary, `Boundary "${boundary.label}" needs an id to contain nested boundaries.`, ['add a unique id to this parent boundary']);
        if (parents.has(id) && parents.get(id) !== boundary) {
          invalid(boundary, `Boundary "${id}" has more than one parent.`, ['retain the child boundary in only one parent wraps list']);
        }
        parents.set(id, boundary);
        const child = visit(named.get(id));
        members.push(child);
        children.push(id);
        child.wraps.forEach(leaf => leaves.add(leaf));
      } else {
        invalid(boundary, `Boundary "${boundary.label}" wraps unknown component "${id}" (or boundary).`, ['replace the unknown wraps entry with an existing component or boundary id']);
      }
    }
    const result = measure({ ...boundary, wraps: [...leaves], children }, members);
    visiting.delete(boundary);
    resolved.set(boundary, result);
    return result;
  }
  boundaries.forEach(visit);
  // Explicit hierarchy has one ownership path per component. Legacy standalone
  // sets may still overlap; they are annotations rather than an ownership tree.
  const hierarchical = boundaries.filter(b => parents.has(b.id) || resolved.get(b).children.length);
  function ancestor(outer, inner) {
    let current = inner;
    while (current) {
      if (current === outer) return true;
      current = parents.get(current.id);
    }
    return false;
  }
  for (let i = 0; i < hierarchical.length; i++) {
    for (let j = i + 1; j < hierarchical.length; j++) {
      const left = hierarchical[i], right = hierarchical[j];
      if (ancestor(left, right) || ancestor(right, left)) continue;
      const shared = resolved.get(left).wraps.find(id => resolved.get(right).wraps.includes(id));
      if (shared) invalid(left, `Component "${shared}" belongs to unrelated hierarchy branches "${left.label}" and "${right.label}".`, ['keep the component in one ownership branch']);
    }
  }
  return boundaries.map(boundary => ({
    ...resolved.get(boundary),
    ...(boundary.id && parents.has(boundary.id) ? { parentId: parents.get(boundary.id).id } : {}),
  }));
}
