// Native mxCells preserve editable labels, connections, and group membership.
Archify.drawio = (function () {
  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function serialize(model, options) {
    options = options || {};
    var azure = options.preset === 'azure';
    var colors = options.colors || {};
    var ink = colors.text || '#242424';
    var muted = colors.muted || '#605e5c';
    var stroke = colors.stroke || '#0078d4';
    var groups = model.groups || [];
    var nodes = model.nodes || [];
    var byGroup = Object.create(null);
    var byNode = Object.create(null);
    groups.forEach(function (g) { byGroup[g.id] = g; });
    nodes.forEach(function (n) { byNode[n.id] = n; });
    function groupId(id) { return id ? 'group:' + id : '1'; }
    function nodeId(id) { return 'node:' + id; }
    // Legacy overlapping sets remain separate frames. Explicit group references
    // take precedence; otherwise the smallest containing membership owns a node.
    function nodeParent(id) {
      var candidates = groups.filter(function (g) { return g.wraps.indexOf(id) !== -1; });
      candidates.sort(function (a, b) { return a.wraps.length - b.wraps.length || a.width * a.height - b.width * b.height; });
      return candidates[0] || null;
    }
    function origin(parent) { return parent || { x: 0, y: 0 }; }
    function geometry(box, parent) {
      var o = origin(parent);
      return '<mxGeometry x="' + (box.x - o.x) + '" y="' + (box.y - o.y) + '" width="' + box.width + '" height="' + box.height + '" as="geometry"/>';
    }
    function vertex(id, label, style, box, parentId, parent) {
      return '<mxCell id="' + esc(id) + '" value="' + esc(label) + '" style="' + esc(style) + '" vertex="1" parent="' + esc(parentId) + '">' + geometry(box, parent) + '</mxCell>';
    }
    function imageUri(mark) {
      var uri = mark.svg || mark.dataUrl;
      if (uri) return uri.replace(';base64,', ',');
      if (!mark.path) return null;
      var svg = '<' + 'svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + mark.viewBox + ' ' + mark.viewBox + '"><path fill="#' + esc(mark.hex) + '" d="' + esc(mark.path) + '"/></' + 'svg>';
      return 'data:image/svg+xml,' + btoa(unescape(encodeURIComponent(svg)));
    }
    var cells = ['<mxCell id="0"/><mxCell id="1" parent="0"/>'];
    // Parent-first order supports both mxCodec and other mxGraph consumers.
    var emitted = Object.create(null);
    function addGroup(g) {
      if (emitted[g.id]) return;
      var parent = byGroup[g.parentId];
      if (parent) addGroup(parent);
      emitted[g.id] = true;
      var dashed = ['subscription', 'subnet', 'on-premises', 'external', 'security-group'].indexOf(g.kind) !== -1;
      cells.push(vertex(groupId(g.id), g.label,
        'rounded=0;html=0;whiteSpace=wrap;container=1;collapsible=0;recursiveResize=0;fillColor=none;strokeColor=' + stroke + ';dashed=' + (dashed ? 1 : 0) + ';verticalAlign=top;align=left;spacingTop=6;spacingLeft=8;fontSize=12;fontFamily=Segoe UI;fontColor=' + ink + ';',
        g, groupId(g.parentId), parent));
    }
    groups.forEach(addGroup);
    nodes.forEach(function (n) {
      var parent = nodeParent(n.id);
      var label = n.label;
      var mark = n.brand;
      function productKey(v) { return String(v).toLowerCase().replace(/\b(microsoft|azure)\b/g, '').replace(/[^a-z0-9]/g, ''); }
      if (azure && mark && productKey(mark.title) !== productKey(n.label)) label += '\n' + mark.title;
      if (n.sublabel) label += '\n' + n.sublabel;
      if (n.tag) label += '\n' + n.tag;
      cells.push(vertex(nodeId(n.id), label,
        'rounded=1;html=0;whiteSpace=wrap;container=1;collapsible=0;fontFamily=Segoe UI;fontSize=11;fontColor=' + ink + ';strokeColor=' + (azure ? 'none' : stroke) + ';fillColor=' + (azure ? 'none' : (colors.fill || '#eff6fc')) + ';verticalAlign=' + (azure && mark ? 'bottom' : 'middle') + ';spacingBottom=4;',
        n, parent ? groupId(parent.id) : '1', parent));
      var uri = mark && imageUri(mark);
      if (uri) {
        var rows = label.split('\n').length;
        var size = azure ? Math.max(8, Math.min(64, n.width - 8, n.height - rows * 12 - 10)) : Math.min(mark.size || (mark.category === 'microsoft' ? 24 : 16), n.width - 8, n.height - 8);
        cells.push(vertex('icon:' + n.id, '',
          'shape=image;html=0;imageAspect=1;aspect=fixed;image=' + uri + ';',
          { x: azure ? (n.width - size) / 2 : n.width - size - 6, y: azure ? 4 : 6, width: size, height: size }, nodeId(n.id), null));
      }
    });
    function ancestors(n) {
      var result = [];
      var g = nodeParent(n.id);
      while (g) { result.push(g.id); g = byGroup[g.parentId]; }
      return result;
    }
    function midpoint(points) {
      var lengths = [], total = 0;
      for (var i = 1; i < points.length; i++) {
        var length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        lengths.push(length); total += length;
      }
      var remaining = total / 2;
      for (var j = 0; j < lengths.length; j++) {
        if (remaining <= lengths[j]) {
          var t = lengths[j] ? remaining / lengths[j] : 0;
          return [points[j][0] + (points[j + 1][0] - points[j][0]) * t, points[j][1] + (points[j + 1][1] - points[j][1]) * t];
        }
        remaining -= lengths[j];
      }
      return points[0];
    }
    (model.edges || []).forEach(function (e, index) {
      var from = byNode[e.from], to = byNode[e.to];
      if (!from || !to) throw new Error('draw.io connection has an unknown endpoint');
      var fromAncestors = ancestors(from), toAncestors = ancestors(to);
      var parentKey = fromAncestors.filter(function (id) { return toAncestors.indexOf(id) !== -1; })[0];
      var parent = byGroup[parentKey], o = origin(parent);
      var points = e.points;
      var first = points[0], last = points[points.length - 1];
      var style = 'html=0;endArrow=block;endFill=1;rounded=0;fontSize=10;fontFamily=Segoe UI;fontColor=' + muted + ';strokeColor=' + stroke + ';strokeWidth=' + (e.width || 1.5) + ';';
      if (e.variant === 'dashed' || e.variant === 'async') style += 'dashed=1;';
      style += 'exitX=' + ((first[0] - from.x) / from.width) + ';exitY=' + ((first[1] - from.y) / from.height) + ';exitPerimeter=0;entryX=' + ((last[0] - to.x) / to.width) + ';entryY=' + ((last[1] - to.y) / to.height) + ';entryPerimeter=0;';
      var waypoints = points.slice(1, -1).map(function (p) { return '<mxPoint x="' + (p[0] - o.x) + '" y="' + (p[1] - o.y) + '"/>'; }).join('');
      var mid = midpoint(points);
      var offset = e.labelAt ? '<mxPoint x="' + (e.labelAt[0] - mid[0]) + '" y="' + (e.labelAt[1] - mid[1]) + '" as="offset"/>' : '';
      cells.push('<mxCell id="edge:' + index + '" value="' + esc(e.label) + '" style="' + esc(style) + '" edge="1" parent="' + esc(groupId(parentKey)) + '" source="' + esc(nodeId(e.from)) + '" target="' + esc(nodeId(e.to)) + '"><mxGeometry relative="1" as="geometry"><Array as="points">' + waypoints + '</Array>' + offset + '</mxGeometry></mxCell>');
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="Archify"><diagram id="archify" name="' + esc(model.title) + '"><mxGraphModel grid="1" gridSize="10" page="0" pageWidth="' + model.viewBox[0] + '" pageHeight="' + model.viewBox[1] + '" background="' + esc(colors.background || '#ffffff') + '"><root>' + cells.join('') + '</root></mxGraphModel></diagram></mxfile>\n';
  }
  return { serialize: serialize };
})();
