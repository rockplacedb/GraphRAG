/**
 * Lab 2 — Cypher 기초 (브라우저 실행)
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
  stepsBlock,
  runPanel,
  badge,
} from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';
import { seedGraphStore, SEED_META } from '../data/modumall.seed.js';
import { toast } from '../core/toast.js';

function stepCard(ctx, { no, title, desc, code, validate, onSuccess, hint }) {
  const panel = runPanel(ctx, {
    title: `${no}. ${title}`,
    code,
    validate,
    hint: hint || 'Ctrl(⌘)+Enter 실행',
    onSuccess: (res) => {
      toast(`${no}단계 통과!`, 'ok');
      ctx.progress?.setStep('lab/cypher-basics', Number(no.replace(/\D/g, '')) || 1);
      onSuccess?.(res);
    },
  });
  return h(
    'div',
    { class: 'stack stack--sm' },
    h(
      'div',
      { class: 'row' },
      badge(no, 'accent'),
      h('strong', { style: { fontSize: 'var(--fs-sm)' } }, title)
    ),
    desc ? h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', margin: '0', lineHeight: '1.7' }, html: desc }) : null,
    panel.el
  );
}

export default {
  id: 'lab/cypher-basics',
  title: 'Cypher 기초',
  kicker: 'LAB 2',
  summary: '브라우저에서 직접 실행하며 MATCH·WHERE·RETURN·CREATE·MERGE·집계를 익힙니다.',
  minutes: 25,
  tags: ['Cypher', 'MATCH', 'MERGE'],
  render(ctx) {
    const { el } = ctx;
    let store = seedGraphStore();
    ctx.store = store;

    const graphHost = h('div');
    let view = null;

    function refreshGraph() {
      if (view) view.setData(store.toVis(), { fit: true });
    }

    el.append(
      ...labHead({
        num: 'LAB 2',
        kicker: 'CYPHER',
        title: 'Cypher 기초 — 손으로 익히기',
        summary:
          '패턴을 그림처럼 읽는 감각이 핵심입니다. <strong>실행 버튼</strong>을 누르면 결과가 표와 그래프로 즉시 나타납니다.',
        minutes: 25,
        tags: ['MATCH', 'WHERE', 'CREATE', 'MERGE', '집계'],
        scenarioTitle: '“그래프는 이제 있는데, 쿼리를 모르겠습니다”',
        quote:
          '“SQL은 자신 있는데 Cypher는 처음입니다. <strong>SELECT가 RETURN이고, FROM이 MATCH</strong>라는 것까지만 들었습니다. 나머지는 직접 쳐 보며 익히고 싶습니다.”',
        reqs: [
          { id: 'SEED', title: '시드 데이터', desc: `노드 ${SEED_META.nodes}개 · 관계 ${SEED_META.edges}개가 메모리에 적재됩니다` },
          { id: 'LIVE', title: '즉시 반영', desc: 'CREATE/MERGE 결과가 아래 그래프에 바로 나타납니다' },
        ],
      })
    );

    /* ---------- 현재 그래프 ---------- */
    const g = graphCard(ctx, {
      title: '현재 그래프 (실시간)',
      subtitle: '쿼리를 실행할 때마다 데이터가 바뀌면 이 그래프도 갱신됩니다.',
      data: store.toVis(),
      height: 380,
      seed: 9,
      tools: [
        h(
          'button',
          {
            class: 'gbtn',
            type: 'button',
            onClick: () => {
              store = seedGraphStore();
              ctx.store = store;
              refreshGraph();
              toast('시드 데이터로 초기화했습니다', 'ok');
            },
          },
          '시드로 초기화'
        ),
      ],
    });
    g.ready.then((v) => {
      view = v;
      refreshGraph();
    });
    graphHost.append(g.el);

    el.append(
      section(
        {
          num: '1',
          title: '읽기 — MATCH · RETURN · WHERE',
          lead: '<strong>MATCH는 패턴</strong>, <strong>RETURN은 프로젝션</strong>입니다. 노드 패턴을 그림처럼 읽으세요.',
        },
        prose(
          `Cypher의 <code>MATCH (c:Customer)</code>는 “Customer 라벨을 가진 노드”를 의미합니다. 관계가 붙은 패턴 <code>(-[:PLACED]->)</code>은
          <strong>화살표 방향까지</strong> 의미가 있습니다. 첫 쿼리를 실행해 보세요.`
        ),
        graphHost,
        stepCard(ctx, {
          no: '1단계',
          title: '가장 단순한 조회',
          code: `MATCH (c:Customer)
RETURN c.name AS name, c.grade AS grade
LIMIT 5;`,
          desc: '노드 하나만 매칭하고 속성 두 개를 프로젝션합니다. SQL의 <code>SELECT name, grade FROM customers LIMIT 5</code>와 같습니다.',
          validate: (res) => ({
            ok: res.rows.length === 5,
            message: `5행이 나와야 합니다. 현재 ${res.rows.length}행. RETURN 문을 확인하세요.`,
          }),
        }),
        stepCard(ctx, {
          no: '2단계',
          title: 'WHERE로 필터링',
          code: `MATCH (p:Product)
WHERE p.price >= 100000
RETURN p.name AS name, p.price AS price
ORDER BY price DESC;`,
          desc: '문자열 연산(<code>CONTAINS</code>, <code>STARTS WITH</code>)도 WHERE에서 그대로 쓸 수 있습니다.',
          validate: (res) => ({
            ok: res.rows.length === 5 && res.rows[0].price >= res.rows[res.rows.length - 1].price,
            message: '10만 원 이상 상품은 5개이고, 가격 내림차순이어야 합니다.',
          }),
        }),
        stepCard(ctx, {
          no: '3단계',
          title: '관계 패턴',
          code: `MATCH (o:Order)-[:CONTAINS]->(p:Product)
WHERE p.name = '무선 이어폰'
RETURN o.id AS orderId, o.status AS status, o.date AS date
ORDER BY date;`,
          desc: '주문에서 상품으로 향하는 방향을 지킵니다. 방향을 뒤집으면 결과가 0행이 됩니다 — 직접 확인해 보세요.',
          validate: (res) => ({
            ok: res.rows.length === 4,
            message: `무선 이어폰을 담은 주문은 4건입니다. 현재 ${res.rows.length}건.`,
          }),
        })
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '쓰기 — CREATE · MERGE · SET',
          lead: '적재는 거의 항상 <strong>MERGE</strong>로 합니다. CREATE는 재실행하면 중복이 생깁니다.',
        },
        callout(
          'warn',
          'CREATE를 적재에 쓰지 않는 이유',
          '<code>CREATE</code>는 무조건 새로 만듭니다. 파이프라인을 두 번 돌리면 노드가 두 배가 됩니다. 적재의 기본은 <code>MERGE</code> + <strong>유니크 제약</strong>입니다.'
        ),
        stepCard(ctx, {
          no: '4단계',
          title: '노드 생성',
          code: `CREATE (s:Supplier {
  id: 's5',
  name: '새빛테크',
  country: '한국',
  riskScore: 0.2,
  leadDays: 9
})
RETURN s.name AS name, labels(s) AS labels;`,
          desc: '새 공급사를 추가합니다. 실행 후 위 그래프에 노드가 하나 늘어납니다.',
          validate: (res, s) => ({
            ok: s.nodesByLabel('Supplier').length === 5,
            message: `Supplier 노드가 5개가 되어야 합니다. 현재 ${s.nodesByLabel('Supplier').length}개.`,
          }),
          onSuccess: () => refreshGraph(),
        }),
        stepCard(ctx, {
          no: '5단계',
          title: 'MERGE로 멱등 적재',
          code: `MERGE (p:Product {id: 'p15'})
SET p.name = 'USB 허브', p.price = 27000, p.stock = 60
RETURN p.name AS name, p.price AS price;`,
          desc: '여러 번 실행해도 상품은 하나만 생깁니다. “있으면 매칭, 없으면 생성” — RDB의 UPSERT에 해당합니다.',
          validate: (res, s) => {
            const node = s.getNode('p15');
            return {
              ok: Boolean(node) && node.props.name === 'USB 허브',
              message: 'p15 노드가 만들어지고 이름이 “USB 허브”여야 합니다. 두 번 실행해도 노드는 1개여야 합니다.',
            };
          },
          onSuccess: () => refreshGraph(),
        }),
        stepCard(ctx, {
          no: '6단계',
          title: '관계 만들기',
          code: `MATCH (s:Supplier {id: 's5'}), (p:Product {id: 'p15'})
CREATE (s)-[:SUPPLIES]->(p)
RETURN s.name AS supplier, p.name AS product;`,
          desc: '이미 존재하는 두 노드를 MATCH로 찾고, 그 사이에 관계를 만듭니다. 관계 타입은 대문자 스네이크케이스가 관례입니다.',
          validate: (res, s) => ({
            ok: Boolean(s.hasEdgeBetween('s5', 'p15', 'SUPPLIES')),
            message: 's5 → p15 SUPPLIES 관계가 있어야 합니다.',
          }),
          onSuccess: () => refreshGraph(),
        }),
        stepCard(ctx, {
          no: '7단계',
          title: 'SET으로 갱신',
          code: `MATCH (p:Product {name: 'USB 허브'})
SET p.price = 24000, p.discount = 0.1
RETURN p.name AS name, p.price AS price, p.discount AS discount;`,
          desc: '속성 하나를 갱신하거나 새 속성을 추가합니다. <code>SET p = {...}</code>는 전체 교체이므로 주의하세요.',
          validate: (res, s) => ({
            ok: s.getNode('p15')?.props.price === 24000,
            message: 'p15의 price가 24000이어야 합니다.',
          }),
          onSuccess: () => refreshGraph(),
        })
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '집계와 정렬',
          lead: '그래프에서도 <code>count</code>·<code>collect</code>·<code>ORDER BY</code>는 그대로 씁니다. 다만 “그룹 기준”은 <strong>RETURN에 쓴 비집계 항목</strong>입니다.',
        },
        stepCard(ctx, {
          no: '8단계',
          title: '상품별 주문 수',
          code: `MATCH (o:Order)-[:CONTAINS]->(p:Product)
RETURN p.name AS product, count(*) AS orders
ORDER BY orders DESC, product ASC
LIMIT 3;`,
          desc: 'SQL의 GROUP BY 없이, 집계 함수가 아닌 항목이 자동으로 그룹 키가 됩니다.',
          validate: (res) => ({
            ok: res.rows.length === 3 && Number(res.rows[0].orders) >= 2,
            message: '상위 3개 상품이 나와야 하고, 1위는 최소 2건의 주문에 포함되어야 합니다.',
          }),
        }),
        stepCard(ctx, {
          no: '9단계',
          title: '경로에 조건 걸기',
          code: `MATCH (c:Customer)-[:PLACED]->(o:Order)-[:HAS_RETURN]->(r:Return)
RETURN c.name AS customer, o.id AS orderId, r.reason AS reason
ORDER BY customer, orderId;`,
          desc: '반품이 발생한 주문의 고객과 사유를 한 번에 가져옵니다. RDB라면 orders · returns · customers 3개 테이블 조인입니다.',
          validate: (res) => ({
            ok: res.rows.length === 5,
            message: `반품 5건이 모두 나와야 합니다. 현재 ${res.rows.length}건.`,
          }),
        }),
        tableBlock({
          head: ['SQL', 'Cypher', '메모'],
          rows: [
            ['SELECT c.name FROM customers c', 'MATCH (c:Customer) RETURN c.name', 'FROM → MATCH, SELECT → RETURN'],
            ['WHERE price >= 100000', 'WHERE p.price >= 100000', '비교 연산자는 동일'],
            ['JOIN order_items ...', '-[:CONTAINS]->', '조인을 화살표로 표현'],
            ['GROUP BY + COUNT', 'count(*) + 비집계 항목', 'GROUP BY 명시 불필요'],
            ['INSERT ... ON CONFLICT', 'MERGE', 'UPSERT에 대응'],
            ['ORDER BY / LIMIT', 'ORDER BY / LIMIT', '동일'],
          ],
          compact: true,
        })
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '실제 Neo4j에서 실행하기',
          lead: '브라우저 엔진과 동일한 쿼리를 실제 DB에서 돌려 보세요.',
        },
        mockNotice(),
        neo4jBlock({
          steps: [
            {
              title: '시드 데이터 적재',
              code: `// 예시: 상품 3개와 고객 2명
MERGE (c1:Customer {id: 'c1'}) SET c1.name = '김하늘', c1.grade = 'VIP';
MERGE (c2:Customer {id: 'c2'}) SET c2.name = '이도윤', c2.grade = 'NORMAL';
MERGE (p1:Product {id: 'p1'}) SET p1.name = '무선 이어폰', p1.price = 89000;
MERGE (p2:Product {id: 'p2'}) SET p2.name = '보조 배터리', p2.price = 32000;
MERGE (o1:Order {id: 'o1001'}) SET o1.amount = 121000, o1.status = 'PAID';

MATCH (c1:Customer {id:'c1'}), (o1:Order {id:'o1001'}), (p1:Product {id:'p1'}), (p2:Product {id:'p2'})
MERGE (c1)-[:PLACED]->(o1)
MERGE (o1)-[:CONTAINS]->(p1)
MERGE (o1)-[:CONTAINS]->(p2);`,
              lang: 'cypher',
            },
            {
              title: '웹 콘솔 기록 보기',
              text: 'Neo4j Browser에서 쿼리를 실행하면 하단에 실행 시간과 행 수가 표시됩니다. PROFILE을 붙여 실행하면 연산자별 db hits를 볼 수 있습니다.',
              code: `PROFILE MATCH (o:Order)-[:CONTAINS]->(p:Product)
WHERE p.name = '무선 이어폰'
RETURN o.id;`,
              lang: 'cypher',
            },
          ],
        })
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '도전 과제',
          lead: '정답이 하나가 아닙니다. 직접 쿼리를 고쳐 실행해 보세요.',
        },
        stepsBlock([
          { title: 'VIP 고객만', desc: '<code>c.grade</code>로 필터링하고, 결제 금액 합계를 구해 보세요. <code>sum(o.amount)</code>를 씁니다.' },
          { title: '리뷰가 없는 상품', desc: '<code>MATCH (p:Product) WHERE NOT EXISTS ((r:Review)-[:REVIEWS]->(p))</code> 같은 패턴을 고민해 보세요. 이 엔진은 <code>EXISTS</code> 함수만 지원하므로 두 단계로 나누어 확인해 보세요.' },
          { title: '경로 길이', desc: '고객에서 반품까지 몇 홉인지 세어 보세요. 이 모델에서는 고객→주문→반품으로 2홉입니다.' },
        ])
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/cypher-basics',
          questions: [
            {
              q: '적재 쿼리로 가장 안전한 것은?',
              options: ['CREATE', 'MERGE + 유니크 제약', 'INSERT'],
              answer: 1,
              explain: 'MERGE는 존재 여부를 확인합니다. 유니크 제약이 동시 실행에서도 중복을 막습니다.',
            },
            {
              q: 'MATCH (o:Order)-[:CONTAINS]->(p:Product) 에서 화살표 방향을 뒤집으면?',
              options: ['같은 결과', '반대 방향 관계만 매칭되어 결과가 달라짐', '문법 오류'],
              answer: 1,
              explain: 'Cypher의 관계는 방향이 있는 패턴입니다. 방향을 무시하려면 화살표 없이 -[:CONTAINS]- 로 씁니다.',
            },
            {
              q: 'RETURN p.name, count(*) 에서 그룹 키는?',
              options: ['count(*)', 'p.name', '없음'],
              answer: 1,
              explain: '집계 함수가 아닌 항목이 그룹 키가 됩니다. GROUP BY를 명시하지 않습니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '문법을 익혔으니 <a href="#/lab/multi-hop">Lab 3 — 다중 홉 탐색</a>에서 그래프의 진짜 힘을 확인합니다.'));

    return {
      destroy() {
        view = null;
      },
    };
  },
};
