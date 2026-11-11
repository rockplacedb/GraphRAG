/**
 * sections.js — 전체 학습 경로 매니페스트.
 * 사이드바/커맨드 팔레트/이전·다음 이동이 모두 이 목록에서 파생된다.
 */

export const SECTIONS = [
  {
    key: 'theory',
    label: '이론',
    hint: '개념과 원리',
    color: 'var(--node-customer)',
  },
  {
    key: 'lab',
    label: '실습',
    hint: '모두몰 시나리오',
    color: 'var(--node-product)',
  },
  {
    key: 'reference',
    label: '부록',
    hint: '치트시트 · 용어',
    color: 'var(--node-supplier)',
  },
];

/** @type {Array<{id:string, section:string, num:string, title:string, summary:string, minutes:number, keywords:string[], load:()=>Promise<any>}>} */
export const ROUTES = [
  {
    id: 'home',
    section: 'home',
    num: '',
    title: '학습 대시보드',
    summary: '전체 학습 지도와 진도',
    minutes: 3,
    keywords: ['홈', '개요', '지도', '진도'],
    load: () => import('../home.js'),
  },

  /* ------------------------------ 이론 ------------------------------ */
  {
    id: 'theory/why-graph',
    section: 'theory',
    num: '01',
    title: '왜 그래프인가',
    summary: 'JOIN 폭발, 재귀 CTE의 한계, 인덱스 없는 인접성',
    minutes: 12,
    keywords: ['join', '조인', '재귀 cte', 'recursive', '탐색', 'traversal', '인덱스 없는 인접성', '언제 그래프'],
    load: () => import('../theory/01-why-graph.js'),
  },
  {
    id: 'theory/what-is-kg',
    section: 'theory',
    num: '02',
    title: '지식 그래프의 정의',
    summary: '트리플, 엔티티 해소, 스키마 유무, KG vs 문서 DB',
    minutes: 13,
    keywords: ['트리플', 'triple', '주어', '관계', '목적어', '엔티티', '스키마', '지식 표현'],
    load: () => import('../theory/02-what-is-kg.js'),
  },
  {
    id: 'theory/internals',
    section: 'theory',
    num: '03',
    title: '그래프 DB 내부 구조',
    summary: 'Property Graph vs RDF, 저장 레이아웃, 인덱스, 트랜잭션',
    minutes: 14,
    keywords: ['property graph', 'rdf', 'adjacency', '포인터', '저장', '인덱스', '제약', 'neo4j', 'transaction'],
    load: () => import('../theory/03-internals.js'),
  },
  {
    id: 'theory/modeling',
    section: 'theory',
    num: '04',
    title: '그래프 데이터 모델링',
    summary: '정규화를 버리는 법, 관계 승격, 슈퍼노드 회피',
    minutes: 15,
    keywords: ['모델링', '정규화', '관계 엔티티', '리파이케이션', '하이퍼엣지', '슈퍼노드', 'supernode', '계층'],
    load: () => import('../theory/04-modeling.js'),
  },
  {
    id: 'theory/query-languages',
    section: 'theory',
    num: '05',
    title: '쿼리 언어',
    summary: 'Cypher 패턴 매칭, 가변 길이, SPARQL, GQL, 실행계획',
    minutes: 13,
    keywords: ['cypher', 'sparql', 'gql', 'pattern', '가변 길이', '실행계획', 'explain', 'profile'],
    load: () => import('../theory/05-query-languages.js'),
  },
  {
    id: 'theory/algorithms',
    section: 'theory',
    num: '06',
    title: '그래프 알고리즘',
    summary: 'BFS·최단경로·PageRank·Louvain, 무엇을 언제 쓰나',
    minutes: 16,
    keywords: ['bfs', 'dfs', '다익스트라', 'dijkstra', 'shortest path', 'pagerank', 'louvain', '중심성', 'community'],
    load: () => import('../theory/06-algorithms.js'),
  },
  {
    id: 'theory/ontology',
    section: 'theory',
    num: '07',
    title: '온톨로지와 지식 표현',
    summary: 'RDF/RDFS/OWL, 추론, SHACL, 온톨로지 거버넌스',
    minutes: 17,
    keywords: ['온톨로지', 'ontology', 'rdf', 'rdfs', 'owl', '추론', 'inference', 'shacl', 'subclassof'],
    load: () => import('../theory/07-ontology.js'),
  },
  {
    id: 'theory/graph-rag',
    section: 'theory',
    num: '08',
    title: 'Graph RAG',
    summary: '벡터 RAG의 한계, KG 검색, 하이브리드, GraphRAG',
    minutes: 18,
    keywords: ['rag', 'graphrag', '벡터', '임베딩', '검색', 'retrieval', '멀티홉', '커뮤니티 요약', 'hallucination'],
    load: () => import('../theory/08-graph-rag.js'),
  },
  {
    id: 'theory/operations',
    section: 'theory',
    num: '09',
    title: '아키텍처와 운영',
    summary: '배포 형태, 인덱스·제약, 샤딩, ETL, 안티패턴',
    minutes: 15,
    keywords: ['운영', '배포', '샤딩', 'etl', '백업', '모니터링', '안티패턴', '성능', '벤더 비교'],
    load: () => import('../theory/09-operations.js'),
  },

  /* ------------------------------ 실습 ------------------------------ */
  {
    id: 'lab/setup',
    section: 'lab',
    num: 'L0',
    title: '환경 준비',
    summary: 'Docker로 Neo4j 기동하고 연결 확인',
    minutes: 10,
    keywords: ['docker', 'neo4j', '설치', '셋업', 'browser', 'cypher-shell'],
    load: () => import('../lab/00-setup.js'),
  },
  {
    id: 'lab/modeling',
    section: 'lab',
    num: 'L1',
    title: 'RDB 스키마를 그래프로',
    summary: '8개 테이블을 노드·관계로 매핑하고 DDL 생성',
    minutes: 22,
    keywords: ['매핑', '마이그레이션', 'ddl', '스키마', '모델링', 'constraint'],
    load: () => import('../lab/01-modeling.js'),
  },
  {
    id: 'lab/cypher-basics',
    section: 'lab',
    num: 'L2',
    title: 'Cypher 기초',
    summary: '브라우저에서 직접 실행하는 CREATE/MATCH/RETURN',
    minutes: 25,
    keywords: ['cypher', 'create', 'merge', 'match', 'where', 'return', 'aggregation'],
    load: () => import('../lab/02-cypher-basics.js'),
  },
  {
    id: 'lab/multi-hop',
    section: 'lab',
    num: 'L3',
    title: '다중 홉 탐색',
    summary: '함께 구매 추천, 반품 연쇄 추적, 최단 경로',
    minutes: 24,
    keywords: ['다중 홉', 'multi hop', '가변 길이', '추천', '경로', 'shortestpath', '함께 구매'],
    load: () => import('../lab/03-multi-hop.js'),
  },
  {
    id: 'lab/algorithms',
    section: 'lab',
    num: 'L4',
    title: '알고리즘 실전',
    summary: 'PageRank로 인플루언서, Louvain으로 세그먼트',
    minutes: 22,
    keywords: ['pagerank', 'louvain', '커뮤니티', '중심성', '알고리즘', 'gds'],
    load: () => import('../lab/04-algorithms.js'),
  },
  {
    id: 'lab/ontology',
    section: 'lab',
    num: 'L5',
    title: '온톨로지 구축과 추론',
    summary: 'Turtle 작성, 추론, SHACL 검증으로 위반 잡기',
    minutes: 24,
    keywords: ['온톨로지', 'turtle', '추론', 'shacl', 'owl', '스키마 검증'],
    load: () => import('../lab/05-ontology.js'),
  },
  {
    id: 'lab/graph-rag',
    section: 'lab',
    num: 'L6',
    title: 'Graph RAG 파이프라인',
    summary: '질의 → 엔티티 링킹 → 서브그래프 → 근거 있는 답변',
    minutes: 26,
    keywords: ['graph rag', '파이프라인', '엔티티 링킹', '서브그래프', '프롬프트', '근거', 'citation'],
    load: () => import('../lab/06-graph-rag.js'),
  },
  {
    id: 'lab/performance',
    section: 'lab',
    num: 'L7',
    title: '성능 진단과 안티패턴',
    summary: '슈퍼노드 팬아웃, 인덱스 유무, RDB와의 교차점',
    minutes: 20,
    keywords: ['성능', '슈퍼노드', '팬아웃', '인덱스', 'profile', '튜닝', '안티패턴'],
    load: () => import('../lab/07-performance.js'),
  },

  /* ------------------------------ 부록 ------------------------------ */
  {
    id: 'reference/cheatsheet',
    section: 'reference',
    num: 'R1',
    title: 'SQL ↔ Cypher 치트시트',
    summary: '같은 질문을 두 언어로 나란히',
    minutes: 8,
    keywords: ['치트시트', 'cheat sheet', 'sql', 'cypher', '비교', '문법'],
    load: () => import('../reference/cheatsheet.js'),
  },
  {
    id: 'reference/glossary',
    section: 'reference',
    num: 'R2',
    title: '용어 사전',
    summary: '40+ 핵심 용어 즉시 검색',
    minutes: 6,
    keywords: ['용어', '사전', 'glossary', '정의'],
    load: () => import('../reference/glossary.js'),
  },
];

export const TRACKS = ROUTES.filter((r) => r.section !== 'home');

export function routesBySection(key) {
  return ROUTES.filter((r) => r.section === key);
}

export function findRoute(id) {
  return ROUTES.find((r) => r.id === id);
}
