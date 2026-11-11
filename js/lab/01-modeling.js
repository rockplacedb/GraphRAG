/**
 * Lab 1 — RDB 스키마를 그래프로 (매핑 도구)
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
  statsBlock,
} from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';
import { MAPPING_SLOTS, MAPPING_TARGETS, MODUMALL_DDL, TABLE_NOTES } from '../data/sqlDdl.js';
import { toast } from '../core/toast.js';

const MODEL_GRAPH = {
  nodes: [
    { id: 'Customer', labels: ['Customer'], props: { name: 'Customer' } },
    { id: 'Order', labels: ['Order'], props: { name: 'Order' } },
    { id: 'Product', labels: ['Product'], props: { name: 'Product' } },
    { id: 'Category', labels: ['Category'], props: { name: 'Category' } },
    { id: 'Supplier', labels: ['Supplier'], props: { name: 'Supplier' } },
    { id: 'Review', labels: ['Review'], props: { name: 'Review' } },
    { id: 'Return', labels: ['Return'], props: { name: 'Return' } },
  ],
  edges: [
    { id: 'm1', type: 'PLACED', from: 'Customer', to: 'Order' },
    { id: 'm2', type: 'CONTAINS', from: 'Order', to: 'Product' },
    { id: 'm3', type: 'IN_CATEGORY', from: 'Product', to: 'Category' },
    { id: 'm4', type: 'SUPPLIED_BY', from: 'Product', to: 'Supplier' },
    { id: 'm5', type: 'WROTE', from: 'Customer', to: 'Review' },
    { id: 'm6', type: 'REVIEWS', from: 'Review', to: 'Product' },
    { id: 'm7', type: 'HAS_RETURN', from: 'Order', to: 'Return' },
    { id: 'm8', type: 'FOR_PRODUCT', from: 'Return', to: 'Product' },
  ],
};

const DDL_OUT = `// 1) 유니크 제약: MERGE가 중복 노드를 만들지 않게 한다
CREATE CONSTRAINT customer_id IF NOT EXISTS
FOR (c:Customer) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT product_sku IF NOT EXISTS
FOR (p:Product) REQUIRE p.sku IS UNIQUE;

CREATE CONSTRAINT order_id IF NOT EXISTS
FOR (o:Order) REQUIRE o.id IS UNIQUE;

// 2) 조회 시작점 인덱스: 라벨 + 속성
CREATE INDEX product_name IF NOT EXISTS FOR (p:Product) ON (p.name);
CREATE INDEX supplier_name IF NOT EXISTS FOR (s:Supplier) ON (s.name);
CREATE INDEX return_reason IF NOT EXISTS FOR (r:Return) ON (r.reasonCode);`;

function mappingTool(ctx) {
  const state = { mapping: {}, selected: null, revealed: false, checked: false, wrong: new Set() };
  const left = h('div', { class: 'map-col' });
  const right = h('div', { class: 'map-col' });
  const feedback = h('div', { class: 'map-feedback' }, '왼쪽 테이블을 고른 뒤, 오른쪽에서 ‘노드’인지 ‘관계’인지 선택하세요.');
  const output = h('div');

  const verifyBtn = h('button', { class: 'btn btn--primary', type: 'button' }, '매핑 검증');
  const answerBtn = h('button', { class: 'btn', type: 'button' }, '정답 보기');
  const resetBtn = h('button', { class: 'btn btn--ghost', type: 'button' }, '초기화');
  const score = h('span', { class: 'badge' }, '0 / 8 매핑');

  const targetUsed = () => new Map(Object.entries(state.mapping));

  function renderColumns() {
    /* --- 왼쪽: 테이블 --- */
    left.replaceChildren(h('div', { class: 'map-col__title' }, '① 운영 중인 테이블 (8)'));
    for (const slot of MAPPING_SLOTS) {
      const target = state.mapping[slot.key];
      const isSelected = state.selected === slot.key;
      const card = h(
        'button',
        {
          class: `map-table${isSelected ? ' is-selected' : ''}${target ? ' is-mapped' : ''}`,
          type: 'button',
          style: { textAlign: 'left', cursor: 'pointer', width: '100%' },
          onClick: () => {
            state.selected = state.selected === slot.key ? null : slot.key;
            renderAll();
          },
        },
        h('span', { class: 'map-table__name' }, slot.label),
        h(
          'span',
          { class: 'map-table__cols' },
          target ? `→ ${target}${state.wrong.has(slot.key) ? ' (다시 확인)' : ''}` : '아직 매핑되지 않음'
        )
      );
      left.append(card);
    }

    /* --- 오른쪽: 모델 --- */
    right.replaceChildren(h('div', { class: 'map-col__title' }, '② 그래프 모델 — 노드와 관계'));
    for (const target of MAPPING_TARGETS) {
      const owner = [...targetUsed().entries()].find(([, t]) => t === target.id);
      const filled = Boolean(owner);
      const slotEl = h(
        'button',
        {
          class: `map-slot${filled ? ' is-filled' : ''}${state.selected ? ' is-target' : ''}`,
          type: 'button',
          style: { textAlign: 'left', cursor: 'pointer', width: '100%' },
          onClick: () => {
            if (!state.selected) {
              toast('먼저 왼쪽에서 테이블을 선택하세요', 'warn');
              return;
            }
            // 하나의 테이블은 하나의 대상만 가질 수 있다
            if (state.mapping[state.selected]) delete state.mapping[state.selected];
            state.mapping[state.selected] = target.id;
            state.wrong.delete(state.selected);
            state.checked = false;
            state.selected = null;
            renderAll();
          },
        },
        h(
          'span',
          { class: 'map-slot__label' },
          h('span', { class: `badge${target.kind === 'relation' ? ' badge--accent' : ''}` }, target.kind === 'relation' ? '관계' : '노드'),
          ' ',
          target.id
        ),
        filled
          ? h(
              'span',
              { class: 'map-slot__value' },
              h('span', {}, owner[0]),
              h('span', { class: 'map-slot__clear', role: 'button', tabindex: '0' }, '✕')
            )
          : h('span', { class: 'map-slot__hint' }, state.selected ? `‘${state.selected}’ 를 여기에 매핑` : target.hint)
      );
      if (filled) {
        slotEl.querySelector('.map-slot__clear')?.addEventListener('click', (e) => {
          e.stopPropagation();
          delete state.mapping[owner[0]];
          state.wrong.delete(owner[0]);
          renderAll();
        });
      }
      right.append(slotEl);
    }
    score.textContent = `${Object.keys(state.mapping).length} / 8 매핑`;
  }

  function renderFeedback() {
    let correct = 0;
    for (const slot of MAPPING_SLOTS) if (state.mapping[slot.key] === slot.accept) correct += 1;

    if (!state.checked) {
      feedback.className = 'map-feedback';
      feedback.innerHTML = `<strong>${correct} / 8</strong> 이 맞습니다. 전부 매핑한 뒤 “매핑 검증”을 눌러 보세요. 확신이 없다면 <strong>order_items</strong>부터 생각해 보세요 — 조인 테이블을 노드로 만들면 어떤 곤란한 점이 생길까요?`;
      return;
    }
    if (state.wrong.size === 0) {
      feedback.className = 'map-feedback is-ok';
      feedback.innerHTML =
        '<strong>정확합니다.</strong> 8개 항목이 모두 올바르게 매핑되었습니다. 핵심 판단은 <strong>order_items → 관계(CONTAINS)</strong> 였습니다. 조인 테이블은 대개 관계로 펼칩니다.';
      renderOutput();
    } else {
      feedback.className = 'map-feedback is-bad';
      const rows = [...state.wrong]
        .map((k) => {
          const slot = MAPPING_SLOTS.find((s) => s.key === k);
          const target = MAPPING_TARGETS.find((t) => t.id === slot.accept);
          return `<li><strong>${slot.label}</strong> → ${target.hint}</li>`;
        })
        .join('');
      feedback.innerHTML = `<strong>${state.wrong.size}개</strong>를 다시 확인하세요.<ul style="margin:8px 0 0 18px">${rows}</ul>`;
    }
  }

  function renderOutput() {
    output.replaceChildren();
    if (state.wrong.size || !state.checked) return;
    output.append(
      h('h4', { style: { margin: 0 } }, '자동 생성된 제약/인덱스'),
      codeBlock({ lang: 'cypher', code: DDL_OUT, title: '스키마 보호 장치' }),
      callout(
        'engineer',
        '제약조건 없는 MERGE의 위험',
        '유니크 제약이 없으면 동시에 두 요청이 <code>MERGE (p:Product {sku:&#39;SKU-1001&#39;})</code>를 실행할 때 <strong>중복 노드</strong>가 생길 수 있습니다. RDB의 PK 제약과 같은 역할을 그래프에서도 반드시 걸어야 합니다.'
      )
    );
  }

  function renderAll() {
    renderColumns();
    renderFeedback();
    if (state.wrong.size || !state.checked) output.replaceChildren();
    else renderOutput();
  }

  verifyBtn.addEventListener('click', () => {
    const missing = MAPPING_SLOTS.filter((s) => !state.mapping[s.key]).length;
    if (missing) {
      toast(`${missing}개 테이블이 아직 매핑되지 않았습니다`, 'warn');
    }
    state.checked = true;
    state.wrong = new Set(MAPPING_SLOTS.filter((s) => state.mapping[s.key] !== s.accept).map((s) => s.key));
    renderAll();
    if (!missing && state.wrong.size === 0) ctx.progress?.setStep('lab/modeling', 1);
  });
  answerBtn.addEventListener('click', () => {
    state.mapping = Object.fromEntries(MAPPING_SLOTS.map((s) => [s.key, s.accept]));
    state.revealed = true;
    state.checked = true;
    state.wrong = new Set();
    renderAll();
  });
  resetBtn.addEventListener('click', () => {
    state.mapping = {};
    state.wrong = new Set();
    state.checked = false;
    state.selected = null;
    renderAll();
  });

  renderAll();

  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card__head' },
      h(
        'div',
        { class: 'card__head-text' },
        h('div', { class: 'card__title' }, '테이블 8개 → 노드 7종 · 관계 8종'),
        h('div', { class: 'card__sub' }, '테이블을 클릭한 뒤 오른쪽 모델에서 “노드” 또는 “관계”를 선택하세요. 정답이 하나는 아니지만, 교육 목적의 권장 모델이 있습니다.')
      ),
      score
    ),
    h('div', { class: 'card__body' }, h('div', { class: 'map-tool' }, left, right)),
    h('div', { class: 'card__body', style: { paddingTop: 0 } }, feedback, output),
    h('div', { class: 'card__foot', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, verifyBtn, answerBtn, resetBtn, h('span', { class: 'spacer' }), h('span', { style: { fontSize: 'var(--fs-2xs)' } }, '힌트는 왼쪽 테이블을 선택하면 오른쪽에 표시됩니다'))
  );
}

export default {
  id: 'lab/modeling',
  title: 'RDB 스키마를 그래프로',
  kicker: 'LAB 1',
  summary: '운영 중인 8개 테이블을 노드·관계로 옮기고, 제약조건까지 설계합니다.',
  minutes: 22,
  tags: ['모델링', '매핑', '제약조건'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      ...labHead({
        num: 'LAB 1',
        kicker: 'MODELING',
        title: 'RDB 스키마를 그래프로',
        summary:
          '테이블을 그대로 옮기면 <strong>“노드만 있는 그래프”</strong>가 됩니다. 무엇이 노드이고 무엇이 관계인지 판단하는 것이 이 실습의 전부입니다.',
        minutes: 22,
        tags: ['매핑', 'order_items', '제약조건'],
        scenarioTitle: '“테이블 8개를 그래프로 옮겨 주세요”',
        quote:
          '“DDL은 그대로 드릴게요. <strong>노드 7종, 관계 8종</strong>으로 정리하고, 유니크 제약까지 걸어 주세요. 기존 조회 쿼리는 깨지지 않아야 합니다.”',
        reqs: [
          { id: 'R1', title: '함께 구매', desc: '2홉 이내 추천이 가능한 모양이어야 함' },
          { id: 'R2', title: '반품 추적', desc: '반품 사유 → 주문 → 상품 → 공급사로 이어져야 함' },
          { id: 'R3', title: '중복 방지', desc: 'MERGE 기준이 되는 유니크 키를 정의' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '출발점 — 운영 중인 DDL',
          lead: '전형적인 정규화 스키마입니다. 이걸 그대로 옮기면 그래프가 아니라 “한 줄로 늘어선 테이블”이 됩니다.',
        },
        codeBlock({ lang: 'sql', code: MODUMALL_DDL, title: '모두몰 운영 DB (발췌)' }),
        tableBlock({
          head: ['테이블', '그래프에서의 역할', '판단 이유'],
          rows: TABLE_NOTES.map((t) => [t.table, t.role, t.note]),
          compact: true,
        })
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '직접 매핑해 보기',
          lead: '정답은 하나가 아니지만, <strong>order_items</strong>만은 대부분의 팀이 관계로 펼칩니다. 이유를 생각하며 진행하세요.',
        },
        mappingTool(ctx)
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '완성된 모델',
          lead: '노드 7종, 관계 8종. 이 모델이면 시나리오의 세 요구를 모두 만족합니다.',
        },
        graphCard(ctx, {
          title: '모두몰 그래프 스키마',
          subtitle: '라벨 수준 모델입니다. 주문(Order)이 중심 허브 역할을 하는 구조가 보입니다.',
          data: MODEL_GRAPH,
          height: 480,
          seed: 12,
          hierarchical: false,
        }).el,
        h(
          'div',
          { class: 'grid-2' },
          callout(
            'warn',
            '안티패턴: order_items를 노드로',
            '조인 테이블을 <code>:OrderItem</code> 노드로 만들면, “함께 구매” 질의마다 <strong>노드를 한 번 더 통과</strong>해야 하고 노드 수가 주문 수 × 상품 수로 폭발합니다. 수량·단가 같은 속성은 <strong>관계 속성</strong>으로 충분합니다.'
          ),
          callout(
            'insight',
            '모델 검증 질문 3개',
            '① 이 노드로 시작하는 조회가 있는가? ② 이 관계 타입 이름만 보고 의미가 통하는가? ③ 3홉 질의에서 슈퍼노드가 생기지 않는가? 셋 다 통과하면 대체로 좋은 모델입니다.'
          )
        ),
        statsBlock([
          { label: '노드 라벨', value: '7', note: 'Customer · Order · Product · Category · Supplier · Review · Return', accent: true },
          { label: '관계 타입', value: '8', note: 'PLACED · CONTAINS · IN_CATEGORY · SUPPLIED_BY · WROTE · REVIEWS · HAS_RETURN · FOR_PRODUCT' },
          { label: '유니크 제약', value: '3', note: 'Customer.id · Product.sku · Order.id' },
          { label: '관계 속성', value: '2', note: 'CONTAINS {qty, unitPrice}' },
        ])
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '실제 Neo4j에서 적재하기',
          lead: '브라우저 실습의 시드 데이터와 동일한 모양입니다. CSV가 있다면 LOAD CSV로 그대로 옮길 수 있습니다.',
        },
        mockNotice(),
        neo4jBlock({
          title: '실제 Neo4j에서 실행하기',
          steps: [
            { text: '먼저 제약을 걸고, 그다음 데이터를 넣습니다. 순서를 지켜야 MERGE가 중복을 만들지 않습니다.', code: DDL_OUT, lang: 'cypher' },
            {
              title: '샘플 적재',
              code: `MERGE (c:Customer {id: 'c1'}) SET c.name = '김하늘', c.grade = 'VIP';
MERGE (p:Product {sku: 'SKU-1001'}) SET p.name = '무선 이어폰', p.price = 89000;
MERGE (o:Order {id: 'o1001'}) SET o.amount = 89000, o.status = 'PAID', o.date = '2024-05-02';

MATCH (c:Customer {id: 'c1'}), (o:Order {id: 'o1001'}), (p:Product {sku: 'SKU-1001'})
MERGE (c)-[:PLACED]->(o)
MERGE (o)-[:CONTAINS {qty: 1, unitPrice: 89000}]->(p)

RETURN c.name, o.id, p.name;`,
              lang: 'cypher',
            },
          ],
          note: 'CSV 대량 적재는 <code>LOAD CSV WITH HEADERS FROM &#39;file:///...&#39; AS row</code> 로 진행합니다. 파일은 Neo4j의 <code>import</code> 디렉터리에 두어야 합니다.',
        })
      )
    );

    el.append(
      section(
        { num: '5', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/modeling',
          questions: [
            {
              q: 'order_items(조인 테이블)를 그래프에서 다루는 일반적인 방법은?',
              options: ['별도 노드로 만든다', '두 노드 사이의 관계로 펼치고 수량·단가는 관계 속성으로 둔다', '삭제한다'],
              answer: 1,
              explain: '조인 테이블은 관계로 펼치는 것이 기본입니다. 노드로 만들면 경로가 길어지고 노드 수가 급증합니다.',
            },
            {
              q: 'MERGE로 데이터를 적재할 때 반드시 먼저 해야 하는 일은?',
              options: ['전체 삭제', '유니크 제약 생성', '인덱스 삭제'],
              answer: 1,
              explain: '유니크 제약이 없으면 동시 요청에서 중복 노드가 생길 수 있습니다.',
            },
            {
              q: '다음 중 노드가 아니라 “관계”로 두는 것이 더 자연스러운 것은?',
              options: ['반품 건', '주문에 포함된 상품(수량·단가 포함)', '공급사'],
              answer: 1,
              explain: '주문–상품은 M:N 연결이고 자체 식별자가 필요 없으므로 관계 + 속성이 적절합니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '모델이 준비되었으니 <a href="#/lab/cypher-basics">Lab 2 — Cypher 기초</a>에서 실제로 쿼리를 실행합니다.'));

    return { destroy() {} };
  },
};
