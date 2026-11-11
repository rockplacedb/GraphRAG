/**
 * 이론 07 — 온톨로지와 지식 표현
 * 라벨과 클래스, RDF/IRI/Turtle, RDFS 추론(대화형), OWL Lite와 SHACL 검증, 거버넌스.
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
  quizBlock,
  compareBlock,
  badge,
} from '../ui/blocks.js';

const CLASS_TREE = [
  ['Product', 'Thing'], ['AudioProduct', 'Product'], ['Headphone', 'AudioProduct'], ['Speaker', 'AudioProduct'],
  ['PowerProduct', 'Product'], ['Charger', 'PowerProduct'], ['Supplier', 'Thing'], ['AudioSupplier', 'Supplier'],
];

const INSTANCES = [
  { id: 'p1', cls: 'Headphone', name: '무선 이어폰', group: 'Product', props: { sku: 'P-1001', price: 89000 } },
  { id: 'p3', cls: 'AudioProduct', name: '노이즈캔슬링 헤드폰', group: 'Product', props: { sku: 'SKU-1003', price: '289,000원' } },
  { id: 's1', cls: 'Supplier', name: '한빛전자', group: 'Supplier', props: { country: '한국' } },
];

/** 명시적 트리플: 클래스 계층 + 인스턴스 타입 + 공급 관계 */
const EXPLICIT = {
  nodes: [
    { id: 'Thing', labels: ['Class'], props: { name: 'Thing', iri: 'ex:Thing' } },
    ...CLASS_TREE.map(([c]) => ({ id: c, labels: ['Class'], props: { name: c, iri: `ex:${c}` } })),
    ...INSTANCES.map((n) => ({ id: n.id, labels: [n.group], props: { name: n.name, iri: `inst:${n.id}`, ...n.props } })),
  ],
  edges: [
    ...CLASS_TREE.map(([c, p]) => ({ id: `${c}-sub-${p}`, from: c, to: p })),
    ...INSTANCES.map((n) => ({ id: `${n.id}-type`, from: n.id, to: n.cls, label: 'type' })),
    { id: 'p1-s1', from: 'p1', to: 's1', label: 'suppliedBy' },
  ],
};

/** 존재 제한(∃)을 만족시키려고 추론기가 만드는 익명 개체 */
const ANON = {
  id: 'anon:sup',
  labels: ['Individual'],
  props: { name: '_:sup_p1', kind: '익명 개체 (blank node)', note: '∃ 제한을 만족시키려고 추론기가 생성' },
};

/** 추론으로 추가되는 트리플(점선) */
const INFERRED = [
  ['Headphone', 'Product', null],
  ['p1', 'AudioProduct', 'type'],
  ['p1', 'Product', 'type'],
  ['s1', 'p1', 'supplies'],
  ['p1', 'anon:sup', 'suppliedBy'],
  ['anon:sup', 'AudioSupplier', 'type'],
].map(([from, to, label], i) => ({ id: `inf-${i}`, from, to, label, inferred: true, type: 'inferred' }));

const INFERRED_TRIPLES = [
  'ex:Headphone rdfs:subClassOf ex:Product   # 전이', 'inst:p1 a ex:AudioProduct                # 상위 클래스',
  'inst:p1 a ex:Product                     # 전이', 'inst:s1 ex:supplies inst:p1              # owl:inverseOf',
  'inst:p1 ex:suppliedBy _:sup_p1           # ∃ 제한', '_:sup_p1 a ex:AudioSupplier              # ∃ 제한',
];

/* ---------------- 추론 토글 + 계층 그래프 ---------------- */
function ontologyLab(ctx) {
  const full = { nodes: [...EXPLICIT.nodes, ANON], edges: [...EXPLICIT.edges, ...INFERRED] };
  let view = null;
  let mode = 'explicit';
  const hooks = [];

  const g = graphCard(ctx, {
    title: '클래스 계층과 인스턴스',
    subtitle: '실선은 사람이 쓴 트리플, <strong>점선은 추론기가 더한 트리플</strong>입니다. 아래 버튼으로 추론을 켜고 끄세요.',
    data: EXPLICIT,
    height: 470,
    hierarchical: true,
    edgeLabels: true,
    legendGroups: ['Class', 'Product', 'Supplier'],
  });

  const stateText = h('span', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' } }, `명시 트리플 ${EXPLICIT.edges.length}개 (추론 꺼짐)`);
  const onBtn = h('button', { class: 'btn btn--sm btn--primary', type: 'button' }, '추론 켜기');
  const offBtn = h('button', { class: 'btn btn--sm', type: 'button', disabled: true }, '추론 끄기');
  const inferredList = h('div.doc-list', { hidden: true },
    INFERRED_TRIPLES.map((t) => h('div.doc-item', { style: { borderLeftColor: 'var(--node-supplier)' } },
      h('span', { style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)' } }, t))));

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    const on = mode === 'inferred';
    view?.setData(on ? full : EXPLICIT);
    onBtn.disabled = on;
    offBtn.disabled = !on;
    onBtn.classList.toggle('btn--primary', !on);
    offBtn.classList.toggle('btn--primary', on);
    inferredList.hidden = !on;
    stateText.textContent = on
      ? `명시 ${EXPLICIT.edges.length} → 추론 후 ${full.edges.length} 트리플 (+ 익명 노드 1)`
      : `명시 트리플 ${EXPLICIT.edges.length}개 (추론 꺼짐)`;
    for (const fn of hooks) fn(mode);
  }
  onBtn.addEventListener('click', () => setMode('inferred'));
  offBtn.addEventListener('click', () => setMode('explicit'));
  g.ready.then((v) => {
    view = v;
    if (mode === 'inferred') view?.setData(full);
  });

  const control = h('div.card',
    h('div.card__head', h('div.card__head-text',
      h('div.card__title', 'RDFS 추론 실행', badge('subClassOf · domain · inverseOf', 'accent')),
      h('div.card__sub', '추론은 데이터를 지우지 않고 <strong>사실을 더합니다</strong>. 켤 때 무엇이 늘어나는지 확인하세요.'))),
    h('div.card__body', h('div.row', onBtn, offBtn, h('span.spacer'), stateText), inferredList),
    h('div.card__foot',
      '추가된 노드 <code>_:sup_p1</code>은 익명 개체(blank node)입니다. “오디오 상품은 반드시 오디오 공급사와 연결된다”는 존재 제한을 만족시키기 위해 추론기가 만들어낸 노드로, 실제 OWL DL 추론기에서도 발생합니다.')
  );

  return {
    el: h('div.stack', g.el, control),
    onModeChange: (fn) => hooks.push(fn),
    /** SHACL 위반 노드를 빨갛게 강조 (빈 배열이면 원래 색으로) */
    highlight(ids) {
      if (!view) return;
      view.clearHighlight();
      if (!ids.length) return;
      view.highlight(ids, { edges: [] });
      try {
        view.nodes?.update?.(ids.map((id) => ({
          id,
          color: { background: 'rgba(239,68,68,0.5)', border: '#ef4444' },
          font: { color: '#ffffff', size: 13 },
        })));
      } catch {
        /* 시각적 강조 실패는 치명적이지 않다 */
      }
    },
  };
}

/* ---------------- SHACL 검증 리포트 ---------------- */
function shaclPanel(lab) {
  const VIOLATIONS = [
    { node: 'p1', focus: 'inst:p1', shape: 'ex:ProductShape', path: 'ex:sku', msg: '값 "P-1001"이 패턴 ^SKU-[0-9]{4}$ 를 만족하지 않습니다 (sh:pattern).' },
    { node: 'p3', focus: 'inst:p3', shape: 'ex:ProductShape', path: 'ex:price', msg: '값 "289,000원"은 xsd:integer가 아닙니다 (sh:datatype).' },
    { node: 's1', focus: 'inst:s1', shape: 'ex:SupplierShape', path: 'ex:riskScore', msg: '필수 속성이 없습니다 (sh:minCount 1).' },
  ];
  const rows = [];
  const list = h('div.shacl-list');
  const clearBtn = h('button', { class: 'btn btn--sm', type: 'button', disabled: true }, '강조 해제');
  let active = -1;

  function select(i) {
    active = i;
    rows.forEach((r, idx) => {
      r.style.borderColor = idx === i ? 'var(--danger-500)' : '';
      r.style.boxShadow = idx === i ? '0 0 0 2px rgba(239,68,68,0.22)' : '';
    });
    clearBtn.disabled = i < 0;
    lab.highlight(i < 0 ? [] : [VIOLATIONS[i].node]);
  }

  VIOLATIONS.forEach((v, i) => {
    const row = h('div.shacl-item.is-bad',
      {
        style: { cursor: 'pointer' }, role: 'button', tabindex: '0', 'aria-label': `${v.focus} 위반: ${v.msg}`,
        onClick: () => select(active === i ? -1 : i),
        onKeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(active === i ? -1 : i);
          }
        },
      },
      h('span.shacl-item__id', v.focus),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        h('span.shacl-item__msg', v.msg),
        h('span', { style: { fontSize: '10px', color: 'var(--ink-4)' } }, `${v.shape} · sh:path ${v.path} · focusNode ${v.focus}`))
    );
    rows.push(row);
    list.append(row);
  });

  clearBtn.addEventListener('click', () => select(-1));
  lab.onModeChange(() => select(-1));

  return h('div.card',
    h('div.card__head', h('div.card__head-text',
      h('div.card__title', 'SHACL 검증 리포트', badge('conforms: false', 'danger')),
      h('div.card__sub', '위반 항목을 누르면 위 그래프의 해당 인스턴스가 빨갛게 강조됩니다.'))),
    h('div.card__body', list,
      h('div.row', { style: { marginTop: '10px' } }, clearBtn, h('span.spacer'),
        h('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--ink-4)' } }, 'shapes 3개 · 위반 3건 · 2024-06-30 02:00 UTC'))),
    h('div.card__foot',
      '검증 시각과 shapes 버전을 함께 남기는 것이 중요합니다. “어제는 통과했는데 오늘 실패”의 원인은 대개 데이터가 아니라 <strong>shapes가 바뀐 것</strong>입니다.')
  );
}

export default {
  id: 'theory/ontology',
  title: '온톨로지와 지식 표현',
  kicker: 'CHAPTER 07 · ONTOLOGY',
  summary:
    '온톨로지는 <strong>클래스·관계·공리</strong>를 선언해 “무엇이 참인가”를 기계가 계산할 수 있게 합니다. RDF/RDFS/OWL로 추론하고, SHACL로 품질을 검증합니다.',
  minutes: 17,
  tags: ['RDF', 'RDFS', 'OWL', 'SHACL', 'SPARQL'],
  render(ctx) {
    const { el } = ctx;
    const lab = ontologyLab(ctx);

    el.append(
      pageHead({
        kicker: 'CHAPTER 07 · ONTOLOGY',
        title: '온톨로지와 지식 표현',
        summary: '라벨은 <strong>저장소의 태그</strong>이고 클래스는 <strong>집합과 공리</strong>입니다. 이 차이가 “계층을 질의할 수 있는가”, “없는 사실을 위반으로 볼 수 있는가”를 갈라놓습니다.',
        minutes: 17,
        tags: ['RDF 트리플', 'RDFS 추론', 'OWL Lite', 'SHACL', '거버넌스'],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '라벨은 클래스가 아니다',
          lead: 'Neo4j의 <code>:Product</code>와 온톨로지의 <code>ex:Product</code>는 이름만 비슷합니다. <strong>계층과 공리가 있느냐</strong>가 다릅니다.',
        },
        prose(
          `Property Graph의 라벨은 저장소가 관리하는 <strong>태그</strong>입니다. 라벨 스캔과 인덱스의 시작점 역할을 하고, 런타임에 자유롭게 붙였다 뗄 수 있습니다.
          온톨로지의 클래스는 <strong>집합</strong>이며 <code>rdfs:subClassOf</code>·<code>rdfs:domain</code>·<code>owl:Restriction</code> 같은 <strong>공리</strong>로 의미가 정의됩니다.
          그래서 “오디오 상품 전부”를 라벨 스캔이 아니라 <strong>계층 질의</strong>로 풀 수 있습니다.`
        ),
        compareBlock([
          { title: 'Property Graph 라벨', tone: 'c', items: ['저장소가 관리하는 태그', '라벨 스캔·인덱스의 시작점', '계층·공리·제약이 없다', '런타임에 자유롭게 추가'] },
          { title: '온톨로지 클래스', tone: 'b', items: ['집합 + 공리(정의)의 선언', 'subClassOf로 질의를 일반화', 'domain/range로 의미를 강제', '변경은 스키마 변경 절차를 탄다'] },
        ]),
        callout(
          'engineer',
          'RDB 비유로 정리하면',
          `라벨 ≈ <strong>테이블 이름</strong>(물리적 저장 단위), 클래스 ≈ <strong>도메인 타입 + CHECK 제약 + 추론 규칙</strong>입니다.
          라벨만으로는 “오디오 계열 전체”를 계층으로 풀 수 없고, 억지로 라벨을 5개 붙이면 그만큼 스캔 대상과 인덱스가 늘어납니다. 온톨로지는 그 계층을 <strong>데이터가 아니라 스키마</strong>로 옮긴 것입니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: 'RDF 트리플과 IRI — 문장을 전역 식별자로 쓰기',
          lead: '트리플은 <strong>주어–서술어–목적어</strong>. 주어·서술어는 IRI이고, 트리플의 모임은 순서 없는 <strong>집합</strong>입니다.',
        },
        prose(
          `“무선 이어폰은 SKU-1001이고 한빛전자가 공급한다”는 세 개의 트리플입니다. 값은 데이터타입이 붙은 리터럴입니다.
          트리플은 집합이라 순서가 없고 중복도 의미가 없지만, <strong>다른 IRI로 같은 사실을 적으면 다른 사실</strong>이 됩니다. 이 점이 RDB의 “같은 값이면 같은 행” 감각과 가장 크게 어긋납니다.`
        ),
        codeBlock({
          lang: 'turtle',
          title: 'Turtle — 모두몰 온톨로지 (발췌)',
          code: `@prefix ex:   <https://modumall.example/schema#> .
@prefix inst: <https://modumall.example/id/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

ex:Product       a owl:Class .
ex:AudioProduct  a owl:Class ; rdfs:subClassOf ex:Product .
ex:Headphone     a owl:Class ; rdfs:subClassOf ex:AudioProduct .
ex:Supplier      a owl:Class .
ex:AudioSupplier a owl:Class ; rdfs:subClassOf ex:Supplier .

ex:suppliedBy a owl:ObjectProperty ;
  rdfs:domain ex:Product ;
  rdfs:range  ex:Supplier ;
  owl:inverseOf ex:supplies .

ex:AudioProduct rdfs:subClassOf [
  a owl:Restriction ;
  owl:onProperty ex:suppliedBy ;
  owl:someValuesFrom ex:AudioSupplier
] .

inst:p1 a ex:Headphone ;
  ex:sku "SKU-1001" ;
  ex:suppliedBy inst:s1 .`,
          note:
            '<code>a</code>는 <code>rdf:type</code>의 축약입니다. 마지막 <code>[ ... ]</code>는 <strong>익명 클래스</strong>로, “오디오 상품은 오디오 공급사와 반드시 연결된다”는 존재 제한을 표현합니다.',
        }),
        tableBlock({
          head: ['RDF 용어', '설명', 'RDB 대응', '주의'],
          rows: [
            ['IRI', '전역 유일 식별자', 'PK + 네임스페이스', '발급 주체가 다르면 같은 실체에 IRI가 여럿 생긴다'],
            ['트리플', '주어–서술어–목적어', '행 하나', '순서·중복이 없는 집합이다'],
            ['리터럴', '값 + 데이터타입', '컬럼 값', '타입·언어 태그 불일치가 검증 1순위'],
            ['익명 노드', '식별자 없는 노드', '임시 행·구조체', '외부에서 조인할 수 없어 질의가 어려워진다'],
            ['네임드 그래프', '트리플의 묶음', '스키마·파티션', '그래프 단위로 권한·버전을 관리한다'],
          ],
          compact: true,
        }),
        callout(
          'warn',
          'owl:sameAs는 만능 열쇠가 아니다',
          `IRI는 <strong>PK인데 발급권이 분산</strong>되어 있습니다. 같은 상품에 사내 IRI와 외부 카탈로그 IRI가 따로 생기고, 이를 <code>owl:sameAs</code>로 묶는 순간 두 IRI의 모든 문장이 합쳐집니다.
          sameAs는 대칭·추이이므로 잘못 연결하면 <strong>오염이 그래프 전체로 번집니다</strong>. 자동 생성하지 말고, 결정적 키 기반 매핑을 먼저 만든 뒤 검수된 것만 추가합니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: 'RDFS — 가장 싼 추론, 가장 큰 효과',
          lead: '<code>subClassOf</code> · <code>domain</code> · <code>range</code> 세 가지로도 질의 결과가 달라집니다. 직접 켜 보세요.',
        },
        prose(
          `RDFS 추론은 세 규칙으로 요약됩니다. ① <code>subClassOf</code>는 전이적입니다. ② <code>domain</code>은 관계의 <strong>주어</strong>에 타입을 부여합니다.
          ③ <code>range</code>는 <strong>목적어</strong>에 타입을 부여합니다. 규칙을 데이터에 먼저 적용해 사실을 늘리는 방식이 <strong>전방 추론(forward chaining)</strong>,
          질의 시점에 필요한 것만 증명하는 방식이 <strong>후방 추론(backward chaining)</strong>입니다. 추론은 <strong>단조(monotonic)</strong>입니다 — 사실을 더할 뿐, 지우지 않습니다.`
        ),
        lab.el,
        prose(
          `추론을 켜면 같은 질의가 더 많은 행을 돌려주는 대신 <strong>저장 공간과 재계산 비용</strong>을 지불합니다. 이 교환은 RDB의 “뷰를 구체화할 것인가, 질의를 다시 쓸 것인가”와 같은 문제입니다.
          계층을 저장하지 않고 질의 시점에 따라가는 선택지도 항상 함께 검토해야 합니다.`
        ),
        codeBlock({
          lang: 'sparql',
          title: '같은 질문, 두 가지 실행 방식',
          code: `PREFIX ex: <https://modumall.example/schema#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

# 1) 추론이 꺼져 있으면: 명시적 타입만 매칭되므로 Headphone 인스턴스가 빠진다
SELECT ?p ?sku WHERE {
  ?p a ex:Product ; ex:sku ?sku .
}

# 2) 질의가 계층을 직접 따라간다: subClassOf* 는 0회 이상 경로
SELECT ?p ?sku WHERE {
  ?p a ?cls ; ex:sku ?sku .
  ?cls rdfs:subClassOf* ex:Product .
}`,
          note:
            '1번은 빠르지만 <strong>답이 불완전</strong>하고, 2번은 정확하지만 <strong>질의마다 경로 탐색 비용</strong>을 낸다. 머티리얼라이제이션은 이 비용을 쓰기 시점으로 옮기는 선택입니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: 'OWL Lite와 SHACL — 추론과 검증은 다른 일이다',
          lead: '<code>owl:inverseOf</code>·전이 속성·제한은 추론을, SHACL은 <strong>위반 보고</strong>를 담당합니다. 섞으면 둘 다 망가집니다.',
        },
        prose(
          `OWL Lite 수준에서 실무에 자주 쓰는 것은 <code>owl:inverseOf</code>, <code>owl:TransitiveProperty</code>, <code>owl:FunctionalProperty</code>,
          그리고 <code>owl:Restriction</code>(<code>someValuesFrom</code>·<code>allValuesFrom</code>·<code>minCardinality</code>)입니다. 전이는 공급망·카테고리 경로에, inverse는 “공급한다/공급받는다” 같은 방향 질의에 유용합니다.
          반면 <strong>“값이 반드시 있어야 한다”</strong>는 요구는 OWL로 표현해도 추론되지 않습니다 — OWL은 <strong>열린 세계</strong>를 가정하기 때문입니다.`
        ),
        codeBlock({
          lang: 'turtle',
          title: 'SHACL — 검증은 온톨로지 밖에서',
          code: `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <https://modumall.example/schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:ProductShape a sh:NodeShape ;
  sh:targetClass ex:Product ;
  sh:property [ sh:path ex:sku   ; sh:minCount 1 ; sh:pattern "^SKU-[0-9]{4}$" ] ;
  sh:property [ sh:path ex:price ; sh:minCount 1 ; sh:datatype xsd:integer ] .

ex:SupplierShape a sh:NodeShape ;
  sh:targetClass ex:Supplier ;
  sh:property [ sh:path ex:riskScore ; sh:minCount 1 ; sh:datatype xsd:decimal ] .`,
          note:
            'shape는 <strong>데이터를 절대 바꾸지 않습니다</strong>. 결과는 <code>sh:conforms</code>와 <code>sh:result</code>(focusNode·path·value)로 돌아옵니다. 그래서 CI의 품질 게이트로 쓰기 좋습니다.',
        }),
        shaclPanel(lab),
        callout(
          'insight',
          '열린 세계 vs 닫힌 세계',
          `OWL은 “모르는 것”을 거짓으로 보지 않습니다. 그래서 <code>ex:riskScore</code>가 없어도 “없다”고 추론하지 못합니다. SHACL은 검증 대상 노드에 대해 <strong>없으면 위반</strong>이라고 봅니다(닫힌 세계).
          추론은 <strong>지식 확장</strong>, SHACL은 <strong>품질 게이트</strong>입니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '거버넌스 — 온톨로지도 스키마 변경이다',
          lead: '한 번 공개한 IRI는 되돌리기 어렵습니다. <strong>이름·버전·재사용</strong> 규칙을 먼저 정해야 합니다.',
        },
        tableBlock({
          head: ['항목', '규칙', '위반 증상'],
          rows: [
            ['네임스페이스', '`https://modumall.example/schema#` 고정, 버전은 경로(`/1.2/`)로', '문서마다 클래스 IRI가 달라져 조인이 깨진다'],
            ['네이밍', '클래스 PascalCase, 속성 camelCase, 표시명은 `rdfs:label`', '같은 개념에 두 이름이 생겨 중복 질의'],
            ['재사용', 'schema.org·FOAF·SKOS는 `subClassOf`/`sameAs`로 매핑', '표준을 직접 수정해 상호운용성이 붕괴'],
            ['버전', '새 버전 IRI를 만들고 구버전은 유지', '구·신 버전 데이터가 한 그래프에 섞임'],
            ['폐기', '삭제 대신 `owl:deprecated true` + 대체 IRI', '기존 질의가 오류 없이 빈 결과를 낸다'],
            ['레이블', '`skos:prefLabel`·`altLabel`로 다국어·동의어 관리', '검색이 표기 차이에 취약해짐'],
          ],
          compact: true,
        }),
        callout(
          'warn',
          '표준 온톨로지는 “복사해서 고치지” 않는다',
          `schema.org의 <code>Product</code>를 그대로 쓰면 우리 도메인의 제약(예: SKU 필수)을 담을 수 없고, 그렇다고 표준 IRI를 수정하면 상호운용성이 깨집니다.
          정답은 <strong>로컬 미러 + 매핑</strong>입니다. <code>ex:Product rdfs:subClassOf schema:Product</code>처럼 방향을 걸어 두면 외부 도구와 우리 제약을 동시에 만족시킬 수 있습니다.`
        ),
        callout(
          'engineer',
          '변경 절차: DDL + 데이터 재작성 + 재추론',
          `클래스를 옮기거나 domain을 바꾸면 <strong>이미 추론된 트리플이 전부 무효</strong>가 될 수 있습니다. RDB에서 뷰에 의존하는 객체를 찾는 작업처럼 “이 공리를 사용하는 질의·shape·파이프라인”의 목록을 유지해야 합니다.`
        )
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/ontology',
          questions: [
            {
              q: 'ex:Headphone ⊑ ex:AudioProduct, ex:AudioProduct ⊑ ex:Product 일 때 RDFS 추론 결과로 옳은 것은?',
              options: ['Headphone의 인스턴스는 Product의 인스턴스로도 질의된다', 'Product가 Headphone의 하위 클래스가 된다', '추론 결과가 없고 명시된 트리플만 남는다'],
              answer: 0,
              explain: 'subClassOf는 전이적입니다. 따라서 Headphone ⊑ Product가 추론되고, Headphone 인스턴스는 Product 타입을 함께 갖습니다.',
            },
            {
              q: '“ex:sku 값이 반드시 있어야 한다”를 강제하려면 무엇을 써야 하는가?',
              options: ['OWL의 owl:someValuesFrom 제한', 'SHACL의 sh:minCount 제약', 'rdfs:domain 선언'],
              answer: 1,
              explain: 'OWL은 열린 세계라 “없음”을 위반으로 보지 못합니다. 존재를 강제하고 위반 리포트를 받으려면 SHACL이 맞습니다.',
            },
            {
              q: 'ex:suppliedBy rdfs:domain ex:Product 선언에서 추론되는 것은?',
              options: ['모든 Product가 suppliedBy 관계를 하나 이상 가진다', 'suppliedBy 문장의 주어가 Product 타입으로 추론된다', 'suppliedBy의 목적어가 Product 타입으로 추론된다'],
              answer: 1,
              explain: 'domain은 주어에, range는 목적어에 타입을 부여합니다. “모든 Product가 관계를 가진다”는 카디널리티/존재 제한의 영역입니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>온톨로지는 “무엇이 참인가”를 선언하고, SHACL은 “무엇이 잘못됐는가”를 보고합니다.</strong> 추론은 지식을 늘리고 검증은 품질을 지킵니다. 둘을 섞으면 어느 쪽도 신뢰할 수 없게 됩니다.'
      )
    );
    return { destroy() {} };
  },
};
