import { annotate, canvas } from './annotate.mjs';
import { renderDrawio } from './drawio.mjs';
import { loadIcons } from './icons.mjs';
import { layout } from './layout.mjs';
import { routeEdges } from './route.mjs';
import { validateSpec } from './spec.mjs';
import { renderHtml, renderSvg } from './svg.mjs';

// Spec object in, { svg, html, drawio, warnings } out. Throws DiagramError on a bad spec.
export function renderDiagram(spec, { iconsDir } = {}) {
  const diagram = annotate(routeEdges(layout(validateSpec(spec, loadIcons(iconsDir)))));
  const view = canvas(diagram);
  return {
    svg: renderSvg(diagram, view),
    html: renderHtml(diagram, renderSvg(diagram, view, { heading: false, interactive: true })),
    drawio: renderDrawio(diagram, view),
    warnings: diagram.warnings,
    diagram,
  };
}
