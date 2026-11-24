# Azure design in Archify

Choose **Azure** in the visual-style dropdown at the top of a newly generated
Archify diagram. It brings the icon-first appearance of this repository's
Azure Diagram skill into Archify's interactive viewer.

## Appearance and behaviour

Architecture diagrams show standalone service icons with the resource name
below the icon. When the resource name differs from the product name, the
product appears on a second line. Authored sublabels and tags remain visible.
Unbranded nodes use a larger version of their semantic symbol.

The artwork keeps its original colours and proportions. Icons fit inside the
existing node bounds, up to 64px. For full-size icons with resource, product,
and supporting labels, use node heights of about 120px. Compact existing nodes
use smaller icons so switching designs does not move nodes or reroute edges.

Both light and dark themes are supported. Search, focus, zoom, animation,
SVG and raster exports continue to use Archify's viewer. Selecting another
design restores its card appearance. Classic remains the default.

Workflow, Sequence, Dataflow, Lifecycle, ERD and the other diagram types use
the Azure colour palette while retaining their own shapes and notation. The
standalone-icon treatment applies to Architecture nodes.

## Start a diagram in Azure

Set this value in the source diagram's `meta` object:

```json
"visual_preset": "azure"
```

For example, ask your harness:

```text
Use Archify to draw an Azure order integration in the Azure visual preset.
Use API Management, Logic Apps, Service Bus, and Azure Functions.
Use resource names as labels and official service brands. Make the nodes
tall enough for 64px icons and resource/product labels.
```

The dropdown changes the current viewing session. To make Azure the initial
design whenever an artifact is reopened, author it in the JSON and regenerate.
Existing standalone HTML files keep their embedded viewer, so regenerate them
with the updated package to gain the new dropdown option.

## Package and scope

Get the updated `archify.zip` from [this fork's releases](https://github.com/Nhat-Bui-CGI/archify-custom/releases).
Use the [install and update prompts](zip-installation.md#let-your-harness-do-it)
for local harnesses or the [ChatGPT app guide](chatgpt.md) for uploaded Skills.

This design is inspired by the Azure Architecture Center style; it is not a
Microsoft diagram standard or an endorsement. The separate Azure Diagram
skill remains useful when you need its editable draw.io output and numbered
data-flow format. Choosing Azure in Archify does not add draw.io export or
invent numbered process steps.
