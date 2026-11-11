/**
 * 부록 2 — 용어 사전
 */
import { h } from '../core/dom.js';
import { pageHead, section, callout } from '../ui/blocks.js';

const TERMS = [
  { t: '노드', en: 'Node', cat: '기초', d: '그래프의 정점. 하나의 사물이나 개념을 나타내며, 라벨과 속성을 가진다. RDB의 한 행(row)에 대응.', link: 'theory/what-is-kg' },
  { t: '관계', en: 'Relationship / Edge', cat: '기초', d: '두 노드 사이의 방향 있는 연결. 타입과 자체 속성을 가질 수 있다. RDB의 FK + 조인 테이블에 대응.', link: 'theory/internals' },
  { t: '라벨', en: 'Label', cat: '기초', d: '노드의 종류를 나타내는 태그. 다중 라벨이 가능하다. 스캔 시작점을 좁히는 역할을 한다.', link: 'theory/internals' },
  { t: '속성', en: 'Property', cat: '기초', d: '노드나 관계에 붙는 키-값 쌍. 다른 엔티티와 연결할 값이라면 속성이 아니라 관계여야 한다.', link: 'theory/modeling' },
  { t: '경로', en: 'Path', cat: '기초', d: '연속된 노드와 관계의 나열. “몇 홉”은 경로의 길이를 뜻한다.', link: 'lab/multi-hop' },
  { t: '홉', en: 'Hop', cat: '기초', d: '관계 하나를 따라 이동하는 단위. “2홉”은 관계를 두 번 지난다는 뜻이다.', link: 'theory/why-graph' },
  { t: '차수', en: 'Degree', cat: '기초', d: '노드에 연결된 관계의 수. 방향 그래프에서는 in/out으로 나뉜다.', link: 'lab/algorithms' },
  { t: '트리플', en: 'Triple', cat: '기초', d: '주어–관계–목적어 3요소로 표현된 사실. RDF의 기본 단위.', link: 'theory/what-is-kg' },
  { t: '지식 그래프', en: 'Knowledge Graph', cat: '기초', d: '엔티티와 관계를, 기계가 질의할 수 있는 형태로 저장한 지식 베이스. 데이터 + 스키마 + 의미를 함께 다룬다.', link: 'theory/what-is-kg' },
  { t: '엔티티 해소', en: 'Entity Resolution', cat: '모델링', d: '서로 다른 소스의 동일 실체를 하나의 노드로 병합하는 작업. KG 품질의 핵심.', link: 'theory/what-is-kg' },
  { t: '리파이케이션', en: 'Reification', cat: '모델링', d: '관계를 노드로 승격해 그 관계에 대한 사실을 추가하는 기법. 관계 속성으로 부족할 때 쓴다.', link: 'theory/modeling' },
  { t: '하이퍼엣지', en: 'Hyperedge', cat: '모델링', d: '3개 이상의 노드를 동시에 잇는 관계. 대부분의 그래프 DB는 직접 지원하지 않아 중간 노드로 흉내 낸다.', link: 'theory/modeling' },
  { t: '슈퍼노드', en: 'Supernode', cat: '모델링', d: '차수가 비정상적으로 큰 노드. 경로 탐색 비용을 폭발시키는 1번 원인.', link: 'lab/performance' },
  { t: '조인 테이블', en: 'Join Table', cat: '모델링', d: 'M:N 관계를 표현하는 RDB 테이블. 그래프에서는 대개 관계 + 관계 속성으로 펼친다.', link: 'lab/modeling' },
  { t: '정규화', en: 'Normalization', cat: '모델링', d: '중복을 제거하는 RDB 설계 원칙. 그래프에서는 “탐색 경로를 짧게”가 우선인 경우가 많다.', link: 'theory/modeling' },
  { t: 'Property Graph', en: 'Property Graph', cat: 'DB', d: '노드/관계에 속성을 붙일 수 있는 그래프 모델. Neo4j, Memgraph, Neptune 등이 채택.', link: 'theory/internals' },
  { t: 'RDF', en: 'Resource Description Framework', cat: 'DB', d: '트리플의 집합으로 지식을 표현하는 W3C 표준 모델. IRI로 식별한다.', link: 'theory/ontology' },
  { t: 'index-free adjacency', en: 'Index-free adjacency', cat: 'DB', d: '이웃 노드로의 포인터를 저장해 인덱스 탐색 없이 관계를 따라가는 구조.', link: 'theory/internals' },
  { t: 'Cypher', en: 'Cypher', cat: '쿼리', d: 'Neo4j의 선언적 그래프 질의 언어. ASCII-art 패턴으로 그래프를 표현한다.', link: 'theory/query-languages' },
  { t: 'SPARQL', en: 'SPARQL', cat: '쿼리', d: 'RDF용 질의 언어. 트리플 패턴과 FILTER를 사용한다. W3C 표준.', link: 'theory/query-languages' },
  { t: 'GQL', en: 'Graph Query Language', cat: '쿼리', d: 'ISO/IEC 표준화가 진행된 그래프 질의 언어. Cypher 계열 문법을 기반으로 한다.', link: 'theory/query-languages' },
  { t: 'MATCH', en: 'MATCH', cat: '쿼리', d: '패턴을 매칭하는 Cypher 절. SQL의 FROM + JOIN에 대응.', link: 'lab/cypher-basics' },
  { t: 'MERGE', en: 'MERGE', cat: '쿼리', d: '“있으면 매칭, 없으면 생성”. UPSERT에 대응. 유니크 제약과 함께 써야 안전하다.', link: 'lab/cypher-basics' },
  { t: '가변 길이 관계', en: 'Variable-length relationship', cat: '쿼리', d: '-[:TYPE*1..3]-> 처럼 홉 범위를 지정하는 문법. 상한을 두지 않으면 위험하다.', link: 'lab/multi-hop' },
  { t: '실행 계획', en: 'Execution Plan', cat: '쿼리', d: '옵티마이저가 만든 연산자 트리. EXPLAIN은 계획만, PROFILE은 실행하며 db hits를 보여준다.', link: 'lab/performance' },
  { t: 'db hits', en: 'db hits', cat: '쿼리', d: 'Neo4j PROFILE에서 연산자가 데이터에 접근한 횟수. 튜닝의 핵심 지표.', link: 'lab/performance' },
  { t: 'BFS', en: 'Breadth-First Search', cat: '알고리즘', d: '가까운 노드부터 방문하는 탐색. 무가중 그래프에서 최단 경로를 보장한다.', link: 'theory/algorithms' },
  { t: '다익스트라', en: "Dijkstra's algorithm", cat: '알고리즘', d: '가중치가 있는 그래프의 최단 경로. 음수 가중치는 사용할 수 없다.', link: 'theory/algorithms' },
  { t: 'PageRank', en: 'PageRank', cat: '알고리즘', d: '연결 구조의 중요도를 반복 계산하는 알고리즘. “중요한 노드와 연결된 노드가 중요하다”.', link: 'theory/algorithms' },
  { t: 'Louvain', en: 'Louvain', cat: '알고리즘', d: '모듈러리티를 최대화하는 커뮤니티 탐지 알고리즘. 대규모 그래프에 빠르게 적용된다.', link: 'lab/algorithms' },
  { t: '모듈러리티', en: 'Modularity', cat: '알고리즘', d: '커뮤니티 분할의 품질 지표. 값이 높을수록 커뮤니티 내부 연결이 밀집되어 있다.', link: 'lab/algorithms' },
  { t: '중심성', en: 'Centrality', cat: '알고리즘', d: '노드의 중요도를 측정하는 지표군. 차수·매개·근접 중심성 등이 있다.', link: 'theory/algorithms' },
  { t: '온톨로지', en: 'Ontology', cat: '온톨로지', d: '도메인의 개념, 관계, 규칙을 명시적으로 정의한 스키마. RDB의 제약 + 문서화된 의미에 대응.', link: 'theory/ontology' },
  { t: 'RDFS', en: 'RDF Schema', cat: '온톨로지', d: '클래스/속성의 계층과 domain/range를 정의하는 RDF 확장. subClassOf가 핵심.', link: 'theory/ontology' },
  { t: 'OWL', en: 'Web Ontology Language', cat: '온톨로지', d: '더 강한 추론을 가능하게 하는 온톨로지 언어. inverseOf, transitive, 제약 클래스 등.', link: 'theory/ontology' },
  { t: '추론', en: 'Inference / Reasoning', cat: '온톨로지', d: '명시된 사실에서 파생 사실을 계산하는 것. subClassOf의 전이성이 대표적.', link: 'lab/ontology' },
  { t: 'SHACL', en: 'Shapes Constraint Language', cat: '온톨로지', d: 'RDF 데이터의 품질 규칙을 선언하고 검증 결과를 보고하는 언어. W3C 표준.', link: 'lab/ontology' },
  { t: 'IRI', en: 'Internationalized Resource Identifier', cat: '온톨로지', d: 'RDF에서 엔티티를 식별하는 전역 식별자. URL과 유사하지만 반드시 접근 가능할 필요는 없다.', link: 'theory/ontology' },
  { t: 'Turtle', en: 'Turtle', cat: '온톨로지', d: 'RDF 트리플을 사람이 읽기 쉽게 적는 직렬화 문법. @prefix 축약을 지원한다.', link: 'theory/ontology' },
  { t: 'Graph RAG', en: 'Graph Retrieval-Augmented Generation', cat: 'RAG', d: '벡터 검색에 그래프 기반 검색을 결합한 RAG. 엔티티 링킹과 경로 확장으로 근거를 모은다.', link: 'theory/graph-rag' },
  { t: '엔티티 링킹', en: 'Entity Linking', cat: 'RAG', d: '질문 속 고유명사를 그래프의 실제 노드에 연결하는 과정. Graph RAG 품질의 상한을 결정한다.', link: 'lab/graph-rag' },
  { t: '서브그래프', en: 'Subgraph', cat: 'RAG', d: '특정 노드 집합을 중심으로 잘라낸 부분 그래프. 프롬프트에 넣을 근거 범위로 사용된다.', link: 'lab/graph-rag' },
  { t: '커뮤니티 요약', en: 'Community Summary', cat: 'RAG', d: '그래프를 커뮤니티로 나눈 뒤 각 커뮤니티를 요약해 두는 기법. 전역 질문에 사용된다.', link: 'theory/graph-rag' },
  { t: 'Faithfulness', en: 'Faithfulness', cat: 'RAG', d: '답변이 제공된 컨텍스트에 실제로 근거하는 정도. 환각 탐지의 핵심 지표.', link: 'theory/graph-rag' },
  { t: '환각', en: 'Hallucination', cat: 'RAG', d: '근거 없이 그럴듯한 내용을 생성하는 현상. 인용 검증으로 완화한다.', link: 'theory/graph-rag' },
  { t: '그래프 프로젝션', en: 'Graph Projection', cat: '운영', d: 'GDS에서 알고리즘을 돌리기 위해 메모리에 올리는 그래프 표현. 메모리 사용량을 먼저 확인해야 한다.', link: 'lab/algorithms' },
  { t: '사이드카 패턴', en: 'Sidecar pattern', cat: '운영', d: 'RDB를 그대로 두고 그래프 기능만 별도 저장소로 붙이는 아키텍처. 동기화 신뢰성이 관건.', link: 'theory/operations' },
  { t: 'CDC', en: 'Change Data Capture', cat: '운영', d: 'RDB의 변경 로그를 읽어 다른 저장소로 반영하는 방식. 배치 ETL보다 지연이 작다.', link: 'theory/operations' },
];

const CATS = ['전체', ...new Set(TERMS.map((x) => x.cat))];

export default {
  id: 'reference/glossary',
  title: '용어 사전',
  kicker: 'REFERENCE 02',
  summary: '학습 중 막히는 용어를 즉시 찾아보는 사전.',
  minutes: 6,
  tags: ['용어', '검색'],
  render(ctx) {
    const { el } = ctx;
    const list = h('div', { class: 'glossary' });
    const count = h('span', { class: 'badge badge--accent' }, `${TERMS.length}개 용어`);
    let query = '';

    const input = h('input', {
      type: 'search',
      placeholder: '용어 검색 (예: 슈퍼노드, SHACL, 리파인)',
      'aria-label': '용어 검색',
      style: {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        fontSize: 'var(--fs-sm)',
        outline: 'none',
      },
      onInput: (e) => {
        query = e.target.value.toLowerCase();
        renderList();
      },
    });

    function renderList() {
      const rows = TERMS.filter((x) => {
        if (!query) return true;
        return (x.t + x.en + x.d + x.cat).toLowerCase().includes(query);
      });
      list.replaceChildren();
      if (!rows.length) {
        list.append(h('p', { class: 'muted' }, '검색 결과가 없습니다.'));
        return;
      }
      let lastCat = null;
      for (const x of rows) {
        if (x.cat !== lastCat) {
          lastCat = x.cat;
          list.append(h('div', { class: 'nav-group__title', style: { marginTop: '12px' } }, x.cat));
        }
        list.append(
          h(
            'div',
            { class: 'glossary__item' },
            h('div', { class: 'glossary__term' }, x.t, h('em', {}, x.en), h('span', { class: 'spacer' }), h('a', { class: 'glossary__link', href: `#/${x.link}` }, '관련 장 →')),
            h('div', { class: 'glossary__def' }, x.d)
          )
        );
      }
    }
    renderList();

    el.append(
      pageHead({
        kicker: 'REFERENCE 02 · GLOSSARY',
        title: '용어 사전',
        summary: '정의는 <strong>한 문장</strong>으로, 가능한 한 RDB 비유와 함께 적었습니다. 검색창에 일부만 입력해도 됩니다.',
        minutes: 6,
        tags: [`${TERMS.length}개 용어`, '즉시 검색'],
      })
    );

    el.append(
      section(
        { num: '1', title: '찾아보기', lead: '학습 중 옆에 두고 쓰는 참조입니다.' },
        h('div', { class: 'row', style: { marginBottom: '8px' } }, input, count),
        list
      )
    );

    el.append(callout('insight', '활용 팁', '용어가 낯설 때는 정의만 읽지 말고 <strong>관련 장</strong> 링크로 이동해 실제 예를 보는 것이 오래 남습니다.'));

    return { destroy() {} };
  },
};
