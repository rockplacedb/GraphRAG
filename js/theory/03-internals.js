/**
 * 이론 03 — 그래프 DB 내부 구조
 * 레코드 레이아웃과 포인터, 인덱스와 제약, 트랜잭션, 제품 비교.
 */
import { h, s } from '../core/dom.js';
import { pageHead, section, prose, callout, codeBlock, tableBlock, graphCard, chartCard, quizBlock } from '../ui/blocks.js';

/* ================= 그림 — 노드 레코드 · 관계 레코드 · 포인터 ================= */
function recordDiagram() {
  const mono = { fontFamily: 'var(--font-mono)', fontSize: '10.5px', fill: 'var(--ink-3)' };
  const box = (x, y, w, hh, title, lines, tone) =>
    s(
      'g',
      {},
      s('rect', { x, y, width: w, height: hh, rx: 7, style: { fill: 'var(--surface-2)', stroke: tone, strokeWidth: '1.3px' } }),
      s('text', {
        x: x + 11,
        y: y + 20,
        style: { fontFamily: 'var(--font-mono)', fontSize: '11.5px', fontWeight: '700', fill: 'var(--ink)' },
        text: title,
      }),
      ...lines.map((ln, i) => s('text', { x: x + 11, y: y + 39 + i * 15, style: mono, text: ln }))
    );
  const arrow = (d, label, lx, ly) => [
    s('path', { d, style: { fill: 'none', stroke: 'var(--ink-4)', strokeWidth: '1.2px' }, 'marker-end': 'url(#kg-arrow)' }),
    label ? s('text', { x: lx, y: ly, style: { fontSize: '9.5px', fill: 'var(--ink-4)' }, text: label }) : null,
  ];

  const svg = s(
    'svg',
    {
      viewBox: '0 0 720 272',
      style: { width: '100%', height: 'auto', display: 'block' },
      role: 'img',
      'aria-label': '노드 레코드가 관계 포인터로 연결 리스트를 이루는 저장 레이아웃',
    },
    s(
      'defs',
      {},
      s(
        'marker',
        { id: 'kg-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' },
        s('path', { d: 'M 0 0 L 10 5 L 0 10 z', style: { fill: 'var(--ink-4)' } })
      )
    ),
    box(8, 96, 172, 96, 'NODE #12', [':Customer', "name: '김하늘'", 'firstRel → #41'], 'var(--node-customer)'),
    box(232, 20, 216, 92, 'REL #41 :PLACED', ['start → #12', 'end   → #57', 'sNext → #42'], 'var(--node-order)'),
    box(232, 148, 216, 92, 'REL #42 :WROTE', ['start → #12', 'end   → #63', 'sNext → null'], 'var(--node-review)'),
    box(500, 20, 212, 76, 'NODE #57', [':Order', "id: 'o1001'"], 'var(--node-order)'),
    box(500, 164, 212, 76, 'NODE #63', [':Review', 'rating: 5'], 'var(--node-review)'),
    ...arrow('M 180 138 C 206 138 206 66 228 66', 'firstRel', 182, 116),
    ...arrow('M 180 152 C 206 152 206 192 228 192', null, 0, 0),
    ...arrow('M 340 112 L 340 144', 'sNext', 346, 132),
    ...arrow('M 448 66 C 472 66 476 56 496 56', 'end', 454, 44),
    ...arrow('M 448 194 C 472 194 476 202 496 202', 'end', 454, 224)
  );

  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h(
        'div',
        { class: 'card__head-text' },
        h('div', { class: 'card__title' }, '노드 레코드 · 관계 레코드 · 포인터'),
        h('div', { class: 'card__sub' }, '노드는 “첫 관계”만 가리키고, 관계 레코드가 양 끝 노드와 같은 체인의 다음 관계를 가리킵니다.')
      )
    ),
    h('div', { class: 'card__body' }, svg),
    h(
      'div',
      { class: 'card__foot' },
      '단순화한 그림입니다. 실제 저장소는 8KB 페이지에 레코드를 채우고, 문자열·배열 값은 별도 동적 저장소(property store)에 둡니다.'
    )
  );
}

/* ================= 데모 — 이웃 조회는 인덱스가 아니라 포인터 ================= */
const NB_GRAPH = {
  nodes: [
    { id: 'c1', labels: ['Customer'], props: { name: '김하늘', grade: 'VIP' } },
    { id: 'c3', labels: ['Customer'], props: { name: '박서연', grade: 'VIP' } },
    { id: 'o1001', labels: ['Order'], props: { id: 'o1001', amount: 89000 } },
    { id: 'o1004', labels: ['Order'], props: { id: 'o1004', amount: 121000 } },
    { id: 'o1016', labels: ['Order'], props: { id: 'o1016', amount: 9000 } },
    { id: 'o1003', labels: ['Order'], props: { id: 'o1003', amount: 289000 } },
    { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰', price: 89000 } },
    { id: 'p3', labels: ['Product'], props: { name: '노캔 헤드폰', price: 289000 } },
    { id: 'p4', labels: ['Product'], props: { name: '보조 배터리', price: 32000 } },
    { id: 'p6', labels: ['Product'], props: { name: 'USB-C 케이블', price: 9000 } },
    { id: 'r1', labels: ['Review'], props: { id: 'r1', rating: 5 } },
    { id: 'r10', labels: ['Review'], props: { id: 'r10', rating: 5 } },
    { id: 's1', labels: ['Supplier'], props: { name: '한빛전자' } },
    { id: 's2', labels: ['Supplier'], props: { name: '대성테크' } },
    { id: 's3', labels: ['Supplier'], props: { name: '파워넷' } },
    { id: 'cat-audio', labels: ['Category'], props: { name: '오디오' } },
    { id: 'cat-power', labels: ['Category'], props: { name: '전원' } },
  ],
  edges: [
    { id: 'e1', type: 'PLACED', from: 'c1', to: 'o1001' },
    { id: 'e2', type: 'PLACED', from: 'c1', to: 'o1004' },
    { id: 'e3', type: 'PLACED', from: 'c1', to: 'o1016' },
    { id: 'e4', type: 'PLACED', from: 'c3', to: 'o1003' },
    { id: 'e5', type: 'CONTAINS', from: 'o1001', to: 'p1' },
    { id: 'e6', type: 'CONTAINS', from: 'o1004', to: 'p1' },
    { id: 'e7', type: 'CONTAINS', from: 'o1004', to: 'p4' },
    { id: 'e8', type: 'CONTAINS', from: 'o1016', to: 'p6' },
    { id: 'e9', type: 'CONTAINS', from: 'o1003', to: 'p3' },
    { id: 'e10', type: 'WROTE', from: 'c1', to: 'r1' },
    { id: 'e11', type: 'REVIEWS', from: 'r1', to: 'p1' },
    { id: 'e12', type: 'WROTE', from: 'c1', to: 'r10' },
    { id: 'e13', type: 'REVIEWS', from: 'r10', to: 'p4' },
    { id: 'e14', type: 'SUPPLIED_BY', from: 'p1', to: 's1' },
    { id: 'e15', type: 'SUPPLIED_BY', from: 'p3', to: 's2' },
    { id: 'e16', type: 'SUPPLIED_BY', from: 'p4', to: 's3' },
    { id: 'e17', type: 'SUPPLIED_BY', from: 'p6', to: 's3' },
    { id: 'e18', type: 'IN_CATEGORY', from: 'p1', to: 'cat-audio' },
    { id: 'e19', type: 'IN_CATEGORY', from: 'p3', to: 'cat-audio' },
    { id: 'e20', type: 'IN_CATEGORY', from: 'p4', to: 'cat-power' },
  ],
};

const NB_LABEL = new Map(NB_GRAPH.nodes.map((n) => [n.id, n.props.name || n.props.id || n.id]));

const NB_ADJ = (() => {
  const adj = new Map();
  const push = (a, b, id) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ peer: b, edge: id });
  };
  for (const e of NB_GRAPH.edges) {
    push(e.from, e.to, e.id);
    push(e.to, e.from, e.id);
  }
  return adj;
})();

/** 방향을 무시한 N홉 이웃 — 포인터 추적 횟수를 세기 위한 모델 */
function bfsFrom(start, hops) {
  const nodes = new Set([start]);
  const edges = new Set();
  let frontier = [start];
  for (let i = 0; i < hops; i++) {
    const next = [];
    for (const id of frontier) {
      for (const nb of NB_ADJ.get(id) || []) {
        edges.add(nb.edge);
        if (!nodes.has(nb.peer)) {
          nodes.add(nb.peer);
          next.push(nb.peer);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { nodes: [...nodes], edges: [...edges] };
}

function neighborDemo(ctx) {
  const g = graphCard(ctx, {
    title: '이웃 조회 = 포인터 추적',
    subtitle: '시작 노드를 바꾸고 홉 수를 늘려 보세요. 강조된 범위가 “관계 레코드를 따라간” 결과입니다.',
    data: NB_GRAPH,
    height: 400,
    seed: 13,
    edgeLabels: true,
    hint: '노드를 끌어 배치를 바꿀 수 있습니다',
  });

  const state = { start: 'c1', hops: 1 };
  let view = null;
  const nodeStat = h('div', { class: 'stat__value' }, '–');
  const edgeStat = h('div', { class: 'stat__value' }, '–');
  const hopsOut = h('output', { style: { fontFamily: 'var(--font-mono)', fontWeight: '700' } }, '1홉');
  const note = h('div', { class: 'card__foot' }, '그래프를 초기화하는 중입니다…');

  const chips = ['c1', 'o1001', 'p1', 's1'].map((id) =>
    h(
      'button',
      {
        class: `chip${id === state.start ? ' is-on' : ''}`,
        type: 'button',
        dataset: { id },
        onClick: () => {
          state.start = id;
          chips.forEach((b) => b.classList.toggle('is-on', b.dataset.id === id));
          render(true);
        },
      },
      NB_LABEL.get(id)
    )
  );

  const range = h('input', {
    type: 'range',
    min: '1',
    max: '3',
    step: '1',
    value: '1',
    'aria-label': '탐색 홉 수',
    onInput: (e) => {
      state.hops = Number(e.target.value);
      render(false);
    },
  });

  function render(focus) {
    const { nodes, edges } = bfsFrom(state.start, state.hops);
    nodeStat.textContent = String(nodes.length);
    edgeStat.textContent = String(edges.length);
    hopsOut.textContent = `${state.hops}홉`;
    note.innerHTML = `<strong>${NB_LABEL.get(state.start)}</strong>에서 ${state.hops}홉 — 노드 <strong>${nodes.length}개</strong>, 관계 <strong>${edges.length}개</strong>. 관계 레코드 ${edges.length}개를 따라갔고, 인덱스 탐색은 <strong>0회</strong>입니다.`;
    if (view) {
      view.highlight(nodes, { edges });
      if (focus) view.focus(state.start);
    }
  }
  g.ready.then((v) => {
    view = v;
    render(false);
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
        h('div', { class: 'card__title' }, '시작 노드와 홉 수'),
        h('div', { class: 'card__sub' }, '1홉은 관계 레코드 한 겹, 2홉은 그 이웃의 관계 레코드까지입니다.')
      )
    ),
    h(
      'div',
      { class: 'card__body' },
      h('div', { class: 'chip-row', style: { marginBottom: '12px' } }, chips),
      h(
        'div',
        { class: 'row', style: { justifyContent: 'space-between', marginBottom: '10px' } },
        h('label', { style: { fontSize: 'var(--fs-sm)', fontWeight: '600' } }, '탐색 깊이'),
        hopsOut
      ),
      range,
      h(
        'div',
        { class: 'stats', style: { marginTop: '16px' } },
        h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, '도달 노드'), nodeStat, h('div', { class: 'stat__note' }, '중복 제거 후')),
        h(
          'div',
          { class: 'stat stat--accent' },
          h('div', { class: 'stat__label' }, '따라간 관계 레코드'),
          edgeStat,
          h('div', { class: 'stat__note' }, '이 숫자가 곧 포인터 추적 횟수')
        )
      )
    ),
    note
  );

  return h('div', { class: 'stack' }, controls, g.el);
}

/* ================= 차트 — 1홉 조회 비용 ================= */
function lookupCostChart(ctx) {
  const sizes = [1000, 10000, 100000, 1000000, 10000000];
  const { el } = chartCard(ctx, {
    title: '1홉 이웃을 찾는 세 가지 방법 (상대 비용)',
    subtitle: '전체 스캔은 O(N), 인덱스 탐색은 O(log N), 포인터 추적은 O(차수)입니다.',
    height: 320,
    foot: '교육용 상대 모델입니다. 실제로는 페이지 캐시 적중률·레코드 크기·동시성에 따라 크게 달라집니다. 평균 차수는 8로 가정했습니다.',
    option: (t) => ({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: t.font, color: t.ink2 },
      grid: { left: 10, right: 18, top: 44, bottom: 10, containLabel: true },
      tooltip: { trigger: 'axis', backgroundColor: t.dark ? '#131a2a' : '#fff', borderColor: t.dark ? '#26314a' : '#e3e6ef', textStyle: { color: t.ink, fontSize: 12 } },
      legend: { top: 0, textStyle: { color: t.ink3, fontSize: 11 } },
      xAxis: {
        type: 'category',
        name: '노드 수',
        nameTextStyle: { color: t.ink4, fontSize: 11 },
        data: ['1천', '1만', '10만', '100만', '1,000만'],
        axisLine: { lineStyle: { color: t.axis } },
        axisLabel: { color: t.ink3 },
      },
      yAxis: {
        type: 'log',
        name: '상대 비용',
        nameTextStyle: { color: t.ink4, fontSize: 11 },
        splitLine: { lineStyle: { color: t.grid } },
        axisLabel: { color: t.ink3, formatter: (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1000 ? `${v / 1000}K` : v) },
      },
      series: [
        { name: '전체 스캔', type: 'line', smooth: true, symbolSize: 7, data: sizes, lineStyle: { width: 2.4, color: t.danger }, itemStyle: { color: t.danger } },
        {
          name: '인덱스 탐색',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: sizes.map((n) => Math.round(40 + 5 * Math.log2(n))),
          lineStyle: { width: 2.4, color: t.warn },
          itemStyle: { color: t.warn },
        },
        { name: '포인터 추적 (1홉)', type: 'line', symbolSize: 7, data: sizes.map(() => 8), lineStyle: { width: 2.4, color: t.ok }, itemStyle: { color: t.ok } },
      ],
      animationDuration: 600,
    }),
  });
  return el;
}

/* ================= 페이지 ================= */
export default {
  id: 'theory/internals',
  title: '그래프 DB 내부 구조',
  kicker: 'CHAPTER 03 · INTERNALS',
  summary: '그래프 DB가 빠른 이유는 마법이 아니라 저장 레이아웃입니다. 레코드·포인터·인덱스·락을 뜯어보면 언제 빠르고 언제 느린지가 보입니다.',
  minutes: 14,
  tags: ['Property Graph', 'RDF', 'index-free adjacency', '제약', '트랜잭션'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      pageHead({
        kicker: 'CHAPTER 03 · INTERNALS',
        title: '그래프 DB 내부 구조',
        summary: '그래프 DB의 성능은 <strong>“관계를 저장했기 때문”</strong>에 나옵니다. 무엇을 어떻게 저장하는지 알면 어떤 워크로드에서 느려질지도 예측할 수 있습니다.',
        minutes: 14,
        tags: ['Property Graph vs RDF', '레코드 레이아웃', '인덱스', 'READ COMMITTED'],
      })
    );

    /* 1 ── 두 데이터 모델 */
    el.append(
      section(
        { num: '1', title: '두 가지 데이터 모델 — Property Graph와 RDF', lead: '그래프 DB를 고를 때 첫 갈림길은 제품이 아니라 <strong>데이터 모델</strong>입니다.' },
        prose(
          `Property Graph는 <strong>노드 · 관계 · 속성</strong>으로 구성되고, 관계는 방향과 타입을 가지며 <strong>관계 자체에 속성을 붙일 수 있습니다</strong>.
          RDF는 모든 것을 <strong>주어–서술어–목적어 트리플</strong>로 표현하며, 서술어는 IRI일 뿐이라 속성을 갖지 못합니다.
          “공급 관계에 리드타임을 붙이고 싶다”면 RDF에서는 관계를 다시 노드로 승격해야 하고, 이를 <strong>리파이케이션(reification)</strong>이라 부릅니다.`
        ),
        tableBlock({
          head: ['구분', 'Property Graph (Neo4j, Memgraph, Neptune)', 'RDF (Oxigraph, GraphDB, Stardog)'],
          rows: [
            ['기본 단위', '노드 + 관계 + 속성', '트리플 (s, p, o)'],
            ['관계의 정체', '1급 객체. 방향·타입·속성 보유', '서술어 IRI. 속성 없음(필요하면 노드로 승격)'],
            ['식별자', '내부 id + 업무 키(속성)', 'IRI (전역 유일)'],
            ['스키마', '라벨/관계 타입 + 제약(선택)', 'RDFS/OWL/SHACL로 선언, 추론 가능'],
            ['질의', 'Cypher · GQL · Gremlin', 'SPARQL 1.1'],
            ['강점', '경로 탐색, 애플리케이션 내장, 속성 풍부', '표준 상호운용, 추론, 데이터 통합'],
          ],
          compact: true,
          caption: '두 모델은 경쟁 관계라기보다 “무엇을 1급으로 둘 것인가”의 차이입니다.',
        }),
        codeBlock({
          lang: 'turtle',
          title: 'RDF에서 “관계에 속성 붙이기” = 관계를 노드로',
          code: `@prefix ex:  <https://modumall.example/schema#> .
@prefix exr: <https://modumall.example/resource/> .

# 트리플만으로는 "리드타임 7일"을 공급 관계에 붙일 수 없다
exr:p1 ex:suppliedBy exr:s1 .

# 그래서 관계를 노드로 승격한다 (리파이케이션)
exr:sup1 a ex:SupplyRelation ;
  ex:subject  exr:s1 ;
  ex:object   exr:p1 ;
  ex:leadDays 7 ;
  ex:validFrom "2023-01-15"^^xsd:date .`,
          note: 'RDF-star(SPARQL-star)를 지원하는 저장소는 트리플을 다시 주어로 쓸 수 있어 이 우회를 줄여 줍니다.',
        }),
        callout(
          'engineer',
          'RDB 머릿속 번역표',
          `RDB의 <strong>테이블 = 클래스</strong>, <strong>행 = 인스턴스</strong>, <strong>FK = 관계</strong>로 대응됩니다.
          차이는 FK가 “무결성 규칙”인 반면 그래프의 관계는 <strong>실제로 저장된 데이터</strong>라는 점입니다.
          RDB에서 조인으로 계산하던 것이 그래프에서는 읽기가 됩니다.`
        )
      )
    );

    /* 2 ── 레코드 레이아웃 */
    el.append(
      section(
        { num: '2', title: '레코드 레이아웃 — 연결은 계산이 아니라 저장이다', lead: '노드는 몇 바이트짜리 작은 레코드이고, 관계는 <strong>양 끝을 가리키는 포인터</strong>입니다.' },
        prose(
          `그래프 저장소는 노드마다 작은 <strong>고정 길이 레코드</strong>를 둡니다. 여기에는 라벨 토큰, <strong>첫 번째 관계 레코드의 주소</strong>,
          첫 번째 속성 레코드의 주소가 들어갑니다. 관계 레코드에는 시작·끝 노드 id, 관계 타입, 그리고 <strong>양 끝 노드의 관계 체인에서의 prev/next 포인터</strong>가
          들어갑니다. 그래서 노드 하나의 관계 목록은 양방향 연결 리스트가 되고, 어느 쪽에서 출발해도 첫 관계를 O(1)에 찾습니다.`
        ),
        prose(
          `핵심은 <strong>관계 레코드가 곧 “인접 리스트의 노드”</strong>라는 점입니다. RDB에서 인접 리스트는 인덱스로 찾아야 하는 자료 구조지만,
          여기서는 포인터가 이미 저장되어 있습니다. 그래서 <code>1홉</code>은 “인덱스 탐색 1회”가 아니라 “포인터 1회”입니다.`
        ),
        recordDiagram(),
        callout(
          'warn',
          '이 그림은 단순화되었습니다',
          `Neo4j 4.x 이후 레코드는 블록 기반 포맷으로 바뀌었고, 문자열·배열 값은 별도 동적 저장소에 있습니다.
          버전마다 레코드 크기와 배치는 다르지만 <strong>“작은 레코드 + 포인터 체인”</strong>이라는 성질은 동일합니다.
          면접에서 바이트 수를 외우기보다 이 성질을 설명하는 편이 정확합니다.`
        )
      )
    );

    /* 3 ── index-free adjacency */
    el.append(
      section(
        { num: '3', title: '인덱스 없는 인접성, 그리고 인덱스', lead: '“인덱스를 안 쓴다”는 절반만 맞습니다. <strong>홉마다는 안 쓰고, 시작점에는 씁니다.</strong>' },
        prose(
          `index-free adjacency는 <strong>“이미 연결된 노드로 갈 때 인덱스를 조회하지 않는다”</strong>는 뜻입니다. 반대로 <strong>“김하늘이라는 고객을 찾는 일”</strong>에는
          인덱스가 필요합니다. Neo4j 5에는 RANGE(기본, 복합 가능), TEXT, POINT, LOOKUP(라벨·타입 토큰), FULLTEXT 인덱스가 있고,
          시작점을 찾을 때 <code>NodeIndexSeek</code> 연산자로 실행 계획에 나타납니다.`
        ),
        neighborDemo(ctx),
        lookupCostChart(ctx),
        callout(
          'engineer',
          '실무 감각',
          `그래프 DB에서 느린 쿼리의 90%는 <strong>시작점을 못 좁힌 쿼리</strong>입니다.
          <code>MATCH (n) WHERE n.name = $name</code>은 라벨도 인덱스도 없으니 전체 스캔입니다.
          <code>MATCH (n:Customer {name: $name})</code>처럼 <strong>라벨 + 인덱스 속성</strong>을 주는 순간 계획이 바뀝니다.`
        )
      )
    );

    /* 4 ── 제약과 트랜잭션 */
    el.append(
      section(
        { num: '4', title: '제약과 트랜잭션 — 정합성은 어디까지 보장되나', lead: '그래프 DB도 <strong>제약 · ACID · 락</strong>을 제공합니다. 범위와 한계가 RDB와 다를 뿐입니다.' },
        codeBlock({
          lang: 'cypher',
          title: 'Neo4j 5 제약조건 정의와 확인',
          code: `// 1) 유일성 — 중복 노드를 막는 1차 방어선
CREATE CONSTRAINT customer_id IF NOT EXISTS
FOR (c:Customer) REQUIRE c.id IS UNIQUE;

// 2) 존재 — "값이 반드시 있어야 한다" (RDB의 NOT NULL)
CREATE CONSTRAINT product_name IF NOT EXISTS
FOR (p:Product) REQUIRE p.name IS NOT NULL;

// 3) 복합 유일 — 업무 키 조합
CREATE CONSTRAINT order_external IF NOT EXISTS
FOR (o:Order) REQUIRE (o.channel, o.externalId) IS UNIQUE;

// 4) 관계 속성 존재
CREATE CONSTRAINT contains_qty IF NOT EXISTS
FOR ()-[r:CONTAINS]-() REQUIRE r.qty IS NOT NULL;

// 5) 현재 걸린 제약 확인
SHOW CONSTRAINTS
YIELD name, type, labelsOrTypes, properties
RETURN name, type, labelsOrTypes, properties;`,
          note: '제약은 “문서화된 관례”를 기계가 강제하는 장치입니다. 모델링 회의에서 합의한 규칙을 코드로 남기세요.',
        }),
        prose(
          `Neo4j의 기본 격리 수준은 <strong>READ COMMITTED</strong>이고, 쓰기는 <strong>노드·관계 단위 락</strong>으로 직렬화됩니다.
          읽기는 락을 잡지 않고 마지막 커밋 상태를 봅니다. 락은 커밋까지 유지되고, 교착 상태는 커널이 감지해 한쪽을
          <code>DeadlockDetectedException</code>으로 중단시킵니다. RDB의 <strong>REPEATABLE READ / SERIALIZABLE</strong>에 해당하는 모드는 없으므로,
          “읽고–검증하고–쓰기”가 필요한 로직은 <strong>유일성 제약 + MERGE</strong>로 설계해야 합니다.`
        ),
        prose(
          `트랜잭션 상태는 커밋 전까지 메모리에 쌓이므로 <strong>수백만 건을 한 트랜잭션에 넣으면</strong> 힙이 커지고 다른 쓰기를 막습니다.
          대량 적재는 <code>CALL { ... } IN TRANSACTIONS OF 10000 ROWS</code>로 나누는 것이 표준적인 처방입니다.`
        ),
        callout(
          'warn',
          '가장 흔한 정합성 사고',
          `제약 없이 <code>MERGE</code>를 병렬로 돌리면 <strong>같은 키의 노드가 2개 생깁니다</strong>.
          MERGE는 “먼저 조회하고 없으면 생성”이라 두 트랜잭션이 동시에 조회하면 둘 다 생성합니다.
          <strong>유일성 제약이 없으면 이 경쟁은 막을 수 없습니다.</strong> 제약은 성능 옵션이 아니라 정합성 장치입니다.`
        )
      )
    );

    /* 5 ── 제품 비교 */
    el.append(
      section(
        { num: '5', title: '제품 지형 — 무엇이 어떻게 다른가', lead: '같은 “그래프 DB”라도 저장 엔진과 트랜잭션 모델이 다릅니다. 벤치마크보다 <strong>운영 제약</strong>을 보세요.' },
        tableBlock({
          head: ['제품', '모델', '저장 방식', '쿼리', '트랜잭션', '강점 / 유의점'],
          rows: [
            ['Neo4j 5', '레이블 속성 그래프', '네이티브 저장(레코드+포인터), 페이지 캐시', 'Cypher, GQL 정렬', 'READ COMMITTED, 쓰기 락', '생태계·도구 성숙. 전체 스캔성 집계는 불리'],
            ['Memgraph', '레이블 속성 그래프', '인메모리 + WAL/스냅샷', 'openCypher', 'MVCC(델타 기반)', '낮은 지연, 스트리밍 수집. 메모리 용량이 상한'],
            ['ArangoDB', '멀티모델(문서+그래프)', 'RocksDB 기반, 엣지 컬렉션', 'AQL', 'MVCC, ACID', '문서+그래프 혼합. 순수 탐색은 전용 엔진보다 느릴 수 있음'],
            ['Amazon Neptune', 'PG + RDF', '분리형 스토리지, 3 AZ 복제, 사용자 인덱스 없음', 'Gremlin, openCypher, SPARQL', '읽기 복제(최대 15), 장애 조치', '완전관리형. 인덱스를 못 만들어 모델로 해결해야 함'],
            ['TigerGraph', '레이블 속성 그래프', 'MPP, 파티션 병렬, 압축 컬럼 저장', 'GSQL', 'ACID(단일 그래프), 분산 실행', '대규모 병렬 분석. 운영·튜닝 복잡도 높음'],
            ['Oxigraph', 'RDF (트리플/쿼드)', 'Rust + RocksDB, SPO/POS/OSP 인덱스', 'SPARQL 1.1', '단일 프로세스 ACID', '임베디드·경량. 동시 쓰기 처리량은 제한적'],
            ['GraphDB · Stardog', 'RDF + 추론', 'RDF4J 계열, 추론 인덱스, 가상 그래프', 'SPARQL 1.1', 'ACID, 클러스터 옵션', '온톨로지 추론·데이터 통합. 라이선스 비용'],
          ],
          compact: true,
        }),
        prose(
          `선택 기준은 대개 셋으로 좁혀집니다. <strong>① 데이터가 이미 RDF/온톨로지인가</strong>, <strong>② 쓰기 처리량과 지연 중 무엇이 중요한가</strong>,
          <strong>③ 완전관리형이 필요한가</strong>입니다. “가장 빠른 그래프 DB”는 워크로드에 따라 답이 바뀌므로 의미가 적습니다.`
        ),
        callout(
          'insight',
          '스키마 제약이 곧 성능',
          `제약과 인덱스는 <strong>쓰기를 느리게 하고 읽기를 빠르게</strong> 만드는 교환입니다. 그래프 DB는 “스키마가 없다”는 말 때문에
          제약을 건너뛰기 쉬운데, 그러면 중복 노드와 전체 스캔이라는 두 가지 부채가 동시에 쌓입니다.`
        )
      )
    );

    /* 6 ── 퀴즈 */
    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/internals',
          questions: [
            {
              q: 'index-free adjacency의 정확한 의미는?',
              options: [
                '인덱스를 전혀 만들 수 없어서 조회가 빠르다',
                '이미 연결된 노드로 갈 때는 저장된 포인터를 따라가므로 인덱스 탐색이 필요 없다',
                '인접 행렬을 메모리에 올려 그래프를 계산한다',
              ],
              answer: 1,
              explain: '시작 노드를 찾을 때는 인덱스가 필요합니다. 인덱스가 필요 없는 것은 “홉”입니다. 노드 레코드의 첫 관계 포인터에서 시작해 관계 체인을 따라갑니다.',
            },
            {
              q: '관계 레코드에 저장되는 정보로 가장 정확한 것은?',
              options: [
                '양 끝 노드의 id, 관계 타입, 각 끝 노드의 관계 체인 prev/next 포인터',
                '양 끝 노드의 모든 속성 사본',
                '관계 타입별 전역 인덱스 엔트리',
              ],
              answer: 0,
              explain: '관계 레코드는 작은 고정 길이 레코드입니다. 속성 값은 별도 저장소에 있고 레코드는 그 주소만 들고 있습니다. 이 작은 크기가 캐시 효율의 근원입니다.',
            },
            {
              q: '유일성 제약 없이 여러 트랜잭션이 동시에 같은 키로 MERGE를 실행하면?',
              options: ['항상 하나의 노드만 생성된다', '같은 키의 노드가 2개 이상 생성될 수 있다', 'DB가 자동으로 트랜잭션을 직렬화한다'],
              answer: 1,
              explain: 'MERGE는 조회 후 생성이라 경쟁 조건이 있습니다. 유일성 제약이 있어야 두 번째 커밋이 실패하며 중복이 막힙니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>그래프 DB는 관계를 “저장”하고, 그 대가로 쓰기·저장 공간·정합성 관리를 떠안습니다.</strong> 레코드와 포인터를 이해하면 왜 탐색이 빠르고 왜 전체 집계가 느린지가 같은 설명으로 풀립니다.'
      )
    );

    return { destroy() {} };
  },
};
