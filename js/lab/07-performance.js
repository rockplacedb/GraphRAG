/**
 * Lab 7 — 성능 진단과 안티패턴
 */
import { h } from '../core/dom.js';
import {
  section,
  prose,
  callout,
  codeBlock,
  tableBlock,
  graphCard,
  chartCard,
  quizBlock,
  checklist,
  badge,
  statsBlock,
} from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';
import { seedGraphStore } from '../data/modumall.seed.js';
import { traversalCost } from '../engine/algorithms.js';

function fanoutGraph(fanout) {
  const nodes = [{ id: 'hub', labels: ['Product'], props: { name: '무선 이어폰 (허브)' } }];
  const edges = [];
  const cap = Math.min(fanout, 48);
  for (let i = 0; i < cap; i++) {
    const kind = i % 3 === 0 ? 'Customer' : i % 3 === 1 ? 'Order' : 'Review';
    const id = `leaf${i}`;
    nodes.push({ id, labels: [kind], props: { name: `${kind === 'Customer' ? '고객' : kind === 'Order' ? '주문' : '리뷰'} ${i + 1}` } });
    edges.push({ id: `he${i}`, type: kind === 'Customer' ? 'REVIEWED_BY' : 'CONTAINS', from: kind === 'Order' ? id : 'hub', to: kind === 'Order' ? 'hub' : id });
  }
  return { nodes, edges };
}

function supernodeDemo(ctx, store) {
  const state = { fanout: 18 };
  const g = graphCard(ctx, {
    title: '허브 노드의 팬아웃',
    subtitle: '인기 상품 하나에 주문·리뷰가 몰립니다. 이 노드를 지나가는 모든 경로가 이 지점에서 병목이 됩니다.',
    data: fanoutGraph(state.fanout),
    height: 360,
    seed: 63,
    nodeShape: 'dot',
  });
  let view = null;
  g.ready.then((v) => {
    view = v;
  });

  const out = h('output', {});
  const latency = h('b');
  const meter = h('i');
  const hint = h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', margin: '0' } });

  const input = h('input', {
    type: 'range',
    min: '4',
    max: '48',
    step: '1',
    value: String(state.fanout),
    'aria-label': '허브 노드 팬아웃',
    onInput: (e) => {
      state.fanout = Number(e.target.value);
      render();
    },
  });

  function render() {
    const f = state.fanout;
    out.textContent = `${f}개`;
    const base = 3 + f * 0.9;
    const penalty = f > 24 ? (f - 24) * 1.8 : 0;
    const ms = base + penalty;
    latency.textContent = `${ms.toFixed(1)}ms`;
    meter.style.width = `${Math.min(100, (ms / 90) * 100)}%`;
    hint.textContent =
      f <= 16
        ? '양호: 인접 리스트 순회가 짧습니다.'
        : f <= 24
          ? '주의: 캐시 효율이 떨어지기 시작합니다. LIMIT·관계 타입 필터를 확인하세요.'
          : '위험: 슈퍼노드입니다. 2~3홉 질의가 이 노드를 지나면 결과가 폭발하고 지연이 급증합니다.';
    if (view) view.setData(fanoutGraph(f), { fit: false });
  }
  render();

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
          h('div', { class: 'card__title' }, '팬아웃 시뮬레이터'),
          h('div', { class: 'card__sub' }, '허브 노드의 연결 수를 바꾸며 “비용이 어디서 터지는지” 감을 잡습니다.')
        ),
        badge('교육용 모델', 'warn')
      ),
      h(
        'div',
        { class: 'card__body' },
        h('div', { class: 'fanout' }, h('div', { class: 'stack' }, g.el), h(
          'div',
          { class: 'fanout__controls' },
          h('div', { class: 'field' }, h('label', {}, h('span', {}, '허브 팬아웃'), out), input),
          h('div', { class: 'stat' }, h('div', { class: 'stat__label' }, '추정 지연'), h('div', { class: 'stat__value' }, latency), h('div', { class: 'meter', style: { marginTop: '8px' } }, meter)),
          hint
        ))
      ),
      h('div', { class: 'card__foot' }, '지연 수치는 설명용 모델입니다(기본 비용 + 팬아웃 선형 + 임계 이후 페널티). 실제 측정은 PROFILE과 모니터링으로 해야 합니다.')
    ),
    callout(
      'warn',
      '슈퍼노드가 생기는 전형적 이유',
      '<strong>①</strong> 인기 상품/유명인처럼 실제로 차수가 큰 노드. <strong>②</strong> 모든 것을 한 “분류” 노드에 연결. ' +
        '<strong>③</strong> 이벤트를 모두 누적하는 “로그” 노드. <strong>④</strong> 잘못된 모델링으로 상태 코드가 노드가 된 경우.'
    ),
    tableBlock({
      head: ['해결 패턴', '방법', '비용'],
      rows: [
        ['관계 세분화', 'CONTAINS 를 연도/카테고리별 관계 타입으로 나누기', '질의가 길어짐'],
        ['중간 노드 도입', 'Product -[HAS_MONTH]- Month -[INCLUDES]- Order', '홉 수 증가'],
        ['필터 우선', 'MATCH 시작점에 라벨+인덱스, LIMIT 사용', '근본 해결은 아님'],
        ['집계 물질화', '자주 쓰는 카운트를 속성으로 유지', '정합성 유지 부담'],
      ],
      compact: true,
    })
  );
}

export default {
  id: 'lab/performance',
  title: '성능 진단과 안티패턴',
  kicker: 'LAB 7',
  summary: '슈퍼노드, 인덱스, 실행 계획. 그래프 DB도 결국 성능 엔지니어링의 영역입니다.',
  minutes: 20,
  tags: ['PROFILE', '슈퍼노드', '인덱스'],
  render(ctx) {
    const { el } = ctx;
    const store = seedGraphStore();
    ctx.store = store;

    const readout = h('div', { class: 'card__foot' }, '체크리스트를 모두 확인하면 운영 준비 완료입니다.');

    const list = checklist(
      [
        '모든 MERGE 대상에 유니크 제약이 있다',
        '조회 시작 노드에 라벨 + 인덱스가 있다',
        '가변 길이 관계에 상한(*1..3)이 있다',
        '슈퍼노드를 지나는 질의에 LIMIT과 타입 필터가 있다',
        'PROFILE로 db hits를 확인했다',
        '백업/복구 절차를 실제로 복원 테스트했다',
        '커넥션 풀 크기와 트랜잭션 범위를 점검했다',
        '메트릭(지연 p95, 페이지 캐시 히트율) 알림이 걸려 있다',
      ],
      {
        onChange: (n, total) => {
          readout.textContent = `${n} / ${total} 확인 완료 ${n === total ? '— 운영 준비 완료 🎉' : ''}`;
          readout.style.color = n === total ? 'var(--ok-500)' : '';
        },
      }
    );

    el.append(
      ...labHead({
        num: 'LAB 7',
        kicker: 'PERFORMANCE',
        title: '성능 진단과 안티패턴',
        summary:
          '그래프 DB라고 성능이 공짜는 아닙니다. <strong>팬아웃·인덱스·실행 계획</strong>을 읽지 못하면 같은 문제를 반복합니다.',
        minutes: 20,
        tags: ['슈퍼노드', 'PROFILE', '인덱스'],
        scenarioTitle: '“배포는 했는데, 특정 상품 페이지만 느립니다”',
        quote:
          '“인기 상품 상세 페이지가 3초 걸립니다. DB는 CPU 20%인데 응답만 느립니다. <strong>그래프를 잘못 쓴 건지, 모델이 잘못된 건지</strong> 모르겠습니다.”',
        reqs: [
          { id: 'R1', title: '병목 찾기', desc: '슈퍼노드인지, 인덱스 누락인지, 경로 폭발인지 구분' },
          { id: 'R2', title: '근거 있는 수정', desc: 'PROFILE 수치로 개선 전후를 비교' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '슈퍼노드 — 그래프 성능의 1번 범인',
          lead: '차수가 큰 노드는 <strong>경로 탐색의 모든 지점</strong>에서 결과를 곱합니다. 슬라이더로 직접 확인하세요.',
        },
        supernodeDemo(ctx, store),
        prose(
          `슈퍼노드 자체는 데이터 문제가 아닙니다. <strong>질문의 모양</strong>과 만날 때 문제가 됩니다.
          “이 상품을 산 고객이 산 다른 상품”은 2홉입니다. 중간 노드의 팬아웃이 1,000이면 2홉 결과는 <strong>100만 경로</strong>가 될 수 있습니다.
          LIMIT은 결과를 줄일 뿐, <strong>탐색 비용</strong>을 줄이지 않습니다.`
        ),
        chartCard(ctx, {
          title: '팬아웃에 따른 지연 (교육용 모델)',
          subtitle: '선형 구간과 임계 이후 페널티 구간을 구분해 보세요.',
          height: 300,
          foot: '실측이 아닌 모델입니다. 실제로는 페이지 캐시 히트율, 관계 타입 수, 속성 크기에 따라 달라집니다.',
          option: (t) => {
            const xs = [4, 8, 12, 16, 20, 24, 32, 40, 48];
            const ys = xs.map((f) => Number((3 + f * 0.9 + (f > 24 ? (f - 24) * 1.8 : 0)).toFixed(1)));
            return {
              backgroundColor: 'transparent',
              textStyle: { fontFamily: t.font, color: t.ink2 },
              grid: { left: 8, right: 18, top: 24, bottom: 8, containLabel: true },
              tooltip: {
                trigger: 'axis',
                backgroundColor: t.dark ? '#131a2a' : '#fff',
                borderColor: t.dark ? '#26314a' : '#e3e6ef',
                textStyle: { color: t.ink, fontSize: 12 },
                valueFormatter: (v) => `${v}ms`,
              },
              xAxis: {
                type: 'category',
                name: '팬아웃',
                nameTextStyle: { color: t.ink4, fontSize: 11 },
                data: xs,
                axisLabel: { color: t.ink3 },
                axisLine: { lineStyle: { color: t.axis } },
              },
              yAxis: {
                type: 'value',
                name: '지연(ms)',
                nameTextStyle: { color: t.ink4, fontSize: 11 },
                axisLabel: { color: t.ink3 },
                splitLine: { lineStyle: { color: t.grid } },
              },
              series: [
                {
                  type: 'line',
                  smooth: true,
                  symbolSize: 7,
                  data: ys,
                  lineStyle: { width: 2.6, color: t.warn },
                  itemStyle: { color: t.warn },
                  areaStyle: {
                    color: {
                      type: 'linear',
                      x: 0,
                      y: 0,
                      x2: 0,
                      y2: 1,
                      colorStops: [
                        { offset: 0, color: 'rgba(217,119,6,0.25)' },
                        { offset: 1, color: 'rgba(217,119,6,0.02)' },
                      ],
                    },
                  },
                  markLine: {
                    silent: true,
                    symbol: 'none',
                    label: { color: t.ink4, fontSize: 10, formatter: '권장 상한' },
                    lineStyle: { color: t.ink4, type: 'dashed' },
                    data: [{ xAxis: 4 }],
                  },
                },
              ],
              animationDuration: 600,
            };
          },
        }),
        statsBlock([
          { label: '권장 팬아웃', value: '≤ 24', note: '이 이상이면 경로 필터·LIMIT을 먼저 검토' },
          { label: '2홉 경로 수', value: 'F²', note: '팬아웃의 제곱으로 늘어남' },
          { label: 'LIMIT의 한계', value: '결과만', note: '탐색 비용은 줄지 않음', accent: true },
          { label: '해결', value: '모델링', note: '관계 세분화 또는 중간 노드' },
        ])
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '인덱스와 제약 — 조용한 성능 킬러',
          lead: '라벨 스캔은 O(N), 인덱스 탐색은 O(log N)입니다. 수십만 노드에서 차이는 “안 되거나 되거나”입니다.',
        },
        codeBlock({
          lang: 'cypher',
          title: '인덱스/제약 확인과 생성',
          code: `// 어떤 인덱스가 있는지 확인
SHOW INDEXES;

// 라벨 + 속성 인덱스 (조회 시작점)
CREATE INDEX product_name IF NOT EXISTS
FOR (p:Product) ON (p.name);

// 유니크 제약 (MERGE 기준 + 동시성 안전)
CREATE CONSTRAINT product_sku_unique IF NOT EXISTS
FOR (p:Product) REQUIRE p.sku IS UNIQUE;

// 제약 조회
SHOW CONSTRAINTS;`,
        }),
        tableBlock({
          head: ['상황', '인덱스 없음', '인덱스 있음'],
          rows: [
            ['MATCH (p:Product {name: "무선 이어폰"})', '전체 Product 스캔 O(N)', '인덱스 탐색 O(log N)'],
            ['MERGE (p:Product {sku: "SKU-1001"})', '중복 위험 + 전체 스캔', '유니크 보장 + 빠른 매칭'],
            ['MATCH (c:Customer {id: "c1"})', '노드 50만 개면 느림', '즉시'],
          ],
          compact: true,
        }),
        callout(
          'engineer',
          'RDB와 같은 원칙',
          '그래프 DB도 <strong>시작점은 인덱스로 찾고, 이후는 포인터로 따라간다</strong>는 원칙이 같습니다. “인덱스 없는 라벨 스캔”은 RDB의 <strong>Full Table Scan</strong>과 동일한 문제입니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: 'PROFILE 읽는 법',
          lead: '실행 계획을 읽을 줄 모르면 튜닝은 감으로 하고, 개선은 우연히 일어납니다.',
        },
        codeBlock({
          lang: 'cypher',
          title: 'PROFILE 예시',
          code: `PROFILE
MATCH (p:Product {name: '무선 이어폰'})
      <-[:CONTAINS]-(o:Order)
RETURN count(o) AS orders;`,
        }),
        tableBlock({
          head: ['연산자', '의미', '봐야 할 지표'],
          rows: [
            ['NodeByLabelScan', '라벨 전체 스캔', 'db hits, rows — 인덱스로 바꿀 수 있는가'],
            ['NodeIndexSeek', '인덱스로 시작점 찾기', 'rows — 기대한 1행인가'],
            ['Expand(All)', '관계 확장', 'db hits, rows — 슈퍼노드 지점인가'],
            ['Filter', '조건 필터', 'rows 감소 폭 — 늦게 필터링하면 비용 증가'],
            ['Aggregate', '집계', 'rows — 중간 결과 크기'],
          ],
          compact: true,
        }),
        neo4jBlock({
          title: '실제 Neo4j에서 확인',
          steps: [
            { text: '먼저 인덱스 없이 실행해 db hits를 기록하고, 인덱스를 만든 뒤 같은 쿼리를 비교합니다.', code: `PROFILE MATCH (p:Product {name: '무선 이어폰'}) RETURN p;`, lang: 'cypher' },
            {
              title: '인덱스 생성 후 재실행',
              code: `CREATE INDEX product_name IF NOT EXISTS FOR (p:Product) ON (p.name);
PROFILE MATCH (p:Product {name: '무선 이어폰'}) RETURN p;`,
              lang: 'cypher',
            },
          ],
          note: '개선 전후의 <strong>db hits</strong>를 반드시 기록하세요. “빨라진 것 같다”는 근거가 아닙니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: 'RDB vs Graph — 값으로 보는 교차점',
          lead: '깊이가 늘어날수록 조인 비용은 곱셈, 홉 비용은 덧셈입니다.',
        },
        chartCard(ctx, {
          title: '탐색 깊이별 비용 모델',
          subtitle: '행 10만, 팬아웃 6 기준. 교차점 이후 격차가 급격히 벌어집니다.',
          height: 300,
          foot: '교육용 근사 모델입니다. 실제 옵티마이저는 통계와 인덱스에 따라 다른 계획을 선택합니다.',
          option: (t) => {
            const depths = [1, 2, 3, 4, 5];
            return {
              backgroundColor: 'transparent',
              textStyle: { fontFamily: t.font, color: t.ink2 },
              grid: { left: 8, right: 18, top: 36, bottom: 8, containLabel: true },
              legend: { top: 0, textStyle: { color: t.ink3, fontSize: 11 } },
              tooltip: { trigger: 'axis', backgroundColor: t.dark ? '#131a2a' : '#fff', borderColor: t.dark ? '#26314a' : '#e3e6ef', textStyle: { color: t.ink, fontSize: 12 } },
              xAxis: { type: 'category', data: depths.map((d) => `${d}홉`), axisLabel: { color: t.ink3 }, axisLine: { lineStyle: { color: t.axis } } },
              yAxis: { type: 'log', axisLabel: { color: t.ink3, formatter: (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : v) }, splitLine: { lineStyle: { color: t.grid } } },
              series: [
                { name: 'RDB 조인', type: 'line', smooth: true, data: depths.map((d) => traversalCost(d).joins[d - 1]), lineStyle: { width: 2.4, color: t.danger }, itemStyle: { color: t.danger } },
                { name: '그래프 홉', type: 'line', smooth: true, data: depths.map((d) => traversalCost(d).traversalOps), lineStyle: { width: 2.4, color: t.ok }, itemStyle: { color: t.ok } },
              ],
              animationDuration: 600,
            };
          },
        })
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '운영 준비 체크리스트',
          lead: '배포 전에 팀이 합의해야 할 항목입니다. 체크해 보세요.',
        },
        h('div', { class: 'card' }, h('div', { class: 'card__body' }, list), readout)
      )
    );

    el.append(
      section(
        {
          num: '6',
          title: '안티패턴 요약',
        },
        tableBlock({
          head: ['안티패턴', '증상', '처방'],
          rows: [
            ['슈퍼노드', '특정 질의만 느림, 결과 폭발', '관계 세분화 / 중간 노드 / 필터 우선'],
            ['인덱스 없는 시작점', '라벨 스캔, 노드 증가에 비례해 느려짐', '라벨+속성 인덱스'],
            ['무제한 가변 길이', '메모리 폭증, 타임아웃', '*1..n 상한 + LIMIT'],
            ['모든 것을 노드로', '노드 수 폭발, 홉 증가', '속성/관계로 재분류'],
            ['MERGE 남용', '전체 스캔 반복', '유니크 제약 + 인덱스'],
            ['트랜잭션에 그래프 전체 쓰기', '락 경합', '배치 분할, 단위 축소'],
          ],
          compact: true,
        })
      )
    );

    el.append(
      section(
        { num: '7', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/performance',
          questions: [
            {
              q: 'LIMIT 10을 추가하면 슈퍼노드 경로 탐색 비용이 줄어드는가?',
              options: ['크게 줄어든다', '결과만 줄고 탐색 비용은 대부분 그대로다', '아무 영향 없다'],
              answer: 1,
              explain: 'LIMIT은 반환 행 수를 제한합니다. 탐색 자체는 계속되므로 상한·필터·모델 개선이 필요합니다.',
            },
            {
              q: 'PROFILE에서 확인해야 할 핵심 지표는?',
              options: ['쿼리 문자열 길이', 'db hits와 rows', '노드 개수만'],
              answer: 1,
              explain: '연산자별 db hits와 rows로 병목 지점을 찾습니다.',
            },
            {
              q: '슈퍼노드 문제의 근본 해결에 가장 가까운 것은?',
              options: ['서버 메모리 증설', '관계 세분화·중간 노드 도입 등 모델 변경', 'LIMIT 100 추가'],
              answer: 1,
              explain: '증설은 시간을 벌 뿐입니다. 경로가 지나는 구조를 바꿔야 합니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '<a href="#/reference/cheatsheet">부록 — SQL ↔ Cypher 치트시트</a>로 문법을 정리하고 마무리합니다.'));

    return { destroy() {} };
  },
};
