/**
 * Lab 3 — 다중 홉 탐색과 경로
 */
import { h } from '../core/dom.js';
import {
  section,
  prose,
  callout,
  codeBlock,
  tableBlock,
  graphCard,
  quizBlock,
  runPanel,
  badge,
  statsBlock,
} from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';
import { seedGraphStore } from '../data/modumall.seed.js';
import { shortestPath } from '../engine/algorithms.js';
import { toast } from '../core/toast.js';

function stepPanel(ctx, { no, title, desc, code, validate, onSuccess }) {
  const panel = runPanel(ctx, { title: `${no} ${title}`, code, validate, onSuccess });
  return h(
    'div',
    { class: 'stack stack--sm' },
    h('div', { class: 'row' }, badge(no, 'accent'), h('strong', { style: { fontSize: 'var(--fs-sm)' } }, title)),
    desc ? h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', margin: '0', lineHeight: '1.7' }, html: desc }) : null,
    panel.el
  );
}

export default {
  id: 'lab/multi-hop',
  title: '다중 홉 탐색',
  kicker: 'LAB 3',
  summary: '함께 구매 추천, 반품 연쇄 추적, 최단 경로. 그래프가 RDB보다 압도적으로 편한 영역입니다.',
  minutes: 24,
  tags: ['다중 홉', '가변 길이', '최단 경로'],
  render(ctx) {
    const { el } = ctx;
    const store = seedGraphStore();
    ctx.store = store;

    /* ---------- 최단 경로 데모 ---------- */
    const pathInfo = h(
      'div',
      { class: 'card__foot' },
      '버튼을 누르면 “박서연”에서 “대성테크”까지의 최단 경로를 찾습니다.'
    );
    const pathBtn = h('button', { class: 'btn btn--primary', type: 'button' }, '최단 경로 찾기');
    const pathResult = h('div', { style: { padding: '0 20px 16px' } });

    const pg = graphCard(ctx, {
      title: '경로 탐색 데모',
      subtitle: '고객 → 주문 → 상품 → 공급사 경로가 실제로 어떻게 이어지는지 보세요.',
      data: store.toVis(),
      height: 400,
      seed: 21,
    });

    let pview = null;
    pg.ready.then((v) => {
      pview = v;
    });

    pathBtn.addEventListener('click', () => {
      const res = shortestPath(store, 'c3', 's2');
      pathResult.replaceChildren();
      if (!res.path) {
        pathResult.append(h('p', { class: 'muted' }, '경로를 찾지 못했습니다.'));
        return;
      }
      const labels = res.path.map((id) => {
        const n = store.getNode(id);
        return n ? `:${n.labels[0]}(${n.props.name})` : id;
      });
      pview?.highlight(res.path, { edges: res.edges });
      pathResult.append(
        h(
          'div',
          { class: 'result-strip', style: { border: '1px solid var(--border)', borderRadius: '10px' } },
          h('span', {}, '홉 수 ', h('b', {}, String(res.length))),
          h('span', { class: 'dot' }),
          h('span', {}, '경로 ', h('b', {}, String(res.path.length)))
        ),
        h('p', { style: { marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' } }, labels.join('  →  '))
      );
    });

    el.append(
      ...labHead({
        num: 'LAB 3',
        kicker: 'MULTI-HOP',
        title: '다중 홉 탐색과 경로',
        summary:
          '“몇 홉 이내로 연결된 것”을 찾는 질문은 그래프의 본령입니다. 방향·타입·가변 길이를 조합해 봅니다.',
        minutes: 24,
        tags: ['2홉 추천', '가변 길이', 'shortestPath'],
        scenarioTitle: '“함께 산 상품을 추천하고, 반품 원인을 추적해 주세요”',
        quote:
          '“상품 상세 페이지에 <strong>함께 구매한 상품</strong>을 띄우고, 반품이 몰리는 <strong>공급사</strong>를 찾고 싶습니다. 두 질문 모두 ‘관계를 몇 번 따라가면’ 답이 나오는 것 같은데, SQL로는 자신이 없습니다.”',
        reqs: [
          { id: 'R1', title: '함께 구매', desc: '같은 주문에 담긴 다른 상품을 2홉으로 찾기' },
          { id: 'R2', title: '반품 연쇄', desc: '반품 → 상품 → 공급사로 원인 후보 좁히기' },
          { id: 'R3', title: '경로', desc: '두 엔티티가 몇 홉으로 이어지는지' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '함께 구매한 상품 (2홉)',
          lead: '패턴 하나로 “이 상품을 산 주문에서, 다른 상품”을 찾습니다. SQL이라면 self-join + group by입니다.',
        },
        prose(
          `패턴 <code>(p)&lt;-[:CONTAINS]-(o)-[:CONTAINS]-&gt;(other)</code>는 중간에 주문 노드를 두고 반대편 상품을 찾습니다.
          <code>WHERE other &lt;&gt; p</code>로 자기 자신을 제외하고, <strong>같은 주문 수</strong>를 세어 정렬합니다.`
        ),
        stepPanel(ctx, {
          no: '1',
          title: '함께 구매한 상품',
          code: `MATCH (p:Product {name: '무선 이어폰'})
      <-[:CONTAINS]-(o:Order)-[:CONTAINS]->(other:Product)
WHERE other <> p
RETURN other.name AS product, count(*) AS together
ORDER BY together DESC;`,
          desc: '무선 이어폰과 함께 주문된 상품 3종이 나와야 합니다.',
          validate: (res) => ({
            ok: res.rows.length === 3,
            message: `3종이 나와야 합니다. 현재 ${res.rows.length}종. WHERE 조건을 확인하세요.`,
          }),
        }),
        callout(
          'engineer',
          'SQL로 같은 것을 하면',
          '주문상품 테이블을 두 번 조인하고(<code>oi1.order_id = oi2.order_id</code>) 자기 상품을 제외한 뒤 GROUP BY 합니다. 1홉은 가능합니다. 하지만 “그 상품을 산 고객이 다시 산 상품”은 조인이 하나 더 늘고, 성능은 급격히 나빠집니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '반품 연쇄 추적 (3홉)',
          lead: '반품 사유에서 시작해 공급사까지. 방향을 지키면 3홉도 패턴 한 줄입니다.',
        },
        stepPanel(ctx, {
          no: '2',
          title: '공급사 → 상품 → 주문 → 반품',
          code: `MATCH (s:Supplier {id: 's2'})
      <-[:SUPPLIED_BY]-(p:Product)
      <-[:CONTAINS]-(o:Order)
      -[:HAS_RETURN]->(r:Return)
RETURN p.name AS product, o.id AS orderId, r.reason AS reason
ORDER BY orderId;`,
          desc: '대성테크(s2) 공급 상품에서 발생한 반품만 추려냅니다. 2건이 나와야 합니다.',
          validate: (res) => ({
            ok: res.rows.length === 2,
            message: `2건이 나와야 합니다. 현재 ${res.rows.length}건. 관계 방향을 확인하세요.`,
          }),
        }),
        stepPanel(ctx, {
          no: '3',
          title: '반품 → 상품 → 공급사',
          code: `MATCH (r:Return)-[:FOR_PRODUCT]->(p:Product)
      -[:SUPPLIED_BY]->(s:Supplier)
RETURN r.reason AS reason, p.name AS product, s.name AS supplier, s.riskScore AS risk
ORDER BY risk DESC;`,
          desc: '반품 사유별로 어떤 공급사의 어떤 상품인지 한 번에 봅니다. 리스크 점수가 높은 공급사가 상단에 옵니다.',
          validate: (res) => ({
            ok: res.rows.length === 5,
            message: `반품 5건이 모두 나와야 합니다. 현재 ${res.rows.length}건.`,
          }),
        })
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '최단 경로',
          lead: '두 엔티티가 “몇 홉으로 이어지는가”는 추천·이상탐지·영향도 분석의 기본 질문입니다.',
        },
        h(
          'div',
          { class: 'stack stack--sm' },
          h('div', { class: 'row' }, pathBtn, h('span', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, '박서연(c3) → 대성테크(s2)')),
          pathInfo
        ),
        pg.el,
        pathResult,
        codeBlock({
          lang: 'cypher',
          title: 'Neo4j에서의 최단 경로',
          code: `MATCH p = shortestPath(
  (c:Customer {id: 'c3'})-[*]-(s:Supplier {id: 's2'})
)
RETURN p, length(p) AS hops
LIMIT 1;`,
          note: '이 브라우저 엔진은 경로 변수(<code>p = ...</code>)를 지원하지 않으므로, 위 데모는 <strong>JS BFS</strong>로 같은 결과를 계산했습니다. 실제 Neo4j에서는 <code>shortestPath</code>가 있습니다.',
        }),
        statsBlock([
          { label: '고객 → 주문', value: '1', unit: '홉', note: 'PLACED' },
          { label: '주문 → 상품', value: '1', unit: '홉', note: 'CONTAINS' },
          { label: '상품 → 공급사', value: '1', unit: '홉', note: 'SUPPLIED_BY' },
          { label: '최단 경로 예상', value: '3', unit: '홉', accent: true, note: '고객이 공급사 상품을 샀다면' },
        ])
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '가변 길이와 함정',
          lead: '<code>-[:CONTAINS*1..3]-</code>는 편리하지만, 상한을 정하지 않으면 <strong>결과가 폭발</strong>합니다.',
        },
        stepPanel(ctx, {
          no: '4',
          title: '가변 길이로 넓게 훑기',
          code: `MATCH (a:Customer)-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
      <-[:CONTAINS]-(:Order)<-[:PLACED]-(b:Customer)
WHERE a <> b
RETURN a.name AS buyer, b.name AS alsoBuyer, p.name AS product
LIMIT 8;`,
          desc: '같은 상품을 산 다른 고객을 찾습니다. LIMIT 8로 결과를 잘라 냅니다.',
          validate: (res) => ({
            ok: res.rows.length === 8,
            message: 'LIMIT 8이면 8행이 나와야 합니다(결과가 8행 이상일 때).',
          }),
        }),
        callout(
          'warn',
          '무제한 가변 길이는 사고의 시작',
          '<code>-[:관계*]-</code>처럼 상한을 생략하면 이론상 무한 탐색입니다. 실제 Neo4j도 기본 상한이 있지만, <strong>항상 <code>*1..3</code>처럼 상한을 쓰세요.</strong> ' +
            '그리고 시작 노드에 라벨/인덱스를 걸어 탐색 범위를 좁혀야 합니다. 슈퍼노드(팬아웃 큰 노드)가 경로에 끼면 비용이 급증합니다 — <a href="#/lab/performance">Lab 7</a>에서 다룹니다.'
        ),
        tableBlock({
          head: ['패턴', '의미', '주의'],
          rows: [
            ['-[:TYPE]->', '정방향 1홉', '가장 빠름'],
            ['<-[:TYPE]-', '역방향 1홉', '방향이 곧 인덱스'],
            ['-[:TYPE]-', '방향 무시 1홉', '양쪽 모두 탐색'],
            ['-[:TYPE*1..3]->', '1~3홉', '상한 필수'],
            ['-[:TYPE*2..]->', '2홉 이상', '이 엔진은 최대 6홉으로 제한합니다'],
          ],
          compact: true,
        })
      )
    );

    el.append(
      section(
        { num: '5', title: '실제 Neo4j에서 실행하기' },
        mockNotice(),
        neo4jBlock({
          steps: [
            {
              title: '동일 쿼리 (Neo4j 5)',
              code: `MATCH (p:Product {name: '무선 이어폰'})
      <-[:CONTAINS]-(o:Order)-[:CONTAINS]->(other:Product)
WHERE other <> p
RETURN other.name AS product, count(*) AS together
ORDER BY together DESC
LIMIT 10;`,
              lang: 'cypher',
            },
            {
              title: '경로 길이 확인',
              code: `MATCH p = (c:Customer {id: 'c3'})-[*1..4]-(s:Supplier {id: 's2'})
RETURN p, length(p) AS hops
ORDER BY hops ASC
LIMIT 1;`,
              lang: 'cypher',
            },
          ],
          note: '실제 Neo4j에서는 결과 경로를 Browser가 그림으로 표시합니다. 경로가 길어지면 <code>LIMIT 1</code>과 <code>ORDER BY length(p)</code>로 좁히세요.',
        })
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/multi-hop',
          questions: [
            {
              q: '“함께 구매한 상품”을 찾는 패턴으로 가장 정확한 것은?',
              options: [
                '(p:Product)-[:CONTAINS]->(o:Order)-[:CONTAINS]->(x:Product)',
                '(p:Product)<-[:CONTAINS]-(o:Order)-[:CONTAINS]->(x:Product)',
                '(p:Product)-[:PLACED]->(o:Order)',
              ],
              answer: 1,
              explain: '주문은 상품을 포함합니다(CONTAINS). 상품에서 주문으로 갈 때는 역방향(<-)이어야 합니다.',
            },
            {
              q: '가변 길이 관계에서 반드시 지켜야 할 것은?',
              options: ['상한(*)을 두지 않는다', '상한(*1..3)을 둔다', '항상 *를 쓴다'],
              answer: 1,
              explain: '상한이 없으면 탐색 폭이 급증합니다. 시작 노드 라벨·인덱스도 함께 필요합니다.',
            },
            {
              q: '최단 경로를 구할 때 가장 적합한 도구는?',
              options: ['가중치 없는 그래프면 BFS, 가중치가 있으면 다익스트라', '항상 PageRank', '항상 Louvain'],
              answer: 0,
              explain: '가중치가 없으면 BFS가 최단, 가중치(비용)가 있으면 다익스트라가 맞습니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '<a href="#/lab/algorithms">Lab 4 — 알고리즘 실전</a>에서 PageRank와 커뮤니티 탐지를 돌려 봅니다.'));

    return { destroy() {} };
  },
};
