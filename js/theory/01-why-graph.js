/**
 * 이론 01 — 왜 그래프인가
 */
import { h } from '../core/dom.js';
import {
  pageHead,
  section,
  prose,
  callout,
  codeBlock,
  tableBlock,
  graphCard,
  chartCard,
  quizBlock,
  compareBlock,
  statsBlock,
  badge,
} from '../ui/blocks.js';
import { traversalCost } from '../engine/algorithms.js';

const SMALL_GRAPH = {
  nodes: [
    { id: 'c1', labels: ['Customer'], props: { name: '김하늘' } },
    { id: 'c2', labels: ['Customer'], props: { name: '이도윤' } },
    { id: 'c3', labels: ['Customer'], props: { name: '박서연' } },
    { id: 'o1', labels: ['Order'], props: { name: 'O-1001', amount: 89000 } },
    { id: 'o2', labels: ['Order'], props: { name: 'O-1002', amount: 53000 } },
    { id: 'o3', labels: ['Order'], props: { name: 'O-1003', amount: 21000 } },
    { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰' } },
    { id: 'p2', labels: ['Product'], props: { name: '보조 배터리' } },
    { id: 'p3', labels: ['Product'], props: { name: '노트북 파우치' } },
    { id: 's1', labels: ['Supplier'], props: { name: '한빛전자' } },
  ],
  edges: [
    { id: 'e1', type: 'PLACED', from: 'c1', to: 'o1' },
    { id: 'e2', type: 'PLACED', from: 'c2', to: 'o2' },
    { id: 'e3', type: 'PLACED', from: 'c3', to: 'o3' },
    { id: 'e4', type: 'CONTAINS', from: 'o1', to: 'p1' },
    { id: 'e5', type: 'CONTAINS', from: 'o1', to: 'p2' },
    { id: 'e6', type: 'CONTAINS', from: 'o2', to: 'p1' },
    { id: 'e7', type: 'CONTAINS', from: 'o3', to: 'p3' },
    { id: 'e8', type: 'SUPPLIED_BY', from: 'p1', to: 's1' },
    { id: 'e9', type: 'SUPPLIED_BY', from: 'p3', to: 's1' },
  ],
};

const ADJ = new Map();
for (const e of SMALL_GRAPH.edges) {
  if (!ADJ.has(e.from)) ADJ.set(e.from, []);
  if (!ADJ.has(e.to)) ADJ.set(e.to, []);
  ADJ.get(e.from).push(e.to);
  ADJ.get(e.to).push(e.from);
}

function bfsLayers(start, hops) {
  const visited = new Set([start]);
  let frontier = [start];
  const layers = [frontier];
  for (let i = 0; i < hops; i++) {
    const next = [];
    for (const id of frontier) {
      for (const nb of ADJ.get(id) || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
    layers.push(frontier);
    if (!next.length) break;
  }
  return { visited: [...visited], frontier };
}

function costDemo(ctx) {
  const state = { hops: 2 };
  const joinEl = h('b', { style: { color: 'var(--danger-500)' } }, '');
  const hopEl = h('b', { style: { color: 'var(--ok-500)' } }, '');
  const ratioEl = h('b', { style: { color: 'var(--accent)' } }, '');
  const joinBar = h('i');
  const hopBar = h('i');
  const depthLabel = h('output', {}, '');

  const input = h('input', {
    type: 'range',
    min: '1',
    max: '4',
    step: '1',
    value: '2',
    'aria-label': '탐색 깊이',
    onInput: (e) => {
      state.hops = Number(e.target.value);
      render();
    },
  });

  const g = graphCard(ctx, {
    title: '탐색 반경을 직접 바꿔 보세요',
    subtitle: '시작 노드는 <strong>무선 이어폰(p1)</strong>입니다. 깊이를 늘리면 “연결된 것”의 범위가 어떻게 넓어지는지 보세요.',
    data: SMALL_GRAPH,
    height: 340,
    seed: 5,
  });

  let view = null;
  g.ready.then((v) => {
    view = v;
    render();
  });

  function render() {
    const hops = state.hops;
    const cost = traversalCost(hops, { rows: 100000, fanout: 6 });
    depthLabel.textContent = `${hops}홉`;
    joinEl.textContent = `${cost.joinOps.toLocaleString('ko-KR')}회`;
    hopEl.textContent = `${cost.traversalOps.toLocaleString('ko-KR')}회`;
    ratioEl.textContent = `${Math.round(cost.ratio).toLocaleString('ko-KR')}배`;
    joinBar.style.width = '100%';
    hopBar.style.width = `${Math.max(2, Math.min(100, (cost.traversalOps / cost.joinOps) * 100))}%`;

    if (view) {
      const { visited, frontier } = bfsLayers('p1', hops);
      view.paint({ visited, frontier });
    }
  }

  const el = h(
    'div',
    { class: 'stack' },
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card__head' },
        h(
          'div',
          { class: 'card__head-text' },
          h('div', { class: 'card__title' }, '같은 질문, 다른 비용'),
          h('div', { class: 'card__sub' }, '행 10만 건 · 평균 팬아웃 6 기준의 교육용 근사치입니다.')
        )
      ),
      h(
        'div',
        { class: 'card__body' },
        h(
          'div',
          { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px' } },
          h('label', { style: { fontSize: 'var(--fs-sm)', fontWeight: '600' } }, '탐색 깊이'),
          depthLabel
        ),
        input,
        h(
          'div',
          { class: 'stats', style: { marginTop: '16px' } },
          h(
            'div',
            { class: 'stat' },
            h('div', { class: 'stat__label' }, 'RDB 조인 기반 추정 연산'),
            h('div', { class: 'stat__value' }, joinEl),
            h('div', { class: 'meter', style: { marginTop: '8px' } }, joinBar),
            h('div', { class: 'stat__note' }, '중간 결과가 다시 스캔·조인됩니다')
          ),
          h(
            'div',
            { class: 'stat stat--accent' },
            h('div', { class: 'stat__label' }, '그래프 포인터 홉'),
            h('div', { class: 'stat__value' }, hopEl),
            h('div', { class: 'meter', style: { marginTop: '8px' } }, hopBar),
            h('div', { class: 'stat__note' }, '시작점에서 인접 리스트를 따라갑니다')
          ),
          h(
            'div',
            { class: 'stat' },
            h('div', { class: 'stat__label' }, '비용 차이'),
            h('div', { class: 'stat__value' }, ratioEl),
            h('div', { class: 'stat__note' }, '깊이가 늘수록 벌어집니다')
          )
        )
      ),
      h(
        'div',
        { class: 'card__foot' },
        '이 숫자는 실측이 아니라 “왜 깊어질수록 불리해지는가”를 보여주기 위한 모델입니다. 실제 성능은 인덱스·카디널리티·통계 정보에 따라 크게 달라집니다.'
      )
    ),
    g.el
  );
  return el;
}

export default {
  id: 'theory/why-graph',
  title: '왜 그래프인가',
  kicker: 'CHAPTER 01 · WHY GRAPH',
  summary: 'SQL이 잘하는 일과 그래프가 잘하는 일은 다릅니다. 같은 질문을 두 엔진에 던졌을 때 비용이 갈라지는 지점을 확인합니다.',
  minutes: 12,
  tags: ['JOIN', '재귀 CTE', '탐색'],
  render(ctx) {
    const { el } = ctx;
    el.append(
      pageHead({
        kicker: 'CHAPTER 01 · WHY GRAPH',
        title: '왜 그래프인가',
        summary:
          '관계형 DB는 <strong>집합</strong>을 잘 다루고, 그래프는 <strong>경로</strong>를 잘 다룹니다. 이 차이는 취향이 아니라 실행 비용의 구조 차이입니다.',
        minutes: 12,
        tags: ['JOIN', '재귀 CTE', 'index-free adjacency'],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '같은 질문을 두 번 던져 보기',
          lead: '“무선 이어폰을 산 고객이 함께 산 상품은?” — RDB에서도 답할 수 있습니다. 문제는 <strong>깊이가 늘어날 때</strong>입니다.',
        },
        prose(
          `RDB에서 관계는 <strong>테이블 사이의 약속(FK)</strong>이고, 실제 연결은 실행 시점의 <strong>조인</strong>으로 만듭니다.
          조인은 “양쪽 집합을 맞춰 보는” 연산이라, 중간 결과가 커질수록 다음 조인의 입력도 커집니다.
          반면 그래프 DB에서 관계는 <strong>저장된 포인터</strong>입니다. 노드에서 이웃으로 가는 데 인덱스 탐색이 필요 없습니다.`
        ),
        costDemo(ctx)
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: 'RDB가 관계를 꺼내는 방법 — 재귀 CTE',
          lead: '2홉까지는 그럭저럭. 3홉부터 쿼리가 길어지고, 실행 계획이 무서워집니다.',
        },
        codeBlock({
          lang: 'sql',
          title: '함께 구매한 상품 (2홉, PostgreSQL)',
          code: `WITH target_orders AS (
  SELECT oi.order_id
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.name = '무선 이어폰'
),
together AS (
  SELECT oi.product_id, COUNT(DISTINCT t.order_id) AS co_orders
  FROM target_orders t
  JOIN order_items oi ON oi.order_id = t.order_id
  JOIN products p2   ON p2.id = oi.product_id
  WHERE p2.name <> '무선 이어폰'
  GROUP BY oi.product_id
)
SELECT p.name, t.co_orders
FROM together t
JOIN products p ON p.id = t.product_id
ORDER BY co_orders DESC
LIMIT 5;`,
        }),
        prose(
          `여기까지는 <strong>자기 참조 조인 한 번</strong>입니다. 그런데 “그 상품을 산 고객이 다시 산 상품”까지 가면 CTE가 하나 더 붙고,
          “3홉 이내”처럼 <strong>깊이가 가변</strong>이면 <code>RECURSIVE</code>로 바뀌면서 중간 결과가 걷잡을 수 없이 커집니다.`
        ),
        callout(
          'engineer',
          'DB 엔지니어가 실제로 겪는 일',
          '개발자가 “3홉 이내 관계를 조회하는 API”를 요청합니다. CTE로 짜고, 실행 계획에서 <strong>Nested Loop + 대량 정렬</strong>을 발견하고, 파티셔닝과 캐시를 검토하다가 결국 <strong>비정규화된 요약 테이블</strong>을 만듭니다. 그 순간부터 “요약 테이블을 최신으로 유지하는 파이프라인”이 새로운 부채가 됩니다.'
        ),
        toCostChart(ctx)
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '그래프가 관계를 꺼내는 방법 — 포인터 한 번',
          lead: '관계는 이미 존재하는 <strong>주소</strong>입니다. 조인은 없고, “따라가기”만 있습니다.',
        },
        prose(
          `Neo4j식 저장소는 노드 레코드에 <strong>관계 ID 목록</strong>을 들고 있습니다. 어떤 관계인지는 관계 레코드가,
          그 관계의 반대편 노드는 관계 레코드의 양 끝 포인터가 들고 있습니다. 그래서 이웃 탐색은
          <code>O(1)</code> 포인터 추적이고, 전체 인덱스 탐색이 필요 없습니다. 이것을 <strong>index-free adjacency</strong>라 부릅니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '함께 구매한 상품 (2홉, Cypher)',
          code: `MATCH (p:Product {name: '무선 이어폰'})<-[:CONTAINS]-(o:Order)
      -[:CONTAINS]->(other:Product)
WHERE other <> p
RETURN other.name AS product,
       count(DISTINCT o) AS co_orders
ORDER BY co_orders DESC
LIMIT 5;`,
        }),
        prose(
          `패턴이 곧 질문이고, <strong>홉 수를 늘려도 쿼리 모양은 그대로</strong>입니다. 깊이는 <code>-[:CONTAINS*1..4]-</code>처럼 표기만 바뀝니다.
          이 “질문 모양이 유지된다”는 성질이 그래프 DB를 배우는 가장 큰 실익입니다.`
        ),
        compareBlock([
          {
            title: 'RDB — 집합 연산',
            tone: 'a',
            items: [
              '관계는 조인으로 계산 (실행 시점 결합)',
              '깊이 증가 → 조인 수 증가 → 중간 결과 폭발 위험',
              '집계·정렬·제약·트랜잭션은 성숙하고 강력',
              '임의 컬럼 스캔, 리포팅에 최적',
            ],
          },
          {
            title: '그래프 — 경로 탐색',
            tone: 'b',
            items: [
              '관계는 저장된 포인터 (index-free adjacency)',
              '깊이 증가 → 홉 수만 선형 증가',
              '경로 패턴, 다중 홉, 추천, 사기탐지에 최적',
              '대량 전체 집계/스캔은 RDB·컬럼형보다 불리',
            ],
          },
        ])
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '그래서 언제 쓰나 — 판단 기준',
          lead: '“그래프가 최신이라서”가 아니라, <strong>질문이 경로 모양인지</strong>로 판단합니다.',
        },
        tableBlock({
          head: ['질문의 모양', 'RDB', '그래프', '판단'],
          rows: [
            ['“A와 B가 몇 홉 이내로 연결되나?”', '재귀 CTE, 깊이 제한 필요', '가변 길이 패턴 한 줄', '그래프'],
            ['“이 고객이 산 상품 중 3종 이상 함께 산 것”', '다중 self-join', '2홉 + having', '그래프'],
            ['“월별 매출 상위 10개 상품”', '집계에 최적', '가능하지만 불리', 'RDB'],
            ['“A 상품을 중심으로 클러스터는 어떻게 나뉘나?”', '사실상 불가', 'Louvain / 커뮤니티', '그래프'],
            ['“재고 10개 미만 상품만 갱신”', 'UPDATE 최적', '가능하지만 트랜잭션 단순성 손해', 'RDB'],
            ['“공급사 리스크가 3홉 내 주문에 전파되나?”', 'CTE 중첩 + UNION', '방향 패턴 + 집계', '그래프'],
          ],
          compact: true,
        }),
        callout(
          'insight',
          '실무의 정답은 대체로 하이브리드',
          '운영 트랜잭션과 리포팅은 RDB에 그대로 두고, <strong>관계 탐색이 필요한 기능만</strong> 그래프로 옮기는 패턴(사이드카)이 흔합니다. 두 저장소를 동기화하는 파이프라인의 신뢰성이 성패를 가릅니다 — 이 주제는 <a href="#/theory/operations">9장 운영</a>에서 다룹니다.'
        )
      )
    );

    el.append(
      section(
        { num: '5', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/why-graph',
          questions: [
            {
              q: '“3홉 이내 연결을 찾는 질문”이 RDB에서 특히 비싸지는 구조적 이유는?',
              options: [
                'RDB에는 인덱스를 만들 수 없어서',
                '조인은 실행 시점 결합이라 깊이가 늘면 중간 결과와 조인 횟수가 함께 늘어서',
                'RDB는 재귀 질의를 지원하지 않아서',
              ],
              answer: 1,
              explain: 'RECURSIVE CTE로 표현은 가능하지만, 홉마다 중간 결과가 다시 조인 입력이 되므로 비용이 급격히 늘어납니다.',
            },
            {
              q: 'index-free adjacency의 의미로 가장 정확한 것은?',
              options: [
                '인덱스가 없어서 조회가 빠르다',
                '이웃으로 가는 포인터가 저장되어 있어 인덱스 탐색 없이 관계를 따라갈 수 있다',
                '인접 행렬을 메모리에 올려 계산한다',
              ],
              answer: 1,
              explain: '노드 레코드가 관계 목록을 들고 있고, 관계 레코드가 상대 노드를 가리킵니다. 그래서 이웃 탐색이 포인터 추적이 됩니다.',
            },
            {
              q: '그래프 DB가 RDB보다 항상 좋은 것은 아닙니다. 어떤 작업이 특히 불리한가요?',
              options: [
                '2홉 이내 추천',
                '사기 연쇄 추적',
                '전체 행에 대한 대량 집계·스캔과 복잡한 트랜잭션 배치',
              ],
              answer: 2,
              explain: '그래프는 국소 탐색에 강합니다. 전수 집계·대량 스캔·리포팅은 RDB나 컬럼형 저장소가 유리합니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>관계를 저장하면 조인을 계산하지 않아도 됩니다.</strong> 대신 관계를 저장하고 관리하는 비용이 생깁니다. 그 교환비가 유리한 질문이 무엇인지 판단하는 것이 이 장의 목적입니다.'
      )
    );

    return { destroy() {} };
  },
};

/** 깊이별 조인 비용 vs 홉 비용 차트 */
function toCostChart(ctx) {
  const depths = [1, 2, 3, 4, 5, 6];
  const rows = depths.map((d) => traversalCost(d, { rows: 100000, fanout: 6 }));
  const joinSeries = rows.map((r) => Math.round(r.joinOps));
  const hopSeries = rows.map((r) => r.traversalOps);
  const { el } = chartCard(ctx, {
    title: '깊이에 따른 연산량 (로그 스케일)',
    subtitle: '조인 기반 추정은 곱셈으로, 그래프 탐색은 덧셈으로 증가합니다.',
    height: 320,
    foot: '교육용 근사 모델입니다. 실제 옵티마이저는 통계 정보·인덱스·조인 순서에 따라 다른 계획을 선택합니다.',
    option: (t) => ({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: t.font, color: t.ink2 },
      grid: { left: 10, right: 18, top: 40, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: t.dark ? '#131a2a' : '#fff',
        borderColor: t.dark ? '#26314a' : '#e3e6ef',
        textStyle: { color: t.ink, fontSize: 12 },
      },
      legend: { top: 0, textStyle: { color: t.ink3, fontSize: 11 } },
      xAxis: {
        type: 'category',
        name: '탐색 깊이(홉)',
        nameTextStyle: { color: t.ink4, fontSize: 11 },
        data: depths.map((d) => `${d}홉`),
        axisLine: { lineStyle: { color: t.axis } },
        axisLabel: { color: t.ink3 },
      },
      yAxis: {
        type: 'log',
        name: '추정 연산량',
        nameTextStyle: { color: t.ink4, fontSize: 11 },
        splitLine: { lineStyle: { color: t.grid } },
        axisLabel: { color: t.ink3, formatter: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1000 ? `${v / 1000}K` : v) },
      },
      series: [
        {
          name: 'RDB 조인 기반',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: joinSeries,
          lineStyle: { width: 2.4, color: t.danger },
          itemStyle: { color: t.danger },
          areaStyle: { color: 'rgba(220,38,38,0.08)' },
        },
        {
          name: '그래프 홉',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: hopSeries,
          lineStyle: { width: 2.4, color: t.ok },
          itemStyle: { color: t.ok },
        },
      ],
      animationDuration: 600,
    }),
  });
  return el;
}
