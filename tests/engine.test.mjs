/**
 * engine.test.mjs — DOM 없이 실행되는 엔진 검증.
 * 실행: node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../js/engine/graph-store.js';
import { runCypher, SUPPORTED, CypherError, splitStatements } from '../js/engine/cypher-lite.js';

function seed() {
  return createStore(
    [
      { id: 'c1', labels: ['Customer'], props: { name: '김하늘', grade: 'VIP' } },
      { id: 'c2', labels: ['Customer'], props: { name: '이도윤', grade: 'NORMAL' } },
      { id: 'c3', labels: ['Customer'], props: { name: '박서연', grade: 'VIP' } },
      { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰', price: 89000 } },
      { id: 'p2', labels: ['Product'], props: { name: '보조 배터리', price: 32000 } },
      { id: 'p3', labels: ['Product'], props: { name: '노트북 파우치', price: 21000 } },
      { id: 'o1', labels: ['Order'], props: { id: 'O-1', amount: 89000, status: 'PAID' } },
      { id: 'o2', labels: ['Order'], props: { id: 'O-2', amount: 53000, status: 'RETURNED' } },
    ],
    [
      { id: 'e1', type: 'PLACED', from: 'c1', to: 'o1' },
      { id: 'e2', type: 'CONTAINS', from: 'o1', to: 'p1' },
      { id: 'e3', type: 'PLACED', from: 'c2', to: 'o2' },
      { id: 'e4', type: 'CONTAINS', from: 'o2', to: 'p1' },
      { id: 'e5', type: 'CONTAINS', from: 'o2', to: 'p2' },
      { id: 'e6', type: 'PLACED', from: 'c3', to: 'o1' },
    ]
  );
}

/* ---------------- 저장소 ---------------- */
test('GraphStore: 라벨 인덱스와 인접 리스트', () => {
  const store = seed();
  assert.equal(store.stats().nodes, 8);
  assert.equal(store.nodesByLabel('Product').length, 3);
  assert.equal(store.degree('p1'), 2);
  assert.equal(store.outAdj.get('o2').length, 2);
  assert.equal(store.neighbors('p1', { dir: 'in' }).length, 2);
  store.removeNode('o2');
  assert.equal(store.getNode('o2'), null);
  assert.equal(store.getEdge('e4'), null, '노드 삭제 시 연결된 엣지도 제거');
});

/* ---------------- MATCH ---------------- */
test('MATCH: 라벨 스캔 + 속성 프로젝션', () => {
  const store = seed();
  const res = runCypher(store, 'MATCH (c:Customer) RETURN c.name AS name');
  assert.equal(res.rows.length, 3);
  assert.deepEqual(res.columns, ['name']);
  assert.deepEqual(res.rows.map((r) => r.name).sort(), ['김하늘', '박서연', '이도윤'].sort());
});

test('MATCH: 관계 패턴과 방향', () => {
  const store = seed();
  const res = runCypher(store, 'MATCH (c:Customer)-[:PLACED]->(o:Order) RETURN c.name AS c, o.id AS o ORDER BY o');
  assert.equal(res.rows.length, 3);
  assert.equal(res.rows[0].o, 'O-1');

  const inbound = runCypher(store, 'MATCH (o:Order)<-[:PLACED]-(c:Customer) RETURN count(*) AS n');
  assert.equal(inbound.rows[0].n, 3);

  const typed = runCypher(store, 'MATCH (o:Order)-[:CONTAINS]->(p:Product) RETURN count(*) AS n');
  assert.equal(typed.rows[0].n, 3);
});

test('WHERE: 비교·문자열·IN·IS NULL', () => {
  const store = seed();
  assert.equal(runCypher(store, "MATCH (c:Customer) WHERE c.grade = 'VIP' RETURN c.name AS n").rows.length, 2);
  assert.equal(runCypher(store, 'MATCH (c:Customer) WHERE c.grade <> "VIP" RETURN c.name AS n').rows.length, 1);
  assert.equal(runCypher(store, 'MATCH (p:Product) WHERE p.price >= 30000 RETURN p.name AS n').rows.length, 2);
  assert.equal(runCypher(store, "MATCH (p:Product) WHERE p.name CONTAINS '배터리' RETURN p.name AS n").rows.length, 1);
  assert.equal(runCypher(store, "MATCH (p:Product) WHERE p.name STARTS WITH '무선' RETURN p.name AS n").rows.length, 1);
  assert.equal(runCypher(store, "MATCH (c:Customer) WHERE c.grade IN ['VIP'] RETURN count(*) AS n").rows[0].n, 2);
  assert.equal(runCypher(store, 'MATCH (p:Product) WHERE p.discount IS NULL RETURN count(*) AS n').rows[0].n, 3);
});

test('가변 길이: 2홉 추천 경로', () => {
  const store = seed();
  const res = runCypher(
    store,
    `MATCH (a:Product)<-[:CONTAINS]-(o:Order)-[:CONTAINS]->(b:Product)
     WHERE a.name <> b.name
     RETURN a.name AS a, b.name AS b`
  );
  assert.ok(res.rows.length > 0);
  assert.ok(res.rows.some((r) => r.a === '무선 이어폰' && r.b === '보조 배터리'));

  const hops = runCypher(store, 'MATCH (p:Product)-[:CONTAINS*1..2]-(q:Product) RETURN count(*) AS n');
  assert.ok(hops.rows[0].n > 0);
});

test('집계: GROUP BY + ORDER BY + LIMIT', () => {
  const store = seed();
  const res = runCypher(
    store,
    `MATCH (o:Order)-[:CONTAINS]->(p:Product)
     RETURN p.name AS product, count(*) AS orders
     ORDER BY orders DESC, product ASC
     LIMIT 2`
  );
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].product, '무선 이어폰');
  assert.equal(res.rows[0].orders, 2);

  const total = runCypher(store, 'MATCH (o:Order) RETURN sum(o.amount) AS total');
  assert.equal(total.rows[0].total, 142000);
});

test('DISTINCT', () => {
  const store = seed();
  const res = runCypher(store, 'MATCH (c:Customer) RETURN DISTINCT c.grade AS g ORDER BY g');
  assert.equal(res.rows.length, 2);
});

/* ---------------- 변경 ---------------- */
test('CREATE: 노드와 관계 생성', () => {
  const store = seed();
  const res = runCypher(store, `CREATE (s:Supplier {id: 'S-1', name: '한빛물류'}) RETURN s.name AS name`);
  assert.equal(res.rows[0].name, '한빛물류');
  assert.equal(store.nodesByLabel('Supplier').length, 1);
  assert.equal(res.stats.nodesCreated, 1);

  const link = runCypher(
    store,
    `MATCH (p:Product {name: '무선 이어폰'}), (s:Supplier {id: 'S-1'})
     CREATE (s)-[:SUPPLIES]->(p)
     RETURN p.name AS p, s.name AS s`
  );
  assert.equal(link.stats.relationshipsCreated, 1);
  assert.ok(store.hasEdgeBetween('S-1', 'p1', 'SUPPLIES'));
});

test('MERGE: 멱등', () => {
  const store = seed();
  runCypher(store, "MERGE (c:Category {name: '오디오'})");
  runCypher(store, "MERGE (c:Category {name: '오디오'})");
  assert.equal(store.nodesByLabel('Category').length, 1);
});

test('SET: 속성 갱신과 삭제', () => {
  const store = seed();
  runCypher(store, "MATCH (c:Customer {name: '이도윤'}) SET c.grade = 'VIP', c.point = 100");
  const live = store.getNode('c2');
  assert.equal(live.props.grade, 'VIP');
  assert.equal(live.props.point, 100);

  runCypher(store, "MATCH (c:Customer {name: '이도윤'}) SET c.point = null");
  assert.equal(store.getNode('c2').props.point, undefined);
});

test('DETACH DELETE: 관계와 함께 삭제', () => {
  const store = seed();
  runCypher(store, 'MATCH (o:Order {id: "O-2"}) DETACH DELETE o');
  assert.equal(store.getNode('o2'), null);
  assert.equal(store.getEdge('e3'), null);
  assert.equal(runCypher(store, 'MATCH (p:Product) RETURN count(*) AS n').rows[0].n, 3);
});

test('DELETE: 관계가 남아 있으면 오류로 알려준다', () => {
  const store = seed();
  assert.throws(
    () => runCypher(store, 'MATCH (o:Order {id: "O-2"}) DELETE o'),
    (err) => err instanceof CypherError && /DETACH DELETE/.test(err.message)
  );
});

/* ---------------- 결과·오류 ---------------- */
test('결과 그래프에 노드/엣지가 담긴다', () => {
  const store = seed();
  const res = runCypher(store, 'MATCH (c:Customer)-[r:PLACED]->(o:Order) RETURN c, r, o LIMIT 5');
  assert.ok(res.resultGraph.nodes.length >= 3);
  assert.ok(res.resultGraph.edges.length >= 1);
});

test('미지원 구문은 위치와 함께 한국어 오류', () => {
  const store = seed();
  assert.throws(
    () => runCypher(store, 'MATCH (n) WITH n RETURN n'),
    (err) => err instanceof CypherError && /WITH/.test(err.message)
  );
  assert.throws(
    () => runCypher(store, 'MATCH (n) OPTIONAL MATCH (n)--(m) RETURN n'),
    (err) => /OPTIONAL MATCH/.test(err.message)
  );
  assert.throws(
    () => runCypher(store, 'MATCH (n) RETRN n'),
    (err) => /알 수 없는 절|RETRN/.test(err.message)
  );
});

test('정의되지 않은 변수는 친절한 오류', () => {
  const store = seed();
  assert.throws(
    () => runCypher(store, 'MATCH (c:Customer) RETURN x.name AS n'),
    (err) => /정의되지 않은 변수/.test(err.message)
  );
});

test('여러 문장 실행', () => {
  const store = seed();
  const stmts = splitStatements('MATCH (c:Customer) RETURN 1; MATCH (p:Product) RETURN 2;');
  assert.equal(stmts.length, 2);
  const res = runCypher(store, "CREATE (t:Temp {id:'t1'}); MATCH (t:Temp) RETURN t.id AS id");
  assert.equal(res.rows[0].id, 't1');
});

test('SUPPORTED 메타데이터가 채워져 있다', () => {
  assert.ok(SUPPORTED.clauses.includes('MATCH'));
  assert.ok(SUPPORTED.notSupported.length > 5);
});
