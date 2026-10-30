// Page behaviour for the HTML output: zoom, focus and animated data flow. It reads only the
// DOM, so no spec text reaches the script. Without JavaScript the page is a plain diagram.
export const VIEWER_CSS = `
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 0 8px; }
.tools[hidden] { display: none; }
.tools button { min-width: 36px; min-height: 36px; padding: 4px 12px; border: 1px solid #8A8886; border-radius: 4px; background: #FFFFFF; color: var(--ink); font: inherit; font-size: 14px; cursor: pointer; }
.tools button:hover { background: #F3F2F1; }
.tools button[hidden] { display: none; }
.tools output { margin-left: 6px; color: var(--muted); font-size: 14px; }
.js .canvas { overflow: hidden; touch-action: pan-y; cursor: grab; }
.js .canvas.zoomed { touch-action: none; }
.js .canvas.dragging { cursor: grabbing; }
.js .canvas svg { min-width: 0; user-select: none; }
.js .hint { display: none; }
.help { display: none; margin: 6px 0 0; color: var(--muted); font-size: 13px; }
.js .help { display: block; }
[data-node], [data-edge] { transition: opacity .15s; }
[data-node] { cursor: pointer; }
[data-edge] { cursor: pointer; }
[data-node]:focus { outline: none; }
[data-node]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.focusing [data-node]:not(.on), .focusing [data-edge]:not(.on) { opacity: .15; }
.hit { fill: none; stroke: transparent; stroke-width: 14; }
.flow { fill: none; stroke: var(--accent); stroke-width: 3.5; stroke-linecap: round; opacity: 0; pointer-events: none; }
[data-edge].current > path:not(.flow):not(.hit) { stroke: var(--accent); }
[data-edge].current polygon { fill: var(--accent); }
[data-edge].current circle { stroke: #FFB900; stroke-width: 3; }
.js li { cursor: pointer; border-radius: 4px; }
.js li:hover, li.on { background: #F3F2F1; }
li.current { background: #DEECF9; }
@media (prefers-reduced-motion: reduce) { [data-node], [data-edge] { transition: none; } }
@media print { .tools, .help { display: none; } .flow { display: none; } .focusing [data-node]:not(.on), .focusing [data-edge]:not(.on) { opacity: 1; } }
`;

export const VIEWER_JS = `
(() => {
  const STEP_MS = 1500;
  const FLOW_MS = 1300;
  const SIGNAL = 28;
  const MAX_ZOOM = 8;
  const canvas = document.querySelector('.canvas');
  const svg = canvas.querySelector('svg');
  const tools = document.querySelector('.tools');
  const button = (name) => tools.querySelector('[data-action="' + name + '"]');
  const status = tools.querySelector('output');
  const steps = [...document.querySelectorAll('ol li')];

  document.documentElement.classList.add('js');
  tools.hidden = false;

  const box = svg.viewBox.baseVal;
  const home = { x: box.x, y: box.y, w: box.width, h: box.height };
  let view = { ...home };

  function show(next) {
    const w = Math.min(home.w, Math.max(home.w / MAX_ZOOM, next.w));
    const h = w * home.h / home.w;
    const x = Math.min(home.x + home.w - w, Math.max(home.x, next.x));
    const y = Math.min(home.y + home.h - h, Math.max(home.y, next.y));
    view = { x, y, w, h };
    svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    canvas.classList.toggle('zoomed', w < home.w);
  }

  function zoom(factor, px, py) {
    const w = Math.min(home.w, Math.max(home.w / MAX_ZOOM, view.w * factor));
    const ratio = w / view.w;
    const x = px ?? view.x + view.w / 2;
    const y = py ?? view.y + view.h / 2;
    show({ x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio, w });
  }

  function toDiagram(event) {
    const rect = svg.getBoundingClientRect();
    return { x: view.x + (event.clientX - rect.left) / rect.width * view.w, y: view.y + (event.clientY - rect.top) / rect.height * view.h };
  }

  function pan(dx, dy) {
    const scale = view.w / svg.getBoundingClientRect().width;
    show({ ...view, x: view.x - dx * scale, y: view.y - dy * scale });
  }

  const nodes = new Map([...svg.querySelectorAll('[data-node]')].map((el) => [el.dataset.node, el]));
  const edges = [...svg.querySelectorAll('[data-from]')].map((el) => ({
    id: el.dataset.edge,
    from: el.dataset.from,
    to: el.dataset.to,
    step: el.dataset.step ?? '',
    both: el.hasAttribute('data-both'),
    flow: el.querySelector('.flow'),
    parts: [...svg.querySelectorAll('[data-edge="' + el.dataset.edge + '"]')],
  }));

  let live = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selection = null;
  let timer = 0;
  let index = 0;
  let running = [];

  function batches() {
    const pool = selection ? selection.edges : edges;
    const numbers = [...new Set(pool.map((edge) => edge.step).filter(Boolean))].sort((a, b) => a - b);
    const queue = numbers.map((step) => pool.filter((edge) => edge.step === step));
    const rest = pool.filter((edge) => !edge.step);
    return rest.length ? [...queue, rest] : queue;
  }

  function quiet() {
    clearTimeout(timer);
    running.forEach((animation) => animation.cancel());
    running = [];
    document.querySelectorAll('.current').forEach((el) => el.classList.remove('current'));
  }

  function signal({ flow, both }) {
    const length = flow.getTotalLength();
    const dash = Math.min(SIGNAL, length / 2);
    flow.style.strokeDasharray = dash + ' ' + (length + dash);
    const out = [{ strokeDashoffset: dash, opacity: 1 }, { strokeDashoffset: -length, opacity: 1 }];
    return flow.animate(both ? [...out, out[0]] : out, { duration: FLOW_MS });
  }

  function tick() {
    const queue = batches();
    if (!queue.length) return;
    quiet();
    const batch = queue[index % queue.length];
    index += 1;
    batch.forEach((edge) => edge.parts.forEach((el) => el.classList.add('current')));
    steps[batch[0].step - 1]?.classList.add('current');
    running = batch.map(signal);
    timer = setTimeout(tick, STEP_MS);
  }

  function restart() {
    quiet();
    index = 0;
    if (live) tick();
  }

  function setLive(value) {
    live = value;
    button('live').textContent = live ? 'Pause' : 'Play';
    restart();
  }

  function clearFocus() {
    selection = null;
    canvas.classList.remove('focusing');
    document.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
    status.textContent = '';
    button('clear').hidden = true;
    restart();
  }

  function focus(key, label, chosen, ids) {
    if (selection?.key === key) { clearFocus(); return; }
    clearFocus();
    selection = { key, edges: chosen };
    canvas.classList.add('focusing');
    ids.forEach((id) => nodes.get(id)?.classList.add('on'));
    chosen.forEach((edge) => {
      edge.parts.forEach((el) => el.classList.add('on'));
      steps[edge.step - 1]?.classList.add('on');
    });
    status.textContent = 'Focus: ' + label;
    button('clear').hidden = false;
    restart();
  }

  function focusNode(id) {
    const chosen = edges.filter((edge) => edge.from === id || edge.to === id);
    focus('node:' + id, nodes.get(id).getAttribute('aria-label'), chosen, [id, ...chosen.flatMap((edge) => [edge.from, edge.to])]);
  }

  function focusEdges(chosen, key, label) {
    focus(key, label, chosen, chosen.flatMap((edge) => [edge.from, edge.to]));
  }

  function focusEdge(id) {
    const edge = edges.find((candidate) => candidate.id === id);
    if (!edge.step) { focusEdges([edge], 'edge:' + id, 'selected connection'); return; }
    focusEdges(edges.filter((candidate) => candidate.step === edge.step), 'step:' + edge.step, 'step ' + edge.step);
  }

  function clickOn(target) {
    const node = target.closest('[data-node]');
    const edge = target.closest('[data-edge]');
    if (node) focusNode(node.dataset.node);
    else if (edge) focusEdge(edge.dataset.edge);
    else if (selection) clearFocus();
  }

  const pointers = new Map();
  let press = null;
  let pinch = 0;

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, event);
    press = pointers.size === 1 ? { x: event.clientX, y: event.clientY, target: event.target, moved: false } : null;
    pinch = 0;
  });

  canvas.addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    if (pointers.size === 2) {
      pointers.set(event.pointerId, event);
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const middle = toDiagram({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
      if (pinch) zoom(pinch / distance, middle.x, middle.y);
      pinch = distance;
      return;
    }
    if (press && !press.moved) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
      press.moved = true;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('dragging');
    }
    pan(event.clientX - last.clientX, event.clientY - last.clientY);
    pointers.set(event.pointerId, event);
  });

  const release = (event) => {
    if (event.type === 'pointerup' && press && !press.moved) clickOn(press.target);
    pointers.delete(event.pointerId);
    press = null;
    pinch = 0;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (event) => {
    if (event.deltaY > 0 && view.w >= home.w) return;
    event.preventDefault();
    const pixels = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
    const point = toDiagram(event);
    zoom(Math.exp(pixels * 0.0015), point.x, point.y);
  }, { passive: false });

  canvas.addEventListener('keydown', (event) => {
    const node = event.target.closest?.('[data-node]');
    if (node && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      focusNode(node.dataset.node);
      return;
    }
    const keys = {
      '+': () => zoom(0.8), '=': () => zoom(0.8), '-': () => zoom(1.25), 0: () => show(home),
      ArrowLeft: () => pan(60, 0), ArrowRight: () => pan(-60, 0), ArrowUp: () => pan(0, 60), ArrowDown: () => pan(0, -60),
    };
    if (!keys[event.key]) return;
    event.preventDefault();
    keys[event.key]();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selection) clearFocus();
  });

  steps.forEach((item, position) => {
    const step = String(position + 1);
    const chosen = edges.filter((edge) => edge.step === step);
    if (!chosen.length) return;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    const pick = () => focusEdges(chosen, 'step:' + step, 'step ' + step);
    item.addEventListener('click', pick);
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      pick();
    });
  });

  tools.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (action === 'in') zoom(0.7);
    if (action === 'out') zoom(1 / 0.7);
    if (action === 'fit') show(home);
    if (action === 'live') setLive(!live);
    if (action === 'clear') clearFocus();
  });

  addEventListener('beforeprint', () => { quiet(); show(home); });
  addEventListener('afterprint', restart);

  setLive(live);
})();
`;
