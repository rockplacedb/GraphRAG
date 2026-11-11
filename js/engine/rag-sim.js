/**
 * rag-sim.js — Graph RAG 파이프라인 시뮬레이터.
 *
 * ★ 진짜 LLM이 아니다. 임베딩은 토큰 해시 기반의 결정적 벡터이고,
 *   답변은 검색된 문서·그래프 근거를 템플릿으로 조립한 것이다.
 *   목적은 "검색 근거가 어떻게 모이고, 그래프가 무엇을 더하는가"를 설명하는 것.
 */
import { DOCS } from '../data/docs.js';

const DIM = 48;

function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 한글은 교착어라 어절이 붙는다 → 어절 + 2글자 바이그램을 함께 토큰으로 쓴다. */
export function tokenize(text) {
  const out = [];
  const cleaned = normalizeText(text).replace(/[^0-9a-z가-힣\s]/g, ' ');
  for (const word of cleaned.split(/\s+/)) {
    if (!word) continue;
    if (word.length === 1) continue;
    out.push(word);
    if (/[가-힣]/.test(word) && word.length >= 3) {
      for (let i = 0; i < word.length - 1; i++) out.push(word.slice(i, i + 2));
    }
  }
  return out;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 결정적 임베딩(토큰 해시 → 48차원, L2 정규화) */
export function embed(text) {
  const v = new Array(DIM).fill(0);
  for (const tok of tokenize(text)) {
    v[hash(tok) % DIM] += 1;
    v[hash(tok + '#') % DIM] += 0.5;
  }
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export function cosine(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/* ---------------- 1. 벡터 검색 ---------------- */
export function vectorSearch(question, docs = DOCS, { k = 4 } = {}) {
  const qv = embed(question);
  const qTokens = new Set(tokenize(question));
  const scored = docs.map((doc) => {
    const dv = embed(`${doc.title} ${doc.text} ${(doc.tags || []).join(' ')}`);
    const base = cosine(qv, dv);
    // 어휘 겹침을 소폭 가산해 해석 가능성을 높인다
    const overlap = tokenize(`${doc.title} ${doc.text}`).filter((t) => qTokens.has(t)).length;
    const score = base + Math.min(0.08, overlap * 0.004);
    return { ...doc, score: Number(score.toFixed(4)) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

/* ---------------- 2. 엔티티 링킹 ---------------- */
export function linkEntities(store, question, { limit = 6 } = {}) {
  const q = normalizeText(question);
  const hits = [];
  for (const node of store.allNodes()) {
    const names = [node.props.name, node.props.title, node.props.id].filter((x) => x && String(x).trim());
    let best = null;
    for (const name of names) {
      const key = normalizeText(name);
      if (key.length < 2) continue;
      if (q.includes(key)) {
        best = { matched: name, score: 1, exact: true, specificity: key.length };
        break;
      }
      // 부분 일치: 이름의 어절 단위로도 확인한다("노이즈캔슬링 헤드폰" ← "헤드폰")
      const words = key.split(' ').filter((w) => w.length >= 2);
      for (const w of words) {
        if (q.includes(w) && (!best || w.length > best.specificity)) {
          best = { matched: w, score: 0.62, exact: false, specificity: w.length };
        }
      }
    }
    if (best) {
      hits.push({
        id: node.id,
        name: node.props.name || node.props.title || node.props.id || node.id,
        label: node.labels[0],
        matched: best.matched,
        score: best.score,
        exact: best.exact,
        specificity: best.specificity,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score || b.specificity - a.specificity).slice(0, limit);
}

/** 서브그래프 확장 시 기본적으로 따라갈 관계 타입(카테고리 허브는 제외 — 슈퍼노드 회피) */
export const EXPAND_TYPES = ['PLACED', 'CONTAINS', 'HAS_RETURN', 'FOR_PRODUCT', 'REVIEWS', 'WROTE', 'SUPPLIED_BY'];

/* ---------------- 3. 서브그래프 확장 ---------------- */
export function expandSubgraph(store, seedIds, { hops = 2, maxNodes = 60, allowTypes = EXPAND_TYPES } = {}) {
  const nodeIds = new Set(seedIds.map(String));
  const edgeIds = new Set();
  let frontier = [...nodeIds];
  for (let h = 0; h < hops && frontier.length; h++) {
    const next = [];
    for (const id of frontier) {
      for (const { node, edge } of store.neighbors(id)) {
        if (!node) continue;
        if (allowTypes && allowTypes.length && !allowTypes.includes(edge.type)) continue;
        edgeIds.add(edge.id);
        if (!nodeIds.has(node.id) && nodeIds.size < maxNodes) {
          nodeIds.add(node.id);
          next.push(node.id);
        }
      }
    }
    frontier = next;
  }
  return { nodeIds: [...nodeIds], edgeIds: [...edgeIds] };
}

/* ---------------- 4. 근거(fact) 만들기 ---------------- */
function labelOf(node) {
  return (
    node.props.name ||
    node.props.title ||
    (node.props.reason ? `반품: ${node.props.reason}` : null) ||
    (node.props.rating ? `리뷰 ★${node.props.rating}` : null) ||
    node.props.id ||
    node.id
  );
}

export function buildFacts(store, nodeIds, edgeIds, { limit = 14, seedIds = [] } = {}) {
  // 시드에서의 거리(홉)를 계산해 가까운 근거를 먼저 보여준다
  const dist = new Map(seedIds.map((id) => [id, 0]));
  let frontier = [...seedIds].filter((id) => store.getNode(id));
  let level = 0;
  while (frontier.length) {
    level += 1;
    const next = [];
    for (const id of frontier) {
      for (const { node } of store.neighbors(id)) {
        if (!node || dist.has(node.id)) continue;
        dist.set(node.id, level);
        next.push(node.id);
      }
    }
    frontier = next;
  }
  const TYPE_PRIORITY = {
    HAS_RETURN: 0,
    FOR_PRODUCT: 1,
    SUPPLIED_BY: 2,
    CONTAINS: 3,
    PLACED: 4,
    REVIEWS: 5,
    WROTE: 6,
  };

  const facts = [];
  const edgeSet = new Set(edgeIds.map(String));
  for (const e of store.allEdges()) {
    if (!edgeSet.has(e.id)) continue;
    if (!nodeIds.includes(e.from) || !nodeIds.includes(e.to)) continue;
    const from = store.getNode(e.from);
    const to = store.getNode(e.to);
    if (!from || !to) continue;
    facts.push({
      edgeId: e.id,
      type: e.type,
      text: `(${labelOf(from)}:${from.labels[0]}) -[${e.type}]-> (${labelOf(to)}:${to.labels[0]})`,
      from: e.from,
      to: e.to,
      props: e.props || {},
      _rank: [
        Math.min(dist.get(e.from) ?? 99, dist.get(e.to) ?? 99),
        TYPE_PRIORITY[e.type] ?? 9,
      ],
    });
  }
  // 가까운 노드 + 의미 있는 관계 타입 순으로 정렬
  facts.sort((a, b) => a._rank[0] - b._rank[0] || a._rank[1] - b._rank[1]);
  return facts.slice(0, limit).map(({ _rank, ...rest }) => rest);
}

/* ---------------- 5. 프롬프트 조립 ---------------- */
export function buildPrompt({ question, facts, docs, linked }) {
  const entityLines = linked.length
    ? linked.map((l) => `- ${l.name} (${l.label}, 신뢰도 ${(l.score * 100).toFixed(0)}%)`).join('\n')
    : '- (식별된 엔티티 없음)';
  const graphLines = facts.length ? facts.map((f) => `- ${f.text}`).join('\n') : '- (관련 그래프 근거 없음)';
  const docLines = docs.length
    ? docs.map((d) => `[${d.id}] ${d.title}: ${d.text}`).join('\n')
    : '- (검색된 문서 없음)';
  return `당신은 모두몰의 데이터 분석 도우미입니다. 아래 "그래프 근거"와 "문서 근거"만 사용해 답하세요.
근거에 없는 내용은 추측하지 말고 "확인 불가"라고 말하세요.

# 질문
${question}

# 식별된 엔티티
${entityLines}

# 그래프 근거 (서브그래프)
${graphLines}

# 문서 근거
${docLines}

# 출력 형식
1) 결론 한 문장
2) 근거(문서 ID·그래프 경로 인용)
3) 추가 확인이 필요한 항목`;
}

/* ---------------- 6. 답변 합성 ---------------- */
function firstSentence(text) {
  const idx = text.indexOf('. ');
  return idx > 0 ? text.slice(0, idx + 1) : text;
}

export function composeAnswer({ question, linked, docs, facts, store }) {
  const q = normalizeText(question);
  const names = linked.map((l) => l.name);
  const entityText = names.length ? names.slice(0, 3).join(', ') : '특정 엔티티';

  const wantsReturn = /반품|반품률|불량|파손|소음|교환|환불|이물질/.test(q);
  const wantsBuy = /함께|같이|추천|교차|연관/.test(q);
  const wantsSupplier = /공급사|공급|리스크|품질|리드타임/.test(q);

  const parts = [];
  parts.push(`“${question.trim()}” 에 대해 ${entityText} 를 기준으로 근거를 모았습니다.`);

  if (docs.length) {
    const d = docs[0];
    parts.push(`[${d.id}] ${d.title} 에 따르면, ${firstSentence(d.text)}`);
  }

  // 그래프 경로 요약: 시드에서 2~3홉 이내로 이어지는 사실 중 마지막 3개를 인용
  const shown = facts.slice(0, 4);
  if (shown.length) {
    parts.push(`그래프에서는 ${shown.map((f) => f.text).join(' → ')} 로 이어집니다.`);
  }

  if (wantsBuy) {
    parts.push('같은 주문에 담긴 상품을 2홉으로 모으면 “함께 구매” 후보가 됩니다. RDB라면 주문 테이블을 self-join해야 하는 질문입니다.');
  } else if (wantsReturn) {
    const hasReturn = facts.some((f) => f.type === 'HAS_RETURN' || f.type === 'FOR_PRODUCT');
    parts.push(
      hasReturn
        ? '반품 노드와 그 사유가 경로에 포함되어 있어, 동일 사유가 반복되는지 추가로 집계할 수 있습니다.'
        : '이 경로에는 반품 노드가 없습니다. 반품을 확인하려면 주문→반품 관계를 한 홉 더 확장해야 합니다.'
    );
  } else if (wantsSupplier) {
    const hasSupplier = facts.some((f) => f.type === 'SUPPLIED_BY');
    parts.push(
      hasSupplier
        ? '공급사 노드가 경로에 포함되어 있어, 같은 공급사의 다른 상품으로 영향 범위를 확장할 수 있습니다.'
        : '공급사 노드가 경로에 없어 전파 분석에는 부족합니다. 상품에서 공급사로 한 홉 확장이 필요합니다.'
    );
  } else {
    parts.push('추가로 확인할 항목은 반품 사유 집계와 공급사 리드타임입니다.');
  }

  return parts.join(' ');
}

/* ---------------- 7. 파이프라인 실행 ---------------- */
export function runRagPipeline(store, question, { docs = DOCS, k = 3, hops = 2 } = {}) {
  const stages = [];
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const linked = linkEntities(store, question);
  stages.push({
    key: 'link',
    title: '엔티티 링킹',
    detail: linked.length ? `${linked.length}개 엔티티 매칭: ${linked.map((l) => l.name).join(', ')}` : '엔티티를 찾지 못했습니다',
  });

  const vectorHits = vectorSearch(question, docs, { k });
  stages.push({
    key: 'retrieve',
    title: '하이브리드 검색',
    detail: `벡터 top-${k}: ${vectorHits.map((d) => d.id).join(', ')}`,
  });

  const seedIds = linked.map((l) => l.id);
  const expanded = seedIds.length ? expandSubgraph(store, seedIds, { hops }) : { nodeIds: [], edgeIds: [] };
  stages.push({
    key: 'expand',
    title: '서브그래프 확장',
    detail: `${hops}홉 확장 → 노드 ${expanded.nodeIds.length}개, 관계 ${expanded.edgeIds.length}개`,
  });

  const facts = buildFacts(store, expanded.nodeIds, expanded.edgeIds, { limit: 16, seedIds });
  stages.push({ key: 'context', title: '근거 구성', detail: `그래프 근거 ${facts.length}개 · 문서 근거 ${vectorHits.length}개` });

  const prompt = buildPrompt({ question, facts, docs: vectorHits, linked });
  stages.push({ key: 'prompt', title: '프롬프트 조립', detail: `${prompt.length.toLocaleString('ko-KR')}자` });

  const answer = composeAnswer({ question, linked, docs: vectorHits, facts, store });
  stages.push({ key: 'answer', title: '답변 합성', detail: '근거 인용 포함' });

  // 증거 체크리스트: 각 모드가 무엇을 확보했는지 비교
  const subNodes = expanded.nodeIds.map((id) => store.getNode(id)).filter(Boolean);
  const labels = new Set(subNodes.flatMap((n) => n.labels));
  const docText = vectorHits.map((d) => `${d.title} ${d.text}`).join(' ');
  const evidence = [
    { key: 'entity', label: '질문 속 엔티티 식별', vector: false, graph: linked.length > 0, hybrid: linked.length > 0 },
    { key: 'policy', label: '정책·사유 문서 확보', vector: vectorHits.length > 0, graph: false, hybrid: vectorHits.length > 0 },
    { key: 'instance', label: '실제 사례(주문·반품·리뷰) 근거', vector: /주문|반품|리뷰/.test(docText), graph: labels.has('Order') || labels.has('Return') || labels.has('Review'), hybrid: true },
    { key: 'supplier', label: '공급사·전파 경로 확보', vector: /공급사/.test(docText), graph: labels.has('Supplier'), hybrid: labels.has('Supplier') || /공급사/.test(docText) },
    { key: 'multiHop', label: '2홉 이상 연결 근거', vector: false, graph: facts.length >= 2, hybrid: facts.length >= 2 },
  ];
  for (const e of evidence) e.hybrid = e.vector || e.graph;

  const score = (mode) => {
    const ok = evidence.filter((e) => e[mode]).length;
    return ok / evidence.length;
  };

  return {
    question,
    linked,
    vectorHits,
    subgraph: {
      nodeIds: expanded.nodeIds,
      edgeIds: expanded.edgeIds,
      nodes: subNodes.map((n) => ({
        id: n.id,
        label: labelOf(n),
        group: n.labels[0],
        props: n.props,
      })),
      edges: expanded.edgeIds
        .map((id) => store.getEdge(id))
        .filter(Boolean)
        .map((e) => ({ id: e.id, from: e.from, to: e.to })),
    },
    facts,
    prompt,
    answer,
    evidence,
    coverage: { vector: score('vector'), graph: score('graph'), hybrid: score('hybrid') },
    stages,
    ms: Math.max(0.01, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
  };
}

export { DOCS };
