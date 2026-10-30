import { DiagramError } from './errors.mjs';
import { genericIds, resolveIcon, suggest } from './icons.mjs';

export const GROUP_KINDS = ['subscription', 'resource-group', 'region', 'vnet', 'subnet', 'on-premises', 'external'];
const EDGE_STYLES = ['solid', 'dashed'];

const KNOWN_KEYS = {
  spec: ['title', 'subtitle', 'nodes', 'groups', 'edges', 'steps'],
  node: ['id', 'icon', 'label', 'sublabel', 'col', 'row'],
  group: ['id', 'label', 'kind', 'contains'],
  edge: ['from', 'to', 'step', 'label', 'style', 'bidirectional'],
};

const isGridIndex = (value) => Number.isInteger(value) && value >= 0;
const isText = (value) => typeof value === 'string' && value.trim() !== '';

// Validates the whole spec and returns it with icons resolved. Problems are collected,
// not thrown one at a time; warnings go in `warnings`.
export function validateSpec(spec, library) {
  const problems = [];
  const warnings = [];
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) throw new DiagramError('The spec must be a JSON object.');
  const nodes = spec.nodes ?? [];
  const groups = spec.groups ?? [];
  const edges = spec.edges ?? [];
  const steps = spec.steps ?? [];
  if (!isText(spec.title)) problems.push('title is required.');
  if (!Array.isArray(nodes) || nodes.length === 0) problems.push('nodes must be a non-empty array.');
  for (const [name, list] of [['groups', groups], ['edges', edges], ['steps', steps]]) {
    if (!Array.isArray(list)) problems.push(`${name} must be an array.`);
  }
  if (problems.length) throw new DiagramError(problems);

  const unknownKeys = (object, kind, where) => {
    for (const key of Object.keys(object)) {
      if (!KNOWN_KEYS[kind].includes(key)) warnings.push(`${where}: unknown field "${key}" ignored.`);
    }
  };
  unknownKeys(spec, 'spec', 'spec');

  const ids = new Set();
  const claimId = (id, where) => {
    if (!isText(id)) problems.push(`${where}: id is required.`);
    else if (ids.has(id)) problems.push(`${where}: id "${id}" is used more than once.`);
    ids.add(id);
  };

  const byCell = new Map();
  const resolved = nodes.map((node, index) => {
    const where = `nodes[${index}]${node?.id ? ` (${node.id})` : ''}`;
    claimId(node.id, where);
    unknownKeys(node, 'node', where);
    if (!isText(node.label)) problems.push(`${where}: label is required.`);
    if (node.sublabel !== undefined && typeof node.sublabel !== 'string') problems.push(`${where}: sublabel must be a string.`);
    if (!isGridIndex(node.col) || !isGridIndex(node.row)) {
      problems.push(`${where}: col and row must be whole numbers from 0.`);
    } else {
      const cell = `${node.col},${node.row}`;
      if (byCell.has(cell)) problems.push(`Overlapping nodes: "${byCell.get(cell)}" and "${node.id}" both use col ${node.col}, row ${node.row}.`);
      byCell.set(cell, node.id);
    }
    if (!isText(node.icon)) {
      problems.push(`${where}: icon is required.`);
      return node;
    }
    const icon = resolveIcon(library, node.icon);
    if (!icon) {
      const near = suggest(library, node.icon);
      const hint = near.length ? ` Did you mean: ${near.join(', ')}?` : '';
      problems.push(`${where}: unknown icon "${node.icon}".${hint} List icons with "azure-diagram icons", or use a neutral shape: ${genericIds().join(', ')}.`);
      return node;
    }
    if (icon.warning && !warnings.includes(icon.warning)) warnings.push(icon.warning);
    return { ...node, iconData: icon };
  });
  const nodeIds = new Set(resolved.map((node) => node.id));
  const groupIds = new Set(groups.map((group) => group.id));

  const parent = new Map();
  groups.forEach((group, index) => {
    const where = `groups[${index}]${group?.id ? ` (${group.id})` : ''}`;
    claimId(group.id, where);
    unknownKeys(group, 'group', where);
    if (!isText(group.label)) problems.push(`${where}: label is required.`);
    if (!GROUP_KINDS.includes(group.kind)) problems.push(`${where}: kind must be one of ${GROUP_KINDS.join(', ')}.`);
    if (!Array.isArray(group.contains) || group.contains.length === 0) {
      problems.push(`${where}: contains must list at least one node or group id.`);
      return;
    }
    for (const member of group.contains) {
      if (!nodeIds.has(member) && !groupIds.has(member)) problems.push(`${where}: unknown member "${member}".`);
      else if (parent.has(member)) problems.push(`"${member}" is in both "${parent.get(member)}" and "${group.id}". Nest the groups instead.`);
      else parent.set(member, group.id);
    }
  });
  for (const group of groups) {
    const seen = new Set([group.id]);
    for (let at = parent.get(group.id); at !== undefined; at = parent.get(at)) {
      if (seen.has(at)) {
        problems.push(`Group "${group.id}" is part of a containment cycle.`);
        break;
      }
      seen.add(at);
    }
  }

  const stepsUsed = new Set();
  edges.forEach((edge, index) => {
    const where = `edges[${index}]`;
    unknownKeys(edge, 'edge', where);
    for (const end of ['from', 'to']) {
      if (!nodeIds.has(edge[end])) problems.push(`${where}: ${end} "${edge[end]}" is not a node id.`);
    }
    if (edge.from === edge.to) problems.push(`${where}: an edge cannot start and end on "${edge.from}".`);
    if (edge.style !== undefined && !EDGE_STYLES.includes(edge.style)) problems.push(`${where}: style must be solid or dashed.`);
    if (edge.step !== undefined) {
      if (!Number.isInteger(edge.step) || edge.step < 1) problems.push(`${where}: step must be a whole number from 1.`);
      else if (edge.step > steps.length) problems.push(`${where}: step ${edge.step} has no entry in steps (there are ${steps.length}).`);
      stepsUsed.add(edge.step);
    }
  });
  steps.forEach((text, index) => {
    if (!isText(text)) problems.push(`steps[${index}] must be text.`);
    if (!stepsUsed.has(index + 1)) warnings.push(`Step ${index + 1} is in steps but no edge shows it on the diagram.`);
  });

  if (problems.length) throw new DiagramError(problems);
  return {
    title: spec.title,
    subtitle: spec.subtitle ?? '',
    nodes: resolved,
    groups,
    edges,
    steps,
    warnings,
  };
}
