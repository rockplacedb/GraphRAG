/**
 * Lab 4 — 알고리즘 실전 (PageRank · Louvain · BFS)
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
  playbar,
  badge,
  statsBlock,
} from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';
import { seedGraphStore } from '../data/modumall.seed.js';
import { pagerank, louvain, bfs, degreeCentrality } from '../engine/algorithms.js';

const COMM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#ef4444', '#8b5cf6'];

export default {
  id: 'lab/algorithms',
  title: '알고리즘 실전',
  kicker: 'LAB 4',
  summary: 'PageRank로 인플루언서 상품을, Louvain으로 고객 세그먼트를 찾습니다.',
  minutes: 22,
  tags: ['PageRank', 'Louvain', 'BFS'],
  render(ctx) {
    const { el } = ctx;
    const store = seedGraphStore();
    ctx.store = store;

    const pr = pagerank(store, { iterations: 40 });
    const comm = louvain(store);
    const degree = degreeCentrality(store);

    /* ---------------- PageRank ----------------
       상품 노드를 중심으로 “누가 허브인가”를 본다. */
    const prTop = pr.scores.filter((s) => store.getNode(s.id)?.labels.includes('Product')).slice(0, 8);

    /* ---------------- Louvain 그래프 준비 ---------------- */
    const visBase = store.toVis();
    const commNodes = visBase.nodes.map((n) => {
      const c = comm.communities.get(n.id);
      return { ...n, color: COMM_COLORS[(c ?? 0) % COMM_COLORS.length], group: `C${c}` };
    });
    const commGroups = comm.groups.filter((g) => g.size >= 2).slice(0, 6);

    /* ---------------- BFS 재생 ---------------- */
    const bfsStart = 'p3';
    const walk = bfs(store, bfsStart, { maxDepth: 3 });
    const walkGraph = graphCard(ctx, {
      title: 'BFS 재생 — 노이즈캔슬링 헤드폰에서 3홉',
      subtitle: '재생을 누르면 방문 순서대로 색이 칠해집니다. 초록=방문 완료, 파랑=다음 차례, 노랑=현재.',
      data: visBase,
      height: 380,
      seed: 31,
    });
    let walkView = null;
    walkGraph.ready.then((v) => {
      walkView = v;
    });

    const bar = playbar({
      length: walk.steps.length,
      label: '스텝',
      onStep: (i) => {
        if (!walkView) return;
        if (i < 0) {
          walkView.resetPaint();
          return;
        }
        const s = walk.steps[i];
        const prev = i > 0 ? walk.steps[i - 1] : null;
        walkView.paint({
          visited: prev ? prev.visited : [],
          frontier: s.frontier,
          active: s.active ? [s.active] : [],
        });
        bar.setLog(s.log);
      },
      onReset: () => walkView?.resetPaint(),
    });
    ctx.addCleanup(() => bar.destroy());

    el.append(
      ...labHead({
        num: 'LAB 4',
        kicker: 'ALGORITHMS',
        title: '알고리즘 실전',
        summary:
          'Cypher로 “찾는” 것과 알고리즘으로 “계산하는” 것은 다릅니다. 점수화·군집화는 알고리즘의 영역입니다.',
        minutes: 22,
        tags: ['PageRank', 'Louvain', 'BFS'],
        scenarioTitle: '“인기 상품과 고객 세그먼트를 데이터로 증명해 주세요”',
        quote:
          '“감으로 ‘이 상품이 인기’라고 말하지 말고 <strong>근거 있는 순위</strong>를 원합니다. 고객도 등급이 아니라 <strong>행동 패턴으로 묶고</strong> 싶습니다.”',
        reqs: [
          { id: 'R1', title: '허브 상품', desc: '연결 구조에서 중심에 있는 상품 찾기' },
          { id: 'R2', title: '세그먼트', desc: '고객을 행동 기반 커뮤니티로 나누기' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: 'PageRank — 연결의 질로 순위 매기기',
          lead: '단순 판매량과 다릅니다. <strong>중요한 노드와 연결된 노드</strong>가 더 높은 점수를 받습니다.',
        },
        prose(
          `PageRank는 “링크가 많고, 그 링크를 가진 노드가 중요할수록” 높은 점수를 줍니다. 상품 그래프에서는
          <strong>주문·리뷰·공급사와 어떻게 연결되어 있는지</strong>가 점수에 반영됩니다.
          판매량 1위와 PageRank 1위가 다를 수 있고, 그 차이가 인사이트입니다.`
        ),
        chartCard(ctx, {
          title: `상품 PageRank 상위 ${prTop.length}개`,
          subtitle: `반복 ${pr.iterations}회 · 감쇠계수 0.85 · 무방향 해석`,
          height: 340,
          foot: '무방향으로 계산하면 주문/리뷰가 많은 상품이 유리합니다. 방향 그래프에서는 “주문 → 상품” 흐름으로 해석할 수 있습니다.',
          option: (t) => ({
            backgroundColor: 'transparent',
            textStyle: { fontFamily: t.font, color: t.ink2 },
            grid: { left: 8, right: 40, top: 16, bottom: 8, containLabel: true },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: t.dark ? '#131a2a' : '#fff', borderColor: t.dark ? '#26314a' : '#e3e6ef', textStyle: { color: t.ink, fontSize: 12 } },
            xAxis: { type: 'value', axisLabel: { color: t.ink3, formatter: (v) => (v * 1000).toFixed(1) }, splitLine: { lineStyle: { color: t.grid } } },
            yAxis: {
              type: 'category',
              inverse: true,
              data: prTop.map((s) => s.label),
              axisLabel: { color: t.ink3, fontSize: 11 },
              axisLine: { lineStyle: { color: t.axis } },
            },
            series: [
              {
                type: 'bar',
                data: prTop.map((s) => Number((s.score * 1000).toFixed(3))),
                barMaxWidth: 16,
                itemStyle: { color: t.purple, borderRadius: [0, 4, 4, 0] },
                label: { show: true, position: 'right', color: t.ink3, fontSize: 10, formatter: (p) => p.value.toFixed(1) },
              },
            ],
            animationDuration: 600,
          }),
        }),
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'table table--compact' },
            h('thead', {}, h('tr', {}, h('th', {}, '순위'), h('th', {}, '상품'), h('th', {}, 'PageRank(×1000)'), h('th', {}, '연결 수(degree)'))),
            h(
              'tbody',
              {},
              prTop.map((s, i) =>
                h(
                  'tr',
                  {},
                  h('td', {}, String(i + 1)),
                  h('td', {}, s.label),
                  h('td', { class: 'num' }, (s.score * 1000).toFixed(2)),
                  h('td', { class: 'num' }, String(store.degree(s.id)))
                )
              )
            )
          )
        ),
        callout(
          'engineer',
          '왜 판매량과 다른가',
          'PageRank는 <strong>연결 구조</strong>를 봅니다. 주문 1건에 여러 상품이 담기면 그 상품들은 서로 연결됩니다. 반면 판매량은 개수만 봅니다. “연결의 질”과 “판매의 양”은 다른 지표이므로, 둘을 함께 보면 <strong>추천 후보 발굴</strong>에 유리합니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: 'Louvain — 커뮤니티로 고객 세그먼트 나누기',
          lead: '라벨을 정하지 않아도, 연결 패턴이 비슷한 노드끼리 묶입니다.',
        },
        prose(
          `Louvain은 <strong>모듈러리티(modularity)</strong>를 최대화하도록 노드를 커뮤니티로 묶습니다.
          여기서는 주문·리뷰 관계를 따라 묶었기 때문에, 결과는 “같은 상품군을 사는 고객” 또는 “같은 공급사에 묶인 상품”이 됩니다.
          업무적으로 해석하는 일은 사람의 몫입니다.`
        ),
        graphCard(ctx, {
          title: '커뮤니티 색칠',
          subtitle: `모듈러리티 ${comm.modularity.toFixed(4)} · 커뮤니티 ${comm.groups.length}개`,
          data: { nodes: commNodes, edges: visBase.edges },
          height: 420,
          seed: 17,
          legendGroups: undefined,
        }).el,
        tableBlock({
          head: ['커뮤니티', '규모', '해석 예시'],
          rows: commGroups.map((g, i) => {
            const labels = new Set(g.members.map((id) => store.getNode(id)?.labels[0]).filter(Boolean));
            return [
              h('span', { class: 'badge', style: { background: `${COMM_COLORS[i % COMM_COLORS.length]}22`, color: COMM_COLORS[i % COMM_COLORS.length], borderColor: `${COMM_COLORS[i % COMM_COLORS.length]}55` } }, `C${i + 1}`),
              String(g.size),
              [...labels].join(' · ') || '-',
            ];
          }),
          compact: true,
        }),
        callout(
          'warn',
          '커뮤니티 탐지의 함정',
          '<strong>①</strong> 작은 그래프(수십 노드)에서는 결과가 불안정합니다. <strong>②</strong> 슈퍼노드 하나가 모든 노드를 한 커뮤니티로 끌어당깁니다. ' +
            '<strong>③</strong> 결과가 업무 의미와 일치한다는 보장이 없습니다. 알고리즘은 <strong>후보 생성기</strong>이고, 해석·검증은 사람이 해야 합니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: 'BFS — 방문 순서를 눈으로 보기',
          lead: '가장 기본이 되는 탐색입니다. 재생 버튼을 눌러 “물결”이 퍼지는 모양을 보세요.',
        },
        bar.el,
        walkGraph.el,
        prose(
          `BFS는 <strong>가까운 것부터</strong> 방문합니다. 그래서 가중치가 없는 그래프에서 최단 경로를 보장합니다.
          다익스트라는 여기에 <strong>가중치</strong>를 더한 것이고, PageRank는 방문 횟수 대신 <strong>중요도</strong>를 반복 계산합니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '무엇을 물을 때 무엇을 쓰나',
          lead: '알고리즘 이름보다 <strong>질문</strong>으로 기억하세요.',
        },
        tableBlock({
          head: ['질문', '알고리즘', '비용', '주의'],
          rows: [
            ['두 점이 몇 홉으로 이어지나', 'BFS / 최단 경로', 'O(V+E)', '가중치 있으면 다익스트라'],
            ['어디가 가장 중요한가', 'PageRank / 중심성', '반복 수 × E', '그래프 방향 정의가 결과를 바꿈'],
            ['자연스러운 그룹은?', 'Louvain / Leiden', 'O(E) 수준', '작은 그래프에서는 불안정'],
            ['누가 병목인가', 'Betweenness', 'O(VE)', '수천 노드 넘으면 GDS 필요'],
            ['연결이 끊긴 곳은?', '연결 요소', 'O(V+E)', '컴포넌트 크기 분포로 확인'],
          ],
          compact: true,
        }),
        statsBlock([
          { label: 'PageRank 반복', value: String(pr.iterations), unit: '회', note: 'damping 0.85, 수렴 기준 1e-7' },
          { label: '모듈러리티', value: comm.modularity.toFixed(3), note: '0.3 이상이면 뚜렷한 구조' },
          { label: '최대 차수', value: String(degree[0]?.degree ?? 0), unit: '연결', note: `${degree[0]?.label ?? '-'} — 슈퍼노드 후보` },
          { label: 'BFS 스텝', value: String(walk.steps.length), unit: '단계', note: '3홉까지 전개' },
        ])
      )
    );

    el.append(
      section(
        { num: '5', title: '실제 Neo4j / GDS에서 실행' },
        mockNotice(),
        neo4jBlock({
          steps: [
            {
              title: 'GDS 라이브러리로 PageRank',
              code: `CALL gds.graph.project(
  'modumall', 'Customer|Product|Order|Supplier|Review|Return|Category',
  { PLACED: { orientation: 'UNDIRECTED' },
    CONTAINS: { orientation: 'UNDIRECTED' },
    SUPPLIED_BY: { orientation: 'UNDIRECTED' },
    REVIEWS: { orientation: 'UNDIRECTED' },
    WROTE: { orientation: 'UNDIRECTED' },
    IN_CATEGORY: { orientation: 'UNDIRECTED' },
    HAS_RETURN: { orientation: 'UNDIRECTED' },
    FOR_PRODUCT: { orientation: 'UNDIRECTED' } }
);

CALL gds.pageRank.stream('modumall')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS name, score
ORDER BY score DESC LIMIT 10;

CALL gds.graph.drop('modumall');`,
              lang: 'cypher',
            },
            {
              title: 'Louvain',
              code: `CALL gds.louvain.stream('modumall')
YIELD nodeId, communityId
RETURN communityId, count(*) AS size
ORDER BY size DESC;`,
              lang: 'cypher',
            },
          ],
          note: 'GDS는 별도 플러그인 또는 AuraDS가 필요합니다. 프로덕션에서는 그래프 프로젝션 메모리 사용량을 먼저 확인하세요.',
        })
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/algorithms',
          questions: [
            {
              q: 'PageRank 점수와 판매량이 다른 이유는?',
              options: ['판매량 데이터가 없어서', 'PageRank는 연결 구조의 중요도를 반영하기 때문', 'PageRank는 무작위라서'],
              answer: 1,
              explain: '연결의 질(중요 노드와의 연결)이 반영됩니다. 두 지표를 함께 보면 추천 후보가 넓어집니다.',
            },
            {
              q: 'Louvain 결과를 업무에 그대로 적용하기 전에 반드시 필요한 일은?',
              options: ['알고리즘을 두 번 돌린다', '커뮤니티를 업무 의미로 해석·검증한다', '노드를 전부 삭제한다'],
              answer: 1,
              explain: '알고리즘은 후보 생성기입니다. 해석과 검증은 도메인 지식을 가진 사람이 해야 합니다.',
            },
            {
              q: '가중치가 없는 그래프에서 최단 경로를 보장하는 알고리즘은?',
              options: ['BFS', 'PageRank', 'Louvain'],
              answer: 0,
              explain: 'BFS는 가까운 순서로 방문하므로 무가중 최단 경로를 보장합니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '<a href="#/lab/ontology">Lab 5 — 온톨로지 구축과 추론</a>에서 “의미”를 기계가 다루게 만듭니다.'));

    return { destroy() {} };
  },
};
