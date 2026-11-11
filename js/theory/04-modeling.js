/**
 * 이론 04 — 그래프 데이터 모델링
 * 정규화를 버리는 지점, 관계의 승격, 슈퍼노드, 계층과 시간.
 */
import { h } from '../core/dom.js';
import { pageHead, section, prose, callout, codeBlock, tableBlock, graphCard, chartCard, quizBlock } from '../ui/blocks.js';
import { modumallSeed } from '../data/modumall.seed.js';

/* ================= 토글 — 같은 데이터, 두 가지 모양 ================= */
const SHAPES = {
  table: {
    label: '테이블 모양',
    hops: 3,
    data: {
      nodes: [
        { id: 'c1', labels: ['Customer'], props: { name: '김하늘' } },
        { id: 'o1004', labels: ['Order'], props: { id: 'o1004', amount: 121000 } },
        { id: 'oi1', labels: ['OrderItem'], props: { id: 'oi1', qty: 1, unitPrice: 89000 } },
        { id: 'oi2', labels: ['OrderItem'], props: { id: 'oi2', qty: 1, unitPrice: 32000 } },
        { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰' } },
        { id: 'p4', labels: ['Product'], props: { name: '보조 배터리' } },
      ],
      edges: [
        { id: 't1', from: 'o1004', to: 'c1', label: 'customer_id' },
        { id: 't2', from: 'oi1', to: 'o1004', label: 'order_id' },
        { id: 't3', from: 'oi2', to: 'o1004', label: 'order_id' },
        { id: 't4', from: 'oi1', to: 'p1', label: 'product_id' },
        { id: 't5', from: 'oi2', to: 'p4', label: 'product_id' },
      ],
    },
    path: ['c1', 'o1004', 'oi1', 'p1'],
    pathEdges: ['t1', 't2', 't4'],
    note: '정규화를 그대로 옮기면 <strong>order_items 행이 중간 노드</strong>로 남아 한 홉을 더 씁니다. 대신 항목 단위의 속성과 이력을 그대로 보존합니다.',
  },
  graph: {
    label: '그래프 모양',
    hops: 2,
    data: {
      nodes: [
        { id: 'c1', labels: ['Customer'], props: { name: '김하늘' } },
        { id: 'o1004', labels: ['Order'], props: { id: 'o1004', amount: 121000 } },
        { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰' } },
        { id: 'p4', labels: ['Product'], props: { name: '보조 배터리' } },
      ],
      edges: [
        { id: 'g1', from: 'c1', to: 'o1004', label: 'PLACED' },
        { id: 'g2', from: 'o1004', to: 'p1', label: 'CONTAINS {qty:1}' },
        { id: 'g3', from: 'o1004', to: 'p4', label: 'CONTAINS {qty:1}' },
      ],
    },
    path: ['c1', 'o1004', 'p1'],
    pathEdges: ['g1', 'g2'],
    note: '항목의 수량·단가를 <strong>관계 속성</strong>으로 내리면 “고객이 산 상품”이 2홉이 됩니다. 대신 항목 자체를 조회하는 질문은 표현하기 어려워집니다.',
  },
};

function shapeToggle(ctx) {
  const g = graphCard(ctx, {
    title: '같은 데이터, 두 가지 모양',
    subtitle: '버튼을 눌러 <strong>테이블 모양</strong>과 <strong>그래프 모양</strong>을 오가 보세요. 강조된 경로의 홉 수가 달라집니다.',
    data: SHAPES.table.data,
    height: 380,
    seed: 9,
    edgeLabels: true,
    legendGroups: ['Customer', 'Order', 'OrderItem', 'Product'],
    hint: '노드를 끌어 배치를 바꿀 수 있습니다',
  });

  let view = null;
  let mode = 'table';
  const hopsOut = h('b', {}, '3홉');
  const readout = h('div', { class: 'card__foot' }, '…');

  const chips = Object.keys(SHAPES).map((key) =>
    h(
      'button',
      {
        class: `chip${key === mode ? ' is-on' : ''}`,
        type: 'button',
        dataset: { key },
        onClick: () => {
          mode = key;
          chips.forEach((b) => b.classList.toggle('is-on', b.dataset.key === key));
          render();
        },
      },
      SHAPES[key].label
    )
  );

  function render() {
    const shape = SHAPES[mode];
    hopsOut.textContent = `${shape.hops}홉`;
    readout.innerHTML = `${shape.note} <span class="badge">노드 ${shape.data.nodes.length}</span> <span class="badge">관계 ${shape.data.edges.length}</span>`;
    if (view) {
      view.setData(shape.data);
      view.relayout();
      view.highlight(shape.path, { edges: shape.pathEdges });
    }
  }
  g.ready.then((v) => {
    view = v;
    render(true);
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
        h('div', { class: 'card__title' }, '“김하늘이 산 상품”까지 몇 홉인가'),
        h('div', { class: 'card__sub' }, '정규화된 모양을 그대로 옮길지, 질문에 맞춰 접을지 고르는 것이 모델링입니다.')
      )
    ),
    h(
      'div',
      { class: 'card__body' },
      h('div', { class: 'chip-row' }, chips),
      h('div', { class: 'row', style: { marginTop: '12px', fontSize: 'var(--fs-sm)' } }, h('span', { class: 'muted' }, '고객 → 상품 경로 길이'), h('span', { class: 'spacer' }), hopsOut)
    ),
    readout
  );

  return h('div', { class: 'stack' }, controls, g.el);
}

/* ================= 슈퍼노드 팬아웃 데모 ================= */
function hubGraph(count, bucketed) {
  const nodes = [{ id: 'hub', labels: ['Category'], props: { name: bucketed ? '오디오' : `오디오 (${count}개 상품)` } }];
  const edges = [];
  if (bucketed) {
    for (let b = 0; b < 3; b++) {
      nodes.push({ id: `bucket${b}`, labels: ['Bucket'], props: { name: `2024-0${b + 5} 버킷` } });
      edges.push({ id: `bkt${b}`, type: 'BUCKET_OF', from: `bucket${b}`, to: 'hub' });
    }
  }
  for (let i = 1; i <= count; i++) {
    nodes.push({ id: `p${i}`, labels: ['Product'], props: { name: `이어폰 ${i}`, price: 1000 * i } });
    const parent = bucketed ? `bucket${(i - 1) % 3}` : 'hub';
    edges.push({ id: `inc${i}`, type: 'IN_CATEGORY', from: `p${i}`, to: parent });
  }
  return { nodes, edges };
}

function supernodeDemo(ctx) {
  const state = { count: 24, bucketed: false };
  const g = graphCard(ctx, {
    title: '허브 하나에 매달린 24개 상품',
    subtitle: '“오디오” 카테고리를 노드로 두면, 그 카테고리를 지나는 모든 질문이 허브를 통과합니다.',
    data: hubGraph(state.count, state.bucketed),
    height: 380,
    seed: 4,
    legendGroups: ['Category', 'Product', 'Bucket'],
  });

  let view = null;
  const degreeOut = h('b', {}, '24');
  const hopOut = h('b', {}, '1홉');
  const countOut = h('b', {}, '24');
  const readout = h('div', { class: 'card__foot' }, '…');

  const range = h('input', {
    type: 'range',
    min: '6',
    max: '24',
    step: '2',
    value: '24',
    'aria-label': '상품 수',
    onInput: (e) => {
      state.count = Number(e.target.value);
      countOut.textContent = String(state.count);
      render(false);
    },
  });

  const bucketBtn = h(
    'button',
    { class: 'chip', type: 'button' },
    '월 버킷으로 분할'
  );
  bucketBtn.addEventListener('click', () => {
    state.bucketed = !state.bucketed;
    bucketBtn.classList.toggle('is-on', state.bucketed);
    bucketBtn.textContent = state.bucketed ? '단일 허브로 되돌리기' : '월 버킷으로 분할';
    render(true);
  });

  function render(settle = false) {
    const data = hubGraph(state.count, state.bucketed);
    const hubEdges = data.edges.filter((e) => e.from === 'hub' || e.to === 'hub');
    const peerIds = hubEdges.map((e) => (e.from === 'hub' ? e.to : e.from));
    const degree = hubEdges.length;
    degreeOut.textContent = String(degree);
    hopOut.textContent = state.bucketed ? '2홉' : '1홉';
    readout.innerHTML = state.bucketed
      ? `허브 차수가 <strong>${state.count} → 3</strong>으로 줄었습니다. 상품은 버킷을 거쳐 <strong>2홉</strong>에서 만나지만, 허브를 지나는 탐색은 관계 <strong>3개</strong>만 순회합니다.`
      : `허브 차수 <strong>${state.count}</strong>. 허브를 지나는 모든 탐색이 관계 <strong>${degree}개</strong>를 순회하고, 2홉이면 그 이웃의 이웃까지 곱해집니다.`;
    if (view) {
      view.setData(data);
      if (settle) view.relayout();
      view.highlight(['hub', ...peerIds], { edges: hubEdges.map((e) => e.id) });
    }
  }
  g.ready.then((v) => {
    view = v;
    render(true);
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
        h('div', { class: 'card__title' }, '팬아웃을 직접 줄여 보기'),
        h('div', { class: 'card__sub' }, '허브 차수(1홉에서 순회하는 관계 수)를 확인하세요. 강조된 것이 “1홉 확장”의 범위입니다.')
      )
    ),
    h(
      'div',
      { class: 'card__body' },
      h(
        'div',
        { class: 'row', style: { justifyContent: 'space-between', marginBottom: '10px', fontSize: 'var(--fs-sm)' } },
        h('label', { style: { fontWeight: '600' } }, '카테고리에 매달린 상품 수'),
        countOut
      ),
      range,
      h(
        'div',
        { class: 'row', style: { marginTop: '12px' } },
        bucketBtn,
        h('span', { class: 'spacer' }),
        h('span', { style: { fontSize: 'var(--fs-sm)' } }, '허브 차수 '),
        degreeOut,
        h('span', { style: { fontSize: 'var(--fs-sm)', margin: '0 8px' }, class: 'muted' }, '상품까지'),
        hopOut
      )
    ),
    readout
  );

  return h('div', { class: 'stack' }, controls, g.el);
}

/* ================= 차트 — 모두몰 시드의 모양 ================= */
function seedShapeChart(ctx) {
  const { nodes, edges } = modumallSeed();
  const order = ['Customer', 'Order', 'Product', 'Review', 'Supplier', 'Category', 'Return'];
  const counts = new Map(order.map((k) => [k, 0]));
  for (const n of nodes) {
    const key = n.labels?.[0];
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }
  const { el } = chartCard(ctx, {
    title: '모두몰 시드: 8개 테이블 → 7개 라벨',
    subtitle: `노드 ${nodes.length}개, 관계 ${edges.length}개. 정규화된 테이블이 그래프에서는 이렇게 펼쳐집니다.`,
    height: 300,
    foot: '시드 데이터는 결정적으로 생성되므로, 실습에서 항상 같은 수가 나옵니다(js/data/modumall.seed.js).',
    option: (t) => ({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: t.font, color: t.ink2 },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: t.dark ? '#131a2a' : '#fff', borderColor: t.dark ? '#26314a' : '#e3e6ef', textStyle: { color: t.ink, fontSize: 12 } },
      xAxis: {
        type: 'category',
        data: order,
        axisLine: { lineStyle: { color: t.axis } },
        axisLabel: { color: t.ink3, fontSize: 10, interval: 0, rotate: 20 },
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: t.grid } }, axisLabel: { color: t.ink3 } },
      series: [
        {
          type: 'bar',
          barWidth: '52%',
          data: order.map((k, i) => ({
            value: counts.get(k),
            itemStyle: { color: [t.blue, t.warn, t.ok, t.purple, t.cyan, t.ink4, t.danger][i], borderRadius: [4, 4, 0, 0] },
          })),
          label: { show: true, position: 'top', color: t.ink3, fontSize: 10 },
        },
      ],
      animationDuration: 600,
    }),
  });
  return el;
}

/* ================= 페이지 ================= */
export default {
  id: 'theory/modeling',
  title: '그래프 데이터 모델링',
  kicker: 'CHAPTER 04 · MODELING',
  summary: '정규화된 스키마를 그대로 옮기면 동작은 합니다. 문제는 그 다음입니다. 홉 수, 팬아웃, 시간을 기준으로 모델을 다시 접는 법을 다룹니다.',
  minutes: 15,
  tags: ['정규화', '리파이케이션', '슈퍼노드', '계층', '버저닝'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      pageHead({
        kicker: 'CHAPTER 04 · MODELING',
        title: '그래프 데이터 모델링',
        summary: '그래프 모델링의 목적 함수는 “중복 제거”가 아니라 <strong>“질문이 몇 홉에서 끝나는가”</strong>입니다. 대신 정합성 비용을 어디서 치를지 결정해야 합니다.',
        minutes: 15,
        tags: ['정규화 vs 비정규화', '관계 승격', '슈퍼노드', '계층 · 시간'],
      })
    );

    /* 1 ── 정규화와 그래프 */
    el.append(
      section(
        { num: '1', title: '정규화를 그래프로 옮길 때', lead: '정규화는 <strong>중복 제거</strong>가 목적이고, 그래프 모델링은 <strong>홉 최소화</strong>가 목적입니다. 목적이 다르면 답도 달라집니다.' },
        prose(
          `RDB의 3정규형은 “같은 사실을 두 번 저장하지 않는다”를 목표로 합니다. 그래프에서도 이 원칙은 유효하지만, 그래프에서는
          <strong>관계를 읽는 비용이 조인보다 훨씬 싸기 때문에</strong> “테이블을 하나 더 두는” 판단이 달라집니다.
          반대로 <strong>관계를 속성으로 접으면</strong> 읽기는 빨라지지만, 그 값에 대한 질의·집계·이력 관리가 어려워집니다.`
        ),
        tableBlock({
          head: ['RDB의 관행', '그대로 옮기면', '그래프에서의 판단'],
          rows: [
            ['모든 FK를 그대로 둔다', '조인 테이블이 노드로 남아 홉이 하나 늘어난다', '속성 없는 M:N은 관계 두 개로 접는다'],
            ['코드 테이블(status, grade)', '저카디널리티 노드가 슈퍼노드가 된다', '속성으로 내리고 값으로 필터한다'],
            ['3정규형 유지', '같은 질문에 4~5홉이 필요해진다', '읽기 패턴 기준으로 의도적으로 접는다'],
            ['집계는 SQL로', '그래프 전체 집계는 불리하다', '집계는 RDB/OLAP에 남기고 탐색만 그래프로'],
            ['NULL 허용 컬럼', '속성 없음 = NULL과 같은 의미', '존재 제약으로 필수 속성을 강제한다'],
            ['유니크 인덱스', '제약 없이는 중복 노드가 생긴다', 'UNIQUE 제약 + MERGE를 함께 쓴다'],
          ],
          compact: true,
          caption: '“정규화를 버린다”가 아니라 “어디까지 접을지 고른다”가 정확한 표현입니다.',
        }),
        callout(
          'engineer',
          '마이그레이션에서 가장 흔한 실수',
          `ERD를 그대로 그래프로 옮기면 <strong>동작은 합니다</strong>. 문제는 성능이 아니라 질문의 모양입니다.
          “이 상품을 산 고객이 함께 산 상품”이 4홉이 되고, 그 4홉이 API 응답 시간에 그대로 나타납니다.
          <strong>테이블이 아니라 질문 목록을 먼저 적고, 그 질문이 2~3홉에 들어오도록 모델을 접으세요.</strong>`
        )
      )
    );

    /* 2 ── 관계의 승격 */
    el.append(
      section(
        { num: '2', title: '관계를 노드로 승격하기 — 리파이케이션', lead: 'M:N 조인 테이블은 <strong>관계</strong>가 될 수도, <strong>노드</strong>가 될 수도 있습니다. 기준은 “그 항목이 스스로 존재하는가”입니다.' },
        prose(
          `판단 기준은 세 가지입니다. <strong>① 관계에 속성이 붙는가</strong>, <strong>② 그 항목 자체를 조회·추적하는가</strong>,
          <strong>③ 그 항목이 다른 것과 관계를 맺는가</strong>입니다. 셋 다 아니면 <strong>관계 속성</strong>으로 접고,
          하나라도 해당하면 <strong>노드로 승격</strong>합니다. 주문 항목은 ②·③이 자주 참이 되므로(반품, 교환, 부분 취소)
          실무에서는 노드로 두는 쪽이 안전한 경우가 많습니다.`
        ),
        shapeToggle(ctx),
        codeBlock({
          lang: 'cypher',
          title: '접기(A) vs 승격(B) — 같은 데이터, 다른 질문',
          code: `// (A) 관계 속성으로 접기 — 항목이 "값"일 때
MATCH (o:Order {id: 'o1004'}), (p:Product {id: 'p1'})
MERGE (o)-[c:CONTAINS]->(p)
SET c.qty = 1, c.unitPrice = 89000;

// (B) 항목을 노드로 승격 — 항목 자체를 조회·추적할 때
MATCH (o:Order {id: 'o1004'}), (p:Product {id: 'p1'})
CREATE (o)-[:HAS_ITEM]->(oi:OrderItem {id: 'oi-1004-1', qty: 1, unitPrice: 89000})
CREATE (oi)-[:OF_PRODUCT]->(p);

// 승격했을 때만 가능한 질문: 항목 단위 매출과 반품 이력
MATCH (o:Order {id: 'o1004'})-[:HAS_ITEM]->(oi)-[:OF_PRODUCT]->(p)
OPTIONAL MATCH (oi)-[:RETURNED_AS]->(r:Return)
RETURN p.name, oi.qty * oi.unitPrice AS line_total, r.reason;`,
          note: '승격은 공짜가 아닙니다. 노드가 늘고 홉이 늘어납니다. “이 질문이 정말 필요한가”를 먼저 확인하세요.',
        }),
        callout(
          'warn',
          '관계 속성의 한계',
          `Neo4j 5는 관계 속성에도 RANGE/TEXT/POINT 인덱스를 만들 수 있지만, 관계 속성으로 <strong>집계·정렬·조인</strong>을
          반복하는 질문에는 불리합니다. “수량 합계”, “단가 이력”, “항목별 반품률”이 요구사항에 있다면
          처음부터 <strong>항목 노드</strong>로 설계하는 편이 유지보수에 유리합니다.`
        )
      )
    );

    /* 3 ── 슈퍼노드 */
    el.append(
      section(
        { num: '3', title: '슈퍼노드 — 팬아웃이 만드는 함정', lead: '차수가 수만인 노드는 <strong>쿼리 한 줄로 수만 개의 관계를 순회</strong>하게 만듭니다.' },
        prose(
          `카테고리, 국가, 상태 코드, 인기 상품처럼 <strong>많은 것이 매달리는 노드</strong>를 슈퍼노드라 부릅니다.
          슈퍼노드 자체는 나쁜 모델이 아닙니다. 문제는 <strong>그 허브를 반드시 지나야 하는 질문</strong>을 설계할 때 생깁니다.
          허브에서 1홉을 펼치면 차수만큼 관계 레코드를 읽고, 2홉에서는 그 이웃들의 차수까지 곱해집니다.
          게다가 인기 상품 하나에 쓰기가 몰리면 <strong>그 노드의 락</strong>이 병목이 됩니다.`
        ),
        supernodeDemo(ctx),
        callout(
          'warn',
          '슈퍼노드를 피하는 다섯 가지',
          `① <strong>속성으로 내리기</strong>: 상태·등급·지역은 노드가 아니라 속성입니다.
          ② <strong>시간 버킷</strong>: <code>2024-05</code> 같은 중간 노드를 두어 허브 차수를 시간으로 나눕니다.
          ③ <strong>관계 타입 분리</strong>: <code>VIEWED</code>/<code>PURCHASED</code>를 한 타입으로 합치지 않습니다.
          ④ <strong>중간 노드</strong>: 카테고리 계층을 한 단계 더 둡니다. ⑤ <strong>사전 집계</strong>: 자주 쓰는 경로는 요약 관계로 미리 계산합니다.`
        )
      )
    );

    /* 4 ── 계층과 시간 */
    el.append(
      section(
        { num: '4', title: '계층과 시간 — 트리, 버전, as-of 조회', lead: '계층은 <strong>parent-of</strong> 하나로, 시간은 <strong>유효 구간</strong> 하나로 대부분 해결됩니다.' },
        prose(
          `카테고리 트리는 <code>(부모)-[:PARENT_OF]-&gt;(자식)</code>로 표현하고, 깊이는 <strong>가변 길이 패턴</strong>으로 처리합니다.
          깊이가 얕고 자주 조회된다면 <strong>조상 목록을 미리 계산</strong>(클로저 테이블)하는 편이 빠르지만,
          이동이 잦은 트리에서는 갱신 비용이 커집니다. RDF에서는 <code>rdfs:subClassOf</code>나 SKOS의
          <code>broader/narrower</code>가 같은 역할을 합니다.`
        ),
        prose(
          `시간은 <strong>관계에 유효 구간을 붙이는</strong> 방식이 가장 흔합니다. <code>validFrom</code>/<code>validTo</code>를 두고,
          <code>validTo</code>가 없으면 “현재 유효”로 봅니다. 상태 전이처럼 <strong>사건 자체가 의미</strong>가 있으면
          이벤트 노드(<code>:StatusChange</code>)로 남깁니다. 이렇게 하면 “그 시점에는 무엇이 참이었나”를
          <strong>한 번의 조건절</strong>로 답할 수 있습니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '계층 탐색과 as-of 조회',
          code: `// 카테고리 트리: 리프에서 루트까지 (parent-of: 부모 → 자식)
MATCH path = (leaf:Category {id: 'cat-audio'})<-[:PARENT_OF*]-(root:Category)
WHERE NOT (root)-[:PARENT_OF]->()
RETURN [n IN nodes(path) | n.name] AS breadcrumb;

// 서브트리 전체 상품 (깊이 무관, 자기 자신 포함)
MATCH (root:Category {id: 'cat-home'})<-[:PARENT_OF*0..]-(sub:Category)<-[:IN_CATEGORY]-(p:Product)
RETURN sub.name AS category, collect(p.name) AS products;

// 가격 이력: 관계가 유효 구간을 가진다
MATCH (p:Product {id: 'p1'})-[old:PRICED_AT]->(:Currency {code: 'KRW'})
WHERE old.validTo IS NULL
SET old.validTo = date('2024-06-01');

// as-of 조회 — "2024-05-20 시점의 가격"
MATCH (p:Product {id: 'p1'})-[r:PRICED_AT]->(:Currency {code: 'KRW'})
WHERE r.validFrom <= date('2024-05-20')
  AND (r.validTo IS NULL OR r.validTo > date('2024-05-20'))
RETURN r.amount;`,
          note: '가변 길이 패턴은 사이클이 있으면 폭발합니다. 트리에는 사이클이 없다는 불변식을 제약이나 적재 검증으로 지키세요.',
        })
      )
    );

    /* 5 ── 8개 테이블 매핑과 안티패턴 */
    el.append(
      section(
        { num: '5', title: '모두몰 8개 테이블 → 라벨·관계', lead: '시나리오의 스키마를 실제로 옮겨 봅니다. <strong>테이블 8개가 라벨 7개 + 관계 5종</strong>이 됩니다.' },
        tableBlock({
          head: ['RDB 테이블', '그래프에서의 모양', '핵심 판단'],
          rows: [
            ['customers', '(:Customer) + 속성', '그대로 노드. 등급·지역은 속성으로'],
            ['categories', '(:Category) + [:IN_CATEGORY]', '계층이 생기면 [:PARENT_OF] 추가'],
            ['suppliers', '(:Supplier) + [:SUPPLIED_BY]', '“공급한다”를 관계로 승격'],
            ['products', '(:Product) + [:SUPPLIED_BY], [:IN_CATEGORY]', 'FK 2개가 관계 2개로'],
            ['orders', '(:Order) + [:PLACED]', '헤더-라인 구조를 어떻게 접을지가 핵심'],
            ['order_items', '[:CONTAINS {qty, unitPrice}] 또는 (:OrderItem)', '속성만 필요하면 관계, 항목을 조회하면 노드'],
            ['reviews', '(:Review) + [:WROTE], [:REVIEWS]', '고객·상품 양쪽에 걸리므로 노드 유지'],
            ['returns', '(:Return) + [:HAS_RETURN], [:FOR_PRODUCT]', '상태 전이를 남기려면 이벤트 노드'],
          ],
          compact: true,
          caption: '시드 데이터는 단순화를 위해 order_items를 [:CONTAINS]로 접었습니다. 실무라면 수량·단가를 관계 속성으로 두거나 항목 노드로 승격합니다.',
        }),
        tableBlock({
          head: ['안티패턴', '증상', '대안'],
          rows: [
            ['상태·지역을 노드로', '저카디널리티 슈퍼노드, 1홉 폭발', '속성으로 두고 라벨·인덱스로 필터'],
            ['관계 타입에 날짜를 박음 (`:ORDERED_20240502`)', '타입 폭발, 쿼리 불가', '관계 속성(validFrom) 또는 버킷 노드'],
            ['조인 테이블을 무조건 노드로', '불필요한 홉 증가', '속성 없는 M:N은 관계 두 개로'],
            ['FK를 속성으로만 저장', '참조 무결성·탐색 상실', '진짜 관계로 저장'],
            ['양방향 관계를 중복 저장', '저장 2배, 갱신 불일치', '방향 하나만 두고 역방향은 쿼리로'],
            ['모든 노드에 `:Entity` 하나', '라벨 스캔 = 전체 스캔', '도메인 라벨 부여'],
            ['리스트 속성에 id 배열', '조인·인덱스 불가', '관계로 펼치기'],
          ],
          compact: true,
        }),
        seedShapeChart(ctx),
        callout(
          'insight',
          '모델링 리뷰에서 물어야 할 세 가지',
          `<strong>① 이 질문은 몇 홉인가</strong>, <strong>② 최악의 차수는 얼마인가</strong>, <strong>③ 이 값이 변하면 무엇을 고쳐야 하는가</strong>.
          세 질문에 답할 수 있으면 모델은 대체로 안전합니다.`
        )
      )
    );

    /* 6 ── 퀴즈 */
    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/modeling',
          questions: [
            {
              q: 'M:N 조인 테이블을 노드로 승격해야 하는 신호로 가장 적절한 것은?',
              options: [
                '양쪽 FK 말고는 컬럼이 없다',
                '항목 자체에 상태·이력이 붙고, 다른 엔티티와도 관계를 맺는다',
                '행 수가 많다',
              ],
              answer: 1,
              explain: '항목이 스스로 식별되고 상태·이력을 가지며 다른 것과 관계를 맺으면 노드가 맞습니다. 반대로 속성만 있으면 관계 속성으로 접는 편이 홉을 아낍니다.',
            },
            {
              q: '카테고리 노드의 차수가 5만인 상황에서 가장 먼저 의심할 것은?',
              options: [
                '그래프 DB의 버전',
                '저카디널리티 값을 엔티티로 승격한 모델링 실수, 또는 허브를 지나는 질문 설계',
                '인덱스가 없어서',
              ],
              answer: 1,
              explain: '슈퍼노드는 대개 모델링 신호입니다. 속성으로 내리거나 시간 버킷·중간 노드로 차수를 나누는 것을 먼저 검토합니다.',
            },
            {
              q: '“2024-05-20 시점의 가격”을 그래프에서 구하는 표준적인 방법은?',
              options: [
                '가격을 노드 속성 하나로 두고 덮어쓴다',
                '관계(또는 이력 노드)에 validFrom/validTo를 두고 as-of 조건으로 조회한다',
                '별도 RDB에만 저장한다',
              ],
              answer: 1,
              explain: '유효 구간을 데이터로 두면 “그 시점에 참이었던 것”을 한 번의 조건절로 답할 수 있습니다. 속성을 덮어쓰면 과거를 잃습니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>그래프 모델링은 “무엇을 노드로 둘지”의 연속된 결정입니다.</strong> 접으면 빨라지고, 승격하면 표현력이 늘어납니다. 그 교환을 질문 목록과 차수 분포로 정당화할 수 있어야 합니다.'
      )
    );

    return { destroy() {} };
  },
};
