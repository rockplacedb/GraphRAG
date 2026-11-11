/**
 * lab.js — 실습 페이지 공통 셸(시나리오 배너, 요구사항, 실제 Neo4j 안내).
 */
import { h } from '../core/dom.js';
import { pageHead, codeBlock, accordionBlock, callout } from './blocks.js';

export const LAB_SCENARIO = {
  company: '모두몰',
  tagline: 'PostgreSQL 15로 운영 중인 생활가전·IT 액세서리 쇼핑몰',
};

/** 페이지 헤더 + 시나리오 배너 */
export function labHead({ num, title, kicker, summary, minutes, tags, scenarioTitle, quote, reqs = [], children = [] }) {
  return [
    pageHead({
      kicker: `${num} · ${kicker}`,
      title,
      summary,
      minutes,
      tags,
      meta: [LAB_SCENARIO.company, LAB_SCENARIO.tagline],
    }),
    h(
      'div',
      { class: 'scenario' },
      h('div', { class: 'scenario__label' }, `SCENARIO ${num}`),
      h('h2', {}, scenarioTitle),
      h('p', { class: 'scenario__quote', html: quote }),
      reqs.length
        ? h(
            'div',
            { class: 'reqs' },
            reqs.map((r) =>
              h(
                'div',
                { class: 'req' },
                h('div', { class: 'req__id' }, r.id),
                h('div', { class: 'req__title' }, r.title),
                h('div', { class: 'req__desc' }, r.desc)
              )
            )
          )
        : null,
      ...children
    ),
  ];
}

/** “실제 Neo4j에서 실행” 접이식 블록 */
export function neo4jBlock({ title = '실제 Neo4j에서 실행하기', steps = [], note } = {}) {
  const content = h('div', { class: 'stack stack--sm' });
  for (const step of steps) {
    if (step.text) content.append(h('p', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', margin: '0' } }, step.text));
    if (step.code) content.append(codeBlock({ lang: step.lang || 'cypher', code: step.code, title: step.title }));
  }
  if (note) content.append(callout('engineer', null, note));
  return accordionBlock([{ title, content }]);
}

/** 실습 체크포인트 표시 */
export function mockNotice() {
  return callout(
    'sim',
    '이 화면의 실행은 시뮬레이션입니다',
    '내장된 교육용 Cypher 엔진이 브라우저 메모리에서 동작합니다. 결과는 실습용 데이터에만 적용되며 서버에 저장되지 않습니다. 아래 “실제 Neo4j에서 실행하기”를 열면 동일한 작업을 실제 DB에서 재현할 수 있습니다.'
  );
}
