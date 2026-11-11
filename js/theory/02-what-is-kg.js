/**
 * 이론 02 — 지식 그래프의 정의
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
  statsBlock,
} from '../ui/blocks.js';

const TRIPLE_GRAPH = {
  nodes: [
    { id: 'p1', labels: ['Product'], props: { name: '무선 이어폰' } },
    { id: 's1', labels: ['Supplier'], props: { name: '한빛전자' } },
    { id: 'cat', labels: ['Category'], props: { name: '오디오' } },
    { id: 'c1', labels: ['Customer'], props: { name: '김하늘' } },
    { id: 'o1', labels: ['Order'], props: { name: 'O-1001' } },
  ],
  edges: [
    { id: 't1', type: 'SUPPLIED_BY', from: 'p1', to: 's1' },
    { id: 't2', type: 'IN_CATEGORY', from: 'p1', to: 'cat' },
    { id: 't3', type: 'CONTAINS', from: 'o1', to: 'p1' },
    { id: 't4', type: 'PLACED', from: 'c1', to: 'o1' },
  ],
};

const TRIPLES = [
  { id: 't1', s: 'p1', p: 'SUPPLIED_BY', o: 's1', text: '무선 이어폰 — 공급받는다 — 한빛전자' },
  { id: 't2', s: 'p1', p: 'IN_CATEGORY', o: 'cat', text: '무선 이어폰 — 속한다 — 오디오' },
  { id: 't3', s: 'o1', p: 'CONTAINS', o: 'p1', text: 'O-1001 — 포함한다 — 무선 이어폰' },
  { id: 't4', s: 'c1', p: 'PLACED', o: 'o1', text: '김하늘 — 주문했다 — O-1001' },
];

function tripleExplorer(ctx) {
  const list = h('div', { class: 'stack stack--sm' });
  const readout = h(
    'div',
    { class: 'card__foot', style: { borderTop: '1px solid var(--border)' } },
    '트리플에 마우스를 올리면 오른쪽 그래프에서 해당 관계가 강조됩니다.'
  );

  const g = graphCard(ctx, {
    title: '트리플 4개 = 그래프 하나',
    subtitle: '왼쪽 문장과 오른쪽 그래프는 <strong>같은 데이터</strong>입니다. 표현만 다를 뿐입니다.',
    data: TRIPLE_GRAPH,
    height: 380,
    seed: 3,
    hint: '노드를 눌러 속성을 확인할 수 있습니다',
  });

  let view = null;
  g.ready.then((v) => {
    view = v;
    if (view) view.setData(TRIPLE_GRAPH);
  });

  for (const t of TRIPLES) {
    const row = h(
      'div',
      {
        class: 'doc-item',
        style: { borderLeftColor: 'var(--accent)' },
        onMouseenter: () => {
          view?.highlight([t.s, t.o], { edges: [t.id] });
          readout.innerHTML = `<strong>${t.text}</strong> — 주어·관계·목적어 순서로 읽습니다.`;
        },
        onMouseleave: () => {
          view?.clearHighlight();
          readout.textContent = '트리플에 마우스를 올리면 오른쪽 그래프에서 해당 관계가 강조됩니다.';
        },
        onClick: () => view?.focus(t.o),
      },
      h('span', { class: 'doc-item__text', style: { fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' } }, t.text),
      h('div', { style: { marginTop: '4px' } }, h('span', { class: 'badge' }, `:${t.p}`))
    );
    list.append(row);
  }

  return h(
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
          h('div', { class: 'card__title' }, '문장을 데이터로'),
          h('div', { class: 'card__sub' }, '주어(Subject) – 관계(Predicate) – 목적어(Object). 이 세 조각이 “트리플”입니다.')
        )
      ),
      h('div', { class: 'card__body' }, list),
      readout
    ),
    g.el
  );
}

export default {
  id: 'theory/what-is-kg',
  title: '지식 그래프의 정의',
  kicker: 'CHAPTER 02 · KNOWLEDGE GRAPH',
  summary: '트리플로 지식을 표현하고, 엔티티를 식별하고, 스키마를 어디까지 강제할지 결정하는 일. 지식 그래프 설계의 본질입니다.',
  minutes: 13,
  tags: ['트리플', '엔티티', '스키마'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      pageHead({
        kicker: 'CHAPTER 02 · KNOWLEDGE GRAPH',
        title: '지식 그래프의 정의',
        summary:
          '지식 그래프는 <strong>엔티티(사물)와 그 사이의 관계</strong>를, 기계가 질의할 수 있는 형태로 저장한 것입니다. 문장 하나가 데이터 한 줄이 됩니다.',
        minutes: 13,
        tags: ['트리플', '엔티티 해소', '스키마리스'],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '트리플 — 문장이 데이터가 된다',
          lead: '“무선 이어폰은 한빛전자에서 공급받는다”는 문장은 <strong>세 개의 조각</strong>으로 분해됩니다.',
        },
        prose(
          `주어(무선 이어폰)와 목적어(한빛전자)는 <strong>엔티티</strong>, 관계(공급받는다)는 <strong>관계 타입</strong>입니다.
          이 세 조각을 <strong>트리플(triple)</strong>이라 하고, 트리플이 모이면 그래프가 됩니다.
          관계형 DB의 “조인 결과 한 줄”과 비슷해 보이지만, 결정적인 차이는 <strong>관계도 이름을 가진 1급 데이터</strong>라는 점입니다.`
        ),
        tripleExplorer(ctx)
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '엔티티 · 관계 · 속성 — 무엇이 노드가 되고 무엇이 속성이 되나',
          lead: '가장 많이 하는 실수는 <strong>성질을 엔티티로 승격</strong>하는 것입니다. 반대 실수도 흔합니다.',
        },
        tableBlock({
          head: ['구성요소', '정의', '예', '주의'],
          rows: [
            ['엔티티(노드)', '스스로 존재하는 사물·개념', '상품, 고객, 주문, 공급사', '같은 개념은 같은 노드로 합쳐야 한다(엔티티 해소)'],
            ['관계(엣지)', '두 엔티티 사이의 연결. 방향과 타입을 가짐', '고객 -[주문했다]-> 주문', '관계에 이름 붙이지 않으면 나중에 구분 불가'],
            ['속성', '엔티티/관계에 종속된 값', '상품.name, 상품.price', '다른 엔티티와 연결할 값이면 속성이 아니라 관계'],
            ['라벨', '노드의 종류(다중 가능)', ':Product, :Customer', '라벨은 스캔 시작점을 좁히는 인덱스 역할'],
            ['관계 속성', '연결 자체에 붙는 값', '주문 -[포함한다 {수량:2, 단가:89000}]-> 상품', 'RDB의 조인 테이블 속성을 그대로 옮길 수 있다'],
          ],
          compact: true,
        }),
        callout(
          'engineer',
          'RDB ↔ 그래프 번역표',
          `<strong>테이블 → 라벨</strong>, <strong>행 → 노드</strong>, <strong>FK → 관계</strong>가 기본 대응입니다. 다만 조인 테이블(M:N)은 대개 두 개의 관계로 펼쳐지고,
          <strong>단순 코드성 값</strong>(예: 상태 코드)은 별도 테이블이었더라도 그래프에서는 속성으로 두는 편이 나은 경우가 많습니다. 이 판단은 <a href="#/theory/modeling">4장 모델링</a>에서 자세히 다룹니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '엔티티 해소 — 지식 그래프의 진짜 난이도',
          lead: '“김하늘”과 “김 하늘”, “hanbit-electronics”와 “한빛전자”가 <strong>같은 회사</strong>임을 시스템이 어떻게 알까요?',
        },
        prose(
          `지식 그래프는 관계의 품질이 전부입니다. 서로 다른 소스의 고객·상품·공급사를 <strong>동일 엔티티로 병합</strong>하지 못하면,
          그래프는 “중복 노드 더미”가 되고 다중 홉 질의는 조용히 틀린 답을 냅니다. 이 과정을 <strong>엔티티 해소(ER)</strong>라고 부릅니다.`
        ),
        h(
          'div',
          { class: 'grid-2' },
          callout(
            'warn',
            '해소 없이 만든 KG의 증상',
            '같은 상품이 3개 노드로 존재 → 판매량 집계가 1/3로 나뉨 → 추천 품질 저하. 그리고 아무도 에러를 보지 못합니다.'
          ),
          callout(
            'insight',
            '실무의 해소 순서',
            '① 결정적 키(사업자번호·상품코드)로 병합 → ② 정규화(공백·대소문자·유니코드) → ③ 유사도 기반 후보 생성 → ④ 사람이 검수. 4단계 없이 자동 병합만 하면 되돌릴 수 없는 오류가 쌓입니다.'
          )
        ),
        codeBlock({
          lang: 'cypher',
          title: '결정적 키로 중복 병합하기',
          code: `// 같은 상품코드가 이미 있으면 그 노드를 재사용하고, 없으면 만든다
MERGE (p:Product {sku: 'SKU-1001'})
SET p.name = '무선 이어폰', p.price = 89000;

// 병합 결과는 “노드 수”로 검증한다
MATCH (p:Product)
RETURN count(*) AS products, count(DISTINCT p.sku) AS distinct_skus;`,
          note: '`MERGE`는 “있으면 매칭, 없으면 생성”입니다. 중복 생성 사고를 막는 가장 기본적인 도구입니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '스키마를 강제할 것인가 — 세 가지 선택지',
          lead: '정답은 “도메인 성숙도”에 따라 다릅니다. 처음부터 OWL을 쓰는 팀은 대개 실패합니다.',
        },
        compareBlock([
          {
            title: 'RDB — 스키마 강제',
            tone: 'c',
            items: ['컬럼 타입·제약·FK가 강제됨', '변경 시 마이그레이션 필요', '집계·정합성에 유리', '새 관계 타입 추가는 스키마 변경'],
          },
          {
            title: 'Property Graph — 느슨한 스키마',
            tone: 'b',
            items: ['라벨·관계 타입은 사실상 관례로 관리', '제약(UNIQUE/NOT NULL)으로 일부 강제 가능', '실험·진화에 유리', '관례를 문서화하지 않으면 곧 혼돈'],
          },
          {
            title: 'RDF/OWL — 의미를 명시',
            tone: 'c',
            items: ['클래스·속성·domain/range를 선언', '추론으로 파생 사실 생성', '도구·표준·상호운용성 강점', '모델링 비용이 높고 사람이 이해하기 어려움'],
          },
        ]),
        callout(
          'engineer',
          'DB 엔지니어에게 맞는 출발점',
          `대부분의 사내 프로젝트는 <strong>Property Graph + 문서화된 관례 + 제약조건</strong>으로 시작하는 것이 현실적입니다.
          온톨로지(7장)는 <strong>도메인이 안정되고 여러 팀이 같은 용어를 써야 할 때</strong> 도입하는 것이 순서입니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '지식 그래프가 실제로 쓰이는 곳',
          lead: '기술 소개가 아니라 <strong>요구사항</strong>으로 이해해야 합니다.',
        },
        statsBlock([
          { label: '검색 품질', value: '엔티티', unit: '중심', note: '“이 상품과 관련된 것”을 키워드가 아닌 관계로 찾기', accent: true },
          { label: '추천', value: '다중 홉', note: '함께 구매·함께 조회·같은 공급사' },
          { label: '리스크 전파', value: '3홉', note: '공급사 → 상품 → 주문 → 고객' },
          { label: 'Graph RAG', value: '근거', note: 'LLM에 넣을 근거를 그래프에서 조립 (8장)' },
        ]),
        prose(
          `네 가지 모두 공통점이 있습니다. <strong>“관계를 몇 번 따라가야 답이 나오는 질문”</strong>이라는 점입니다.
          이 관점으로 요구사항을 분류하면 그래프 도입 여부가 훨씬 명확해집니다.`
        )
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/what-is-kg',
          questions: [
            {
              q: '트리플의 세 요소로 올바른 것은?',
              options: ['테이블·컬럼·값', '주어·관계·목적어', '노드·엣지·인덱스'],
              answer: 1,
              explain: '지식 그래프의 기본 단위는 주어(엔티티) – 관계 – 목적어(엔티티/값)입니다.',
            },
            {
              q: '“상품의 색상”처럼 다른 엔티티와 연결할 필요가 없는 값은 보통 무엇으로 두는가?',
              options: ['별도 노드', '속성(property)', '관계 타입'],
              answer: 1,
              explain: '자체 식별자나 추가 관계가 필요 없다면 속성이 맞습니다. 엔티티로 승격하면 노드 수만 늘어납니다.',
            },
            {
              q: '엔티티 해소를 건너뛰었을 때 가장 위험한 결과는?',
              options: [
                '쿼리 문법 오류가 난다',
                '중복 노드로 인해 집계·경로 결과가 조용히 틀린다',
                '그래프 DB가 시작되지 않는다',
              ],
              answer: 1,
              explain: '에러 없이 결과만 왜곡됩니다. 그래서 파이프라인 검증(중복률, distinct 키 수)이 필수입니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>지식 그래프 = 엔티티 + 관계 + (선택적) 스키마.</strong> 기술 선택보다 <strong>엔티티를 어떻게 식별하고 병합할지</strong>가 성패를 가릅니다.'
      )
    );

    return { destroy() {} };
  },
};
