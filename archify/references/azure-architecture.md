# Azure architecture groups and draw.io

Use this guide when authoring Azure architecture diagrams or when the user wants
an editable draw.io version of an Architecture diagram.

## Azure appearance

Set `meta.visual_preset` to `"azure"`. Use official service brand IDs, resource
names as node labels, and node heights near 120px for full-size service icons.
The viewer's style dropdown can also switch an existing diagram to Azure.

## Group hierarchy

Architecture boundaries accept these kinds: `subscription`, `resource-group`,
`region`, `vnet`, `subnet`, `on-premises`, `external`, and `security-group`.

Give a boundary an `id` to reference it from another boundary's `wraps` list.
IDs must be unique across components and boundaries. A parent that wraps another
boundary must also have an ID. `wraps` accepts component IDs and boundary IDs;
parent membership and frame size include the descendants automatically.

```json
"boundaries": [
  { "id": "subscription", "kind": "subscription", "label": "Production subscription", "wraps": ["integration-rg"] },
  { "id": "integration-rg", "kind": "resource-group", "label": "Integration resources", "wraps": ["integration-vnet"] },
  { "id": "integration-vnet", "kind": "vnet", "label": "Integration VNet", "wraps": ["workload-subnet"] },
  { "id": "workload-subnet", "kind": "subnet", "label": "Workloads subnet", "wraps": ["api", "worker"] }
]
```

Here `api` and `worker` are IDs from `components`. Put the components far enough
from the top and left edges to accommodate each parent frame. Each nesting level
adds its own padding and title space. Use concise titles and leave space between
sibling groups. Automatic canvas sizing includes the hierarchy.

A nested group has one parent. Cycles, unknown references, duplicate IDs, and
components shared by unrelated hierarchy branches fail validation. Choose nesting
that describes the actual system; the renderer does not verify Azure deployment
rules or infer that a service runs inside a subnet.

Existing boundaries that wrap component IDs directly remain supported. Legacy
overlapping sets remain annotations. For reliable group movement in draw.io,
express ownership through explicit nested boundary references.

## Editable export

Generate and validate the standalone HTML through the usual `finalize architecture`
workflow. In the viewer, select a design and theme, then choose **Export → draw.io**.
Open the downloaded `.drawio` file in diagrams.net or draw.io Desktop.

The export contains editable native nodes, labels, connectors, and boundary
containers, with original brand artwork embedded. Moving a container moves its
descendants. Node positions and routed connector points come from the compiled
diagram. Focus, search, zoom, and other temporary viewer states do not filter it.

The export uses the selected light or dark palette. Azure uses service icons
with labels below them; other designs use simple editable cards. Typography and
spacing can differ from the HTML. Legacy overlapping sets cannot give one node
two draw.io parents: the smallest containing set owns it and other frames remain
visible annotations. Animation, interactive viewer tools, and PNG/SVG/WebM exports
remain in the HTML. Other native diagram types do not offer draw.io export.
