/**
 * 이론 09 — 아키텍처와 운영
 * 배포 형태, 사이징·인덱스·제약, 트랜잭션과 클러스터링, ETL, 백업·모니터링, 운영 체크리스트.
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
  quizBlock,
  compareBlock,
} from '../ui/blocks.js';
import { stepsBlock, checklist } from '../ui/components.js';

const DEPLOY = [
  { name: '자체 · NVMe', read: 1.2, write: 3.1 },
  { name: '자체 · 네트워크 볼륨', read: 2.4, write: 7.8 },
  { name: 'AuraDB (DBaaS)', read: 1.9, write: 4.6 },
  { name: '관리형 · K8s Operator', read: 2.8, write: 9.2 },
];

const READINESS = [
  '조회에 쓰는 모든 키에 인덱스나 제약이 있다',
  'UNIQUE 제약이 MERGE의 중복 생성을 막고 있다',
  '트랜잭션 크기 상한과 재시도 정책이 코드에 있다',
  '백업에서 복구하는 리허설을 최근 90일 내 수행했다',
  'RPO / RTO가 숫자로 문서화되어 있다',
  '느린 쿼리 상위 10개의 실행 계획을 주기적으로 본다',
  '슈퍼노드(차수 상위) 목록과 우회 전략이 있다',
  'ETL 지연(lag)과 실패에 대한 알림이 있다',
  'dual-write 경로가 없거나 outbox로 대체되어 있다',
  '메이저 버전 업그레이드 경로와 롤백 계획이 있다',
  '라벨을 스키마 대신 쓰지 않는다 (라벨 폭증 금지)',
  '알고리즘 점수를 원본 속성에 덮어쓰지 않는다',
];

/* ---------------- 배포 형태별 지연 비교 ---------------- */
function latencyChart(ctx) {
  return chartCard(ctx, {
    title: '배포 형태별 읽기·쓰기 지연',
    subtitle: '교육용 예시 — 읽기 p50 / 쓰기 p95 (ms). 실제 측정값이 아닙니다.',
    height: 320,
    foot: '수치는 <strong>교육용 예시</strong>입니다. 실제 지연은 하드웨어·캐시 히트율·동시성·쿼리 형태에 따라 자릿수가 달라집니다.',
    option: (t) => ({
      backgroundColor: 'transparent',
      grid: { left: 6, right: 16, top: 34, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: t.dark ? '#131a2a' : '#ffffff',
        borderColor: t.dark ? '#26314a' : '#e3e6ef',
        textStyle: { color: t.ink, fontSize: 12 },
        valueFormatter: (v) => `${v} ms`,
      },
      legend: { top: 0, textStyle: { color: t.ink3, fontSize: 11 }, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
      xAxis: {
        type: 'category',
        data: DEPLOY.map((d) => d.name),
        axisLabel: { color: t.ink3, fontSize: 10, interval: 0 },
        axisLine: { lineStyle: { color: t.axis } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'ms',
        nameTextStyle: { color: t.ink4, fontSize: 10 },
        splitLine: { lineStyle: { color: t.grid } },
        axisLabel: { color: t.ink4, fontSize: 10 },
      },
      series: [
        {
          name: '읽기 p50',
          type: 'bar',
          barWidth: 20,
          data: DEPLOY.map((d) => d.read),
          itemStyle: { color: t.cyan, borderRadius: [3, 3, 0, 0] },
        },
        {
          name: '쓰기 p95',
          type: 'bar',
          barWidth: 20,
          data: DEPLOY.map((d) => d.write),
          itemStyle: { color: t.accent, borderRadius: [3, 3, 0, 0] },
        },
      ],
      animationDuration: 650,
    }),
  }).el;
}

/* ---------------- 운영 준비 체크리스트 ---------------- */
function readinessCard() {
  const count = h('b', { style: { fontFamily: 'var(--font-mono)' } }, `0 / ${READINESS.length}`);
  const bar = h('i', { style: { width: '0%' } });
  const verdict = h('span', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' } }, '아직 이릅니다 — 남은 항목을 하나씩 닫으세요.');

  const list = checklist(READINESS, {
    onChange: (n, total) => {
      count.textContent = `${n} / ${total}`;
      bar.style.width = `${(n / total) * 100}%`;
      if (n === total) {
        verdict.textContent = '모든 항목 충족 — 운영 투입 가능한 수준입니다.';
        verdict.style.color = 'var(--ok-500)';
      } else if (n >= total * 0.7) {
        verdict.textContent = '대체로 준비됨 — 남은 항목의 리스크를 문서화하세요.';
        verdict.style.color = 'var(--warn-500)';
      } else {
        verdict.textContent = '아직 이릅니다 — 남은 항목을 하나씩 닫으세요.';
        verdict.style.color = 'var(--ink-3)';
      }
    },
  });

  return h('div.card',
    h('div.card__head', h('div.card__head-text',
      h('div.card__title', '운영 준비 체크리스트'),
      h('div.card__sub', '프로덕션 투입 전에 팀이 합의해야 하는 항목입니다. 체크 상태는 이 페이지에서만 유지됩니다.'))),
    h('div.card__body',
      list,
      h('div.row', { style: { marginTop: '14px' } }, h('span', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' } }, '충족'), count,
        h('span.spacer'), verdict),
      h('div.meter', { style: { marginTop: '8px' } }, bar)
    )
  );
}

export default {
  id: 'theory/operations',
  title: '아키텍처와 운영',
  kicker: 'CHAPTER 09 · OPERATIONS',
  summary:
    '그래프 DB의 운영은 RDB와 크게 다르지 않습니다. 다른 것은 <strong>확장의 방향</strong>과 <strong>순회가 샤드 경계를 넘을 때의 비용</strong>입니다.',
  minutes: 15,
  tags: ['배포', '인덱스', '샤딩', 'ETL', '백업'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      pageHead({
        kicker: 'CHAPTER 09 · OPERATIONS',
        title: '아키텍처와 운영',
        summary: '배포 형태·사이징·트랜잭션·샤딩·ETL·백업까지, <strong>운영자가 실제로 결정해야 하는 것</strong>만 모았습니다.',
        minutes: 15,
        tags: ['Self-hosted · Aura', '제약과 인덱스', 'CDC', '백업 · 모니터링'],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '배포 형태 — 무엇을 직접 책임질 것인가',
          lead: '선택지는 세 가지지만, 실제 결정은 <strong>백업·업그레이드·장애 접근 권한</strong>을 누가 갖느냐의 문제입니다.',
        },
        prose(
          `자체 호스팅은 모든 것을 통제할 수 있지만 <strong>모든 것을 책임</strong>집니다. AuraDB 같은 DBaaS는 백업·패치·장애 조치를 위탁하는 대신
          힙 덤프·OS 튜닝·플러그인 같은 저수준 접근을 포기합니다. 관리형(K8s Operator)은 그 중간으로, 운영 자동화는 얻지만
          <strong>스토리지·네트워크 성능은 직접 책임</strong>집니다. RDB에서 “직접 운영 vs RDS”를 고를 때와 같은 축입니다.`
        ),
        compareBlock([
          { title: '자체 호스팅', tone: 'c', items: ['완전한 통제 · 저수준 튜닝 가능', '백업·패치·장애 조치 모두 직접', '비용은 인프라 + 인건비', '네트워크·디스크를 직접 최적화'] },
          { title: 'AuraDB (DBaaS)', tone: 'b', items: ['백업·PITR·업그레이드 위탁', '접속만 하면 되는 운영 단순성', '저수준 접근·플러그인 제한', '비용은 인스턴스 시간 + 스토리지'] },
          { title: '관리형 (K8s Operator)', tone: 'c', items: ['배포·스케일링 자동화', '스토리지·네트워크는 직접 책임', '클라우드 종속은 상대적으로 낮음', '운영 인력의 K8s 역량 필요'] },
        ]),
        latencyChart(ctx),
        callout(
          'engineer',
          '결정을 바꾸는 질문 세 개',
          `① 장애 시 <strong>힙 덤프와 쿼리 로그</strong>를 우리가 볼 수 있어야 하는가? ② 메이저 버전 업그레이드를 <strong>언제</strong> 누가 결정하는가?
          ③ 백업에서 복구된 스냅숏을 <strong>우리 계정</strong>으로 가져올 수 있는가? 세 번째 질문에 “아니오”라면, 그 플랫폼은 데이터 주권 측면에서 재검토 대상입니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '사이징 · 인덱스 · 제약',
          lead: '그래프 DB의 성능 사고는 대개 <strong>제약 없는 MERGE</strong>와 <strong>캐시에 안 들어가는 store</strong>에서 시작됩니다.',
        },
        prose(
          `사이징의 출발점은 store 크기와 페이지 캐시입니다. 캐시가 store를 덮지 못하면 순회가 디스크를 타면서 지연이 급격히 나빠집니다.
          노드·관계마다 포인터와 속성 저장 공간이 붙으므로, RDB의 “행 크기” 감각보다 <strong>관계 수</strong>를 먼저 봐야 합니다.
          인덱스와 제약은 조회의 시작점을 좁히는 동시에 <strong>쓰기 비용</strong>을 늘립니다.`
        ),
        codeBlock({
          lang: 'cypher',
          title: '제약과 인덱스 — 먼저 만들고, 나중에 측정한다',
          code: `// 조회 키에는 반드시 인덱스를: 없으면 MERGE가 라벨 전체를 스캔한다
CREATE CONSTRAINT product_sku IF NOT EXISTS
FOR (p:Product) REQUIRE p.sku IS UNIQUE;

CREATE CONSTRAINT customer_id IF NOT EXISTS
FOR (c:Customer) REQUIRE c.id IS NOT NULL;

CREATE INDEX order_date IF NOT EXISTS
FOR (o:Order) ON (o.date);

CREATE FULLTEXT INDEX product_search IF NOT EXISTS
FOR (p:Product) ON EACH [p.name, p.description];

// 적용된 제약/인덱스 확인
SHOW CONSTRAINTS;
SHOW INDEXES;`,
          note:
            '<code>IF NOT EXISTS</code>는 재실행 안전성을 위한 것입니다. 제약을 추가하면 기존 데이터 검증이 먼저 돌기 때문에, <strong>운영 중 추가는 쓰기 정지 또는 배치 윈도우</strong>를 계획해야 합니다.',
        }),
        tableBlock({
          head: ['종류', 'RDB 대응', '비용·주의'],
          rows: [
            ['UNIQUE 제약', 'UNIQUE 인덱스', '인덱스 생성 + 쓰기마다 중복 검사'],
            ['NOT NULL(EXISTS) 제약', 'NOT NULL', '쓰기 검증만, 인덱스는 별도'],
            ['일반 인덱스', 'B-tree 인덱스', '조회 이득 vs 쓰기·저장 비용'],
            ['전문(fulltext) 인덱스', 'GIN/전문 인덱스', '별도 저장소, 재색인 비용'],
            ['복합 인덱스', '복합 인덱스', '컬럼 순서가 선택도를 좌우'],
          ],
          compact: true,
        }),
        callout(
          'warn',
          '제약 없는 MERGE는 전체 스캔이다',
          `제약이나 인덱스가 없으면 <code>MERGE (p:Product {sku: $sku})</code>는 라벨 스캔으로 후보를 찾습니다. 데이터가 커질수록 쓰기 지연이 선형으로 늘고,
          동시 실행에서는 <strong>중복 노드</strong>까지 생깁니다. “개발에서는 빨랐는데”의 전형적인 원인입니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '트랜잭션 · 클러스터링 · 샤딩의 현실',
          lead: '그래프 DB는 <strong>읽기를 수평 확장</strong>하기 쉽고, <strong>쓰기를 수평 확장</strong>하기는 매우 어렵습니다. 순회가 샤드 경계를 넘기 때문입니다.',
        },
        prose(
          `트랜잭션은 ACID를 따르며, 격리 수준은 대개 read-committed입니다. 쓰기는 노드·관계 단위 잠금을 잡고, 교착은 엔진이 감지해 한쪽을 롤백합니다.
          트랜잭션 크기는 메모리에 묶여 있어 <strong>대량 적재는 청크로 나눠야</strong> 합니다. 클러스터는 단일 쓰기 리더 + 읽기 팔로워 구조이고,
          리더 선출은 합의 프로토콜(Raft)로 이뤄집니다. 즉 <strong>쓰기 확장은 수직(더 큰 장비)</strong>입니다.`
        ),
        tableBlock({
          head: ['확장 방식', '늘어나는 것', '한계'],
          rows: [
            ['읽기 복제(팔로워)', '읽기 처리량', '복제 지연, 팔로워 읽기의 최신성 불일치'],
            ['수직 확장(더 큰 장비)', '쓰기 처리량 + 캐시', '장비 상한, 비용의 비선형 증가'],
            ['도메인 분할(그래프 분리)', '장애 격리, 팀 자율성', '경계를 넘는 질의는 애플리케이션이 조립'],
            ['해시 샤딩(단일 그래프)', '거의 없음', '홉마다 원격 호출, 슈퍼노드 쏠림, 2홉 질의 폭발'],
          ],
          compact: true,
        }),
        callout(
          'warn',
          '샤딩은 순회를 “네트워크 홉”으로 바꾼다',
          `고객 ID로 샤딩하면 3홉 질의가 <strong>3번의 원격 호출</strong>이 되고, 한 샤드에 몰린 슈퍼노드가 전체 지연을 지배합니다.
          Neo4j의 Fabric/복합 데이터베이스는 <strong>샤딩이 아니라 라우팅</strong>입니다 — 질의를 여러 데이터베이스에 보내지만 하나의 그래프를 쪼개지는 않습니다.
          실무의 정답은 대개 <strong>도메인 단위 분할 + 경계 질의 최소화</strong>입니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: 'RDB에서 그래프로 — CDC, dual-write, 스트랭글러',
          lead: '동기화 파이프라인의 신뢰성이 프로젝트 성패를 가릅니다. <strong>dual-write는 답이 아닙니다.</strong>',
        },
        prose(
          `초기 적재는 배치로, 이후 변경은 CDC(예: Debezium)로 흘리는 구성이 일반적입니다. 핵심은 <strong>멱등성</strong>입니다.
          같은 이벤트가 두 번 와도 결과가 같도록 키 기반 <code>MERGE</code>로 upsert하고, 삭제는 tombstone 이벤트로 처리합니다.
          순서 보장은 전역이 아니라 <strong>키 단위</strong>로만 보장된다고 가정해야 합니다.`
        ),
        stepsBlock([
          { title: '① 스키마 매핑 확정', desc: '테이블 → 라벨, FK → 관계, 조인 테이블 → 관계 속성. 매핑표를 코드가 아니라 <strong>문서</strong>로 먼저 고정합니다.' },
          { title: '② 초기 백필(배치)', desc: '스냅숏 시점을 기록하고, 그 이후 변경은 CDC로 따라잡습니다. 백필 중 변경분을 버리지 않는 것이 핵심입니다.' },
          { title: '③ CDC 스트림', desc: '이벤트를 키 단위로 정렬하고, 재시도·DLQ를 둡니다. 스키마 변경 이벤트도 함께 처리해야 합니다.' },
          { title: '④ 멱등 upsert + 검증', desc: '<code>MERGE</code> + 제약으로 중복을 막고, 행 수·체크섬·표본 대조로 정합성을 확인합니다.' },
        ]),
        callout(
          'danger',
          'dual-write는 부분 실패를 숨긴다',
          `RDB에 쓰고 그래프에 쓰는 코드를 나란히 두면, 두 번째 쓰기가 실패했을 때 RDB는 이미 커밋되어 있습니다. 분산 트랜잭션이 없는 한 되돌릴 수 없고,
          재시도는 중복을 만들고, 보상 로직은 반드시 누락됩니다. <strong>outbox(변경 로그) → CDC → 그래프</strong>가 사실상 유일한 안전한 경로입니다.`
        ),
        callout(
          'engineer',
          '스트랭글러 사이드카',
          `기존 RDB를 유지한 채, 관계 탐색이 필요한 기능만 그래프로 옮깁니다. 라우팅은 기능 플래그로 하고, 두 저장소의 응답을 <strong>그림자 비교</strong>하며 신뢰를 쌓습니다.
          “빅뱅 마이그레이션”보다 느리지만, 롤백 경로가 항상 남아 있습니다.`
        )
      )
    );

    el.append(
      section(
        {
          num: '5',
          title: '백업 · 복구 · 모니터링',
          lead: '백업은 <strong>복구 리허설</strong>까지가 백업입니다. 지표는 “예쁜 그래프”보다 <strong>이상 신호</strong>를 봅니다.',
        },
        prose(
          `백업은 두 갈래입니다. 논리 백업(<code>dump</code>/<code>load</code>)은 버전 간 이동에 유연하지만 느리고, 물리 백업은 빠르지만 버전·구성에 민감합니다.
          DBaaS는 대개 자동 백업 + 특정 시점 복구(PITR)를 제공합니다. 어느 쪽이든 <strong>RPO/RTO를 숫자로 정하고, 복구 리허설로 검증</strong>해야 합니다.
          백업 파일이 있는 것과 복구되는 것은 전혀 다른 문제입니다.`
        ),
        tableBlock({
          head: ['지표', '무엇을 보는가', '이상 신호'],
          rows: [
            ['page cache hit ratio', '캐시가 store를 얼마나 덮는가', '95% 미만이면 메모리 부족 또는 콜드 캐시'],
            ['트랜잭션 롤백률', '애플리케이션 오류·락 경합', '급증은 배포 직후나 교착 폭주'],
            ['p95 쿼리 지연', '사용자 체감', '상위 쿼리 변화와 함께 해석해야'],
            ['GC pause', 'JVM 힙 압박', '빈번하면 힙 증설 또는 쿼리 수정'],
            ['store size 증가율', '삭제·보존 정책의 유효성', '선형 증가는 미회수 데이터'],
            ['복제 지연', '팔로워 읽기의 최신성', '커지면 팔로워 읽기에서 불일치'],
          ],
          compact: true,
        }),
        readinessCard(),
        callout(
          'insight',
          '운영의 목표는 “안 죽는 것”이 아니다',
          `그래프 DB 운영의 목표는 <strong>죽었을 때 얼마나 빨리, 얼마나 정확히 복구하는가</strong>입니다. 백업·모니터링·체크리스트는 모두 이 한 문장으로 수렴합니다.`
        )
      )
    );

    el.append(
      section(
        { num: '6', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'theory/operations',
          questions: [
            {
              q: 'RDB와 그래프 DB에 동시에 쓰는 dual-write 방식이 위험한 이유는?',
              options: ['그래프 DB가 쓰기를 거부하기 때문', '두 쓰기 사이에 분산 트랜잭션이 없어 부분 실패 시 불일치가 남기 때문', 'CDC보다 항상 느리기 때문'],
              answer: 1,
              explain: '한쪽만 커밋된 상태를 되돌릴 방법이 없습니다. outbox + CDC로 단일 쓰기 지점을 만드는 것이 안전합니다.',
            },
            {
              q: 'Neo4j 클러스터에서 쓰기 처리량을 늘리는 방법으로 가장 정확한 것은?',
              options: ['팔로워를 추가한다', '리더 장비를 더 크게(수직 확장) 한다', '그래프를 해시로 샤딩한다'],
              answer: 1,
              explain: '리더는 단일 쓰기 지점입니다. 팔로워는 읽기 확장이고, 해시 샤딩은 순회 비용을 네트워크 홉으로 바꿔 득보다 실이 큽니다.',
            },
            {
              q: '단일 그래프를 고객 ID로 해시 샤딩할 때 가장 먼저 무너지는 것은?',
              options: ['백업 속도', '다중 홉 순회(경로 질의)의 비용', '인덱스 생성 시간'],
              answer: 1,
              explain: '홉이 샤드 경계를 넘을 때마다 원격 호출이 필요합니다. 슈퍼노드가 한 샤드에 몰리면 지연은 더 나빠집니다.',
            },
          ],
        })
      )
    );

    el.append(
      callout(
        'insight',
        '한 줄 요약',
        '<strong>그래프 DB 운영의 제약은 “쓰기는 한 곳, 순회는 경계를 싫어한다”는 두 문장으로 요약됩니다.</strong> 이 제약을 인정하고 읽기 확장·도메인 분할·CDC 동기화로 설계하는 팀이 살아남습니다.'
      )
    );

    return { destroy() {} };
  },
};
