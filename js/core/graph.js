/**
 * graph.js — vis-network 래퍼.
 * 지식 그래프 시각화의 단일 창구: 데이터 세트, 테마 스타일, 하이라이트, PNG 내보내기, 정리.
 */

export const NODE_COLORS = {
  Customer: '#3b82f6',
  Order: '#f59e0b',
  Product: '#10b981',
  Supplier: '#a855f7',
  Review: '#ec4899',
  Category: '#64748b',
  Return: '#ef4444',
  Doc: '#14b8a6',
  Class: '#8b5cf6',
  /* RDF/온톨로지 */
  Resource: '#8b5cf6',
  Literal: '#94a3b8',
  Payment: '#0ea5e9',
  Shipment: '#22d3ee',
  Coupon: '#eab308',
  Person: '#3b82f6',
  Movie: '#ec4899',
  Genre: '#64748b',
  Company: '#a855f7',
  Country: '#14b8a6',
  default: '#94a3b8',
};

const FONT = '"Pretendard Variable", Pretendard, "Malgun Gothic", system-ui, sans-serif';
const BG = '#0b1220';
const DIM_NODE = { background: 'rgba(30,41,59,0.55)', border: '#28344d', font: '#5f6d8a' };
const DIM_EDGE = 'rgba(51,65,85,0.35)';

const waitForVis = () =>
  new Promise((resolve, reject) => {
    if (window.vis?.Network) return resolve(window.vis);
    let tries = 0;
    const timer = setInterval(() => {
      if (window.vis?.Network) {
        clearInterval(timer);
        resolve(window.vis);
      } else if (tries++ > 80) {
        clearInterval(timer);
        reject(new Error('vis-network을 찾을 수 없습니다 (assets/vendor/vis-network.min.js)'));
      }
    }, 25);
  });

export function colorFor(group) {
  if (!group) return NODE_COLORS.default;
  return NODE_COLORS[group] || NODE_COLORS.default;
}

function withAlpha(hex, alpha = '2e') {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  return hex + alpha;
}

export function nodeTitle(node) {  const rows = Object.entries(node.props || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 8)
    .map(([k, v]) => `<tr><td style="padding:1px 10px 1px 0;color:#94a3b8">${escapeHtml(k)}</td><td style="color:#e2e8f0">${escapeHtml(String(v))}</td></tr>`)
    .join('');
  const head = node.group
    ? `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(node.label || node.id)} <span style="color:${colorFor(node.group)};font-size:10px">:${escapeHtml(node.group)}</span></div>`
    : `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(node.label || node.id)}</div>`;
  return rows ? `${head}<table style="border-collapse:collapse;font-size:11px">${rows}</table>` : head;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** vis-network는 undefined 값을 가진 옵션 키를 기본값 덮어쓰기로 해석해 깨진다 → 제거한다. */
function compact(obj) {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
}

/** 시드 데이터({labels, props})와 vis 데이터({group, label})를 모두 받아 표준화한다. */
export function normalizeGraphData(data = {}) {
  return {
    nodes: (data.nodes || []).map((n) => ({
      ...n,
      id: String(n.id),
      label: n.label || n.props?.name || n.props?.title || n.props?.id || n.id,
      group: n.group || (Array.isArray(n.labels) && n.labels[0]) || 'default',
    })),
    edges: (data.edges || []).map((e) => ({
      ...e,
      id: e.id || `${e.from}-${e.to}`,
      from: String(e.from),
      to: String(e.to),
    })),
  };
}

export class GraphView {
  /**
   * @param {HTMLElement} canvasEl
   * @param {object} opts
   */
  constructor(canvasEl, opts = {}) {
    this.el = canvasEl;
    this.opts = opts;
    this.network = null;
    this.nodes = null;
    this.edges = null;
    this._origin = new Map();
    this._destroyed = false;
    this.ready = false;
    this.stabilizing = true;
  }

  static async create(canvasEl, opts = {}) {
    const view = new GraphView(canvasEl, opts);
    await view._init();
    return view;
  }

  async _init() {
    const vis = await waitForVis();
    if (this._destroyed) return;
    if (window.__QA__) window.__QA__.graphs++;

    this.nodes = new vis.DataSet([]);
    this.edges = new vis.DataSet([]);

    const hierarchical = Boolean(this.opts.hierarchical);
    this.network = new vis.Network(
      this.el,
      { nodes: this.nodes, edges: this.edges },
      this._options(vis, hierarchical)
    );

    this.network.once('stabilizationIterationsDone', () => {
      if (this._destroyed) return;
      this.stabilizing = false;
      try {
        this.network.setOptions({ physics: false });
        this.network.fit({ animation: { duration: 260, easingFunction: 'easeInOutQuad' } });
      } catch {
        /* ignore */
      }
    });

    this.network.on('click', (params) => {
      if (params.nodes.length && this.opts.onNodeClick) this.opts.onNodeClick(params.nodes[0], params);
    });

    this._ro = new ResizeObserver(() => {
      if (this._destroyed) return;
      try {
        this.network.redraw();
      } catch {
        /* ignore */
      }
    });
    this._ro.observe(this.el);

    this.onTheme = null;
    this.ready = true;
  }

  _options(vis, hierarchical) {
    const nodeShape = this.opts.nodeShape || 'box';
    return {
      autoResize: true,
      height: '100%',
      width: '100%',
      layout: hierarchical
        ? {
            hierarchical: {
              enabled: true,
              direction: this.opts.hierDirection || 'LR',
              sortMethod: 'directed',
              shakeTowards: 'roots',
              levelSeparation: this.opts.levelSeparation || 150,
              nodeSpacing: this.opts.nodeSpacing || 70,
              treeSpacing: 90,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
            },
          }
        : { improvedLayout: true, randomSeed: this.opts.seed ?? 7 },
      physics: hierarchical
        ? false
        : {
            enabled: true,
            solver: 'barnesHut',
            barnesHut: {
              gravitationalConstant: this.opts.gravity ?? -7200,
              centralGravity: 0.24,
              springLength: this.opts.springLength ?? 132,
              springConstant: 0.055,
              damping: 0.55,
              avoidOverlap: 0.4,
            },
            maxVelocity: 32,
            minVelocity: 0.65,
            stabilization: { enabled: true, iterations: 420, updateInterval: 40, fit: true },
          },
      interaction: {
        hover: true,
        hoverConnectedEdges: true,
        tooltipDelay: 110,
        multiselect: true,
        selectConnectedEdges: true,
        navigationButtons: false,
        keyboard: false,
        zoomView: true,
        dragView: true,
      },
      nodes: {
        shape: nodeShape,
        shapeProperties: { borderRadius: 7, interpolation: true },
        size: this.opts.nodeSize || 18,
        borderWidth: 1.6,
        borderWidthSelected: 2.5,
        margin: { top: 7, bottom: 7, left: 11, right: 11 },
        font: { color: '#e6edf8', size: 12, face: FONT, strokeWidth: 0, vadjust: 0 },
        shadow: { enabled: true, color: 'rgba(2,6,23,0.55)', size: 8, x: 0, y: 2 },
        color: { background: 'rgba(30,41,59,0.9)', border: '#3d4d6d', highlight: { background: '#1e293b', border: '#93c5fd' }, hover: { background: '#243049', border: '#93c5fd' } },
      },
      edges: {
        arrows: { to: { enabled: true, scaleFactor: 0.55 } },
        color: { color: 'rgba(94,120,163,0.75)', highlight: '#7dd3fc', hover: '#9cc3e8', opacity: 1 },
        width: 1.25,
        selectionWidth: 2.4,
        smooth: hierarchical
          ? { enabled: true, type: 'cubicBezier', roundness: 0.5, forceDirection: 'horizontal' }
          : { enabled: true, type: this.opts.edgeSmooth ?? 'continuous', roundness: 0.22 },
        font: { color: '#8fa3c4', size: 10, face: FONT, strokeWidth: 3.5, strokeColor: BG, align: 'middle' },
        shadow: false,
      },
    };
  }

  setData(data, { fit = true } = {}) {
    if (!this.network) return;
    const normalized = normalizeGraphData(data);
    const nodes = normalized.nodes.map((n) => this._node(n));
    const edges = normalized.edges.map((e) => this._edge(e));
    this.nodes.clear();
    this.edges.clear();
    this._origin.clear();
    for (const n of nodes) {
      this._origin.set(n.id, { color: n.color, font: { ...n.font } });
    }
    this.nodes.add(nodes);
    this.edges.add(edges);
    this.rawNodes = normalized.nodes;
    this.rawEdges = normalized.edges;
    if (fit) {
      setTimeout(() => {
        if (!this._destroyed && this.network) this.network.fit({ animation: { duration: 320, easingFunction: 'easeInOutQuad' } });
      }, 60);
    }
  }

  _node(n) {
    const color = n.color || colorFor(n.group);
    return compact({
      id: n.id,
      label: n.label ?? n.id,
      group: n.group,
      title: n.title ?? nodeTitle(n),
      shape: n.shape || (n.group === 'Literal' ? 'ellipse' : undefined),
      size: n.size,
      shapeProperties: n.group === 'Literal' ? { borderRadius: 4 } : undefined,
      color:
        n.color && typeof n.color === 'object'
          ? n.color
          : {
              background: withAlpha(color, n.group === 'Literal' ? '22' : '2b'),
              border: color,
              highlight: { background: withAlpha(color, '55'), border: '#fff' },
              hover: { background: withAlpha(color, '44'), border: '#dbeafe' },
            },
      font: n.font || { color: '#e6edf8', size: n.fontSize || 12, face: FONT },
      borderWidth: n.group === 'Literal' ? 1 : 1.6,
      hidden: n.hidden || undefined,
      x: n.x,
      y: n.y,
      fixed: n.fixed,
    });
  }

  _edge(e) {
    return compact({
      id: e.id || `${e.from}->${e.to}:${e.label || ''}`,
      from: e.from,
      to: e.to,
      label: e.label,
      title: e.title,
      arrows: e.arrows,
      color:
        e.muted || e.inferred
          ? { color: e.inferred ? 'rgba(167,139,250,0.5)' : DIM_EDGE, highlight: '#7dd3fc' }
          : { color: e.color || 'rgba(94,120,163,0.75)', highlight: '#7dd3fc', hover: '#9cc3e8' },
      dashes: e.dashed || e.inferred ? [5, 4] : false,
      width: e.width || 1.25,
      hidden: e.hidden || undefined,
      smooth: e.smooth,
    });
  }

  /** 노드/엣지를 특정 집합만 남기고 흐리게 */
  highlight(ids, { edges = null } = {}) {
    if (!this.network) return;
    const keep = new Set(ids.map(String));
    const updates = [];
    for (const node of this.nodes.get()) {
      const origin = this._origin.get(node.id) || {};
      if (keep.has(String(node.id))) {
        updates.push({
          id: node.id,
          color: origin.color,
          font: { ...(origin.font || {}), color: '#ffffff' },
          shadow: { enabled: true, color: 'rgba(56,189,248,0.55)', size: 16, x: 0, y: 0 },
        });
      } else {
        updates.push({
          id: node.id,
          color: { background: DIM_NODE.background, border: DIM_NODE.border },
          font: { ...(origin.font || {}), color: DIM_NODE.font },
          shadow: { enabled: false },
        });
      }
    }
    this.nodes.update(updates);

    if (edges) {
      const keepEdges = new Set(edges.map(String));
      this.edges.update(
        this.edges.get().map((e) => ({
          id: e.id,
          color: keepEdges.has(String(e.id)) ? { color: '#38bdf8', highlight: '#7dd3fc' } : { color: DIM_EDGE, highlight: DIM_EDGE },
          width: keepEdges.has(String(e.id)) ? 2.2 : 1,
        }))
      );
    }
  }

  /** 모든 하이라이트 해제 */
  clearHighlight() {
    if (!this.network) return;
    this.nodes.update(
      this.nodes.get().map((node) => {
        const origin = this._origin.get(node.id) || {};
        return {
          id: node.id,
          color: origin.color,
          font: { ...(origin.font || {}), color: '#e6edf8' },
          shadow: { enabled: true, color: 'rgba(2,6,23,0.55)', size: 8, x: 0, y: 2 },
        };
      })
    );
    this.edges.update(
      this.edges.get().map((e) => ({
        id: e.id,
        color: { color: 'rgba(94,120,163,0.75)', highlight: '#7dd3fc', hover: '#9cc3e8' },
        width: 1.25,
      }))
    );
  }

  /** 알고리즘 애니메이션용: 방문/활성 색상으로 칠한다 */
  paint({ visited = [], active = [], frontier = [] } = {}) {
    if (!this.network) return;
    const v = new Set(visited.map(String));
    const a = new Set(active.map(String));
    const f = new Set(frontier.map(String));
    this.nodes.update(
      this.nodes.get().map((node) => {
        const id = String(node.id);
        if (a.has(id)) {
          return { id: node.id, color: { background: 'rgba(251,191,36,0.5)', border: '#fbbf24' }, font: { color: '#ffffff', size: 13 } };
        }
        if (f.has(id)) {
          return { id: node.id, color: { background: 'rgba(56,189,248,0.35)', border: '#38bdf8' }, font: { color: '#ffffff', size: 12 } };
        }
        if (v.has(id)) {
          return { id: node.id, color: { background: 'rgba(16,185,129,0.32)', border: '#10b981' }, font: { color: '#e6edf8', size: 12 } };
        }
        return { id: node.id, color: { background: DIM_NODE.background, border: DIM_NODE.border }, font: { color: DIM_NODE.font, size: 11 } };
      })
    );
  }

  resetPaint() {
    this.clearHighlight();
  }

  focus(id) {
    if (!this.network) return;
    try {
      this.network.focus(String(id), { scale: 1.25, animation: { duration: 380, easingFunction: 'easeInOutQuad' } });
      this.network.selectNodes([String(id)]);
    } catch {
      /* ignore */
    }
  }

  fit() {
    try {
      this.network?.fit({ animation: { duration: 320, easingFunction: 'easeInOutQuad' } });
    } catch {
      /* ignore */
    }
  }

  /** 물리엔진을 짧게 다시 돌려 레이아웃을 재계산 */
  relayout() {
    if (!this.network) return;
    const hierarchical = Boolean(this.opts.hierarchical);
    if (hierarchical) {
      this.fit();
      return;
    }
    this.network.setOptions({ physics: { enabled: true } });
    setTimeout(() => {
      try {
        this.network.setOptions({ physics: false });
        this.network.fit({ animation: { duration: 300 } });
      } catch {
        /* ignore */
      }
    }, 1400);
  }

  toPng(filename = 'graph.png') {
    const canvas = this.el.querySelector('canvas');
    if (!canvas) return null;
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    const g = ctx.createRadialGradient(out.width * 0.2, 0, 0, out.width * 0.2, 0, out.width * 0.9);
    g.addColorStop(0, '#101a30');
    g.addColorStop(1, '#0b1220');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    try {
      const a = document.createElement('a');
      a.href = out.toDataURL('image/png');
      a.download = filename;
      a.click();
      return true;
    } catch {
      return false;
    }
  }

  destroy() {
    this._destroyed = true;
    try {
      this._ro?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.network?.destroy();
    } catch {
      /* ignore */
    }
    this.network = null;
    this.nodes = null;
    this.edges = null;
    this._origin.clear();
  }
}
