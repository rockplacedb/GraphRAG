/**
 * 이론 08 — Graph RAG
 */
import { h } from '../core/dom.js';
import {
  pageHead,
  section,
  prose,
  callout,
  codeBlock,
  tableBlock,
  chartCard,
  graphCard,
  quizBlock,
  compareBlock,
  statsBlock,
} from '../ui/blocks.js';

const SUB_1HOP = {
  nodes: [
    { id: 's2', labels: ['Supplier'], props: { name: '대성테크' } },
    { id: 'p3', labels: ['Product'], props: { name: '노이즈캔슬링 헤드폰' } },
    { id: 'o1003', labels: ['Order'], props: { name: 'O-1003' } },
    { id: 'o1010', labels: ['Order'], props: { name: 'O-1010' } },
    { id: 'o1014', labels: ['Order'], props: { name: 'O-1014' } },
    { id: 'r3', labels: ['Review'], props: { name: '리뷰 R-3 ★5' } },
    { id: 'r8', labels: ['Review'], props: { name: '리뷰 R-8 ★4' } },
  ],
  edges: [
    { id: 'a1', type: 'SUPPLIED_BY', from: 'p3', to: 's2' },
    { id: 'a2', type: 'CONTAINS', from: 'o1003', to: 'p3' },
    { id: 'a3', type: 'CONTAINS', from: 'o1010', to: 'p3' },
    { id: 'a4', type: 'CONTAINS', from: 'o1014', to: 'p3' },
    { id: 'a5', type: 'REVIEWS', from: 'r3', to: 'p3' },
    { id: 'a6', type: 'REVIEWS', from: 'r8', to: 'p3' },
  ],
};

const SUB_2HOP = {
  nodes: [
    ...SUB_1HOP.nodes,
    { id: 'ret3', labels: ['Return'], props: { name: '반품: 소음' } },
    { id: 'ret4', labels: ['Return'], props: { name: '반품: 단순 변심' } },
    { id: 'c3', labels: ['Customer'], props: { name: '박서연' } },
    { id: 'c8', labels: ['Customer'], props: { name: '임도현' } },
    { id: 'c11', labels: ['Customer'], props: { name: '신유나' } },
    { id: 'p8', labels: ['Product'], props: { name: '무선 마우스' } },
    { id: 'p9', labels: ['Product'], props: { name: '기계식 키보드' } },
    { id: 'p13', labels: ['Product'], props: { name: '휴대용 SSD' } },
  ],
  edges: [
    ...SUB_1HOP.edges,
    { id: 'b1', type: 'HAS_RETURN', from: 'o1014', to: 'ret3' },
    { id: 'b2', type: 'HAS_RETURN', from: 'o1003', to: 'ret4' },
    { id: 'b3', type: 'PLACED', from: 'c3', to: 'o1003' },
    { id: 'b4', type: 'PLACED', from: 'c8', to: 'o1010' },
    { id: 'b5', type: 'PLACED', from: 'c11', to: 'o1014' },
    { id: 'b6', type: 'WROTE', from: 'c3', to: 'r3' },
    { id: 'b7', type: 'WROTE', from: 'c8', to: 'r8' },
    { id: 'b8', type: 'SUPPLIED_BY', from: 'p8', to: 's2' },
    { id: 'b9', type: 'SUPPLIED_BY', from: 'p9', to: 's2' },
    { id: 'b10', type: 'SUPPLIED_BY', from: 'p13', to: 's2' },
  ],
};

function subgraphDemo(ctx) {
  const g = graphCard(ctx, {
    title: '검색된 서브그래프 — 1홉 vs 2홉',
    subtitle: '질문에서 링킹된 <strong>대성테크</strong>와 <strong>노이즈캔슬링 헤드폰</strong>에서 확장된 범위입니다.',
    data: SUB_1HOP,
    height: 380,
    seed: 71,
  });

  let view = null;
  let hops = 1;
  g.ready.then((v) => {
    view = v;
  });

  const readout = h('span', { class: 'badge' }, '1홉 · 노드 7 · 관계 6');
  const one = h('button', { class: 'btn btn--sm btn--primary', type: 'button' }, '1홉');
  const two = h('button', { class: 'btn btn--sm', type: 'button' }, '2홉');
  const extra = h('span', { class: 'muted', style: { fontSize: 'var(--fs-2xs)' } }, '2홉으로 늘리면 반품·고객·다른 상품이 근거에 추가됩니다.');

  function apply(nextHops) {
    hops = nextHops;
    const data = hops === 1 ? SUB_1HOP : SUB_2HOP;
    one.classList.toggle('btn--primary', hops === 1);
    two.classList.toggle('btn--primary', hops === 2);
    readout.textContent = `${hops}홉 · 노드 ${data.nodes.length} · 관계 ${data.edges.length}`;
    extra.textContent =
      hops === 1
        ? '1홉: 공급사·상품·주문까지만. “반품 사유”는 아직 근거에 없습니다.'
        : '2홉: 반품 사유(소음·단순 변심)와 고객, 같은 공급사의 다른 상품까지 근거에 포함됩니다.';
    view?.setData(data);
  }
  one.addEventListener('click', () => apply(1));
  two.addEventListener('click', () => apply(2));

  return h('div', { class: 'stack stack--sm' }, g.el, h('div', { class: 'row' }, one, two, readout, extra));
}

const STAGES = [
  { n: '01', t: '문서 청킹', d: '문서를 300~800 토큰으로 자른다' },
  { n: '02', t: '임베딩', d: '청크를 벡터로 바꾼다' },
  { n: '03', t: '벡터 검색', d: '질문과 가까운 top-k를 고른다' },
  { n: '04', t: '프롬프트 조립', d: '청크 + 질문을 넣는다' },
  { n: '05', t: '생성', d: 'LLM이 답을 만든다' },
];

function pipelineViz() {
  return h(
    'div',
    { class: 'pipeline', style: { gridTemplateColumns: 'repeat(5, minmax(0,1fr))' } },
    STAGES.map((s) =>
      h(
        'div',
        { class: 'pstage' },
        h('div', { class: 'pstage__n' }, s.n),
        h('div', { class: 'pstage__title' }, s.t),
        h('div', { class: 'pstage__state' }, s.d)
      )
    )
  );
}

function budgetDemo() {
  const state = { graphShare: 3 };
  const docBar = h('i');
  const graphBar = h('i');
  const docText = h('b');
  const graphText = h('b');
  const policyScore = h('b', { style: { color: 'var(--ok-500)' } });
  const hopScore = h('b', { style: { color: 'var(--accent)' } });
  const verdict = h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', margin: '0' } });

  const input = h('input', {
    type: 'range',
    min: '0',
    max: '6',
    step: '1',
    value: '3',
    'aria-label': '그래프 근거 슬롯 수',
    onInput: (e) => {
      state.graphShare = Number(e.target.value);
      render();
    },
  });

  function render() {
    const g = state.graphShare;
    const docs = 6 - g;
    docText.textContent = `${docs}개`;
    graphText.textContent = `${g}개`;
    docBar.style.width = `${(docs / 6) * 100}%`;
    graphBar.style.width = `${(g / 6) * 100}%`;
    const policy = Math.min(1, docs / 4);
    const hop = Math.min(1, g / 3);
    policyScore.textContent = `${Math.round(policy * 100)}%`;
    hopScore.textContent = `${Math.round(hop * 100)}%`;
    verdict.textContent =
      g === 6
        ? '그래프만으로는 “왜 7일 이내인가” 같은 정책 문장을 인용할 수 없습니다. 정책 근거가 0이 되었습니다.'
        : docs === 6
          ? '문서만 있으면 “어느 주문이 어느 공급사와 연결되는지” 구체적 사례를 인용할 수 없습니다.'
          : `예산 배분: 문서 ${docs} : 그래프 ${g}. 정책형 질문과 다중 홉 질문의 성격에 맞춰 조정하세요.`;
  }

  const card = h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h(
        'div',
        { class: 'card__head-text' },
        h('div', { class: 'card__title' }, '컨텍스트 예산 배분'),
        h('div', { class: 'card__sub' }, 'LLM에 넣을 수 있는 근거는 유한합니다. 문서와 그래프 근거를 어떻게 나눌지 직접 조정해 보세요.')
      ),
      h('span', { class: 'badge badge--accent' }, '6슬롯 예산')
    ),
    h(
      'div',
      { class: 'card__body' },
      h('div', { class: 'field' }, h('label', {}, h('span', {}, '그래프 근거에 배정'), input)),
      h(
        'div',
        { class: 'stats', style: { marginTop: '12px' } },
        h(
          'div',
          { class: 'stat' },
          h('div', { class: 'stat__label' }, '문서 근거 슬롯'),
          h('div', { class: 'stat__value' }, docText),
          h('div', { class: 'meter', style: { marginTop: '8px' } }, docBar)
        ),
        h(
          'div',
          { class: 'stat stat--accent' },
          h('div', { class: 'stat__label' }, '그래프 근거 슬롯'),
          h('div', { class: 'stat__value' }, graphText),
          h('div', { class: 'meter', style: { marginTop: '8px' } }, graphBar)
        ),
        h(
          'div',
          { class: 'stat' },
          h('div', { class: 'stat__label' }, '정책형 질문 추정'),
          h('div', { class: 'stat__value' }, policyScore),
          h('div', { class: 'stat__note' }, '문서 슬롯 4개에서 포화')
        ),
        h(
          'div',
          { class: 'stat' },
          h('div', { class: 'stat__label' }, '다중 홉 질문 추정'),
          h('div', { class: 'stat__value' }, hopScore),
          h('div', { class: 'stat__note' }, '그래프 슬롯 3개에서 포화')
        )
      ),
      verdict
    ),
    h(
      'div',
      { class: 'card__foot' },
      '위 퍼센트는 교육용 모델입니다(슬롯 수에 대한 단순 포화 함수). 실제 품질은 검색기·리랭커·프롬프트에 크게 의존합니다.'
    )
  );
  render();
  return card;
}

export default {
  id: 'theory/graph-rag',
  title: 'Graph RAG',
  kicker: 'CHAPTER 08 · GRAPH RAG',
  summary: '벡터 검색은 “비슷한 문장”을 찾습니다. Graph RAG는 “연결된 사실”을 찾습니다. 이 차이가 답변의 근거 수준을 바꿉니다.',
  minutes: 18,
  tags: ['벡터 검색', '엔티티 링킹', 'GraphRAG'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      pageHead({
        kicker: 'CHAPTER 08 · GRAPH RAG',
        title: 'Graph RAG — 검색에 관계를 더하기',
        summary:
          'RAG는 “LLM에게 찾아온 문서를 읽힌다”입니다. Graph RAG는 여기에 <strong>엔티티와 경로</strong>를 더해, <strong>어떤 사실에 근거했는지 인용 가능한 답변</strong>을 만듭니다.',
        minutes: 18,
        tags: ['벡터 RAG 한계', '하이브리드 검색', '커뮤니티 요약'],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '기본형 RAG는 어떻게 동작하나',
          lead: '다섯 단계입니다. 그래프가 없어도 잘 도는 구간과, 구조적으로 안 되는 구간을 구분하는 것이 출발점입니다.',
        },
        pipelineViz(),
        prose(
          `질문과 청크를 <strong>같은 벡터 공간</strong>에 놓고 가까운 것을 고릅니다. 이 방식은 “문서 안에 답이 한 문단으로 있는 질문”에 매우 강합니다.
          반대로 <strong>여러 문서의 사실을 조합해야 하는 질문</strong>에는 약합니다. 검색이 문장 유사도만 보기 때문에, “연결”을 계산하지 않기 때문입니다.`
        ),
        codeBlock({
          lang: 'text',
          title: '기본형 RAG 프롬프트의 전형',
          code: `다음 문서만 사용해 질문에 답하세요. 문서에 없으면 "확인 불가"라고 하세요.

# 문서
[D1] 반품·교환 정책 v3.2: 수령 후 7일 이내 단순 변심 반품이 가능합니다...
[D2] 반품 사유 코드 정의: 사유 코드는 파손, 불량, 소음, 이물질, 단순 변심으로 구분합니다...

# 질문
대성테크가 공급한 헤드폰의 반품 사유와, 그 영향 범위는?`,
          note: '문서에 “대성테크”가 직접 등장하지 않으면, 이 프롬프트는 근거를 찾지 못하고 그럴듯한 일반론을 생성합니다. 이것이 <strong>근거 없는 답변</strong>의 시작입니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '벡터 RAG가 구조적으로 무너지는 질문',
          lead: '세 가지 유형입니다. 셋 다 “유사도는 높지만 답이 아닌 문서”를 가져옵니다.',
        },
        tableBlock({
          head: ['질문 유형', '예', '벡터 검색이 하는 일', '실패 지점'],
          rows: [
            ['다중 홉 조합', '“대성테크 부품이 들어간 상품의 반품률은?”', '“반품률”이 들어간 정책 문서를 가져옴', '정책은 오지만 <em>어느 상품이 어느 공급사인지</em>는 문서에 없음'],
            ['전역 요약', '“이번 분기 클레임의 공통 원인은?”', '개별 클레임 문서 몇 개를 가져옴', '전체를 가로지르는 요약은 top-k에 담기지 않음'],
            ['엔티티 정규화', '“한빛전자 제품 불량” vs 문서의 “한빛 일렉트로닉스”', '문자열이 달라 유사도가 낮음', '같은 회사인데 검색 실패'],
          ],
          compact: true,
        }),
        callout(
          'engineer',
          'DB 엔지니어의 번역',
          '벡터 검색은 <strong>인덱스 스캔</strong>입니다. 조건을 정확히 모르고 “비슷한 것”을 훑는 방식이죠. 그래프 검색은 <strong>조인</strong>입니다. “이 엔티티에서 시작해 이 관계를 따라간다”는 경로가 명시적입니다. RAG의 실패는 대개 인덱스 문제가 아니라 <strong>조인 조건 부재</strong>입니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '그래프가 더하는 세 가지',
          lead: '엔티티 링킹 · 다중 홉 확장 · 커뮤니티 요약. 하나씩 보면 어렵지 않습니다.',
        },
        compareBlock([
          {
            title: '① 엔티티 링킹',
            tone: 'c',
            items: [
              '질문의 고유명사를 그래프 노드에 연결',
              '“헤드폰” → 실제 상품 노드 p3',
              '동의어·오타·약어를 별칭으로 흡수',
              '실패하면 이후 모든 단계가 어긋남 → 가장 중요한 단계',
            ],
          },
          {
            title: '② 다중 홉 확장',
            tone: 'b',
            items: [
              '시작 엔티티에서 1~2홉만 확장 (전체 그래프는 절대 넣지 않음)',
              '관계 타입을 제한해 노이즈 차단',
              '경로 자체를 근거로 프롬프트에 넣음',
              '“왜 이 답인가”를 경로로 설명 가능',
            ],
          },
          {
            title: '③ 커뮤니티 요약',
            tone: 'c',
            items: [
              '그래프를 커뮤니티로 나누고(Louvain) 요약문 생성',
              '전역 질문(“공통 원인은?”)에 사용',
              'Microsoft GraphRAG 계열의 접근',
              '요약 갱신 비용이 든다 → 배치 주기 설계 필요',
            ],
          },
        ]),
        callout(
          'insight',
          '핵심 원칙',
          'Graph RAG에서 그래프는 <strong>정답 저장소가 아니라 “근거를 찾는 인덱스”</strong>입니다. 답변은 여전히 LLM이 만들지만, 근거의 경로가 추적 가능해집니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '하이브리드 설계 — 무엇을 얼마나 넣을 것인가',
          lead: '좋은 Graph RAG는 “그래프만” 쓰지 않습니다. 문서 근거와 그래프 근거를 <strong>역할별로</strong> 배분합니다.',
        },
        budgetDemo(),
        subgraphDemo(ctx),
        prose(
          `실무 파이프라인의 순서는 대개 이렇습니다.
          <strong>① 질문에서 엔티티·의도 추출</strong> → <strong>② 벡터 검색으로 정책 문서 확보</strong> → <strong>③ 그래프에서 사례·경로 확장</strong> →
          <strong>④ 경로와 문서를 함께 재랭킹</strong> → <strong>⑤ 근거 ID를 붙여 프롬프트 조립</strong>.
          이 순서를 지키지 않고 “그래프 전체를 요약해 넣기”부터 하면 토큰만 태우고 품질은 떨어집니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '다중 홉 근거 후보 찾기 (Neo4j)',
          code: `// 질문에서 식별된 공급사(s2)에서 2홉 이내의 “사례”만 모은다
MATCH (s:Supplier {id: 's2'})<-[:SUPPLIED_BY]-(p:Product)
      <-[:CONTAINS]-(o:Order)-[:HAS_RETURN]->(r:Return)
RETURN p.name   AS product,
       o.id     AS orderId,
       r.reason AS reason,
       r.status AS status
LIMIT 25;`,
          note: '이 결과를 **구조화된 근거**로 프롬프트에 넣습니다. 전체 서브그래프를 자연어로 요약하지 마세요 — 근거가 흐려집니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '평가는 어떻게 하나',
          lead: '“답이 좋아 보인다”로는 운영할 수 없습니다. RAG 평가는 <strong>검색 평가</strong>와 <strong>생성 평가</strong>로 나눕니다.',
        },
        tableBlock({
          head: ['지표', '측정 대상', 'Graph RAG에서의 의미', '측정 방법'],
          rows: [
            ['Context Recall', '검색', '필요한 사실이 컨텍스트에 들어왔는가', '골든셋의 필수 근거 노드·문서 ID 대조'],
            ['Context Precision', '검색', '넣은 근거 중 실제로 쓰인 비율', '리랭커 점수·인용 일치율'],
            ['Faithfulness', '생성', '답변이 컨텍스트에 근거하는가', '문장별 근거 ID 인용 여부 검사'],
            ['Answer Relevance', '생성', '질문에 답했는가', 'LLM 심사 or 사람 평가'],
            ['Path Validity', '그래프', '인용한 경로가 실제로 존재하는가', '인용 경로를 그래프에 재질의'],
          ],
          compact: true,
        }),
        statsBlock([
          { label: '골든셋 규모(권장)', value: '50', unit: '문항', note: '질문 유형별로 고르게. 없으면 개선을 측정할 수 없음' },
          { label: '가장 흔한 실패', value: '링킹', note: '엔티티 링킹 실패가 전체 오류의 절반 이상' },
          { label: 'Path Validity', value: '100', unit: '%', note: '인용 경로는 반드시 실제로 존재해야 함', accent: true },
          { label: '컨텍스트 크기', value: '4–8', unit: 'k 토큰', note: '그 이상은 비용 대비 효용이 급감' },
        ])
      )
    );

    el.append(
      section(
        { num: '6', title: '한눈에 비교' },
        chartCard(ctx, {
          title: '질문 유형별 근거 확보율 (교육용 예시)',
          subtitle: '벡터 단독 / 그래프 단독 / 하이브리드가 각 질문 유형에서 근거를 얼마나 확보하는지.',
          height: 320,
          foot: '실측이 아닌 설명용 예시 수치입니다. 도메인과 데이터 품질에 따라 결과는 크게 달라집니다.',
          option: (t) => ({
            backgroundColor: 'transparent',
            textStyle: { fontFamily: t.font, color: t.ink2 },
            grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
            tooltip: {
              trigger: 'axis',
              backgroundColor: t.dark ? '#131a2a' : '#fff',
              borderColor: t.dark ? '#26314a' : '#e3e6ef',
              textStyle: { color: t.ink, fontSize: 12 },
            },
            legend: { top: 0, textStyle: { color: t.ink3, fontSize: 11 } },
            xAxis: {
              type: 'category',
              data: ['정책 단일 문서', '다중 홉 조합', '전역 요약', '엔티티 별칭'],
              axisLabel: { color: t.ink3, fontSize: 11 },
              axisLine: { lineStyle: { color: t.axis } },
            },
            yAxis: {
              type: 'value',
              max: 100,
              axisLabel: { color: t.ink3, formatter: '{value}%' },
              splitLine: { lineStyle: { color: t.grid } },
            },
            series: [
              {
                name: '벡터 단독',
                type: 'bar',
                data: [92, 34, 41, 48],
                itemStyle: { color: t.blue, borderRadius: [4, 4, 0, 0] },
                barMaxWidth: 22,
              },
              {
                name: '그래프 단독',
                type: 'bar',
                data: [21, 88, 52, 76],
                itemStyle: { color: t.purple, borderRadius: [4, 4, 0, 0] },
                barMaxWidth: 22,
              },
              {
                name: '하이브리드',
                type: 'bar',
                data: [94, 91, 84, 88],
                itemStyle: { color: t.ok, borderRadius: [4, 4, 0, 0] },
                barMaxWidth: 22,
              },
            ],
            animationDuration: 600,
          }),
        })
      )
    );

    el.append(
      section(
        { num: '7', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/graph-rag',
          questions: [
            {
              q: '“대성테크 부품이 들어간 상품의 반품률” 질문에서 벡터 RAG가 실패하는 주된 이유는?',
              options: [
                '임베딩 모델이 한국어를 지원하지 않아서',
                '정책 문서는 찾지만 상품–공급사 연결 관계를 검색이 계산하지 않기 때문',
                '문서가 너무 짧아서',
              ],
              answer: 1,
              explain: '유사도 검색은 문장 유사도만 봅니다. 공급사→상품→주문→반품의 경로는 그래프에서 명시적으로 따라가야 합니다.',
            },
            {
              q: 'Graph RAG 파이프라인에서 가장 먼저 무너지면 전체가 어긋나는 단계는?',
              options: ['프롬프트 조립', '엔티티 링킹', '답변 요약'],
              answer: 1,
              explain: '질문 속 엔티티를 잘못 연결하면 확장 경로 자체가 틀어집니다. 링킹 품질이 상한을 결정합니다.',
            },
            {
              q: '전역 요약 질문(“이번 분기 공통 원인은?”)에 주로 쓰이는 기법은?',
              options: ['커뮤니티 탐지 후 요약문 활용 (GraphRAG 계열)', '그래프 전체 노드를 프롬프트에 넣기', '벡터 top-1만 사용하기'],
              answer: 0,
              explain: '커뮤니티별 요약을 미리 만들어 두고, 전역 질문에는 요약을 근거로 사용합니다. 전체 노드를 넣는 것은 토큰 낭비입니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        'Graph RAG의 본질은 <strong>“검색기가 조인을 할 수 있게 만드는 것”</strong>입니다. 그래프는 답을 담는 곳이 아니라, <strong>근거를 찾고 인용하는 경로</strong>를 제공합니다.'
      )
    );

    return { destroy() {} };
  },
};
