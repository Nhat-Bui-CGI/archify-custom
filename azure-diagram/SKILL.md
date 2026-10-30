---
name: azure-diagram
description: "Create static architecture diagrams in the Microsoft Azure Architecture Center style: the official Azure SVG icon is the node, with no boxes, a large icon, the product name below it, grouped boundaries (subscription, resource group, VNet, subnet, on-premises) and numbered data-flow steps. Outputs SVG, standalone HTML and an editable draw.io file. Use when the user asks for an Azure Architecture Center style diagram, a Microsoft-style diagram, a reference architecture, Azure icons as nodes, or a diagram to edit in draw.io or paste into a document. Archify remains the choice for interactive viewers and animated diagrams."
---

# Azure diagram

Writes a JSON spec, then renders it. Layout is an explicit grid; edges are routed automatically.

Use Archify instead for an explorable or animated page, for sequence, ERD, state or timeline diagrams, or when the user names Archify.

## Workflow

1. Find icons. Run `icons <query>` for each product. Do not guess ids.
2. Write `<name>.json` next to the user's work.
3. Render it. Fix every `error:` line and read every `warning:` line.
4. Look at the result if you can view images. Fix crowded edges by changing `col` and `row`: leave a free row or column, or keep connected nodes on one row.
5. Give the user the file paths and repeat any warning that affects them.

## Commands

`<skill>` is the folder holding this file: `~/.claude/skills/azure-diagram` for Claude, `~/.agents/skills/azure-diagram` for Codex.

```bash
node <skill>/bin/azure-diagram.mjs icons [query] [--json]
node <skill>/bin/azure-diagram.mjs render spec.json --out path/to/stem
```

`render` writes `stem.svg`, `stem.html` and `stem.drawio`. Exit codes: 0 done, 1 spec problem, 2 wrong usage. A failed render writes nothing. `examples/d365-integration.json` is a full example.

## Spec

```json
{
  "title": "Required",
  "subtitle": "Optional",
  "nodes": [
    { "id": "apim", "icon": "api-management", "label": "Azure API Management", "sublabel": "Policies", "col": 2, "row": 1 }
  ],
  "groups": [
    { "id": "rg", "label": "Resource group", "kind": "resource-group", "contains": ["apim", "vnet"] }
  ],
  "edges": [
    { "from": "partner", "to": "apim", "step": 1, "label": "API call", "style": "solid", "bidirectional": false }
  ],
  "steps": ["Text for step 1. Index 0 is step 1."]
}
```

- `nodes`: `id`, `icon`, `label`, `col` and `row` are required. `col` and `row` start at 0. One node per cell.
- `icon`: a catalog id, title or alias, or a neutral shape: `generic:person`, `generic:server`, `generic:database`, `generic:cloud`, `generic:document`.
- `groups`: `kind` is `subscription`, `resource-group`, `region`, `vnet`, `subnet`, `on-premises` or `external`. `contains` lists node or group ids. An id has one parent; nest groups to show hierarchy.
- `edges`: `step`, `label`, `style` (`solid`, `dashed`) and `bidirectional` are optional. Several edges may share a step number.
- `steps`: every `step` used needs an entry. An entry no edge uses gives a warning.

Group bounds come from the members, so members must form a rectangle on the grid. These are errors: a non-member inside a group, two groups that partly overlap, two nodes in a cell, an unknown icon, an edge that cannot avoid a node.

## Labelling rules

- `label` is the product name as Microsoft writes it. Put the role, SKU or detail in `sublabel`.
- Keep `sublabel` to a few words, and edge labels to two or three.
- Put the explanation in `steps`, one sentence per step, numbered in the order the data moves.
- Do not use an Azure icon for something that is not that service. A non-Azure system uses its own mark if the catalog has it, otherwise a `generic:*` shape with its name as the label.

## Microsoft icon rules

From <https://learn.microsoft.com/azure/architecture/icons> (read 2026-10-30):

- Put the product name close to the icon.
- Use icons as they appear in Azure. Do not crop, flip or rotate them, and do not distort or change their shape.
- Do not use Microsoft icons for your own product.
- They are allowed in architecture diagrams, training materials and documentation.

The renderer embeds each SVG unaltered at 64 x 64 with its aspect ratio kept. Do not edit icon files.

## What this style is and is not

Microsoft publishes no layout, sizing or boundary rules, so this is not a standard and must not be described as "compliant" with one. Grid, 64 px icons, boundary colours and dash patterns are this skill's design choices. Numbers on the diagram with a matching list follow what the Azure reference architecture pages do: they put numbered "Data flow" steps in the text beside the diagram.

## Icon notes

- The catalog has 41 entries: Microsoft product icons, the Boomi logo and the reused AX 2012 mark. Run `icons` to list them. Microsoft's full icon download is not included, because its page requires accepting terms, so many Azure services have no icon yet.
- `dynamics-ax-2012` is the Dynamics 365 icon reused, because no official AX 2012 icon was found. The CLI warns when it is used. Say so in the sublabel or tell the user.
- The Boomi logo has no published licence. Keep Boomi diagrams to internal use unless the user has cleared it with Boomi.

## Add more icons

In the private repo `peterbuitho/archify-custom`, not in the installed skill:

1. The user gets the SVG from a source they are entitled to use. If it comes from Microsoft's icon download, the user accepts its terms and downloads it.
2. Put it in `archify/brand-marks/azure/`.
3. Add an entry to `archify/brand-marks/catalog.local.json` and record the source in both `THIRD_PARTY_NOTICES.md` files.
4. Run `npm run generate:brand-marks` in `archify/`, commit, then run `node local/sync-archify.mjs`.

## Limits

- Images are embedded as base64, so each output is self-contained. No file makes a network request.
- In draw.io, moving a group rectangle does not move its members, and step badges and edge labels do not follow an edge when it is moved.
- Text width is estimated, because the renderer has no font engine. Very long labels may look a little different from the estimate.
