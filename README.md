# 지식 그래프 · Graph RAG 학습 대시보드

DB 엔지니어를 위한 **지식 그래프 / 그래프 DB / 온톨로지 / Graph RAG** 이론·실습 웹 대시보드입니다.
정적 사이트이며, 그래프 시각화와 Cypher 실행이 **모두 브라우저 안에서** 동작합니다(백엔드·LLM 호출 없음).

- 대상: SQL·RDB 운영은 익숙하지만 그래프 DB는 처음인 엔지니어
- 시나리오: **모두몰** — PostgreSQL로 운영 중인 쇼핑몰을 그래프로 전환
- 분량: 이론 9장 + 실습 8개 + 부록 2개

## 빠른 시작

```bash
git clone <이 저장소 URL> && cd GraphRAG
./start.sh     # macOS/Linux
start.bat      # Windows (더블클릭)
```

브라우저가 자동으로 열립니다(기본 포트 4321). Node.js 또는 Python 3 중 하나만 있으면 됩니다.

## 실행

```bash
node scripts/serve.mjs          # http://127.0.0.1:4321
node scripts/serve.mjs 8080     # 포트 지정
python3 -m http.server 4321     # Node가 없을 때 대안
```

> `index.html`을 파일로 직접 열지 마세요. **ES 모듈은 `file://`에서 동작하지 않습니다.**
> 반드시 위처럼 로컬 서버로 띄우거나, 사내 정적 서버에 폴더를 그대로 올려 사용하세요.

## 디렉터리

```
index.html                 앱 셸(사이드바·상단바·본문 마운트)
assets/css/                tokens · base · layout · components · labs
assets/vendor/             vis-network 10.1.5, Apache ECharts 6.1.0 (로컬, 오프라인)
js/core/                   라우터·테마·진도·그래프 래퍼·차트 래퍼·구문 강조
js/ui/                     블록 팩토리, 실행 패널, 실습 셸
js/engine/                 graph-store · cypher-lite · algorithms · rag-sim (DOM 비의존)
js/data/                   페이지 매니페스트, 시드 데이터, DDL, 문서 청크
js/theory/  js/lab/  js/reference/     페이지 모듈
scripts/                   vendor(로컬 라이브러리 확보) · serve · qa(CDP 검증)
tests/                     엔진 단위 테스트(node:test)
```

## 페이지 모듈 계약

```js
export default {
  id: 'theory/why-graph',
  title: '왜 그래프인가',
  kicker, summary, minutes, tags,
  render(ctx) {
    const { el, addCleanup } = ctx;
    // el 에 블록을 append
    return { destroy() {} };
  },
};
```

사이드바·검색·이전/다음은 `js/data/sections.js` 매니페스트에서 자동 생성됩니다.

## 브라우저 실습 엔진의 범위

`js/engine/cypher-lite.js`는 **교육용 부분집합**입니다. 실제 Neo4j가 아닙니다.

- 지원: `MATCH`(노드/관계 패턴, 방향, `*1..n`, 속성 맵), `WHERE`, `RETURN`(DISTINCT·별칭·`count`/`collect`/`sum`·`ORDER BY`/`SKIP`/`LIMIT`), `CREATE`, `MERGE`, `SET`, `DELETE`, `DETACH DELETE`
- 미지원: `OPTIONAL MATCH`, `WITH`, `UNWIND`, `CALL`, `LOAD CSV`, 경로 변수(`p = (...)`), `UNION`, `MERGE ... ON CREATE`
- 미지원 구문은 위치(행/열)를 포함한 한국어 오류로 안내합니다.

각 실습 화면의 **지원 문법** 버튼에서 동일한 표를 확인할 수 있습니다.
Graph RAG 실습(`js/engine/rag-sim.js`)도 **시뮬레이션**입니다 — 임베딩은 토큰 해시 기반 결정적 벡터이고, 답변은 검색된 근거를 템플릿으로 조립합니다.

## 배포 — 3가지 방법

| 방법 | 학습자 경험 | 준비 | 유지보수 |
|---|---|---|---|
| **사내 정적 호스팅** (nginx / S3 / Pages) | URL 클릭 | 폴더 업로드 | 최상 |
| **Git 클론 + 로컬 실행** | `start.bat` 더블클릭 | Git·Node(또는 Python) | 보통 |
| **ZIP 배포** | 압축 해제 후 `start.bat` | 없음 | 나쁨(버전 분산) |

- 빌드 과정이 없습니다. 폴더를 그대로 올리면 끝입니다.
- 학습자 런타임에 **외부 네트워크가 필요 없습니다**(vendor 로컬 포함). 폐쇄망에서도 동작합니다.
- 정적 호스팅 시 캐시 권장: `index.html` no-cache, `assets/vendor/*` 장기 캐시, 나머지 짧게.
- 압축(gzip/brotli) 적용 시 전송량은 약 2.3MB → **730KB**입니다.

### GitHub Pages

`.github/workflows/pages.yml` 이 준비되어 있습니다. 저장소 **Settings → Pages → Source: GitHub Actions** 로 한 번만 지정하면,
`main` 에 push 할 때마다 `index.html · assets · js` 만 추려 자동 배포됩니다(빌드 없음).

- 주소: `https://<계정>.github.io/GraphRAG/`
- ⚠️ **비공개 저장소의 Pages는 GitHub Pro 이상이 필요**하며, 배포된 사이트 자체는 기본적으로 **공개**입니다.
  내용을 사내 한정으로 유지해야 한다면 Pages 대신 **사내 정적 호스팅**을 권장합니다.

## 검증

```bash
# 1) 엔진 단위 테스트 (DOM 불필요)
node tests/engine.test.mjs

# 2) 화면 검증: 헤드리스 Chrome + CDP (전 라우트 오류/그래프 렌더/스크린샷)
pwsh -NoProfile -File qa/run.ps1 -Shots
pwsh -NoProfile -File qa/run.ps1 -Routes "lab/cypher-basics" -Width 390 -Height 844
```

`qa/run.ps1`은 전용 Chrome 프로필을 띄우고, 종료 시 해당 프로세스 트리만 정리합니다.
결과는 `qa/report.json`, 스크린샷은 `qa/shots/`에 저장됩니다.

> `node --test tests/`는 일부 샌드박스에서 자식 프로세스 파이프가 막혀 `EPERM`이 납니다. 테스트 파일을 직접 실행하세요.

## 시드 데이터

`js/data/modumall.seed.js` — 고객 12 · 상품 14 · 분류 5 · 공급사 4 · 주문 18 · 리뷰 10 · 반품 5 (노드 68, 관계 102).
무작위가 없어 항상 같은 결과가 나옵니다.

## 라이선스 / 고지

- `assets/vendor/vis-network.min.js` — vis-network 10.1.5, MIT 또는 Apache-2.0 (듀얼 라이선스)
- `assets/vendor/echarts.min.js` — Apache ECharts 6.1.0, Apache-2.0

전체 라이선스 원문은 `assets/vendor/vis-network.LICENSE.txt`, `assets/vendor/echarts.LICENSE.txt`에 있습니다.
벤더 파일은 `node scripts/vendor.mjs`로 NPM 레지스트리에서 재생성할 수 있습니다(생성 후 오프라인 동작).
Neo4j, Cypher는 Neo4j, Inc.의 상표이며 이 자료와 무관한 교육용 문서입니다.

실습에 사용된 Neo4j 코드는 **Neo4j 5.x** 기준이며, 브라우저 실습 결과와 실제 DB 결과가 다를 수 있습니다
(특히 실행 계획·인덱스·제약 동작).
