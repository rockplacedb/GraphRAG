/**
 * algorithms.js — 그래프 알고리즘(교육용, 소규모 그래프 기준).
 * 모든 함수는 DOM에 의존하지 않으며 애니메이션용 단계(steps)를 함께 돌려준다.
 */

/* ---------------- BFS ---------------- */
export function bfs(store, startId, { dir = 'both', types = null, maxDepth = Infinity, undirected = true } = {}) {
  const start = store.getNode(startId);
  if (!start) return { order: [], depth: new Map(), parent: new Map(), steps: [] };
  const depth = new Map([[start.id, 0]]);
  const parent = new Map();
  const order = [start.id];
  const steps = [{ visited: [...order], frontier: [], active: start.id, depth: 0, log: `시작: ${labelOf(start)}` }];
  let frontier = [start.id];

  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      const d = depth.get(id);
      if (d >= maxDepth) continue;
      for (const { node, edge } of store.neighbors(id, { dir, types })) {
        if (!node || depth.has(node.id)) continue;
        depth.set(node.id, d + 1);
        parent.set(node.id, { node: id, edge: edge.id });
        next.push(node.id);
        order.push(node.id);
      }
    }
    if (!next.length) break;
    steps.push({
      visited: [...order],
      frontier: [...next],
      active: null,
      depth: (depth.get(next[0]) ?? 0),
      log: `깊이 ${depth.get(next[0])} — 새로 방문 ${next.length}개: ${next.map((id) => labelOf(store.getNode(id))).join(', ')}`,
    });
    frontier = next;
  }
  return { order, depth, parent, steps };
}

function labelOf(node) {
  if (!node) return '?';
  return node.props.name || node.props.title || node.props.id || node.id;
}

/* ---------------- 최단 경로(무가중, BFS) ---------------- */
export function shortestPath(store, from, to, { dir = 'both', types = null } = {}) {
  if (from === to) return { path: [from], edges: [], length: 0, steps: [] };
  const parent = new Map();
  const seen = new Set([from]);
  const steps = [];
  let frontier = [from];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const { node, edge } of store.neighbors(id, { dir, types })) {
        if (!node || seen.has(node.id)) continue;
        seen.add(node.id);
        parent.set(node.id, { from: id, edge: edge.id });
        next.push(node.id);
        if (node.id === to) {
          const path = [to];
          const edges = [];
          let cur = to;
          while (parent.has(cur)) {
            const p = parent.get(cur);
            edges.unshift(p.edge);
            path.unshift(p.from);
            cur = p.from;
          }
          steps.push({ visited: [...seen], frontier: [...next], active: to, log: `경로 발견: ${path.length - 1} 홉` });
          return { path, edges, length: path.length - 1, steps };
        }
      }
    }
    steps.push({ visited: [...seen], frontier: [...next], active: null, log: `전개 ${next.length}개 (누적 방문 ${seen.size})` });
    frontier = next;
  }
  return { path: null, edges: [], length: -1, steps };
}

/* ---------------- 다익스트라(가중) ---------------- */
export function dijkstra(store, startId, { weightKey = 'weight', dir = 'both' } = {}) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const steps = [];
  for (const n of store.allNodes()) dist.set(n.id, Infinity);
  if (!store.getNode(startId)) return { dist, prev, pathTo: () => null, steps };
  dist.set(startId, 0);
  const queue = new Set([startId]);

  while (queue.size) {
    let best = null;
    let bestD = Infinity;
    for (const id of queue) {
      const d = dist.get(id);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    if (best === null) break;
    queue.delete(best);
    visited.add(best);
    steps.push({
      visited: [...visited],
      frontier: [...queue],
      active: best,
      log: `${labelOf(store.getNode(best))} 확정 (거리 ${bestD})`,
    });
    for (const { node, edge } of store.neighbors(best, { dir })) {
      if (!node) continue;
      const w = Number(edge.props?.[weightKey] ?? 1);
      const nd = bestD + (Number.isFinite(w) ? w : 1);
      if (nd < dist.get(node.id)) {
        dist.set(node.id, nd);
        prev.set(node.id, { from: best, edge: edge.id });
        queue.add(node.id);
      }
    }
  }
  const pathTo = (target) => {
    if (!prev.has(target) && target !== startId) return null;
    const path = [target];
    let cur = target;
    while (prev.has(cur)) {
      const p = prev.get(cur);
      path.unshift(p.from);
      cur = p.from;
    }
    return path;
  };
  return { dist, prev, pathTo, steps };
}

/* ---------------- PageRank ---------------- */
export function pagerank(store, { damping = 0.85, iterations = 30, tolerance = 1e-7, directed = false } = {}) {
  const nodes = store.allNodes();
  const n = nodes.length;
  if (!n) return { scores: [], trace: [], iterations: 0 };
  const idx = new Map(nodes.map((node, i) => [node.id, i]));
  const out = Array.from({ length: n }, () => []);
  for (const e of store.allEdges()) {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    out[a].push(b);
    if (!directed) out[b].push(a);
  }
  let rank = new Array(n).fill(1 / n);
  const trace = [];
  let used = 0;
  for (let it = 0; it < iterations; it++) {
    const next = new Array(n).fill((1 - damping) / n);
    let dangling = 0;
    for (let i = 0; i < n; i++) {
      if (!out[i].length) {
        dangling += rank[i];
        continue;
      }
      const share = (rank[i] * damping) / out[i].length;
      for (const j of out[i]) next[j] += share;
    }
    if (dangling) {
      const spread = (dangling * damping) / n;
      for (let i = 0; i < n; i++) next[i] += spread;
    }
    let delta = 0;
    for (let i = 0; i < n; i++) delta += Math.abs(next[i] - rank[i]);
    rank = next;
    trace.push(delta);
    used = it + 1;
    if (delta < tolerance) break;
  }
  const scores = nodes
    .map((node, i) => ({ id: node.id, label: labelOf(node), group: node.labels[0] || 'default', score: rank[i] }))
    .sort((a, b) => b.score - a.score);
  return { scores, trace, iterations: used, rankOf: (id) => rank[idx.get(id)] ?? 0 };
}

/* ---------------- Louvain (1차 로컬 이동) ---------------- */
export function louvain(store, { resolution = 1, maxSweeps = 24 } = {}) {
  const nodes = store.allNodes();
  const n = nodes.length;
  if (!n) return { communities: new Map(), groups: [], modularity: 0, trace: [] };
  const ids = nodes.map((x) => x.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const adj = Array.from({ length: n }, () => new Map());
  const degree = new Array(n).fill(0);
  const selfLoops = new Array(n).fill(0);
  let m2 = 0; // 2m

  for (const e of store.allEdges()) {
    const a = idx.get(e.from);
    const b = idx.get(e.to);
    if (a === undefined || b === undefined) continue;
    if (a === b) {
      selfLoops[a] += 1;
      degree[a] += 2;
      m2 += 2;
      continue;
    }
    adj[a].set(b, (adj[a].get(b) || 0) + 1);
    adj[b].set(a, (adj[b].get(a) || 0) + 1);
    degree[a] += 1;
    degree[b] += 1;
    m2 += 2;
  }
  if (!m2) {
    return {
      communities: new Map(ids.map((id, i) => [id, i])),
      groups: ids.map((id, i) => ({ id: i, members: [id] })),
      modularity: 0,
      trace: [],
    };
  }

  const comm = ids.map((_, i) => i);
  const totals = degree.slice();
  const trace = [];

  const modularity = () => {
    let q = 0;
    const inner = new Map();
    for (let i = 0; i < n; i++) {
      for (const [j, w] of adj[i]) {
        if (comm[i] === comm[j]) inner.set(comm[i], (inner.get(comm[i]) || 0) + w);
      }
    }
    for (const c of new Set(comm)) {
      const inW = inner.get(c) || 0;
      q += inW / m2 - resolution * Math.pow(totals[c] / m2, 2);
    }
    return q;
  };

  let improved = true;
  let sweeps = 0;
  while (improved && sweeps < maxSweeps) {
    improved = false;
    sweeps++;
    for (let i = 0; i < n; i++) {
      const ci = comm[i];
      const linksTo = new Map();
      let selfW = 0;
      for (const [j, w] of adj[i]) {
        if (j === i) {
          selfW = w;
          continue;
        }
        const cj = comm[j];
        linksTo.set(cj, (linksTo.get(cj) || 0) + w);
      }
      // 최선의 이웃 커뮤니티 계산
      let bestC = ci;
      let bestGain = 0;
      const ki = degree[i];
      for (const [c, w] of linksTo) {
        const gain = w / m2 - (resolution * totals[c] * ki) / (m2 * m2);
        if (gain > bestGain) {
          bestGain = gain;
          bestC = c;
        }
      }
      if (bestC !== ci) {
        const off = linksTo.get(bestC) || 0;
        const keep = linksTo.get(ci) || 0;
        const gain = off - keep;
        if (gain > 0) {
          totals[ci] -= ki;
          totals[bestC] += ki;
          comm[i] = bestC;
          improved = true;
        }
      }
    }
    trace.push(modularity());
  }

  const byComm = new Map();
  ids.forEach((id, i) => {
    const c = comm[i];
    if (!byComm.has(c)) byComm.set(c, []);
    byComm.get(c).push(id);
  });
  const groups = [...byComm.entries()]
    .map(([cid, members]) => ({ id: cid, members, size: members.length }))
    .sort((a, b) => b.size - a.size);

  return {
    communities: new Map(ids.map((id, i) => [id, comm[i]])),
    groups,
    modularity: trace.length ? trace[trace.length - 1] : modularity(),
    trace,
    sweeps,
  };
}

/* ---------------- 중심성 ---------------- */
export function degreeCentrality(store) {
  const max = Math.max(1, ...store.allNodes().map((n) => store.degree(n.id)));
  return store
    .allNodes()
    .map((n) => ({
      id: n.id,
      label: labelOf(n),
      group: n.labels[0] || 'default',
      degree: store.degree(n.id),
      score: store.degree(n.id) / max,
    }))
    .sort((a, b) => b.degree - a.degree);
}

/** Brandes betweenness (무가중, 소규모 전용) */
export function betweenness(store, { normalized = true } = {}) {
  const nodes = store.allNodes();
  const cb = new Map(nodes.map((n) => [n.id, 0]));
  for (const s of nodes) {
    const S = [];
    const P = new Map(nodes.map((n) => [n.id, []]));
    const sigma = new Map(nodes.map((n) => [n.id, 0]));
    const d = new Map(nodes.map((n) => [n.id, -1]));
    sigma.set(s.id, 1);
    d.set(s.id, 0);
    const Q = [s.id];
    while (Q.length) {
      const v = Q.shift();
      S.push(v);
      for (const { node } of store.neighbors(v)) {
        if (d.get(node.id) < 0) {
          d.set(node.id, d.get(v) + 1);
          Q.push(node.id);
        }
        if (d.get(node.id) === d.get(v) + 1) {
          sigma.set(node.id, sigma.get(node.id) + sigma.get(v));
          P.get(node.id).push(v);
        }
      }
    }
    const delta = new Map(nodes.map((n) => [n.id, 0]));
    while (S.length) {
      const w = S.pop();
      for (const v of P.get(w)) {
        delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      }
      if (w !== s.id) cb.set(w, cb.get(w) + delta.get(w));
    }
  }
  const vals = [...cb.values()];
  const max = Math.max(1, ...vals);
  const denom = normalized && nodes.length > 2 ? ((nodes.length - 1) * (nodes.length - 2)) / 2 : 1;
  return nodes
    .map((n) => ({
      id: n.id,
      label: labelOf(n),
      group: n.labels[0] || 'default',
      score: normalized ? cb.get(n.id) / denom : cb.get(n.id),
      raw: cb.get(n.id),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ ...x, norm: x.score / (max || 1) }));
}

/* ---------------- 연결 요소 ---------------- */
export function connectedComponents(store) {
  const seen = new Set();
  const groups = [];
  for (const node of store.allNodes()) {
    if (seen.has(node.id)) continue;
    const { order } = bfs(store, node.id);
    const members = order;
    members.forEach((id) => seen.add(id));
    groups.push(members);
  }
  return groups.sort((a, b) => b.length - a.length);
}

/* ---------------- 시뮬레이션: 조인 비용 vs 홉 비용 ---------------- */
export function traversalCost(hops, { rows = 100000, fanout = 6, joinCost = 1 } = {}) {
  // RDB: 깊이마다 조인 비용이 곱해지고, 중간 결과가 다시 스캔된다고 가정(교육용 근사)
  let join = rows;
  const joins = [];
  for (let h = 1; h <= hops; h++) {
    join = join * Math.max(1, fanout) * joinCost;
    joins.push(join);
  }
  // 그래프: 시작 노드에서 포인터를 따라가므로 홉 수에 선형
  const traversal = hops * fanout;
  return {
    hops,
    joinOps: joins[joins.length - 1] || rows,
    joins,
    traversalOps: traversal,
    ratio: (joins[joins.length - 1] || rows) / Math.max(1, traversal),
  };
}
