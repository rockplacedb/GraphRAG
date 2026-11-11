/**
 * Lab 0 — 환경 준비
 */
import { h } from '../core/dom.js';
import { section, prose, callout, codeBlock, tableBlock, quizBlock, stepsBlock, badge } from '../ui/blocks.js';
import { labHead, neo4jBlock, mockNotice } from '../ui/lab.js';

const CHECK_ITEMS = [
  { label: 'Docker Desktop(또는 Docker Engine) 설치 확인', cmd: 'docker --version' },
  { label: 'Neo4j 컨테이너 기동', cmd: 'docker run -d --name modumall-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/modumall123 neo4j:5' },
  { label: '컨테이너 상태 확인', cmd: 'docker ps --filter name=modumall-neo4j' },
  { label: 'Neo4j Browser 접속', cmd: 'http://localhost:7474' },
  { label: 'cypher-shell 접속', cmd: 'docker exec -it modumall-neo4j cypher-shell -u neo4j -p modumall123' },
  { label: '버전 확인', cmd: 'RETURN 1;  // 그리고 Neo4j Browser 우상단 버전 표시 확인' },
];

export default {
  id: 'lab/setup',
  title: '환경 준비',
  kicker: 'LAB 0',
  summary: 'Docker로 Neo4j 5를 띄우고, Browser와 cypher-shell로 접속해 준비를 마칩니다.',
  minutes: 10,
  tags: ['Docker', 'Neo4j', 'cypher-shell'],
  render(ctx) {
    const { el } = ctx;

    el.append(
      ...labHead({
        num: 'LAB 0',
        kicker: 'SETUP',
        title: '환경 준비 — 10분',
        summary:
          '이후 실습은 브라우저에서 바로 실행되지만, <strong>실제 Neo4j에서도 같은 쿼리를 돌려 보는 것</strong>을 권합니다. 이 장은 그 준비입니다.',
        minutes: 10,
        tags: ['Docker', 'Neo4j 5', 'cypher-shell'],
        scenarioTitle: '“그래프 DB를 한 번도 띄워 본 적 없다”에서 출발',
        quote:
          '“운영 DB는 잘 만지는데, 그래프 DB는 처음입니다. 로컬에 띄우는 것부터 확인해 주세요. <strong>설치는 10분, 개념은 그다음</strong>입니다.”',
        reqs: [
          { id: 'GOAL', title: '연결 확인', desc: 'Neo4j 5.x가 기동되고, Browser에서 RETURN 1이 실행되면 완료' },
          { id: 'NOTE', title: '버전 기준', desc: '이 자료의 Cypher는 Neo4j 5.x 문법 기준입니다 (4.x와 일부 차이)' },
        ],
      })
    );

    el.append(
      section(
        {
          num: '1',
          title: '왜 로컬 Neo4j를 띄우는가',
          lead: '브라우저 실습은 교육용 엔진입니다. <strong>진짜 실행 계획(PROFILE)</strong>과 인덱스 동작은 실제 DB에서만 볼 수 있습니다.',
        },
        prose(
          `브라우저 실습의 목적은 <strong>문법과 사고방식</strong>입니다. 반면 <code>PROFILE</code>·<code>EXPLAIN</code>로 실행 계획을 읽고,
          제약조건이 실제로 스캔을 줄이는지 확인하는 일은 실제 Neo4j에서만 의미가 있습니다.
          Lab 7(성능 진단)은 이 차이를 다룹니다.`
        ),
        mockNotice()
      )
    );

    el.append(
      section(
        {
          num: '2',
          title: '기동과 접속',
          lead: 'Docker 한 줄이면 끝납니다. 인증 정보는 <strong>실습 전용</strong>이므로 실제 환경에 그대로 쓰지 마세요.',
        },
        codeBlock({
          lang: 'bash',
          title: 'Neo4j 5 기동',
          code: `# 1) 이미지 받고 기동 (브라우저 7474, Bolt 7687)
docker run -d \\
  --name modumall-neo4j \\
  -p 7474:7474 -p 7687:7687 \\
  -e NEO4J_AUTH=neo4j/modumall123 \\
  neo4j:5

# 2) 상태 확인
docker ps --filter name=modumall-neo4j
docker logs --tail 20 modumall-neo4j

# 3) 접속 (Browser)
#    http://localhost:7474  →  사용자 neo4j / 비밀번호 modumall123

# 4) 셸 접속
docker exec -it modumall-neo4j cypher-shell -u neo4j -p modumall123`,
        }),
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'table table--compact' },
            h('thead', {}, h('tr', {}, h('th', {}, '확인 항목'), h('th', {}, '명령/주소'), h('th', {}, '기대 결과'))),
            h(
              'tbody',
              {},
              CHECK_ITEMS.map((c, i) =>
                h(
                  'tr',
                  {},
                  h('td', {}, `${i + 1}. ${c.label}`),
                  h('td', {}, h('code', {}, c.cmd)),
                  h('td', {}, i === 3 ? '로그인 화면' : i === 5 ? '1 (숫자 한 행)' : '정상 출력')
                )
              )
            )
          )
        ),
        callout(
          'warn',
          '자주 막히는 지점',
          '<strong>①</strong> 7474 포트가 이미 사용 중이면 <code>-p 7475:7474</code>로 바꾸고 Browser 주소도 함께 바꾸세요. ' +
            '<strong>②</strong> 첫 기동은 이미지 다운로드 때문에 1~3분 걸립니다. <code>docker logs</code>에 “Started.”가 보일 때까지 기다립니다. ' +
            '<strong>③</strong> 비밀번호는 최소 8자여야 하며, 처음 로그인 시 변경을 요구받을 수 있습니다.'
        )
      )
    );

    el.append(
      section(
        {
          num: '3',
          title: '알아 두면 편한 Browser 명령',
          lead: ':help, :play 는 Neo4j Browser의 내장 명령입니다. 쿼리와 섞어 쓰지 마세요.',
        },
        tableBlock({
          head: ['명령', '용도'],
          rows: [
            [':play start', '내장 튜토리얼 목록'],
            [':help commands', 'Browser 명령 도움말'],
            [':param name => "값"', '쿼리 파라미터 지정'],
            [':history', '실행 이력'],
            ['EXPLAIN <쿼리>', '실행하지 않고 계획만 확인'],
            ['PROFILE <쿼리>', '실제 실행하며 연산자별 db hits 확인'],
          ],
          compact: true,
        }),
        neo4jBlock({
          title: '연결이 되었는지 최종 확인',
          steps: [
            { text: '아래를 실행해 결과가 한 행 나오면 준비 완료입니다.', code: 'RETURN 1 AS ready;', lang: 'cypher' },
            {
              title: '샘플 노드 하나 만들고 지우기',
              code: `CREATE (t:Tmp {name: 'hello'})
RETURN t.name AS name;

MATCH (t:Tmp) DELETE t;`,
              lang: 'cypher',
            },
          ],
        })
      )
    );

    el.append(
      section(
        {
          num: '4',
          title: '과제',
          lead: '다음 Lab으로 넘어가기 전에 스스로 확인해 보세요.',
        },
        stepsBlock([
          { title: '스냅샷 만들기', desc: '<code>docker commit modumall-neo4j modumall-base:1</code> 로 현재 상태를 저장해 두면 실습을 되돌리기 쉽습니다.' },
          { title: '데이터 초기화 습관', desc: '<code>MATCH (n) DETACH DELETE n;</code> 은 전체 삭제입니다. 운영 DB에서는 절대 실행하지 마세요. 실습 컨테이너에서만 사용합니다.' },
          { title: '정리', desc: '실습이 끝나면 <code>docker stop modumall-neo4j</code> 로 중지합니다. 데이터는 볼륨에 남습니다.' },
        ])
      )
    );

    el.append(
      section(
        { num: '5', title: '스스로 점검' },
        quizBlock(ctx, {
          id: 'lab/setup',
          questions: [
            {
              q: 'Neo4j Browser의 기본 접속 포트는?',
              options: ['7687', '7474', '5432'],
              answer: 1,
              explain: '7474는 HTTP(Browser), 7687은 Bolt 프로토콜 포트입니다. 애플리케이션은 보통 7687로 접속합니다.',
            },
            {
              q: '쿼리를 실행하지 않고 실행 계획만 보고 싶을 때 쓰는 명령은?',
              options: ['EXPLAIN', 'PROFILE', 'SHOW PLAN'],
              answer: 0,
              explain: 'EXPLAIN은 계획만, PROFILE은 실제로 실행하면서 db hits까지 보여줍니다.',
            },
            {
              q: '브라우저 실습 결과가 실제 Neo4j와 다른 이유로 가장 정확한 것은?',
              options: [
                '브라우저 엔진은 버그가 많아서',
                '교육용 부분집합 엔진이며 실행 계획·인덱스·트랜잭션이 실제와 다르기 때문',
                '데이터가 없어서',
              ],
              answer: 1,
              explain: '문법과 사고방식을 익히는 용도입니다. 성능·계획·제약 동작은 실제 Neo4j에서 확인해야 합니다.',
            },
          ],
        })
      )
    );

    el.append(callout('insight', '다음 단계', '환경이 준비되면 <a href="#/lab/modeling">Lab 1 — RDB 스키마를 그래프로</a>에서 운영 스키마를 직접 옮겨 봅니다.'));

    return { destroy() {} };
  },
};
