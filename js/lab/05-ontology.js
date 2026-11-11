/**
 * Lab 5 — 온톨로지 구축과 추론·검증
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
import { GraphStore } from '../engine/graph-store.js';
import { toast } from '../core/toast.js';

const TURTLE = `@prefix :   <http://modumall.example/onto#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .

:Product        a owl:Class .
:AudioProduct   a owl:Class ; rdfs:subClassOf :Product .
:Headphone      a owl:Class ; rdfs:subClassOf :AudioProduct .
:Earbud         a owl:Class ; rdfs:subClassOf :AudioProduct .
:Speaker        a owl:Class ; rdfs:subClassOf :AudioProduct .
:Supplier       a owl:Class .

:hasCategory    a owl:ObjectProperty ;
                rdfs:domain :Product ;
                rdfs:range  :Category .

:p1 a :Earbud   ; rdfs:label "무선 이어폰" ; :hasCategory :CatAudio .
:p3 a :Headphone; rdfs:label "노이즈캔슬링 헤드폰" ; :hasCategory :CatAudio .
# 의도적 누락: p2 는 hasCategory 가 없다 → SHACL 위반
:p2 a :Speaker  ; rdfs:label "블루투스 스피커" .`;

const SHACL = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix :   <http://modumall.example/onto#> .

:AudioProductShape a sh:NodeShape ;
  sh:targetClass :AudioProduct ;
  sh:property [
    sh:path     :hasCategory ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message  "오디오 상품은 카테고리를 정확히 1개 가져야 합니다." ;
  ] ;`;

function buildOntologyStore() {
  const store = new GraphStore();
  const cls = (id, name) => store.addNode({ id: `C-${id}`, labels: ['Class'], props: { name, kind: 'class' } });
  cls('Product', 'Product');
  cls('AudioProduct', 'AudioProduct');
  cls('PowerProduct', 'PowerProduct');
  cls('Headphone', 'Headphone');
  cls('Earbud', 'Earbud');
  cls('Speaker', 'Speaker');
  cls('Supplier', 'Supplier');
  cls('Category', 'Category');

  store.addEdge({ id: 'sc1', type: 'SUBCLASS_OF', from: 'C-Earbud', to: 'C-AudioProduct' });
  store.addEdge({ id: 'sc2', type: 'SUBCLASS_OF', from: 'C-Headphone', to: 'C-AudioProduct' });
  store.addEdge({ id: 'sc3', type: 'SUBCLASS_OF', from: 'C-Speaker', to: 'C-AudioProduct' });
  store.addEdge({ id: 'sc4', type: 'SUBCLASS_OF', from: 'C-AudioProduct', to: 'C-Product' });
  store.addEdge({ id: 'sc5', type: 'SUBCLASS_OF', from: 'C-PowerProduct', to: 'C-Product' });

  store.addNode({ id: 'p1', labels: ['Product'], props: { name: '무선 이어폰', sku: 'SKU-1001' } });
  store.addNode({ id: 'p2', labels: ['Product'], props: { name: '블루투스 스피커', sku: 'SKU-1002' } });
  store.addNode({ id: 'p3', labels: ['Product'], props: { name: '노이즈캔슬링 헤드폰', sku: 'SKU-1003' } });
  store.addNode({ id: 's2', labels: ['Supplier'], props: { name: '대성테크' } });
  store.addNode({ id: 'catA', labels: ['Category'], props: { name: '오디오' } });

  store.addEdge({ id: 'ty1', type: 'TYPE', from: 'p1', to: 'C-Earbud' });
  store.addEdge({ id: 'ty2', type: 'TYPE', from: 'p2', to: 'C-Speaker' });
  store.addEdge({ id: 'ty3', type: 'TYPE', from: 'p3', to: 'C-Headphone' });
  store.addEdge({ id: 'ty4', type: 'TYPE', from: 's2', to: 'C-Supplier' });
  store.addEdge({ id: 'ct1', type: 'IN_CATEGORY', from: 'p1', to: 'catA' });
  store.addEdge({ id: 'ct3', type: 'IN_CATEGORY', from: 'p3', to: 'catA' });
  return store;
}

/** 추론: subClassOf 전이 + 타입 상속 */
function infer(store) {
  const inferred = [];
  const classes = store.nodesByLabel('Class');
  const superOf = new Map();
  for (const e of store.allEdges()) {
    if (e.type !== 'SUBCLASS_OF') continue;
    if (!superOf.has(e.from)) superOf.set(e.from, []);
    superOf.get(e.from).push(e.to);
  }
  // 전이 폐쇄
  const ancestors = (classId, seen = new Set()) => {
    const out = new Set();
    for (const parent of superOf.get(classId) || []) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      out.add(parent);
      for (const a of ancestors(parent, seen)) out.add(a);
    }
    return out;
  };
  for (const c of classes) {
    for (const a of ancestors(c.id)) {
      inferred.push({ id: `inf-sc-${c.id}-${a}`, type: 'SUBCLASS_OF', from: c.id, to: a });
    }
  }
  // 인스턴스 타입 상속
  for (const e of store.allEdges()) {
    if (e.type !== 'TYPE') continue;
    for (const a of ancestors(e.to)) {
      inferred.push({ id: `inf-ty-${e.from}-${a}`, type: 'TYPE', from: e.from, to: a });
    }
  }
  return inferred;
}

/** 단순 SHACL 검사: :Product 계열 인스턴스는 IN_CATEGORY 를 정확히 1개 */
function validateShacl(store) {
  const violations = [];
  const checks = [];
  const instanceTypes = new Map();
  for (const e of store.allEdges()) {
    if (e.type === 'TYPE') instanceTypes.set(e.from, e.to);
  }
  const productClasses = new Set(['C-Product', 'C-AudioProduct', 'C-Earbud', 'C-Headphone', 'C-Speaker', 'C-PowerProduct']);
  const catCount = new Map();
  for (const e of store.allEdges()) {
    if (e.type !== 'IN_CATEGORY') continue;
    catCount.set(e.from, (catCount.get(e.from) || 0) + 1);
  }
  for (const [instId, typeId] of instanceTypes) {
    if (!productClasses.has(typeId)) continue;
    const node = store.getNode(instId);
    const n = catCount.get(instId) || 0;
    const ok = n === 1;
    checks.push({
      id: instId,
      name: node?.props.name || instId,
      path: 'hasCategory',
      value: n,
      ok,
      message: ok ? '카테고리 1개 — 통과' : n === 0 ? '카테고리가 없습니다 (minCount 위반)' : '카테고리가 2개 이상입니다 (maxCount 위반)',
    });
    if (!ok) violations.push(instId);
  }
  return { checks, violations, shape: 'AudioProductShape', constraint: 'sh:minCount 1 / sh:maxCount 1' };
}

export default {
  id: 'lab/ontology',
  title: '온톨로지 구축과 추론',
  kicker: 'LAB 5',
  summary: '클래스 계층을 만들고, 추론으로 파생 사실을 얻고, SHACL로 데이터 품질을 강제합니다.',
  minutes: 24,
  tags: ['Turtle', '추론', 'SHACL'],
  render(ctx) {
    const { el } = ctx;
    let store = buildOntologyStore();
    let showInferred = false;
    let view = null;

    /* ---------- 그래프 ---------- */
    const graphEl = h('div');
    const readout = h('div', { class: 'card__foot' }, '추론을 켜면 점선으로 파생 사실이 추가됩니다. 데이터는 그대로이고, 보이는 사실이 늘어납니다.');

    function currentData() {
      const base = store.toVis();
      const extra = showInferred ? infer(store) : [];
      return {
        nodes: base.nodes,
        edges: [
          ...base.edges.map((e) => (e.label === undefined ? e : e)),
          ...extra.map((e) => ({ id: e.id, from: e.from, to: e.to, label: undefined, inferred: true })),
        ],
      };
    }

    function refresh() {
      if (view) view.setData(currentData());
    }

    const toggleBtn = h(
      'button',
      { class: 'btn btn--sm', type: 'button', 'aria-pressed': 'false' },
      '추론 켜기'
    );
    toggleBtn.addEventListener('click', () => {
      showInferred = !showInferred;
      toggleBtn.textContent = showInferred ? '추론 끄기' : '추론 켜기';
      toggleBtn.classList.toggle('btn--primary', showInferred);
      toggleBtn.setAttribute('aria-pressed', String(showInferred));
      refresh();
      readout.textContent = showInferred
        ? `추론 결과 ${infer(store).length}개의 파생 트리플이 추가되었습니다. 예: 무선 이어폰은 Earbud이므로 Product이기도 합니다.`
        : '추론을 끄면 명시된 사실만 남습니다. 데이터 자체는 변하지 않았습니다.';
      toast(showInferred ? '추론을 켰습니다 (파생 사실 표시)' : '추론을 껐습니다', 'ok');
    });

    const shaclBtn = h('button', { class: 'btn btn--sm', type: 'button' }, 'SHACL 검증 실행');
    const shaclOut = h('div', { class: 'shacl-list' });
    shaclBtn.addEventListener('click', () => {
      const result = validateShacl(store);
      shaclOut.replaceChildren(
        h('div', { class: 'row', style: { marginBottom: '4px' } }, badge(result.shape, 'accent'), h('span', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, result.constraint)),
        ...result.checks.map((c) =>
          h(
            'div',
            { class: `shacl-item ${c.ok ? 'is-ok' : 'is-bad'}` },
            h('span', { class: 'shacl-item__id' }, c.ok ? '✓' : '✕'),
            h('span', { class: 'shacl-item__msg' }, `${c.name} · ${c.path}=${c.value} — ${c.message}`)
          )
        )
      );
      if (result.violations.length) {
        view?.highlight(result.violations);
        toast(`${result.violations.length}건의 SHACL 위반을 찾았습니다`, 'warn');
      } else {
        view?.clearHighlight();
        toast('위반 없음', 'ok');
      }
    });

    const g = graphCard(ctx, {
      title: '클래스 계층 + 인스턴스',
      subtitle: '보라색이 클래스, 색이 있는 노드가 인스턴스입니다. 인스턴스는 클래스에 <strong>TYPE</strong> 관계로 연결됩니다.',
      data: store.toVis(),
      height: 420,
      seed: 41,
      tools: [toggleBtn, shaclBtn],
    });
    g.ready.then((v) => {
      view = v;
      refresh();
    });
    graphEl.append(g.el);

    /* ---------- 추가 실습용 스토어(트리플 작성) ---------- */
    const practiceStore = buildOntologyStore();
    ctx.store = practiceStore;

    el.append(
      ...labHead({
        num: 'LAB 5',
        kicker: 'ONTOLOGY',
        title: '온톨로지 구축과 추론',
        summary:
          '라벨 이름만으로는 “의미”를 표현할 수 없습니다. 클래스·속성·제약을 명시하면 <strong>기계가 추론하고 검증</strong>할 수 있습니다.',
        minutes: 24,
        tags: ['Turtle', 'RDFS', 'SHACL'],
        scenarioTitle: '“상품 분류가 사람마다 다릅니다. 규칙으로 강제해 주세요”',
        quote:
          '“어떤 팀은 헤드폰을 ‘오디오’로, 어떤 팀은 ‘액세서리’로 분류합니다. <strong>분류 규칙과 필수 조건</strong>을 데이터로 선언하고, 위반을 자동으로 잡고 싶습니다.”',
        reqs: [
          { id: 'R1', title: '분류 체계', desc: '상품 하위 클래스와 상속 관계를 선언' },
          { id: 'R2', title: '추론', desc: '하위 클래스는 상위 클래스의 성질을 물려받음' },
          { id: 'R3', title: '검증', desc: '카테고리 누락 같은 품질 위반을 자동 탐지' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '온톨로지를 코드로 적기 — Turtle',
          lead: 'RDF는 <strong>트리플의 집합</strong>입니다. Turtle은 그 집합을 읽기 쉽게 적는 문법입니다.',
        },
        prose(
          `Property Graph의 “라벨 이름”과 온톨로지의 “클래스”는 다릅니다. 라벨은 <strong>관례</strong>이고, 클래스는 <strong>선언</strong>입니다.
          <code>:Headphone rdfs:subClassOf :AudioProduct</code> 라고 선언하면, 이후 추론기가 “헤드폰은 오디오 상품”이라는 사실을 <strong>스스로</strong> 만들어 냅니다.`
        ),
        codeBlock({ lang: 'turtle', code: TURTLE, title: 'modumall 온톨로지 (발췌)' }),
        callout(
          'warn',
          '의도적으로 넣은 결함',
          '위 온톨로지에는 <code>p2</code>(블루투스 스피커)의 <code>:hasCategory</code>가 <strong>없습니다</strong>. 데이터 품질 검증이 실제로 잡아내는지 아래에서 확인하세요.'
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '추론과 SHACL 검증',
          lead: '추론은 <strong>보이는 사실</strong>을 늘리고, SHACL은 <strong>지켜야 할 규칙</strong>을 검사합니다.',
        },
        h('div', { class: 'stack stack--sm' }, graphEl, readout),
        h('div', { class: 'card' },
          h('div', { class: 'card__head' },
            h('div', { class: 'card__head-text' },
              h('div', { class: 'card__title' }, 'SHACL 검증 결과'),
              h('div', { class: 'card__sub' }, '“오디오 상품은 카테고리를 정확히 1개 가져야 한다”를 검사합니다.')
            )
          ),
          h('div', { class: 'card__body' }, shaclOut || h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' } }, '위의 “SHACL 검증 실행”을 눌러 결과를 확인하세요.'))
        ),
        codeBlock({ lang: 'turtle', code: SHACL, title: 'SHACL Shape' }),
        callout(
          'engineer',
          '제약조건과 무엇이 다른가',
          'Neo4j의 <code>CONSTRAINT</code>는 <strong>저장 시점</strong>에 막습니다(유니크·존재). SHACL은 <strong>검증 시점</strong>에 보고합니다. ' +
            '전자는 “잘못된 데이터가 들어오지 못하게”, 후자는 “이미 들어온 데이터의 품질을 측정”하는 데 적합합니다. 둘은 대체가 아니라 보완입니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '직접 트리플 추가하기',
          lead: '클래스를 하나 더 만들고 상속 관계를 이어 보세요. 결과 그래프에 즉시 반영됩니다.',
        },
        runPanel(ctx, {
          title: '3. 새 클래스 추가 (두 문장)',
          code: `CREATE (c:Class {name: 'NoiseCancelling'})
RETURN c.name AS created;

MATCH (c:Class {name: 'NoiseCancelling'}), (parent:Class {name: 'Headphone'})
CREATE (c)-[:SUBCLASS_OF]->(parent)
RETURN c.name AS cls, parent.name AS parent;`,
          hint: '문장은 세미콜론(;)으로 구분합니다',
          validate: (res, s) => {
            const node = s.allNodes().find((n) => n.props.name === 'NoiseCancelling');
            return {
              ok: Boolean(node),
              message: 'Class 노드가 만들어지고 Headphone의 하위로 연결되어야 합니다.',
            };
          },
          onSuccess: () => {
            // 실습 스토어를 메인 그래프에 반영
            store = practiceStore;
            refresh();
            toast('온톨로지 그래프에 반영했습니다', 'ok');
          },
        }),
        prose(
          `실제 RDF 스토어에서는 <code>INSERT DATA { ... }</code>로 트리플을 추가합니다. Property Graph에서 “클래스”를 노드로 두는 것은
          온톨로지를 그래프로 표현하는 한 방법입니다. 도구에 따라 클래스를 <strong>라벨 메타데이터</strong>로만 다루기도 합니다.`
        )
      )
    );

    el.append(
      section(
        { num: '4', title: '실제 환경에서 (참고)' },
        mockNotice(),
        neo4jBlock({
          title: '실제 환경에서는',
          steps: [
            {
              title: 'RDF 스토어 (SPARQL)',
              text: 'Turtle 파일을 적재한 뒤 SPARQL로 추론 결과를 확인합니다. 상용/오픈소스 RDF 스토어는 추론 프로파일(RDFS/OWL RL)을 설정으로 켭니다.',
              code: `PREFIX : <http://modumall.example/onto#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

# 헤드폰의 상위 클래스 전부
SELECT ?ancestor WHERE {
  :Headphone rdfs:subClassOf* ?ancestor .
}`,
              lang: 'sparql',
            },
            {
              title: 'Neo4j에서 유사하게',
              text: 'Neo4j에는 기본 추론기가 없습니다. 클래스 노드와 SUBClassOf 관계를 직접 만들고, 애플리케이션 또는 APOC로 전이 폐쇄를 계산합니다.',
              code: `MATCH (c:Class {name: 'Headphone'})-[:SUBCLASS_OF*1..5]->(p:Class)
RETURN p.name AS ancestor;`,
              lang: 'cypher',
            },
          ],
          note: '대규모 전이 추론은 비용이 큽니다. “필요할 때 질의로 계산” vs “미리 물질화(materialize)”를 데이터 규모와 갱신 빈도로 결정하세요.',
        })
      )
    );

    el.append(
      section(
        { num: '5', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/ontology',
          questions: [
            {
              q: '추론을 켰을 때 변하는 것은?',
              options: ['원본 데이터가 수정된다', '파생 사실이 추가로 보인다', '노드가 삭제된다'],
              answer: 1,
              explain: '추론은 명시된 사실에서 파생 사실을 계산합니다. 데이터 자체는 그대로입니다.',
            },
            {
              q: 'SHACL과 그래프 DB 제약조건의 차이로 가장 정확한 것은?',
              options: [
                'SHACL은 저장 시점에 차단하고, 제약은 나중에 검사한다',
                '제약은 저장 시점에 막고, SHACL은 검증 시점에 보고한다',
                '둘은 완전히 같다',
              ],
              answer: 1,
              explain: '제약은 쓰기 차단, SHACL은 품질 보고입니다. 함께 쓰는 것이 일반적입니다.',
            },
            {
              q: 'rdfs:subClassOf의 전이성으로 옳은 것은?',
              options: ['A⊑B, B⊑C 이면 A⊑C', 'A⊑B 이면 B⊑A', '전이되지 않는다'],
              answer: 0,
              explain: 'subClassOf는 전이 관계입니다. 그래서 추론이 파생 사실을 만들어 냅니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '<a href="#/lab/graph-rag">Lab 6 — Graph RAG 파이프라인</a>에서 이 모든 것을 검색 근거로 연결합니다.'));

    return { destroy() {} };
  },
};
