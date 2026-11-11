/**
 * 이론 06 — 그래프 알고리즘
 * 질문→알고리즘 지도, BFS 단계 재생, PageRank 실측 차트, 중심성·커뮤니티 비교, 안티패턴, 퀴즈.
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
  chartCard,
  quizBlock,
  compareBlock,
  statsBlock,
  badge,
} from '../ui/blocks.js';
import { playbar } from '../ui/components.js';
import { bfs, pagerank, louvain, degreeCentrality, betweenness } from '../engine/algorithms.js';
import { seedGraphStore } from '../data/modumall.seed.js';

const START = 'c1';

/* ---------------- BFS 단계 재생 ---------------- */
function bfsPlayground(ctx, store) {
  const g = graphCard(ctx, {
    title: 'BFS — 한 홉씩 번지는 방문',
    subtitle:
      '시작 노드는 <strong>고객 김하늘(c1)</strong>입니다. 재생하면 <strong>방문(녹색) · 확장 대기(청록) · 현재(호박)</strong>이 단계마다 갱신됩니다.',
    data: store.toVis(),
    height: 430,
    seed: 9,
    hint: '노드를 드래그하거나 스크롤로 확대할 수 있습니다',
  });

  const steps = bfs(store, START, { maxDepth: 5 }).steps;
  const visitedOut = h('b', { style: { fontFamily: 'var(--font-mono)' } }, '0');
  const frontierOut = h('b', { style: { fontFamily: 'var(--font-mono)' } }, '0');
  let view = null;
  let bar = null;

  function renderStep(i) {
    if (i < 0) {
      view?.clearHighlight();
      visitedOut.textContent = '0';
      frontierOut.textContent = '0';
      bar?.setLog('재생을 누르면 c1에서 시작합니다.');
      return;
    }
    const s = steps[i];
    if (!s) return;
    view?.paint({ visited: s.visited, active: s.active ? [s.active] : [], frontier: s.frontier });
    visitedOut.textContent = String(s.visited.length);
    frontierOut.textContent = String(s.frontier.length);
    bar?.setLog(s.log);
  }

  bar = playbar({
    length: steps.length,
    label: '홉',
    onStep: renderStep,
    onReset: () => {
      view?.clearHighlight();
      visitedOut.textContent = '0';
      frontierOut.textContent = '0';
    },
  });
  ctx.addCleanup(() => bar.destroy());

  g.ready.then((v) => {
    view = v;
    if (bar.step >= 0) renderStep(bar.step);
  });

  return h(
    'div',
    { class: 'stack' },
    g.el,
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card__head' },
        h(
          'div',
          { class: 'card__head-text' },
          h('div', { class: 'card__title' }, '단계 재생', badge(`${steps.length}단계`, 'accent')),
          h('div', { class: 'card__sub' }, '한 단계 = 한 홉(레벨). 큐에서 꺼낸 순서대로 이웃을 방문합니다.')
        )
      ),
      h(
        'div',
        { class: 'card__body' },
        h(
          'div',
          { class: 'row', style: { marginBottom: '10px' } },
          h('span', { class: 'badge' }, '방문 누적'),
          visitedOut,
          h('span', { class: 'badge' }, '확장 대기'),
          frontierOut,
          h('span', { class: 'spacer' }),
          h('span', { style: { fontSize: 'var(--fs-2xs)', color: 'var(--ink-4)' } }, '시작 c1 · 최대 5홉')
        ),
        bar.el
      ),
      h(
        'div',
        { class: 'card__foot' },
        'BFS는 모든 간선 비용이 같을 때만 최단 경로를 보장합니다. 가중치가 있으면 Dijkstra로 넘어가야 하고, 음수 간선이 있으면 Bellman-Ford입니다.'
      )
    )
  );
}

/* ---------------- PageRank 실측 차트 ---------------- */
function pagerankChart(ctx, pr) {
  const top = pr.scores.slice(0, 8);
  const { el } = chartCard(ctx, {
    title: 'PageRank 상위 8 — 모두몰 시드 실측',
    subtitle: `무방향 투영 · 감쇠 0.85 · ${pr.iterations}회 반복. 점수는 확률 질량이라 전체 합이 1입니다.`,
    height: 320,
    foot: '상품 허브가 상위에 오는 것은 주문·리뷰가 몰린 <strong>구조</strong>의 결과입니다. 매출 순위와 나란히 놓으면 두 지표가 서로 다른 것을 재고 있음이 드러납니다.',
    option: (t) => ({
      backgroundColor: 'transparent',
      grid: { left: 6, right: 52, top: 8, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: t.dark ? '#131a2a' : '#ffffff',
        borderColor: t.dark ? '#26314a' : '#e3e6ef',
        textStyle: { color: t.ink, fontSize: 12 },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: t.grid } },
        axisLabel: { color: t.ink4, fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: top.map((x) => x.label),
        axisLabel: { color: t.ink2, fontSize: 11, width: 130, overflow: 'truncate' },
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: top.map((x) => Number(x.score.toFixed(4))),
          barWidth: 13,
          itemStyle: { color: t.accent, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: t.ink3,
            fontSize: 10,
            formatter: (p) => Number(p.value).toFixed(3),
          },
        },
      ],
      animationDuration: 700,
    }),
  });
  return el;
}

export default {
  id: 'theory/algorithms',
  title: '그래프 알고리즘',
  kicker: 'CHAPTER 06 · GRAPH ALGORITHMS',
  summary:
    '알고리즘 선택은 <strong>질문의 종류</strong>를 고르는 일입니다. 같은 그래프에서 BFS·Dijkstra·PageRank·Louvain이 각각 무엇을 답하고, 어떤 질문에는 <strong>답하지 못하는지</strong> 확인합니다.',
  minutes: 16,
  tags: ['BFS', 'Dijkstra', 'PageRank', 'Louvain', 'GDS'],
  render(ctx) {
    const { el } = ctx;
    const store = seedGraphStore();
    const { nodes: nodeCount, edges: edgeCount } = store.stats();
    const pr = pagerank(store);
    const comm = louvain(store);
    const dc = degreeCentrality(store);
    const bw = betweenness(store);
    const first = pr.scores[0];
    const second = pr.scores[1];

    el.append(
      pageHead({
        kicker: 'CHAPTER 06 · GRAPH ALGORITHMS',
        title: '그래프 알고리즘',
        summary:
          '“몇 홉인가”와 “누가 중요한가”는 다른 질문이고, 다른 알고리즘입니다. <strong>무엇을 답하는지</strong>와 <strong>비용이 어떻게 증가하는지</strong>를 함께 봐야 합니다.',
        minutes: 16,
        tags: ['BFS · DFS', '최단 경로', 'PageRank', 'Louvain', 'GDS'],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '알고리즘은 “무엇을 묻는가”를 고르는 일',
          lead:
            '도구 이름을 외우는 대신 <strong>질문 → 알고리즘 → 복잡도</strong> 순서로 정리합니다. 이 표가 이 장의 지도입니다.',
        },
        tableBlock({
          head: ['질문', '알고리즘', '돌려주는 것', '복잡도', 'Neo4j GDS (5.x)'],
          rows: [
            ['A에서 B까지 몇 홉인가', 'BFS', '레벨(=홉)과 방문 순서', 'O(V+E)', '`gds.bfs.stream`'],
            ['가중치를 고려한 최단 경로', 'Dijkstra', '경로 + 총 비용', 'O((V+E) log V)', '`gds.shortestPath.dijkstra.stream`'],
            ['연결이 가장 많은 노드', 'Degree centrality', '차수', 'O(V+E)', '`gds.degree.stream`'],
            ['경로를 많이 중계하는 노드', 'Betweenness', '최단 경로 경유 횟수', 'O(V·E)', '`gds.betweenness.stream`'],
            ['영향력이 큰 노드', 'PageRank', '정상 상태 확률', 'O(k·E)', '`gds.pageRank.stream`'],
            ['덩어리(커뮤니티)', 'Louvain', '소속 + 모듈러리티 Q', 'O(E)·스윕', '`gds.louvain.stream`'],
            ['끊긴 섬 찾기', 'Connected components', '컴포넌트 목록', 'O(V+E)', '`gds.wcc.stream`'],
          ],
          compact: true,
        }),
        prose(
          `표의 복잡도는 <strong>한 번 실행</strong> 기준입니다. BFS·연결 요소는 간선을 한 번씩만 보므로 <code>O(V+E)</code>이고, 매개 중심성은 모든 시작점에서 BFS를 돌리므로 <code>O(V·E)</code>입니다.
          PageRank는 반복 횟수 k에, Louvain은 스윕 수에 비례합니다. 같은 “중요도”라도 <strong>비용 증가율이 두 자릿수만큼 다릅니다</strong>.`
        ),
        callout(
          'engineer',
          'GDS의 투영(projection) = 구체화 뷰 + 인덱스',
          `알고리즘은 디스크의 그래프를 직접 읽지 않습니다. <code>gds.graph.project</code>로 만든 <strong>메모리 투영</strong> 위에서 돌고, 결과는 <code>stream</code>(즉시 반환)·<code>write</code>(노드 속성에 기록)·<code>mutate</code>(다음 알고리즘의 입력)로 받습니다.
          투영은 공짜가 아니라서, 운영에서는 <strong>언제 만들고 언제 버릴지</strong>가 알고리즘 선택만큼 중요합니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: 'BFS · DFS · 최단 경로',
          lead: 'BFS는 <strong>큐</strong>, DFS는 <strong>스택</strong>. 이 차이가 “최단을 보장하느냐”를 갈라놓습니다.',
        },
        prose(
          `BFS는 시작점에서 가까운 순서로 방문하므로 <strong>무가중 최단 경로</strong>를 줍니다. DFS는 경로 존재·사이클·위상 정렬에 강하지만 최단을 보장하지 않습니다.
          가중치가 붙으면 Dijkstra(<code>우선순위 큐</code>)로, 음수 간선이 있으면 Bellman-Ford로 넘어갑니다. 실무에서 “최단 경로”가 느려지는 원인은 대개 알고리즘이 아니라 <strong>탐색 반경</strong>입니다.`
        ),
        bfsPlayground(ctx, store),
        prose(
          `${nodeCount}개 노드가 모두 방문되는 동안, 각 단계의 비용은 <strong>그 레벨의 간선 수</strong>로 제한됩니다. RDB의 재귀 CTE가 홉마다 중간 결과를 다시 조인하는 것과 대비되는 지점입니다.
          탐색 반경을 제한하지 않으면 그래프에서도 비용은 결국 “전체 그래프”가 됩니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '최단 경로 — 엔진 내장 함수와 GDS',
          code: `// 1) 엔진 내장: 무가중(홉 수) 기준 최단 경로
MATCH (a:Customer {id: 'c1'}), (b:Supplier {id: 's4'})
MATCH p = shortestPath((a)-[*..6]-(b))
RETURN [n IN nodes(p) | coalesce(n.name, n.id)] AS route,
       length(p) AS hops;

// 2) GDS: 가중치를 고려한 Dijkstra (투영이 먼저)
CALL gds.graph.project('modumall',
  ['Customer', 'Order', 'Product', 'Supplier'],
  { PLACED:      { type: 'PLACED',      orientation: 'UNDIRECTED' },
    CONTAINS:    { type: 'CONTAINS',    orientation: 'UNDIRECTED' },
    SUPPLIED_BY: { type: 'SUPPLIED_BY', orientation: 'UNDIRECTED', properties: 'leadDays' } });

CALL gds.shortestPath.dijkstra.stream('modumall', { sourceNode: 'c1', targetNode: 's4', relationshipWeightProperty: 'leadDays' })
YIELD totalCost, nodeIds
RETURN totalCost, [id IN nodeIds | gds.util.asNode(id).name] AS route;`,
          note:
            '<code>leadDays</code>는 <code>SUPPLIED_BY</code>에만 있는 속성이라 나머지 관계는 기본 가중치 1로 계산됩니다. <strong>가중치가 일부에만 있는 그래프</strong>는 최단 경로가 조용히 왜곡되기 쉬운 대표 사례입니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: 'PageRank — “중요도”를 확률로 정의하기',
          lead: '링크를 따라가는 무작위 서퍼가 각 노드에 머무는 확률. 정의가 명확한 대신, <strong>구조가 정보를 담고 있어야</strong> 의미가 있습니다.',
        },
        prose(
          `PageRank는 감쇠 계수 d(보통 0.85)를 두고 “링크를 따라가기”와 “순간이동”을 섞습니다. 순간이동 확률이 남아 있으면 순환·막다른 노드가 있어도 분포가 수렴합니다. 반복은 점수 변화량이 허용오차 아래로 떨어질 때 멈추므로 <strong>비용은 반복 횟수에 비례</strong>합니다.
          이 시드에서 1위는 <strong>${first.label}</strong>(${first.score.toFixed(3)}), 2위는 ${second.label}(${second.score.toFixed(3)})입니다.`
        ),
        pagerankChart(ctx, pr),
        callout(
          'warn',
          '별 그래프에서 PageRank는 아무것도 알려주지 않는다',
          `중심 1개 + 잎 N개인 별 그래프를 떠올려 보세요. 잎은 모두 <code>(1-d)/N</code> 근처로 똑같고 중심만 튑니다.
          “누가 더 중요한가”라는 질문에 <strong>새 정보가 0</strong>입니다. 또 방향을 지운 무방향 투영에서는 차수가 점수를 지배합니다.
          추천에 쓰려면 <strong>방향 + 관계 가중치 + 개인화 벡터</strong>가 필요합니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: 'gds.pageRank — stream과 write',
          code: `CALL gds.pageRank.stream('modumall', {
  maxIterations: 20, dampingFactor: 0.85, relationshipWeightProperty: 'weight'
})
YIELD nodeId, score
WITH gds.util.asNode(nodeId) AS n, score
WHERE n:Product
RETURN n.name AS product, score
ORDER BY score DESC
LIMIT 8;

// 점수를 노드 속성으로 남기면 대시보드/추천에서 재사용할 수 있다
CALL gds.pageRank.write('modumall', { writeProperty: 'pagerank' });`,
          note:
            '반복 알고리즘은 <strong>중간 상태가 없다</strong>는 점이 장점이자 단점입니다. 언제 계산했는지(계산 시각·투영 이름)를 함께 저장하지 않으면, 대시보드 숫자가 언제 것인지 아무도 답할 수 없습니다.',
        })
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: 'Louvain과 중심성 — “중요하다”의 정의를 고르기',
          lead: 'Louvain은 <strong>모듈러리티 Q</strong>를 최대화하고, 중심성은 <strong>무엇을 세는지</strong>에 따라 답이 달라집니다.',
        },
        prose(
          `Louvain은 ① 각 노드를 자기 커뮤니티로 두고 이웃으로 옮겨 보며 Q 이득을 계산하고, ② 커뮤니티를 하나의 노드로 접어 다시 ①을 반복합니다.
          resolution을 올리면 <strong>작은 커뮤니티가 많이</strong>, 내리면 큰 덩어리가 적게 나옵니다.
          이 페이지의 구현은 ②(집계) 없이 ①만 도는 교육용 버전이라 <strong>${comm.groups.length}개 커뮤니티</strong>로 잘게 나뉩니다(Q≈${comm.modularity.toFixed(2)}).
          GDS의 Louvain은 계층 병합까지 수행하므로 훨씬 적은 수로 수렴합니다.`
        ),
        statsBlock([
          { label: '커뮤니티 수 (교육용 구현)', value: comm.groups.length, unit: '개', note: `모듈러리티 Q ≈ ${comm.modularity.toFixed(2)}`, accent: true },
          { label: '최대 차수', value: dc[0].degree, unit: '연결', note: dc[0].label },
          { label: '최대 매개 중심성', value: bw[0].score.toFixed(2), note: bw[0].label },
          { label: 'PageRank 1위', value: first.score.toFixed(3), note: first.label },
        ]),
        compareBlock([
          {
            title: '차수 중심성 (Degree)',
            tone: 'c',
            items: ['이웃 수 그 자체를 잰다', '가장 싼 지표 (O(E))', '슈퍼노드가 1등 — 품질 신호가 아님', '카탈로그 정리, 이상치 탐지'],
          },
          {
            title: '매개 중심성 (Betweenness)',
            tone: 'b',
            items: ['최단 경로가 지나가는 횟수를 잰다', '병목·중계자 찾기', 'O(V·E) — 큰 그래프에 매시간은 무리', '공급망 단절점, 물류 허브'],
          },
          {
            title: 'PageRank',
            tone: 'a',
            items: ['무작위 서퍼의 정상 상태 확률', '방향·가중치를 반영한 영향력', '별·완전 그래프에서는 정보 없음', '추천 후보, 문서 중요도'],
          },
        ]),
        codeBlock({
          lang: 'cypher',
          title: 'gds.louvain — 커뮤니티를 노드 속성으로',
          code: `CALL gds.louvain.stream('modumall', { relationshipWeightProperty: 'weight' })
YIELD nodeId, communityId
RETURN communityId, count(*) AS members,
       collect(gds.util.asNode(nodeId).name)[..4] AS sample
ORDER BY members DESC
LIMIT 5;`,
          note:
            'resolution을 올리면 커뮤니티가 작아지고 개수가 늘어납니다. <code>gds.louvain.write</code>로 <code>communityId</code>를 노드 속성에 남겨 두면 세그먼트 질의에 바로 쓸 수 있습니다.',
        }),
        callout(
          'sim',
          '구현 세부가 결과를 바꾼다',
          `“커뮤니티 ${comm.groups.length}개”는 도메인 사실이 아니라 <strong>이 구현의 성질</strong>입니다. 교육용 Louvain은 1차 로컬 이동만 하므로 연결이 적은 노드가 곧바로 자기 커뮤니티가 됩니다.
          <strong>알고리즘 결과를 조직 개편의 근거로 쓰기 전에, 구현과 하이퍼파라미터를 문서화</strong>해야 합니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '쓰지 말아야 할 때 — 안티패턴과 운영 규칙',
          lead: '알고리즘은 <strong>질문이 구조와 맞을 때만</strong> 답을 줍니다. 틀린 질문에 정교한 알고리즘을 쓰면 비용만 남습니다.',
        },
        tableBlock({
          head: ['안티패턴', '증상', '대안'],
          rows: [
            ['수백 노드 그래프에 Louvain', '거의 모든 노드가 자기 커뮤니티', '도메인 규칙·수동 분류, 또는 더 큰 그래프에서만'],
            ['무방향 PageRank로 개인화 추천', '허브 상품만 상위 — 모두에게 같은 답', '방향·가중치 + 개인화 벡터, 협업 필터링과 결합'],
            ['매시간 전체 betweenness 재계산', 'O(V·E)로 배치 윈도우 초과', '샘플링·근사, 상위 후보만 재계산'],
            ['슈퍼노드를 포함한 전체 투영', '한 노드가 수백만 관계, 메모리 폭발', '투영에서 제외하거나 가중치로 압축'],
            ['알고리즘 점수를 원본 노드에 덮어쓰기', '재계산 때마다 이력 소실, 롤백 불가', '별도 라벨·속성 + 계산 시각 기록'],
          ],
          compact: true,
        }),
        callout(
          'engineer',
          '알고리즘 결과는 파생 데이터다',
          `PageRank·Louvain 결과를 원본 노드에 덮어쓰지 말고 <code>:PagerankScore</code> 같은 별도 라벨이나 <code>pagerank</code> + <code>computedAt</code> 속성으로 남기세요. 재계산과 롤백이 가능해집니다.
          RDB에서 구체화 뷰를 원본 테이블에 쓰지 않는 것과 같은 이유입니다. 같은 Louvain이라도 관계 1억 개에서는 스윕 한 번이 배치 한 번이므로, 알고리즘을 바꾸기 전에 <strong>투영을 줄일 수 있는지</strong> 먼저 봐야 합니다.`
        )
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/algorithms',
          questions: [
            {
              q: 'BFS가 “최단 경로”를 보장하는 조건으로 가장 정확한 것은?',
              options: [
                '모든 간선의 비용(가중치)이 같을 때',
                '그래프가 방향 그래프일 때',
                '간선 가중치가 모두 음수일 때',
              ],
              answer: 0,
              explain:
                'BFS는 홉 수를 최소화합니다. 간선 비용이 다르면 “홉이 적지만 비용이 큰” 경로가 최적일 수 있으므로 Dijkstra가 필요합니다.',
            },
            {
              q: '중심 1개와 잎 N개로 이루어진 별 그래프에 PageRank를 돌리면?',
              options: [
                '잎들의 점수가 서로 크게 갈린다',
                '중심만 높고 잎은 거의 동일하다 — “누가 더 중요한가”에 대한 정보가 없다',
                '모든 노드가 정확히 같은 점수를 받는다',
              ],
              answer: 1,
              explain:
                '잎은 들어오는 링크가 중심 하나뿐이라 점수가 대칭적으로 같아집니다. 구조가 구분을 담고 있지 않으면 지표도 구분을 만들지 못합니다.',
            },
            {
              q: '매개 중심성(Betweenness)을 대규모 그래프에서 매시간 재계산하는 것이 위험한 이유는?',
              options: [
                '결과가 항상 부정확하기 때문',
                '복잡도가 O(V·E)라 그래프가 커지면 배치 윈도우를 넘기기 때문',
                'Neo4j가 betweenness를 지원하지 않기 때문',
              ],
              answer: 1,
              explain:
                'Brandes 알고리즘은 모든 시작점에서 BFS를 수행합니다. 노드·간선이 늘면 비용이 곱으로 늘어나므로 근사·샘플링·부분 재계산이 필요합니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>알고리즘은 질문의 번역이다.</strong> “몇 홉”은 BFS, “가중 최단”은 Dijkstra, “영향력”은 PageRank, “덩어리”는 Louvain입니다. 질문이 구조와 맞지 않으면 정교한 알고리즘도 비용만 남깁니다.'
      )
    );

    return { destroy() {} };
  },
};
