/**
 * blocks.js — 페이지를 조립하는 블록 팩토리.
 * 모든 페이지는 이 파일의 함수만으로 구성해 시각적 일관성을 유지한다.
 */
import { h, slug } from '../core/dom.js';
import { highlight, LANG_LABEL } from '../core/code.js';
import { copyText, toast } from '../core/toast.js';
import { mountChart } from '../core/chart.js';
import { GraphView, NODE_COLORS, colorFor, normalizeGraphData } from '../core/graph.js';
import { quizBlock, tabsBlock, accordionBlock, stepsBlock, compareBlock, checklist, kvBlock, playbar } from './components.js';

/* ---------------- 페이지 헤더 ---------------- */
export function pageHead({ kicker, title, summary, minutes, tags = [], meta = [] }) {
  return h(
    'header',
    { class: 'page-head' },
    kicker ? h('div', { class: 'page-head__kicker' }, kicker) : null,
    h('h1', {}, title),
    summary ? h('p', { class: 'page-head__summary', html: summary }) : null,
    h(
      'div',
      { class: 'page-head__meta' },
      minutes ? h('span', {}, `약 ${minutes}분`) : null,
      minutes && (tags.length || meta.length) ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null,
      ...tags.map((t) => h('span', { class: 'badge' }, t)),
      ...meta.map((m, i) => [i > 0 ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : null, h('span', {}, m)]).flat()
    )
  );
}

/* ---------------- 섹션 ---------------- */
export function section({ num, title, lead, id }, ...children) {
  const anchor = id || slug(title);
  return h(
    'section',
    { class: 'section' },
    h(
      'div',
      { class: 'section__head' },
      h('h2', { id: anchor }, num ? h('span', { class: 'num' }, num) : null, title),
      lead ? h('p', { class: 'section__lead', html: lead }) : null
    ),
    ...children
  );
}

/** 소제목 */
export function h3(text, id) {
  return h('h3', { id: id || slug(text) }, text);
}

/* ---------------- 본문 ---------------- */
export function prose(html) {
  return h('div', { class: 'prose', html });
}

export function callout(type, title, html) {
  const icon = { insight: '◆', warn: '!', danger: '×', engineer: '⌘', sim: '∿' }[type] || 'i';
  return h(
    'div',
    { class: `callout callout--${type}` },
    h('span', { class: 'callout__icon', 'aria-hidden': 'true' }, icon),
    h(
      'div',
      { class: 'callout__body' },
      title ? h('div', { class: 'callout__title' }, title) : null,
      html ? h('div', { html }) : null
    )
  );
}

export function tableBlock({ head, rows, caption, cls = '', compact = false }) {
  const t = h(
    'table',
    { class: `table${compact ? ' table--compact' : ''} ${cls}`.trim() },
    caption ? h('caption', {}, caption) : null,
    h('thead', {}, h('tr', {}, head.map((c) => (typeof c === 'string' ? h('th', {}, c) : h('th', c.attrs || {}, c.text))))),
    h(
      'tbody',
      {},
      rows.map((r) => h('tr', {}, r.map((c) => (c instanceof Node ? h('td', {}, c) : h('td', { html: formatCell(c) })))))
    )
  );
  return h('div', { class: 'table-wrap' }, t);
}

function formatCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && /[<`]/.test(v)) {
    // `code` 는 인라인 코드로, <strong> 등은 그대로 허용
    return v.replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  return String(v);
}

export function badge(text, tone = '') {
  return h('span', { class: `badge${tone ? ` badge--${tone}` : ''}` }, text);
}

export function statsBlock(items) {
  return h(
    'div',
    { class: 'stats' },
    items.map((it) =>
      h(
        'div',
        { class: `stat${it.accent ? ' stat--accent' : ''}` },
        h('div', { class: 'stat__label' }, it.label),
        h('div', { class: 'stat__value' }, String(it.value), it.unit ? h('small', {}, it.unit) : null),
        it.note ? h('div', { class: 'stat__note' }, it.note) : null
      )
    )
  );
}

/* ---------------- 코드 ---------------- */
export function codeBlock({ code, lang = 'cypher', title, note, showCopy = true }) {
  const wrapped = h(
    'div',
    { class: 'code' },
    h(
      'div',
      { class: 'code__bar' },
      h('span', { class: 'code__lang' }, LANG_LABEL[lang] || lang),
      title ? h('span', { class: 'code__title' }, title) : h('span', { class: 'spacer' }),
      showCopy
        ? h(
            'button',
            {
              class: 'code__copy',
              type: 'button',
              onClick: () => copyText(code, '코드를 복사했습니다'),
            },
            '복사'
          )
        : null
    ),
    h('pre', {}, h('code', { html: highlight(code, lang) }))
  );
  if (!note) return wrapped;
  return h('div', { class: 'stack stack--sm' }, wrapped, h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' }, html: note }));
}

/* ---------------- 그래프 카드 ---------------- */
/**
 * @returns {{el: HTMLElement, ready: Promise<GraphView|null>}}
 */
export function graphCard(ctx, opts = {}) {
  const {
    title = '그래프',
    subtitle = '',
    height = 420,
    hierarchical = false,
    nodeShape,
    seed,
    tools = [],
    hint = '노드를 드래그하거나 스크롤로 확대할 수 있습니다',
    note,
    onNodeClick,
    legendGroups,
    edgeLabels = false,
  } = opts;
  const data = normalizeGraphData(opts.data || {});

  const canvas = h('div', {
    class: 'graph-canvas',
    tabindex: '0',
    role: 'img',
    'aria-label': `${title} — 인터랙티브 그래프. 노드 ${data.nodes.length}개, 관계 ${data.edges.length}개`,
  });
  canvas.style.height = `${height}px`;

  const card = h('div', { class: 'graph-card' });
  const head = h(
    'div',
    { class: 'graph-card__head' },
    h(
      'div',
      { style: { minWidth: '0' } },
      h('div', { class: 'graph-card__title' }, title),
      subtitle ? h('div', { class: 'graph-card__sub', html: subtitle }) : null
    ),
    h('div', { class: 'graph-card__tools' })
  );
  const toolsEl = head.querySelector('.graph-card__tools');
  card.append(head);

  const wrap = h('div', { class: 'graph-canvas-wrap' }, canvas, h('div', { class: 'graph-hint' }, hint));
  card.append(wrap);

  /* 범례 */
  const groups = legendGroups || [...new Set(data.nodes.map((n) => n.group).filter(Boolean))];
  const legend = h(
    'div',
    { class: 'graph-legend' },
    groups.map((g) => {
      const count = data.nodes.filter((n) => n.group === g).length;
      return h(
        'span',
        { class: 'legend-item' },
        h('span', { class: 'legend-swatch', style: { background: colorFor(g) } }),
        `${g}${count ? ` (${count})` : ''}`
      );
    }),
    edgeLabels
      ? h('span', { class: 'legend-item' }, h('span', { class: 'legend-swatch legend-swatch--line', style: { background: '#5e78a3' } }), '관계')
      : null
  );
  if (!groups.length) legend.style.display = 'none';
  card.append(legend);

  /* 접근성용 표 대체 */
  const fallback = h('div', { class: 'graph-fallback' });
  fallback.append(
    h('div', { class: 'table-wrap' }, buildFallbackTable(data))
  );
  card.append(fallback);

  /* 도구 */
  const tRelayout = h('button', { class: 'gbtn', type: 'button', title: '레이아웃 재계산' }, '재배치');
  const tFit = h('button', { class: 'gbtn', type: 'button', title: '화면에 맞추기' }, '맞춤');
  const tTable = h('button', { class: 'gbtn', type: 'button', title: '표로 보기' }, '표로');
  const tPng = h('button', { class: 'gbtn', type: 'button', title: 'PNG로 저장' }, 'PNG');
  toolsEl.append(...tools, tRelayout, tFit, tPng, tTable);

  const ready = GraphView.create(canvas, { hierarchical, nodeShape, seed, onNodeClick })
    .then((view) => {
      if (!view) return null;
      if (!card.isConnected && ctx?.el?.isConnected) {
        // 카드가 이미 사라졌다면 즉시 정리
      }
      view.setData(data);
      tRelayout.addEventListener('click', () => view.relayout());
      tFit.addEventListener('click', () => view.fit());
      tPng.addEventListener('click', () => {
        const ok = view.toPng(`${slug(title)}.png`);
        toast(ok ? 'PNG를 저장했습니다' : 'PNG 저장에 실패했습니다', ok ? 'ok' : 'warn');
      });
      tTable.addEventListener('click', () => {
        card.classList.toggle('show-table');
        tTable.classList.toggle('is-on', card.classList.contains('show-table'));
      });
      ctx?.addCleanup?.(() => view.destroy());
      return view;
    })
    .catch((err) => {
      console.error('[graphCard]', err);
      wrap.append(h('div', { class: 'error-box' }, `그래프를 초기화하지 못했습니다: ${String(err.message || err)}`));
      return null;
    });

  if (note) card.append(h('div', { class: 'graph-legend' }, h('span', {}, note)));
  return { el: card, ready };
}

function buildFallbackTable(data) {
  const rows = data.nodes.slice(0, 120).map((n) => [
    n.id,
    n.label || n.id,
    n.group || '-',
    String(Object.keys(n.props || {}).length),
  ]);
  return h(
    'table',
    { class: 'table table--compact' },
    h('thead', {}, h('tr', {}, ['ID', '이름', '종류', '속성 수'].map((t) => h('th', {}, t)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c)))))
  );
}

/* ---------------- 차트 카드 ---------------- */
export function chartCard(ctx, { title, subtitle, option, height = 300, foot }) {
  const body = h('div', { class: 'chart-body', style: { height: `${height}px` } });
  body.append(h('div', { class: 'chart-loading', style: { height: `${height}px` } }, '차트 준비 중…'));
  const card = h(
    'div',
    { class: 'chart-card' },
    h(
      'div',
      { class: 'chart-card__head' },
      title ? h('div', { class: 'chart-card__title' }, title) : null,
      subtitle ? h('div', { class: 'chart-card__sub', html: subtitle }) : null
    ),
    body,
    foot ? h('div', { class: 'chart-card__foot', html: foot }) : null
  );
  body.replaceChildren();
  const holder = h('div', { style: { height: `${height}px` } });
  body.append(holder);
  const ready = mountChart(holder, option).then((chart) => {
    if (chart) ctx?.addCleanup?.(() => chart.destroy());
    return chart;
  });
  return { el: card, ready };
}

/* ---------------- 실습용 실행 패널 ---------------- */
export { runPanel } from './runner.js';

/* ---------------- 재노출 ---------------- */
export { quizBlock, tabsBlock, accordionBlock, stepsBlock, compareBlock, checklist, kvBlock, playbar };
