/**
 * rag.test.mjs — Graph RAG 시뮬레이터 검증(DOM 불필요).
 * 실행: node tests/rag.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { seedGraphStore } from '../js/data/modumall.seed.js';
import { embed, cosine, vectorSearch, linkEntities, expandSubgraph, buildFacts, runRagPipeline, DOCS } from '../js/engine/rag-sim.js';

test('임베딩은 결정적이다', () => {
  const a = embed('대성테크 헤드폰 반품');
  const b = embed('대성테크 헤드폰 반품');
  assert.deepEqual(a, b);
  assert.equal(a.length, 48);
  const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9, 'L2 정규화');
});

test('코사인 유사도 경계', () => {
  const v = embed('무선 이어폰 배터리');
  assert.ok(Math.abs(cosine(v, v) - 1) < 1e-9);
  assert.ok(cosine(v, embed('전혀 다른 문자열 zzz')) < 0.9);
});

test('벡터 검색은 관련 문서를 상위로 올린다', () => {
  const hits = vectorSearch('대성테크 공급사 품질 불량', DOCS, { k: 3 });
  assert.equal(hits.length, 3);
  const ids = hits.map((h) => h.id);
  assert.ok(ids.includes('D3'), `D3(대성테크 품질 리포트)가 top-3에 있어야 함: ${ids}`);
});

test('엔티티 링킹: 공급사와 상품을 찾는다', () => {
  const store = seedGraphStore();
  const linked = linkEntities(store, '대성테크가 공급한 헤드폰의 반품 사유는?');
  const ids = linked.map((l) => l.id);
  assert.ok(ids.includes('s2'), `대성테크(s2) 링킹 실패: ${ids}`);
  assert.ok(ids.includes('p3'), `헤드폰(p3) 링킹 실패: ${ids}`);
});

test('서브그래프 확장은 카테고리 허브를 따라가지 않는다', () => {
  const store = seedGraphStore();
  const { nodeIds, edgeIds } = expandSubgraph(store, ['s2'], { hops: 2 });
  assert.ok(nodeIds.includes('p3'));
  const types = edgeIds.map((id) => store.getEdge(id)?.type);
  assert.ok(!types.includes('IN_CATEGORY'), 'IN_CATEGORY 는 확장 대상이 아님');
  assert.ok(types.includes('SUPPLIED_BY'));
});

test('근거 정렬: 반품/상품 관계가 먼저 온다', () => {
  const store = seedGraphStore();
  const { nodeIds, edgeIds } = expandSubgraph(store, ['s2'], { hops: 2 });
  const facts = buildFacts(store, nodeIds, edgeIds, { limit: 8, seedIds: ['s2'] });
  assert.ok(facts.length > 0);
  const topTypes = facts.slice(0, 4).map((f) => f.type);
  assert.ok(
    topTypes.some((t) => ['SUPPLIED_BY', 'FOR_PRODUCT', 'HAS_RETURN', 'CONTAINS'].includes(t)),
    `상위 근거가 의미 있는 타입이어야 함: ${topTypes}`
  );
});

test('파이프라인: 하이브리드 커버리지가 각 단독보다 낮지 않다', () => {
  const store = seedGraphStore();
  const res = runRagPipeline(store, '대성테크가 공급한 헤드폰의 반품 사유와 영향 범위는?', { k: 3, hops: 2 });
  assert.equal(res.stages.length, 6);
  assert.ok(res.answer.length > 50);
  assert.ok(res.vectorHits.length === 3);
  assert.ok(res.subgraph.nodeIds.length > 1);
  assert.ok(res.coverage.hybrid >= res.coverage.vector);
  assert.ok(res.coverage.hybrid >= res.coverage.graph);
  assert.ok(res.prompt.includes('# 그래프 근거'));
  assert.ok(res.prompt.includes('# 질문'));
});

test('결정적: 같은 질문은 같은 결과', () => {
  const store = seedGraphStore();
  const a = runRagPipeline(store, '무선 이어폰과 함께 구매되는 상품은?');
  const b = runRagPipeline(store, '무선 이어폰과 함께 구매되는 상품은?');
  assert.deepEqual(a.subgraph.nodeIds, b.subgraph.nodeIds);
  assert.deepEqual(a.vectorHits.map((d) => d.id), b.vectorHits.map((d) => d.id));
  assert.equal(a.answer, b.answer);
});
