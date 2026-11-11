/**
 * Lab 6 — Graph RAG 파이프라인
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
  accordionBlock,
  badge,
} from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';
import { seedGraphStore } from '../data/modumall.seed.js';
import { runRagPipeline, DOCS } from '../engine/rag-sim.js';
import { toast } from '../core/toast.js';

const STAGES = [
  { key: 'analyze', title: '질의 분석', state: '대기' },
  { key: 'link', title: '엔티티 링킹', state: '대기' },
  { key: 'retrieve', title: '하이브리드 검색', state: '대기' },
  { key: 'expand', title: '서브그래프 확장', state: '대기' },
  { key: 'context', title: '근거 구성', state: '대기' },
  { key: 'answer', title: '답변 + 인용', state: '대기' },
];

const PRESETS = [
  '대성테크가 공급한 헤드폰의 반품 사유와 영향 범위는?',
  '무선 이어폰과 함께 구매되는 상품은?',
  '파워넷 충전기 발열 이슈의 공급사 리드타임은?',
];

function ragDemo(ctx, store) {
  const g = graphCard(ctx, {
    title: '검색된 서브그래프',
    subtitle: '실행 후 질문과 연결된 노드·관계만 남기고 나머지는 흐려집니다.',
    data: store.toVis(),
    height: 400,
    seed: 55,
  });
  let view = null;
  g.ready.then((v) => {
    view = v;
  });

  /* stages */
  const stageEls = STAGES.map((s) =>
    h(
      'div',
      { class: 'pstage', dataset: { key: s.key } },
      h('div', { class: 'pstage__n' }, s.key === 'analyze' ? '01' : String(STAGES.findIndex((x) => x.key === s.key) + 1).padStart(2, '0')),
      h('div', { class: 'pstage__title' }, s.title),
      h('div', { class: 'pstage__state' }, '대기')
    )
  );
  const pipeline = h('div', { class: 'pipeline' }, stageEls);

  const input = h('input', {
    type: 'text',
    value: PRESETS[0],
    'aria-label': '질문 입력',
    placeholder: '질문을 입력하세요',
  });
  const runBtn = h('button', { class: 'btn btn--primary', type: 'button' }, '파이프라인 실행');
  const presetRow = h(
    'div',
    { class: 'chip-row' },
    PRESETS.map((p, i) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          onClick: () => {
            input.value = p;
            if (i === 0) run();
          },
        },
        `예시 ${i + 1}`
      )
    )
  );

  const results = h('div');
  const answerBox = h(
    'div',
    {},
    h('div', { class: 'rag-box' }, h('div', { class: 'rag-box__head' }, '답변'), h('div', { class: 'rag-box__body' }, '파이프라인을 실행하면 근거를 인용한 답변이 여기에 표시됩니다.'))
  );
  const docsBox = h(
    'div',
    {},
    h('div', { class: 'rag-box' }, h('div', { class: 'rag-box__head' }, '근거'), h('div', { class: 'rag-box__body' }, '검색된 문서와 그래프 경로가 여기에 표시됩니다.'))
  );
  const entityBox = h('div', { class: 'chip-row' });

  let busy = false;

  function setStage(idx, state) {
    stageEls.forEach((el, i) => {
      el.classList.toggle('is-active', i === idx && state === 'active');
      el.classList.toggle('is-done', i < idx || (i === idx && state === 'done'));
      const st = el.querySelector('.pstage__state');
      if (i < idx) st.textContent = '완료';
      else if (i === idx) st.textContent = state === 'active' ? '처리 중…' : '완료';
      else st.textContent = '대기';
    });
  }

  function resetStages() {
    stageEls.forEach((el) => {
      el.classList.remove('is-active', 'is-done');
      el.querySelector('.pstage__state').textContent = '대기';
    });
  }

  async function run() {
    if (busy) return;
    const q = input.value.trim();
    if (!q) {
      toast('질문을 입력하세요', 'warn');
      return;
    }
    busy = true;
    runBtn.disabled = true;
    results.replaceChildren();
    answerBox.replaceChildren();
    docsBox.replaceChildren();
    entityBox.replaceChildren();
    view?.clearHighlight();
    resetStages();

    const res = runRagPipeline(store, q, { k: 3, hops: 2 });

    // 단계 애니메이션
    for (let i = 0; i < stageEls.length; i++) {
      setStage(i, 'active');
      await new Promise((r) => setTimeout(r, 260));
      setStage(i, 'done');
    }

    renderResult(res);
    busy = false;
    runBtn.disabled = false;
    ctx.progress?.setStep('lab/graph-rag', 1);
  }

  function renderResult(res) {
    /* 엔티티 */
    entityBox.replaceChildren(
      ...(res.linked.length
        ? res.linked.map((l) =>
            h(
              'button',
              {
                class: 'chip is-on',
                type: 'button',
                style: { cursor: 'pointer' },
                onClick: () => {
                  view?.focus(l.id);
                  view?.highlight([l.id], { edges: [] });
                },
                title: `링킹 신뢰도 ${Math.round(l.score * 100)}%`,
              },
              `${l.name} :${l.label}`
            )
          )
        : [h('span', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, '식별된 엔티티가 없습니다. 질문에 상품·공급사 이름을 넣어 보세요.')])
    );

    /* 답변 */
    const citeOf = (id) => DOCS.find((d) => d.id === id);
    const parts = res.answer.split(/(\[D\d\])/g);
    const answerText = h('div', { class: 'rag-answer' });
    for (const p of parts) {
      const m = /^\[D(\d)\]$/.exec(p);
      if (m) {
        const doc = citeOf(`D${m[1]}`);
        answerText.append(
          h(
            'button',
            {
              class: 'rag-cite',
              type: 'button',
              title: doc ? doc.title : '',
              onClick: () => {
                const idx = res.vectorHits.findIndex((d) => d.id === `D${m[1]}`);
                toast(idx >= 0 ? `${doc?.title} — 유사도 ${(res.vectorHits[idx].score * 100).toFixed(1)}%` : doc?.title || '문서', 'info');
              },
            },
            p
          )
        );
      } else {
        answerText.append(document.createTextNode(p));
      }
    }

    answerBox.replaceChildren(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'card__head' },
          h(
            'div',
            { class: 'card__head-text' },
            h('div', { class: 'card__title' }, '답변 (근거 인용 포함)'),
            h('div', { class: 'card__sub' }, `그래프 근거 ${res.facts.length}개 · 문서 근거 ${res.vectorHits.length}개 · ${res.ms.toFixed(1)}ms`)
          ),
          badge('시뮬레이션', 'warn')
        ),
        h('div', { class: 'card__body' }, answerText, h('div', { style: { marginTop: '12px' } }, h('div', { class: 'card__sub', style: { marginBottom: '6px' } }, '식별된 엔티티'), entityBox)),
        h('div', { class: 'card__foot' }, '답변은 실제 LLM이 아니라, 검색된 문서 문장과 그래프 경로를 템플릿으로 조립한 결과입니다. “근거가 어떻게 모이는가”를 보여주는 것이 목적입니다.')
      )
    );

    /* 문서 */
    docsBox.replaceChildren(
      h('div', { class: 'rag-box' },
        h('div', { class: 'rag-box__head' }, '문서 근거 (벡터 top-3)'),
        h(
          'div',
          { class: 'rag-box__body' },
          res.vectorHits.map((d) =>
            h(
              'div',
              { class: 'rag-hit' },
              h('span', { class: 'rag-hit__score' }, `${(d.score * 100).toFixed(0)}%`),
              h('div', { class: 'rag-hit__text' }, h('b', {}, `${d.id} ${d.title}`), h('div', {}, d.text.slice(0, 90) + '…'))
            )
          )
        )
      ),
      h('div', { class: 'rag-box', style: { marginTop: '8px' } },
        h('div', { class: 'rag-box__head' }, '그래프 경로 근거'),
        h('div', { class: 'rag-box__body' }, res.facts.slice(0, 8).map((f) => h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '2px 0' } }, f.text)))
      )
    );

    /* 비교 */
    const ev = res.evidence;
    results.append(
      h(
        'div',
        { class: 'result-strip' },
        h('span', {}, '커버리지 — 벡터 ', h('b', {}, `${(res.coverage.vector * 100).toFixed(0)}%`)),
        h('span', { class: 'dot' }),
        h('span', {}, '그래프 ', h('b', {}, `${(res.coverage.graph * 100).toFixed(0)}%`)),
        h('span', { class: 'dot' }),
        h('span', {}, '하이브리드 ', h('b', {}, `${(res.coverage.hybrid * 100).toFixed(0)}%`))
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'table table--compact' },
          h('thead', {}, h('tr', {}, h('th', {}, '필요한 근거'), h('th', {}, '벡터만'), h('th', {}, '그래프만'), h('th', {}, '하이브리드'))),
          h(
            'tbody',
            {},
            ev.map((e) =>
              h(
                'tr',
                {},
                h('td', {}, e.label),
                h('td', {}, e.vector ? '✓' : '—'),
                h('td', {}, e.graph ? '✓' : '—'),
                h('td', {}, e.hybrid ? '✓' : '—')
              )
            )
          )
        )
      ),
      accordionBlock([
        {
          title: '프롬프트 미리보기 (실제 조립된 텍스트)',
          content: [
            h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, '아래 텍스트가 그대로 LLM에 들어간다고 가정합니다. 구조화된 근거가 프롬프트에 어떤 형태로 들어가는지 확인하세요.'),
            codeBlock({ lang: 'text', code: res.prompt, title: '조립된 프롬프트' }),
          ],
        },
      ])
    );

    /* 그래프 하이라이트 */
    if (view && res.subgraph.nodeIds.length) {
      view.highlight(res.subgraph.nodeIds, { edges: res.subgraph.edgeIds });
    }
  }

  runBtn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });

  const panel = h(
    'div',
    { class: 'rag-panel' },
    h(
      'div',
      { class: 'rag-panel__head' },
      h('span', { class: 'rag-panel__title' }, 'Graph RAG 파이프라인'),
      h('span', { class: 'rag-sim-tag' }, 'SIMULATION'),
      h('span', { class: 'spacer' })
    ),
    h(
      'div',
      { class: 'rag-panel__body' },
      pipeline,
      h('div', { class: 'rag-q' }, input, runBtn),
      presetRow,
      results
    )
  );

  return h(
    'div',
    { class: 'stack' },
    panel,
    g.el,
    h('div', { class: 'rag-grid' }, answerBox, docsBox)
  );
}

export default {
  id: 'lab/graph-rag',
  title: 'Graph RAG 파이프라인',
  kicker: 'LAB 6',
  summary: '질문 → 엔티티 링킹 → 서브그래프 → 근거 인용 답변까지 직접 실행합니다.',
  minutes: 26,
  tags: ['Graph RAG', '엔티티 링킹', '근거'],
  render(ctx) {
    const { el } = ctx;
    const store = seedGraphStore();
    ctx.store = store;

    el.append(
      ...labHead({
        num: 'LAB 6',
        kicker: 'GRAPH RAG',
        title: 'Graph RAG 파이프라인',
        summary:
          '이 실습은 <strong>실제 LLM을 호출하지 않습니다</strong>. 대신 “근거가 어떻게 모이고, 그래프가 무엇을 더하는지”를 단계별로 눈으로 확인합니다.',
        minutes: 26,
        tags: ['파이프라인', '엔티티 링킹', '인용'],
        scenarioTitle: '“챗봇이 그럴듯한 거짓말을 합니다. 근거를 대게 해 주세요”',
        quote:
          '“CS 챗봇이 ‘반품은 30일’이라고 답했는데 실제 정책은 7일이었습니다. <strong>어떤 문서·어떤 주문</strong>에 근거했는지 함께 보여 주고, 없으면 모른다고 하게 해 주세요.”',
        reqs: [
          { id: 'R1', title: '엔티티 링킹', desc: '질문 속 고유명사를 실제 노드에 연결' },
          { id: 'R2', title: '근거 수집', desc: '문서 + 그래프 경로를 함께 모으기' },
          { id: 'R3', title: '인용', desc: '답변의 각 주장에 근거 ID를 붙이기' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '파이프라인 실행',
          lead: '질문을 고르고 <strong>실행</strong>을 누르면 6단계가 순서대로 돌아갑니다. 결과 그래프에서 근거 범위가 강조됩니다.',
        },
        ragDemo(ctx, store),
        callout(
          'sim',
          '무엇이 진짜이고 무엇이 시뮬레이션인가',
          '임베딩은 <strong>토큰 해시 기반 결정적 벡터</strong>이고, 검색·확장·경로 수집은 실제로 동작합니다. 답변 문장만 템플릿으로 조립됩니다. 즉 <strong>“검색 파이프라인은 진짜, LLM은 가짜”</strong>입니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '각 단계에서 실제로 벌어지는 일',
          lead: '이해해야 할 것은 모델이 아니라 <strong>데이터 흐름</strong>입니다.',
        },
        tableBlock({
          head: ['단계', '입력', '출력', '실패하면'],
          rows: [
            ['질의 분석', '자연어 질문', '의도 + 키워드', '엉뚱한 문서를 검색'],
            ['엔티티 링킹', '키워드 + 노드 사전', '노드 ID 목록', '이후 모든 근거가 틀어짐'],
            ['하이브리드 검색', '질문 벡터', '문서 top-k', '정책 근거 누락'],
            ['서브그래프 확장', '시작 노드 + 홉 수', '노드/관계 집합', '사례 근거 누락 또는 폭발'],
            ['근거 구성', '서브그래프 + 문서', '구조화된 근거 문장', '프롬프트가 지저분해짐'],
            ['답변 + 인용', '근거 + 템플릿/LLM', '답변 + 근거 ID', '인용 없는 답변 = 신뢰 불가'],
          ],
          compact: true,
        })
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '실제 구현에 가까운 코드',
          lead: '브라우저 시뮬레이션을 실제 서비스로 옮길 때의 골격입니다.',
        },
        codeBlock({
          lang: 'cypher',
          title: '1) 질문 엔티티로 근거 후보 뽑기',
          code: `// 1) 엔티티 링킹 결과(s2, p3)로 2홉 서브그래프를 만든다
MATCH path = (s:Supplier {id: 's2'})<-[:SUPPLIED_BY]-(p:Product)
             <-[:CONTAINS]-(o:Order)-[:HAS_RETURN]->(r:Return)
RETURN p.name AS product, o.id AS orderId, r.reason AS reason,
       [n IN nodes(path) | coalesce(n.name, n.id)] AS pathNodes
LIMIT 30;`,
        }),
        codeBlock({
          lang: 'text',
          title: '2) 근거를 프롬프트로 조립하는 골격 (의사코드)',
          code: `entities = link(question)                    # 노드 ID
docs     = vector_search(question, k=4)      # 정책 문서
graph    = expand(entities, hops=2, limit=40) # 사례 경로
facts    = [edge_to_sentence(e) for e in graph]
prompt   = TEMPLATE.format(question, entities, facts, docs)
answer   = llm(prompt, temperature=0)        # 낮은 온도 권장
citations = extract_citations(answer, facts, docs)
assert all(c in facts|docs for c in citations)  # 인용 검증(환각 차단)`,
        }),
        callout(
          'warn',
          '인용 검증을 건너뛰지 마세요',
          'LLM이 만들어 낸 인용 ID는 <strong>존재하지 않을 수 있습니다</strong>. 답변 생성 후 “인용된 근거 ID가 실제 검색 결과에 있는가”를 코드로 검증해야 합니다. 이것이 faithfulness의 최소 방어선입니다.'
        ),
        neo4jBlock({
          title: '실제 Neo4j에서 근거 후보 확인',
          steps: [
            {
              title: '2홉 서브그래프',
              code: `MATCH (s:Supplier {id: 's2'})<-[:SUPPLIED_BY]-(p:Product)
      <-[:CONTAINS]-(o:Order)-[:HAS_RETURN]->(r:Return)
RETURN p.name AS product, count(o) AS orders, collect(r.reason) AS reasons
ORDER BY orders DESC;`,
              lang: 'cypher',
            },
          ],
        })
      )
    );

    el.append(
      section(
        { num: '4', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/graph-rag',
          questions: [
            {
              q: '이 실습에서 진짜로 동작하는 부분은?',
              options: ['LLM 답변 생성', '벡터 검색·그래프 확장·근거 수집', '없음'],
              answer: 1,
              explain: '검색과 확장은 실제 계산입니다. 답변 문장만 템플릿으로 조립됩니다.',
            },
            {
              q: '엔티티 링킹이 실패하면 어떤 일이 생기는가?',
              options: ['답변 속도만 느려진다', '서브그래프가 비어 근거 없는 답변이 나온다', '그래프가 삭제된다'],
              answer: 1,
              explain: '시작 노드가 없으면 확장할 수 없습니다. 링킹이 전체 품질의 상한을 결정합니다.',
            },
            {
              q: '답변의 인용 ID를 검증해야 하는 이유는?',
              options: ['속도를 위해', 'LLM이 존재하지 않는 근거를 인용할 수 있으므로', '토큰을 절약하려고'],
              answer: 1,
              explain: '인용 검증은 환각을 걸러내는 가장 저렴하고 효과적인 방법입니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '<a href="#/lab/performance">Lab 7 — 성능 진단과 안티패턴</a>에서 슈퍼노드와 fan-out을 다룹니다.'));

    return { destroy() {} };
  },
};
