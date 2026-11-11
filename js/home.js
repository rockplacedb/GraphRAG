/**
 * home.js — 학습 대시보드(랜딩).
 */
import { h } from './core/dom.js';
import { ROUTES, SECTIONS, TRACKS } from './data/sections.js';
import { pageHead, section, prose, callout, statsBlock, graphCard, tableBlock, badge } from './ui/blocks.js';
import { SEED_META, modumallSeed } from './data/modumall.seed.js';
import { progress } from './core/progress.js';

const SECTION_COLOR = {
  theory: 'var(--node-customer)',
  lab: 'var(--node-product)',
  reference: 'var(--node-supplier)',
};

function courseCard(route) {
  const quiz = progress.getQuiz(route.id);
  const done = progress.isVisited(route.id) || Boolean(quiz);
  return h(
    'a',
    {
      class: `course-card${done ? ' is-done' : ''}`,
      href: `#/${route.id}`,
      style: { '--cc': SECTION_COLOR[route.section] || 'var(--accent)' },
    },
    h('div', { class: 'course-card__num' }, route.num),
    h('div', { class: 'course-card__title' }, route.title),
    h('div', { class: 'course-card__desc' }, route.summary),
    h(
      'div',
      { class: 'course-card__foot' },
      h('span', { class: 'course-card__dot' }),
      h('span', {}, done ? '학습함' : '학습 전'),
      h('span', { class: 'spacer' }),
      h('span', {}, `${route.minutes}분`)
    )
  );
}

export default {
  id: 'home',
  title: '학습 대시보드',
  kicker: 'START HERE',
  summary: 'DB 엔지니어 관점에서 지식 그래프·그래프 DB·온톨로지·Graph RAG를 이론과 실습으로 익힙니다.',
  minutes: 3,
  render(ctx) {
    const { el } = ctx;
    const totalMinutes = TRACKS.reduce((n, r) => n + r.minutes, 0);
    const visited = TRACKS.filter((r) => progress.isVisited(r.id)).length;
    const lastRoute = ROUTES.find((r) => r.id === progress.last());

    /* ---------- 히어로 ---------- */
    el.append(
      h(
        'div',
        { class: 'hero' },
        h('div', { class: 'hero__eyebrow' }, badge('DB ENGINEER → GRAPH', 'accent'), h('span', {}, 'SQL은 아는데, 그래프는 처음인 사람을 위해')),
        h('h1', {}, '관계를 저장하면, ', h('span', { class: 'grad-text' }, '질문이 쉬워집니다')),
        h(
          'p',
          { html: 'JOIN을 더 붙이는 대신 <strong>관계 자체를 1급 시민으로</strong> 저장하면 어떻게 달라질까요? 이 대시보드는 <strong>이론 9장 + 실습 8개</strong>로 그 차이를 보여주고, 마지막에는 <strong>근거를 인용하는 Graph RAG 파이프라인</strong>까지 직접 돌려 봅니다. 모든 실습은 설치 없이 브라우저에서 실행됩니다.' }
        ),
        h(
          'div',
          { class: 'hero__actions' },
          h('a', { class: 'btn btn--primary', href: `#/${lastRoute && lastRoute.id !== 'home' ? lastRoute.id : 'theory/why-graph'}` }, lastRoute && lastRoute.id !== 'home' ? '이어서 학습' : '이론부터 시작'),
          h('a', { class: 'btn', href: '#/lab/cypher-basics' }, '바로 실습해 보기'),
          h('a', { class: 'btn btn--ghost', href: '#/reference/cheatsheet' }, 'SQL ↔ Cypher 치트시트')
        ),
        h(
          'div',
          { class: 'hero__grid' },
          h('div', { class: 'hero__card' }, h('h3', {}, '🎯 무엇을 얻나'), h('p', {}, '모델링 판단 기준, Cypher 작성 능력, 온톨로지·추론·SHACL 감각, Graph RAG 설계와 평가 관점.')),
          h('div', { class: 'hero__card' }, h('h3', {}, '🧪 어떻게'), h('p', {}, '모두몰(쇼핑몰) 시나리오의 8개 테이블을 그래프로 옮기고, 브라우저에서 쿼리를 실행하며 결과를 눈으로 확인합니다.')),
          h('div', { class: 'hero__card' }, h('h3', {}, '✅ 무엇이 남나'), h('p', {}, '재사용 가능한 모델링 체크리스트, Cypher 치트시트, 안티패턴 진단표, RAG 근거 설계도.'))
        )
      )
    );

    /* ---------- 지표 ---------- */
    el.append(
      statsBlock([
        { label: '전체 학습 시간', value: `${totalMinutes}`, unit: '분', note: '이론 123분 · 실습 173분 구성', accent: true },
        { label: '학습한 페이지', value: `${visited}`, unit: `/ ${TRACKS.length}`, note: `퀴즈 응시 ${progress.quizCount()}개` },
        { label: '시나리오 그래프', value: `${SEED_META.nodes}`, unit: '노드', note: `관계 ${SEED_META.edges}개 · 7개 라벨` },
        { label: '브라우저 실습', value: '8', unit: '개 Lab', note: '설치·백엔드·LLM 호출 없음' },
      ])
    );

    /* ---------- 학습 지도 ---------- */
    const mapSection = section(
      { title: '학습 지도', lead: '이론으로 개념을 세우고, 실습에서 손으로 확인합니다. 순서대로 가도 되고, 필요한 장만 골라도 됩니다.' },
      ...[
        { key: 'theory', title: '① 이론 — 9장', desc: '왜 그래프인가부터 운영까지. 각 장에 인터랙티브 시각화와 점검 퀴즈가 있습니다.' },
        { key: 'lab', title: '② 실습 — 8개 Lab', desc: '모두몰의 RDB를 그래프로 옮기고, Cypher를 실행하고, 마지막엔 Graph RAG를 조립합니다.' },
        { key: 'reference', title: '③ 부록 — 2개', desc: 'SQL↔Cypher 치트시트와 용어 사전. 학습 중 옆에 두고 쓰는 참조 자료입니다.' },
      ].map((group) =>
        h(
          'div',
          { class: 'stack stack--sm' },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
            h('h3', {}, group.title),
            h('p', { class: 'dim', style: { fontSize: 'var(--fs-xs)', margin: '0' } }, group.desc)
          ),
          h('div', { class: 'course-grid' }, ROUTES.filter((r) => r.section === group.key).map(courseCard))
        )
      )
    );
    el.append(mapSection);

    /* ---------- 실제 그래프 미리보기 ---------- */
    const seed = modumallSeed();
    const preview = graphCard(ctx, {
      title: '모두몰 도메인 그래프',
      subtitle: '실습에서 쓰는 실제 데이터입니다. 노드를 끌어 보세요 — DB 엔지니어에게는 "ERD가 아니라 값으로 연결된 데이터"라는 감각이 먼저 필요합니다.',
      data: seed,
      height: 430,
      hint: '드래그로 이동 · 스크롤로 확대 · 노드에 마우스를 올리면 속성 툴팁',
      note: null,
    });
    el.append(
      section(
        { title: '지금 보고 있는 것', lead: 'Customer · Order · Product · Supplier · Category · Review · Return 7개 라벨이 실제 관계로 연결되어 있습니다.' },
        preview.el,
        h(
          'div',
          { class: 'grid-2' },
          callout('engineer', 'RDB 엔지니어의 첫 반응', '“이건 그냥 ERD 아닌가요?” 맞습니다. 다른 점은 <strong>ERD는 스키마이고, 이건 인스턴스</strong>라는 것. 그리고 이 인스턴스 위에서 “3홉 이내” 질문이 인덱스 없이도 즉시 됩니다.'),
          callout('insight', '이 대시보드의 관점', '그래프 DB를 “또 하나의 DB”로 소개하지 않습니다. <strong>JOIN 비용이 사라지는 대신 무엇을 포기하는지</strong>(제약, 집계, 트랜잭션 범위)를 함께 봅니다.')
        )
      )
    );

    /* ---------- 추천 코스 ---------- */
    el.append(
      section(
        { title: '처음이라면 이 순서 (총 75분)', lead: '개념 → 손 → 확장 순서로 짧게 한 바퀴 도는 코스입니다.' },
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'table table--compact' },
            h('thead', {}, h('tr', {}, h('th', {}, '순서'), h('th', {}, '페이지'), h('th', {}, '왜 이 순서인가'), h('th', {}, '시간'))),
            h(
              'tbody',
              {},
              [
                ['1', 'theory/why-graph', 'RDB의 어떤 질문이 비싸지는지 먼저 체감한다', '12분'],
                ['2', 'theory/what-is-kg', '엔티티/관계/속성이라는 공통 언어를 맞춘다', '13분'],
                ['3', 'lab/cypher-basics', '손으로 쿼리를 실행해 문법을 몸에 익힌다', '25분'],
                ['4', 'theory/modeling', '실습에서 감으로 잡은 것을 판단 기준으로 정리한다', '15분'],
                ['5', 'lab/multi-hop', '다중 홉이 그래프의 본론임을 확인한다', '24분'],
                ['6', 'theory/graph-rag', '왜 여기에 그래프가 필요한지 이해한다', '18분'],
                ['7', 'lab/graph-rag', '직접 파이프라인을 돌려 근거를 확인한다', '26분'],
              ].map(([n, id, why, min]) =>
                h(
                  'tr',
                  {},
                  h('td', {}, n),
                  h('td', {}, h('a', { href: `#/${id}` }, ROUTES.find((r) => r.id === id)?.title || id)),
                  h('td', {}, why),
                  h('td', { class: 'num' }, min)
                )
              )
            )
          )
        )
      )
    );

    /* ---------- 용어 미리보기 ---------- */
    el.append(
      section(
        { title: '용어가 낯설다면', lead: '이론 1장을 읽기 전에 아래 다섯 개만 잡고 가면 나머지가 편해집니다.' },
        tableBlock({
          head: ['용어', '한 줄 정의', 'RDB 비유'],
          rows: [
            ['노드 (Node)', '하나의 사물/개념. 라벨과 속성을 가진다', '한 행(row)'],
            ['관계 (Relationship)', '두 노드 사이의 방향 있는 연결. 자체 속성도 가진다', 'FK + 조인 테이블'],
            ['라벨 (Label)', '노드의 종류. 다중 라벨 가능', '테이블 이름'],
            ['트리플 (Triple)', '주어–관계–목적어 3요소 문장', '조인 결과의 한 줄'],
            ['온톨로지 (Ontology)', '도메인의 개념과 관계, 규칙을 명시한 스키마', '제약조건 + 문서화된 의미'],
          ],
          compact: true,
        }),
        h('div', { class: 'row' }, h('a', { class: 'btn btn--sm', href: '#/reference/glossary' }, '용어 사전 전체 보기 →'))
      )
    );

    /* ---------- 주의 ---------- */
    el.append(
      callout(
        'sim',
        '실습은 시뮬레이션입니다',
        '브라우저 실습은 이 페이지에 내장된 <strong>교육용 Cypher 부분집합 엔진</strong>과 <strong>정책 기반 RAG 시뮬레이터</strong>로 동작합니다. Neo4j 자체도, 실제 LLM도 아닙니다. 각 실습에는 동일한 쿼리를 <strong>실제 Neo4j에서 실행하는 방법</strong>이 함께 제공되며, 지원 범위는 실습 화면의 “지원 문법” 버튼에서 확인할 수 있습니다.'
      )
    );

    return { destroy() {} };
  },
};
