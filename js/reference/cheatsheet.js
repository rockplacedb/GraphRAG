/**
 * 부록 1 — SQL ↔ Cypher 치트시트
 */
import { h } from '../core/dom.js';
import { pageHead, section, prose, callout, badge } from '../ui/blocks.js';
import { copyText } from '../core/toast.js';

const ROWS = [
  { topic: '조회', sql: 'SELECT * FROM customers LIMIT 10;', cypher: 'MATCH (c:Customer) RETURN c LIMIT 10;', note: 'FROM → MATCH' },
  { topic: '조회', sql: 'SELECT name, grade FROM customers;', cypher: 'MATCH (c:Customer) RETURN c.name, c.grade;', note: 'SELECT → RETURN' },
  { topic: '조회', sql: "SELECT * FROM products WHERE price > 100000;", cypher: 'MATCH (p:Product) WHERE p.price > 100000 RETURN p;', note: 'WHERE 동일' },
  { topic: '조회', sql: "SELECT DISTINCT grade FROM customers;", cypher: 'MATCH (c:Customer) RETURN DISTINCT c.grade;', note: 'DISTINCT' },
  { topic: '조회', sql: 'ORDER BY price DESC LIMIT 5 OFFSET 10', cypher: 'ORDER BY p.price DESC SKIP 10 LIMIT 5', note: 'OFFSET → SKIP' },
  { topic: '필터', sql: "WHERE name LIKE '%이어폰%'", cypher: "WHERE p.name CONTAINS '이어폰'", note: 'LIKE %x% → CONTAINS' },
  { topic: '필터', sql: "WHERE name LIKE '무선%'", cypher: "WHERE p.name STARTS WITH '무선'", note: 'LIKE x% → STARTS WITH' },
  { topic: '필터', sql: 'WHERE price BETWEEN 10000 AND 50000', cypher: 'WHERE 10000 <= p.price <= 50000', note: '범위 조건' },
  { topic: '필터', sql: 'WHERE deleted_at IS NULL', cypher: 'WHERE p.deletedAt IS NULL', note: 'IS NULL' },
  { topic: '필터', sql: "WHERE grade IN ('VIP','GOLD')", cypher: "WHERE c.grade IN ['VIP','GOLD']", note: 'IN + 리스트' },
  { topic: '조인·경로', sql: 'FROM orders o JOIN customers c ON c.id = o.customer_id', cypher: 'MATCH (c:Customer)-[:PLACED]->(o:Order)', note: '조인 = 관계 패턴' },
  { topic: '조인·경로', sql: '... JOIN order_items oi ON oi.order_id = o.id', cypher: 'MATCH (o:Order)-[:CONTAINS]->(p:Product)', note: '조인 테이블 → 관계' },
  { topic: '조인·경로', sql: 'LEFT JOIN ...', cypher: 'OPTIONAL MATCH ...', note: '이 실습 엔진은 미지원' },
  { topic: '조인·경로', sql: '재귀 CTE로 3홉', cypher: 'MATCH (a)-[:R*1..3]->(b)', note: '가변 길이' },
  { topic: '조인·경로', sql: '양방향 연결 찾기 (복잡)', cypher: 'MATCH (a)-[:R]-(b)', note: '방향 생략' },
  { topic: '집계', sql: 'SELECT grade, COUNT(*) FROM customers GROUP BY grade', cypher: 'MATCH (c:Customer) RETURN c.grade, count(*)', note: 'GROUP BY 자동' },
  { topic: '집계', sql: 'SUM(amount), AVG(amount), MIN, MAX', cypher: 'sum(o.amount), avg(o.amount), min(), max()', note: '동일' },
  { topic: '집계', sql: 'HAVING count(*) >= 2', cypher: 'WHERE는 집계 전 → WITH + WHERE (미지원)', note: '이 실습 엔진에서는 서브쿼리로' },
  { topic: '집계', sql: 'ARRAY_AGG(name)', cypher: 'collect(p.name)', note: '배열 집계' },
  { topic: '변경', sql: 'INSERT INTO products (sku, name) VALUES (...)', cypher: 'CREATE (p:Product {sku: ..., name: ...})', note: 'CREATE = INSERT' },
  { topic: '변경', sql: 'INSERT ... ON CONFLICT DO UPDATE', cypher: 'MERGE (p:Product {sku: ...}) SET p.name = ...', note: 'MERGE = UPSERT' },
  { topic: '변경', sql: 'UPDATE products SET price = 100 WHERE sku = ...', cypher: 'MATCH (p:Product {sku: ...}) SET p.price = 100', note: 'SET' },
  { topic: '변경', sql: 'ALTER TABLE ... ADD COLUMN', cypher: 'SET p.newProp = 값', note: '스키마 없음' },
  { topic: '변경', sql: 'DELETE FROM products WHERE ...', cypher: 'MATCH (p:Product) WHERE ... DELETE p', note: '관계 있으면 DETACH' },
  { topic: '변경', sql: 'DELETE ... CASCADE', cypher: 'DETACH DELETE p', note: '연결 관계까지 삭제' },
  { topic: '메타', sql: '\\d products / information_schema', cypher: 'CALL db.labels() / CALL db.propertyKeys()', note: '스키마 메타' },
  { topic: '메타', sql: 'EXPLAIN / EXPLAIN ANALYZE', cypher: 'EXPLAIN / PROFILE', note: '실행 계획' },
  { topic: '메타', sql: 'CREATE UNIQUE INDEX', cypher: 'CREATE CONSTRAINT ... REQUIRE ... IS UNIQUE', note: '제약' },
];

const TOPICS = ['전체', '조회', '필터', '조인·경로', '집계', '변경', '메타'];

function cheatCell(text, tone) {
  const pre = h('div', { class: 'cheat__cell__inner', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, text);
  const cell = h(
    'div',
    { class: `cheat__cell cheat__cell--${tone}`, title: '클릭하면 복사합니다', style: { cursor: 'copy' } },
    h('span', { class: 'cheat__label' }, tone === 'sql' ? 'SQL' : 'Cypher / Graph'),
    pre
  );
  cell.addEventListener('click', () => copyText(text, '복사했습니다'));
  return cell;
}

export default {
  id: 'reference/cheatsheet',
  title: 'SQL ↔ Cypher 치트시트',
  kicker: 'REFERENCE 01',
  summary: '이미 아는 SQL에서 출발해 Cypher를 대응시키는 가장 빠른 방법.',
  minutes: 8,
  tags: ['치트시트', '문법'],
  render(ctx) {
    const { el } = ctx;
    const list = h('div', { class: 'cheat' });
    const chips = h('div', { class: 'chip-row' });
    let active = '전체';

    function renderRows() {
      list.replaceChildren();
      const rows = ROWS.filter((r) => active === '전체' || r.topic === active);
      for (const r of rows) {
        list.append(
          h(
            'div',
            { class: 'cheat__row' },
            cheatCell(r.sql, 'sql'),
            cheatCell(r.cypher, 'cypher'),
            h('div', { style: { gridColumn: '1 / -1', fontSize: 'var(--fs-2xs)', color: 'var(--ink-4)', marginTop: '2px' } }, r.note)
          )
        );
      }
      if (!rows.length) list.append(h('p', { class: 'muted' }, '해당 주제가 없습니다.'));
    }

    for (const t of TOPICS) {
      chips.append(
        h(
          'button',
          {
            class: `chip${t === active ? ' is-on' : ''}`,
            type: 'button',
            onClick: (e) => {
              active = t;
              chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c.textContent === t));
              renderRows();
            },
          },
          t
        )
      );
    }
    renderRows();

    el.append(
      pageHead({
        kicker: 'REFERENCE 01 · CHEAT SHEET',
        title: 'SQL ↔ Cypher 치트시트',
        summary: '왼쪽 SQL을 알고 있다면 오른쪽은 <strong>대응</strong>만 기억하면 됩니다. 셀을 클릭하면 복사됩니다.',
        minutes: 8,
        tags: ['28개 대응', '클릭 복사'],
      })
    );

    el.append(
      section(
        { num: '1', title: '패턴 읽는 법', lead: 'Cypher의 절반은 <strong>그림 읽기</strong>입니다.' },
        h(
          'div',
          { class: 'grid-2' },
          h(
            'div',
            { class: 'code', style: { padding: '16px' } },
            h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: '#e6edf3', lineHeight: '2' } },
              h('div', {}, h('span', { style: { color: '#ffcb6b' } }, '(c:Customer)'), ' — Customer 라벨을 가진 노드, 변수 c'),
              h('div', {}, h('span', { style: { color: '#89ddff' } }, '-[:PLACED]->'), ' — 오른쪽 방향 관계'),
              h('div', {}, h('span', { style: { color: '#89ddff' } }, '<-[:PLACED]-'), ' — 왼쪽 방향'),
              h('div', {}, h('span', { style: { color: '#89ddff' } }, '-[:PLACED]-'), ' — 방향 무시'),
              h('div', {}, h('span', { style: { color: '#ffcb6b' } }, '{name: "김하늘"}'), ' — 속성 조건')
            )
          ),
          callout(
            'engineer',
            '가장 큰 사고는 방향',
            'RDB의 FK는 방향 개념이 없지만, 그래프 관계는 <strong>방향이 의미를 가집니다</strong>. “고객이 주문을 했다”는 <code>(Customer)-[:PLACED]->(Order)</code>입니다. 반대로 조회하면 0행이 나옵니다.',
          )
        )
      )
    );

    el.append(
      section(
        { num: '2', title: '주제별 대응', lead: '필터로 주제를 좁혀 보세요.' },
        chips,
        list,
        callout(
          'warn',
          '주의',
          '위 대응 중 일부(예: <code>OPTIONAL MATCH</code>, <code>WITH</code>)는 이 사이트의 <strong>브라우저 엔진</strong>에서는 실행되지 않습니다. 실제 Neo4j에서는 동작합니다 — 지원 범위는 각 실습의 “지원 문법” 버튼을 참고하세요.'
        )
      )
    );

    el.append(
      section(
        { num: '3', title: '자주 틀리는 것 5가지' },
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'table table--compact' },
            h('thead', {}, h('tr', {}, h('th', {}, '실수'), h('th', {}, '결과'), h('th', {}, '올바른 방법'))),
            h(
              'tbody',
              {},
              [
                ['관계 방향 무시', '0행 또는 정반대 결과', '패턴을 문장으로 읽어 방향 확인'],
                ['MERGE에 라벨/속성 누락', '중복 노드', '유니크 키가 되는 속성을 반드시 포함'],
                ['가변 길이 무제한', '타임아웃/메모리 폭증', '*1..3 상한'],
                ['LIKE 사고', 'CONTAINS 대신 = 사용', '부분 일치는 CONTAINS'],
                ['WHERE에서 집계', '문법 오류', '집계는 RETURN/HAVING에 해당하는 위치로'],
              ].map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))
            )
          )
        )
      )
    );

    return { destroy() {} };
  },
};
