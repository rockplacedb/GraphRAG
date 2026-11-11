/**
 * 이론 05 — 쿼리 언어
 * Cypher 패턴 매칭, 가변 길이, 집계·MERGE, 실행 계획, SPARQL과 GQL.
 */
import { h } from '../core/dom.js';
import { pageHead, section, prose, callout, codeBlock, tableBlock, graphCard, chartCard, quizBlock, tabsBlock } from '../ui/blocks.js';

/* ================= 패턴 매칭 데모용 그래프 ================= */
const QUERY_GRAPH = {
  nodes: [
    { id: 'c1', labels: ['Customer'], props: { name: '김하늘' } },
    { id: 'c2', labels: ['Customer'], props: { name: '이도윤' } },
    { id: 'o1001', labels: ['Order'], props: { id: 'o1001', date: '2024-05-02' } },
    { id: 'o1004', labels: ['Order'], props: { id: 'o1004', date: '2024-05-09' } },
    { id: 'o1002', labels: ['Order'], props: { id: 'o1002', date: '2024-05-03' } },
    { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰' } },
    { id: 'p4', labels: ['Product'], props: { name: '보조 배터리' } },
    { id: 'p6', labels: ['Product'], props: { name: 'USB-C 케이블' } },
    { id: 's1', labels: ['Supplier'], props: { name: '한빛전자' } },
    { id: 's3', labels: ['Supplier'], props: { name: '파워넷' } },
  ],
  edges: [
    { id: 'k1', type: 'PLACED', from: 'c1', to: 'o1001' },
    { id: 'k2', type: 'PLACED', from: 'c1', to: 'o1004' },
    { id: 'k3', type: 'PLACED', from: 'c2', to: 'o1002' },
    { id: 'k4', type: 'CONTAINS', from: 'o1001', to: 'p1' },
    { id: 'k5', type: 'CONTAINS', from: 'o1004', to: 'p4' },
    { id: 'k6', type: 'CONTAINS', from: 'o1002', to: 'p4' },
    { id: 'k7', type: 'CONTAINS', from: 'o1002', to: 'p6' },
    { id: 'k8', type: 'SUPPLIED_BY', from: 'p1', to: 's1' },
    { id: 'k9', type: 'SUPPLIED_BY', from: 'p4', to: 's3' },
    { id: 'k10', type: 'SUPPLIED_BY', from: 'p6', to: 's3' },
  ],
};

/** 화면에 보이는 질의의 조각들 — 왼쪽에서 오른쪽으로 “적용”된다 */
const SEGMENTS = [
  "(c:Customer {name: '김하늘'})",
  '-[:PLACED]->(o:Order)',
  '-[:CONTAINS]->(p:Product)',
  '<-[:SUPPLIED_BY]-(s:Supplier)',
  "WHERE s.name = '한빛전자'",
  'RETURN c.name, count(DISTINCT p) AS products',
];

const STEPS = [
  {
    nodes: ['c1'],
    edges: [],
    rows: 1,
    op: 'NodeIndexSeek(:Customer.name)',
    note: '시작 노드를 인덱스로 찾습니다. 이 질의에서 인덱스를 쓰는 곳은 여기 한 군데뿐입니다.',
  },
  {
    nodes: ['c1', 'o1001', 'o1004'],
    edges: ['k1', 'k2'],
    rows: 2,
    op: 'Expand(All) :PLACED',
    note: '관계 타입으로 1홉 확장합니다. 노드 1개 → 행 2개로 늘어났습니다.',
  },
  {
    nodes: ['c1', 'o1001', 'o1004', 'p1', 'p4'],
    edges: ['k1', 'k2', 'k4', 'k5'],
    rows: 2,
    op: 'Expand(All) :CONTAINS',
    note: '주문마다 상품이 하나씩이라 아직 2행입니다. 상품이 여러 개인 주문이 있었다면 여기서 행이 더 늘어납니다.',
  },
  {
    nodes: ['c1', 'o1001', 'o1004', 'p1', 'p4', 's1', 's3'],
    edges: ['k1', 'k2', 'k4', 'k5', 'k8', 'k9'],
    rows: 2,
    op: 'Expand(All) :SUPPLIED_BY (역방향)',
    note: '화살표가 반대이므로 관계를 거꾸로 따라갑니다. 방향은 저장된 포인터를 어느 쪽으로 읽을지만 정합니다.',
  },
  {
    nodes: ['c1', 'o1001', 'p1', 's1'],
    edges: ['k1', 'k4', 'k8'],
    rows: 1,
    op: 'Filter',
    note: 'WHERE가 후보를 걸러냅니다. 이 단계가 마지막이 아니라면, 조건을 더 일찍 밀어 넣는 것이 최적화의 핵심입니다.',
  },
  {
    nodes: ['c1', 'o1001', 'p1', 's1'],
    edges: ['k1', 'k4', 'k8'],
    rows: 1,
    op: 'Aggregation + ProduceResults',
    note: 'count(DISTINCT p) = 1. 집계는 앞 단계의 행을 모두 소비한 뒤에야 결과를 냅니다(blocking).',
  },
];

function patternStepper(ctx) {
  const g = graphCard(ctx, {
    title: '패턴은 왼쪽에서 오른쪽으로 적용된다',
    subtitle: '아래 버튼으로 단계를 넘기면, 지금 적용 중인 패턴 조각과 결과 행이 함께 바뀝니다.',
    data: QUERY_GRAPH,
    height: 400,
    seed: 6,
    edgeLabels: true,
    legendGroups: ['Customer', 'Order', 'Product', 'Supplier'],
  });

  let view = null;
  let step = 0;

  const segStyle = { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', padding: '1px 3px', borderRadius: '3px' };
  const segEls = SEGMENTS.map((text) => h('span', { style: { ...segStyle } }, text));
  const counter = h('span', { class: 'badge badge--accent' }, `1 / ${SEGMENTS.length}`);
  const opOut = h('b', {});
  const rowsOut = h('b', {});
  const noteOut = h('div', { class: 'card__foot' }, '');
  const prev = h('button', { class: 'btn btn--sm', type: 'button' }, '◀ 이전');
  const next = h('button', { class: 'btn btn--sm', type: 'button' }, '다음 ▶');

  function setStep(i) {
    step = Math.max(0, Math.min(SEGMENTS.length - 1, i));
    const s = STEPS[step];
    segEls.forEach((elm, k) => {
      elm.style.background = k === step ? 'var(--accent-soft)' : 'transparent';
      elm.style.color = k === step ? 'var(--ink)' : k < step ? 'var(--ink-2)' : 'var(--ink-4)';
      elm.style.fontWeight = k === step ? '700' : '400';
    });
    counter.textContent = `${step + 1} / ${SEGMENTS.length}`;
    opOut.textContent = s.op;
    rowsOut.textContent = `${s.rows}행`;
    noteOut.textContent = s.note;
    prev.disabled = step === 0;
    next.disabled = step === SEGMENTS.length - 1;
    if (view) view.highlight(s.nodes, { edges: s.edges });
  }
  prev.addEventListener('click', () => setStep(step - 1));
  next.addEventListener('click', () => setStep(step + 1));
  g.ready.then((v) => {
    view = v;
    setStep(0);
  });

  const controls = h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h(
        'div',
        { class: 'card__head-text' },
        h('div', { class: 'card__title' }, '지금 적용 중인 패턴 조각'),
        h('div', { class: 'card__sub' }, 'MATCH는 “연결되어 있는지”를 선언하고, 엔진이 어디서부터 펼칠지 정합니다.')
      ),
      h('div', { class: 'card__tools' }, counter)
    ),
    h(
      'div',
      { class: 'card__body' },
      h('div', { style: { lineHeight: '1.95', marginBottom: '4px' } }, h('span', { style: { ...segStyle, color: 'var(--ink-4)' } }, 'MATCH '), ...segEls.slice(0, 4)),
      h('div', { style: { lineHeight: '1.95' } }, segEls.slice(4)),
      h(
        'div',
        { class: 'row', style: { marginTop: '14px' } },
        prev,
        next,
        h('span', { class: 'spacer' }),
        h('span', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' } }, '연산자 '),
        opOut,
        h('span', { style: { margin: '0 8px' }, class: 'muted' }, '·'),
        rowsOut
      )
    ),
    noteOut
  );

  return h('div', { class: 'stack' }, controls, g.el);
}

/* ================= 차트 — 시작점 하나가 계획을 바꾼다 ================= */
function planChart(ctx) {
  const { el } = chartCard(ctx, {
    title: 'PROFILE: 연산자별 db hits',
    subtitle: '같은 질의, 같은 결과. 시작점을 라벨 스캔으로 잡느냐 인덱스로 잡느냐만 다릅니다.',
    height: 320,
    foot: '교육용 예시입니다. 실제 db hits는 데이터 분포·캐시 상태에 따라 달라지지만, “시작점이 지배적”이라는 성질은 같습니다.',
    option: (t) => ({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: t.font, color: t.ink2 },
      grid: { left: 10, right: 18, top: 44, bottom: 10, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: t.dark ? '#131a2a' : '#fff',
        borderColor: t.dark ? '#26314a' : '#e3e6ef',
        textStyle: { color: t.ink, fontSize: 12 },
      },
      legend: { top: 0, textStyle: { color: t.ink3, fontSize: 11 } },
      xAxis: {
        type: 'category',
        data: ['시작 노드 찾기', '1홉 확장', '필터', '집계'],
        axisLine: { lineStyle: { color: t.axis } },
        axisLabel: { color: t.ink3, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'db hits',
        nameTextStyle: { color: t.ink4, fontSize: 11 },
        splitLine: { lineStyle: { color: t.grid } },
        axisLabel: { color: t.ink3, formatter: (v) => (v >= 1000 ? `${v / 1000}K` : v) },
      },
      series: [
        {
          name: '라벨 스캔 계획',
          type: 'bar',
          barWidth: '32%',
          data: [100000, 2460, 2460, 2460],
          itemStyle: { color: t.danger, borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '인덱스 계획',
          type: 'bar',
          barWidth: '32%',
          data: [3, 2460, 2460, 2460],
          itemStyle: { color: t.ok, borderRadius: [4, 4, 0, 0] },
        },
      ],
      animationDuration: 600,
    }),
  });
  return el;
}

/* ================= 페이지 ================= */
export default {
  id: 'theory/query-languages',
  title: '쿼리 언어',
  kicker: 'CHAPTER 05 · QUERY LANGUAGES',
  summary: 'Cypher는 “무엇이 연결되어 있는지”를 그리고, SPARQL은 트리플을 나열합니다. 두 언어의 실행 모델을 알면 언제 무엇을 쓸지 판단할 수 있습니다.',
  minutes: 13,
  tags: ['Cypher', 'SPARQL', 'GQL', '가변 길이', '실행 계획'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      pageHead({
        kicker: 'CHAPTER 05 · QUERY LANGUAGES',
        title: '쿼리 언어',
        summary: '패턴을 그리는 언어와 트리플을 나열하는 언어. 문법 차이보다 중요한 것은 <strong>매칭 의미론과 실행 계획</strong>입니다.',
        minutes: 13,
        tags: ['MATCH 의미론', '가변 길이', 'EXPLAIN/PROFILE', 'SPARQL', 'GQL'],
      })
    );

    /* 1 ── 패턴이 곧 질문 */
    el.append(
      section(
        { num: '1', title: '패턴이 곧 질문 — MATCH의 의미론', lead: 'Cypher의 <code>MATCH</code>는 <strong>“이 모양이 그래프에 존재하는가”</strong>를 묻습니다. SQL의 FROM처럼 순서를 정하지 않습니다.' },
        prose(
          `Cypher에서 <code>(c:Customer)-[:PLACED]-&gt;(o:Order)</code>는 “고객 c에서 주문 o로 향하는 PLACED 관계가 있다”는 선언입니다.
          엔진은 이 패턴을 만족하는 <strong>모든 바인딩</strong>을 찾습니다. 즉 결과는 “패턴에 맞는 노드·관계의 조합”이고,
          한 행이 곧 하나의 <strong>매치</strong>입니다. SQL처럼 조인 순서를 사람이 정하지 않고, 옵티마이저가
          <strong>어디서부터 펼칠지</strong>(시작점)를 고릅니다.`
        ),
        prose(
          `중요한 제약이 하나 있습니다. Cypher의 한 패턴 안에서 <strong>같은 관계는 두 번 지나갈 수 없습니다</strong>(relationship uniqueness).
          이 규칙 덕분에 무한 루프가 원천적으로 막히지만, “왕복 경로”를 찾고 싶을 때는 패턴을 나누거나
          <code>MATCH</code>를 두 번 써야 합니다. SPARQL은 이런 제약이 없어 속성 경로에서 관계를 반복할 수 있습니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '패턴 · 조건 · 반환',
          code: `// “한빛전자가 공급하는 상품을 산 고객”
MATCH (c:Customer)-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
      -[:SUPPLIED_BY]->(s:Supplier {name: '한빛전자'})
RETURN DISTINCT c.name
ORDER BY c.name;

// 조건은 WHERE로 분리할 수도, 패턴 안에 넣을 수도 있다
MATCH (c:Customer)-[:PLACED]->(o:Order)
WHERE o.status = 'RETURNED' AND o.date >= date('2024-05-01')
RETURN c.name, count(o) AS returns
ORDER BY returns DESC;`,
          note: '패턴 안의 속성 조건은 “그 속성을 가진 노드만 매칭”을 뜻합니다. WHERE와 결과는 같지만, 인덱스 사용 여부는 계획이 결정합니다.',
        }),
        callout(
          'engineer',
          'SQL과의 결정적 차이',
          `SQL의 <code>FROM a JOIN b</code>는 <strong>집합을 결합</strong>하는 연산입니다. Cypher의 <code>MATCH (a)-[:R]-&gt;(b)</code>는
          <strong>모양을 만족하는 경로를 찾는</strong> 연산입니다. 그래서 “2홉 이내”가 SQL에서는 <code>RECURSIVE</code>가 되고,
          Cypher에서는 <code>*1..2</code>로 끝납니다. 이 차이가 1장에서 본 비용 구조의 정체입니다.`
        )
      )
    );

    /* 2 ── 방향과 가변 길이 */
    el.append(
      section(
        { num: '2', title: '방향 · 가변 길이 — 패턴이 실행되는 순서', lead: '패턴은 왼쪽에서 오른쪽으로 “적용”되지만, 실제 실행 순서는 옵티마이저가 정합니다. 단계별로 확인해 보세요.' },
        patternStepper(ctx),
        prose(
          `방향은 <strong>저장된 포인터를 어느 쪽으로 읽을지</strong>를 정합니다. Neo4j는 관계를 양방향으로 저장하므로
          <code>&lt;-[:R]-</code>도 추가 비용이 없습니다. 반면 <strong>방향을 생략한</strong> <code>-[:R]-</code>은 양쪽을 모두 매칭하므로
          결과가 2배가 되고, 그 뒤 집계에서 중복을 걷어내야 합니다.`
        ),
        prose(
          `가변 길이는 <code>*1..3</code>처럼 씁니다. 깊이 상한을 반드시 두세요. <code>*</code>만 쓰면 사이클이 있는 그래프에서
          경로가 폭발합니다. “최단 경로”가 목적이라면 <code>shortestPath</code>가 탐색 공간을 줄여 줍니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '가변 길이와 최단 경로',
          code: `// 가변 길이: 1~3홉, 관계 타입 두 개를 번갈아 따라간다
MATCH path = (c:Customer {id: 'c1'})-[:PLACED|CONTAINS*1..3]->(x)
RETURN x.name AS reached, length(path) AS hops
ORDER BY hops, reached;

// 최단 경로: 양 끝을 지정하고 상한을 둔다
MATCH (a:Product {id: 'p1'}), (b:Product {id: 'p4'})
MATCH path = shortestPath((a)-[*..6]-(b))
RETURN [n IN nodes(path) | coalesce(n.name, n.id)] AS route,
       length(path) AS hops;`,
          note: '`shortestPath`는 무방향 탐색이 기본입니다. 방향을 강제하려면 패턴에 화살표를 넣으세요.',
        }),
        callout(
          'warn',
          '무방향 + 가변 길이 = 폭발',
          `<code>MATCH (a)-[*]-(b)</code>는 양방향으로 무한정 펼칩니다. 상한을 두고, 가능하면 관계 타입과 라벨을 함께 지정하세요.
          실행 계획에 <code>VarLengthExpand(All)</code>이 보이면 <strong>예상 행 수</strong>를 반드시 확인해야 합니다.`
        )
      )
    );

    /* 3 ── 집계와 MERGE */
    el.append(
      section(
        { num: '3', title: '집계 · MERGE — 파이프라인과 쓰기', lead: '<code>WITH</code>는 파이프라인의 단계이고, <code>MERGE</code>는 “있으면 매칭, 없으면 생성”입니다.' },
        prose(
          `Cypher의 집계는 <strong>암묵적 그룹화</strong>입니다. <code>RETURN c, count(*)</code>는 c로 그룹화하고,
          집계 함수가 아닌 표현식이 그룹 키가 됩니다. <code>WITH</code>를 쓰면 중간 결과에 조건을 걸거나
          정렬한 뒤 다음 단계로 넘길 수 있습니다. SQL의 <code>HAVING</code>에 해당하는 것은
          <code>WITH ... WHERE ...</code>입니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '집계 파이프라인과 MERGE',
          code: `// 고객별 구매 묶음 — WITH 이후에 그룹 조건을 건다
MATCH (c:Customer)-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
WITH c, collect(DISTINCT p.name) AS products, count(DISTINCT p) AS kinds
WHERE kinds >= 2
RETURN c.name, kinds, products
ORDER BY kinds DESC;

// MERGE: 있으면 매칭, 없으면 생성. 분기는 ON CREATE / ON MATCH
MERGE (c:Customer {id: $id})
  ON CREATE SET c.createdAt = datetime(), c.grade = 'NORMAL'
  ON MATCH  SET c.lastSeen = datetime()
RETURN c.grade;`,
          note: 'MERGE는 패턴 전체를 대상으로 동작합니다. “노드는 있고 관계만 없을 때”는 MERGE를 나눠 써야 합니다.',
        }),
        callout(
          'warn',
          'MERGE의 두 가지 함정',
          `① <strong>제약이 없으면 동시 실행에서 중복이 생깁니다.</strong> 유일성 제약을 먼저 만드세요.
          ② <strong><code>MERGE (a)-[:R]-&gt;(b)</code>는 관계 전체를 새로 만듭니다.</strong> 노드를 먼저 MERGE하고,
          그 다음 관계를 MERGE하는 식으로 쪼개야 의도대로 동작합니다.`
        )
      )
    );

    /* 4 ── 실행 계획 */
    el.append(
      section(
        { num: '4', title: '실행 계획 — EXPLAIN과 PROFILE', lead: '문법을 아는 것과 <strong>계획을 읽는 것</strong>은 다른 능력입니다. 후자가 실무 성능을 가릅니다.' },
        prose(
          `Cypher는 파싱 → 논리 계획 → <strong>비용 기반 최적화</strong> → 물리 계획 순으로 컴파일됩니다. 물리 계획은
          <code>NodeIndexSeek</code>, <code>NodeByLabelScan</code>, <code>Expand(All)</code>, <code>Expand(Into)</code>,
          <code>Filter</code>, <code>Aggregation</code>, <code>Sort</code>, <code>ProduceResults</code> 같은
          연산자의 트리입니다. <code>EXPLAIN</code>은 계획만 보여주고(실행하지 않음), <code>PROFILE</code>은 실제로 실행해
          <strong>연산자별 db hits와 행 수</strong>를 보여줍니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '계획 확인하기',
          code: `// 실행하지 않고 계획만 (예상 행 수, 추정 비용)
EXPLAIN
MATCH (c:Customer {name: '김하늘'})-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
RETURN p.name;

// 실제로 실행하고 연산자별 db hits / rows를 본다
PROFILE
MATCH (c:Customer {name: '김하늘'})-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
RETURN p.name;`,
          note: '실무 순서: PROFILE로 가장 db hits가 큰 연산자를 찾고 → 그 연산자가 왜 선택됐는지(통계·인덱스·카디널리티)를 확인합니다.',
        }),
        planChart(ctx),
        callout(
          'engineer',
          '계획을 읽는 순서',
          `① 가장 <strong>db hits가 큰</strong> 연산자를 찾습니다. ② 그 위에 <code>Expand(All)</code>이 있으면
          <strong>시작점이 너무 넓다</strong>는 신호입니다. ③ <code>Eager</code>나 <code>Sort</code>가 중간에 있으면
          메모리를 크게 쓰는 구간입니다. ④ 예상 행 수와 실제 행 수가 크게 다르면 <strong>통계가 낡았습니다</strong>.`
        )
      )
    );

    /* 5 ── SPARQL · GQL */
    el.append(
      section(
        { num: '5', title: 'SPARQL · GQL — 같은 질문, 다른 언어', lead: 'RDF 진영의 표준은 <strong>SPARQL 1.1</strong>, 그래프 질의의 ISO 표준은 <strong>GQL</strong>입니다.' },
        prose(
          `SPARQL은 <strong>트리플 패턴의 집합</strong>(BGP)을 나열하고 조인합니다. <code>?c ex:placed ?o .</code>처럼
          변수로 트리플을 쓰고, <code>FILTER</code>로 값을 걸러냅니다. 속성 경로(<code>:r+</code>, <code>:r{1,3}</code>)를
          지원하고, <code>OPTIONAL</code>·<code>UNION</code>·서브쿼리를 갖춥니다. 반면 Cypher는 노드와 관계에
          <strong>이름을 붙여</strong> 패턴을 그리고, 관계 속성을 직접 쓸 수 있습니다.`
        ),
        tabsBlock([
          {
            label: 'Cypher',
            content: codeBlock({
              lang: 'cypher',
              title: '한빛전자가 공급하는 상품을 산 고객',
              code: `MATCH (c:Customer)-[:PLACED]->(:Order)-[:CONTAINS]->(p:Product)
      -[:SUPPLIED_BY]->(s:Supplier {name: '한빛전자'})
RETURN DISTINCT c.name;`,
            }),
          },
          {
            label: 'SPARQL',
            content: codeBlock({
              lang: 'sparql',
              title: '같은 질문을 트리플 패턴으로',
              code: `PREFIX ex: <https://modumall.example/schema#>

SELECT DISTINCT ?name WHERE {
  ?c ex:placed      ?o .
  ?o ex:contains    ?p .
  ?p ex:suppliedBy  ?s .
  ?s ex:name        "한빛전자" .
  ?c ex:name        ?name .
}`,
            }),
          },
          {
            label: 'SQL',
            content: codeBlock({
              lang: 'sql',
              title: 'RDB에서 같은 질문',
              code: `SELECT DISTINCT c.name
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
JOIN suppliers s    ON s.id = p.supplier_id
WHERE s.name = '한빛전자';`,
            }),
          },
        ]),
        tableBlock({
          head: ['질문', 'Cypher', 'SQL', 'SPARQL'],
          rows: [
            ['패턴 매칭', '`MATCH (a)-[:R]->(b)`', '`JOIN ... ON`', '`?a :r ?b .`'],
            ['가변 길이', '`-[:R*1..3]->`', '`WITH RECURSIVE`', '`:r+` / `:r{1,3}`'],
            ['선택적 조인', '`OPTIONAL MATCH`', '`LEFT JOIN`', '`OPTIONAL { }`'],
            ['필터', '`WHERE`', '`WHERE`', '`FILTER`'],
            ['집계', '`count()`, `collect()`', '`COUNT`, `array_agg`', '`COUNT`, `GROUP_CONCAT`'],
            ['없으면 생성', '`MERGE`', '`INSERT ... ON CONFLICT`', '표준 질의에는 없음(`INSERT DATA`)'],
          ],
          compact: true,
          caption: '문법은 달라도 “패턴을 만족하는 바인딩을 찾는다”는 의미론은 같습니다.',
        }),
        prose(
          `GQL은 <strong>ISO/IEC 39075:2024</strong>로 제정된 그래프 질의 언어 표준입니다. Cypher의 패턴 문법을 계승했고,
          Neo4j 5.26 이후의 <strong>Cypher 25</strong>는 GQL 정렬을 시작했습니다. 한편 SQL 진영에는
          <strong>SQL/PGQ(ISO/IEC 9075-16:2023)</strong>가 있어, 표준 SQL 안에서 <code>GRAPH_TABLE</code>로
          속성 그래프 패턴을 질의할 수 있습니다. 즉 “그래프 질의”는 이제 특정 제품의 문법이 아니라 표준의 일부입니다.`
        ),
        callout(
          'insight',
          '무엇을 언제',
          `<strong>경로 중심·애플리케이션 내장</strong>이면 Cypher/GQL, <strong>RDF·온톨로지·추론·데이터 통합</strong>이면 SPARQL,
          <strong>기존 RDB에 그래프 기능을 얹는 것</strong>이면 SQL/PGQ가 자연스럽습니다. 언어 선택은 대개 <strong>데이터 모델이 이미 결정</strong>합니다.`
        )
      )
    );

    /* 6 ── 퀴즈 */
    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/query-languages',
          questions: [
            {
              q: 'Cypher에서 방향을 생략한 `-[:R]-` 패턴의 비용상 특징은?',
              options: ['방향이 없으면 매칭되지 않는다', '양쪽 방향을 모두 매칭하므로 결과가 2배가 될 수 있다', '자동으로 최단 경로가 된다'],
              answer: 1,
              explain: '양방향 매칭이므로 같은 관계가 양쪽에서 잡힙니다. 방향이 분명한 질문에는 화살표를 쓰는 편이 빠르고 정확합니다.',
            },
            {
              q: 'Cypher의 “관계 고유성(relationship uniqueness)”이 뜻하는 것은?',
              options: [
                '한 패턴 안에서 같은 관계를 두 번 지나갈 수 없다',
                '관계 타입은 그래프 전체에서 유일해야 한다',
                '한 노드는 관계를 하나만 가질 수 있다',
              ],
              answer: 0,
              explain: '이 규칙이 무한 루프를 막습니다. 왕복 경로가 필요하면 패턴을 나누거나 MATCH를 여러 번 씁니다.',
            },
            {
              q: 'PROFILE 결과에서 가장 먼저 봐야 할 것은?',
              options: ['쿼리 문자열의 길이', '연산자별 db hits와 예상/실제 행 수', '그래프의 노드 색상'],
              answer: 1,
              explain: 'db hits가 큰 연산자가 병목입니다. 예상 행 수와 실제 행 수의 차이는 통계가 낡았다는 신호입니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>쿼리 언어의 차이는 문법이 아니라 매칭 의미론과 실행 모델에서 나옵니다.</strong> 패턴이 어떻게 펼쳐지는지 알면, 같은 질문을 더 짧은 계획으로 바꿀 수 있습니다.'
      )
    );

    return { destroy() {} };
  },
};
