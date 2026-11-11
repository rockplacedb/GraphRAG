/**
 * graph-store.js — 브라우저 메모리 그래프 저장소.
 *
 * 노드: { id, labels: string[], props: object }
 * 엣지: { id, type: string, from, to, props: object }
 *
 * RDB의 고정 스키마 대신, 라벨 인덱스 + 인접 리스트로 "포인터 홉"을 흉내 낸다.
 * 이 파일은 DOM에 의존하지 않으므로 Node 테스트에서 그대로 쓸 수 있다.
 */

let seqCounter = 0;

export function resetSeq() {
  seqCounter = 0;
}

export class GraphStore {
  constructor(data) {
    this.nodes = new Map();
    this.edges = new Map();
    this.labelIndex = new Map(); // label -> Set<nodeId>
    this.outAdj = new Map(); // nodeId -> [{ edgeId, otherId, type }]
    this.inAdj = new Map();
    this.seq = 0;
    if (data) this.load(data);
  }

  nextId(prefix) {
    seqCounter += 1;
    this.seq += 1;
    return `${prefix}${this.seq}_${seqCounter.toString(36)}`;
  }

  load({ nodes = [], edges = [] } = {}) {
    for (const n of nodes) this.addNode(n);
    for (const e of edges) this.addEdge(e);
    return this;
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.labelIndex.clear();
    this.outAdj.clear();
    this.inAdj.clear();
  }

  /* ---------------- 노드 ---------------- */
  addNode(input) {
    const id = String(input.id ?? this.nextId('n'));
    const existing = this.nodes.get(id);
    if (existing) {
      // MERGE 재사용 시 라벨/속성 병합
      for (const l of input.labels || []) this._indexLabel(id, l);
      Object.assign(existing.props, input.props || {});
      return existing;
    }
    const node = {
      id,
      labels: [...new Set(input.labels || [])],
      props: { ...(input.props || {}) },
    };
    this.nodes.set(id, node);
    for (const l of node.labels) this._indexLabel(id, l);
    if (!this.outAdj.has(id)) this.outAdj.set(id, []);
    if (!this.inAdj.has(id)) this.inAdj.set(id, []);
    return node;
  }

  _indexLabel(id, label) {
    if (!label) return;
    let set = this.labelIndex.get(label);
    if (!set) {
      set = new Set();
      this.labelIndex.set(label, set);
    }
    set.add(id);
    const node = this.nodes.get(id);
    if (node && !node.labels.includes(label)) node.labels.push(label);
  }

  getNode(id) {
    return this.nodes.get(String(id)) || null;
  }

  removeNode(id) {
    const node = this.getNode(id);
    if (!node) return false;
    for (const e of [...this.edges.values()]) {
      if (e.from === node.id || e.to === node.id) this.removeEdge(e.id);
    }
    for (const l of node.labels) {
      const set = this.labelIndex.get(l);
      if (set) {
        set.delete(node.id);
        if (!set.size) this.labelIndex.delete(l);
      }
    }
    this.outAdj.delete(node.id);
    this.inAdj.delete(node.id);
    this.nodes.delete(node.id);
    return true;
  }

  nodesByLabel(label) {
    if (!label) return [...this.nodes.values()];
    const ids = this.labelIndex.get(label);
    return ids ? [...ids].map((id) => this.nodes.get(id)).filter(Boolean) : [];
  }

  /* ---------------- 엣지 ---------------- */
  addEdge(input) {
    const from = String(input.from);
    const to = String(input.to);
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`엣지를 만들 수 없습니다: 존재하지 않는 노드 (${from} → ${to})`);
    }
    const id = String(input.id ?? this.nextId('e'));
    if (this.edges.has(id)) {
      Object.assign(this.edges.get(id).props, input.props || {});
      return this.edges.get(id);
    }
    const edge = {
      id,
      type: input.type || 'REL',
      from,
      to,
      props: { ...(input.props || {}) },
    };
    this.edges.set(id, edge);
    this.outAdj.get(from).push({ edgeId: id, otherId: to, type: edge.type });
    this.inAdj.get(to).push({ edgeId: id, otherId: from, type: edge.type });
    return edge;
  }

  getEdge(id) {
    return this.edges.get(String(id)) || null;
  }

  removeEdge(id) {
    const e = this.getEdge(id);
    if (!e) return false;
    const drop = (adj, key, other) => {
      const list = adj.get(key);
      if (!list) return;
      const idx = list.findIndex((x) => x.edgeId === e.id);
      if (idx >= 0) list.splice(idx, 1);
    };
    drop(this.outAdj, e.from, e.to);
    drop(this.inAdj, e.to, e.from);
    this.edges.delete(e.id);
    return true;
  }

  /** 방향별 이웃: dir = 'out' | 'in' | 'both' */
  neighbors(id, { dir = 'both', types = null } = {}) {
    const out = [];
    const nodeId = String(id);
    const push = (list, direction) => {
      for (const item of list || []) {
        if (types && types.length && !types.includes(item.type)) continue;
        out.push({ node: this.nodes.get(item.otherId), edge: this.edges.get(item.edgeId), direction });
      }
    };
    if (dir === 'out' || dir === 'both') push(this.outAdj.get(nodeId), 'out');
    if (dir === 'in' || dir === 'both') push(this.inAdj.get(nodeId), 'in');
    return out;
  }

  degree(id, dir = 'both') {
    if (dir === 'out') return (this.outAdj.get(String(id)) || []).length;
    if (dir === 'in') return (this.inAdj.get(String(id)) || []).length;
    return (this.outAdj.get(String(id)) || []).length + (this.inAdj.get(String(id)) || []).length;
  }

  hasEdgeBetween(from, to, type) {
    for (const item of this.outAdj.get(String(from)) || []) {
      if (item.otherId === String(to) && (!type || item.type === type)) return this.edges.get(item.edgeId);
    }
    return null;
  }

  /* ---------------- 직렬화 ---------------- */
  allNodes() {
    return [...this.nodes.values()];
  }

  allEdges() {
    return [...this.edges.values()];
  }

  clone() {
    return new GraphStore(JSON.parse(JSON.stringify(this.snapshot())));
  }

  snapshot() {
    return {
      nodes: this.allNodes().map((n) => ({ id: n.id, labels: [...n.labels], props: { ...n.props } })),
      edges: this.allEdges().map((e) => ({ id: e.id, type: e.type, from: e.from, to: e.to, props: { ...e.props } })),
    };
  }

  stats() {
    return { nodes: this.nodes.size, edges: this.edges.size };
  }

  /** vis-network 데이터로 변환 */
  toVis({ labelKey = 'name', labelFor } = {}) {
    const nodes = this.allNodes().map((n) => {
      const label =
        (labelFor ? labelFor(n) : null) ||
        n.props[labelKey] ||
        n.props.title ||
        n.props.label ||
        n.props.id ||
        n.id;
      return {
        id: n.id,
        label: String(label),
        group: n.labels[0] || 'default',
        props: n.props,
        title: undefined,
      };
    });
    const edges = this.allEdges().map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.props && e.props.label ? String(e.props.label) : undefined,
      title: `${e.type}${e.props && Object.keys(e.props).length ? ' · ' + JSON.stringify(e.props) : ''}`,
    }));
    return { nodes, edges };
  }
}

/** 배열 데이터에서 스토어 생성 헬퍼 */
export function createStore(nodes = [], edges = []) {
  return new GraphStore({ nodes, edges });
}

export const NODE_LABEL_COLORS = {
  Customer: '#3b82f6',
  Order: '#f59e0b',
  Product: '#10b981',
  Supplier: '#a855f7',
  Review: '#ec4899',
  Category: '#64748b',
  Return: '#ef4444',
};
