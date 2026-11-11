/**
 * runner.js — 미니 Cypher 실행 패널.
 * 코드 편집 → 실행 → 결과 표/그래프/통계 + 기대 결과 검증까지 한 카드에서 처리한다.
 */
import { h } from '../core/dom.js';
import { runCypher, SUPPORTED, CypherError } from '../engine/cypher-lite.js';
import { GraphView } from '../core/graph.js';
import { highlight } from '../core/code.js';
import { toast, copyText } from '../core/toast.js';

function cellValue(v) {
  if (v && typeof v === 'object') {
    if (Array.isArray(v)) return v.map(cellValue).join(', ');
    if (Array.isArray(v.labels)) {
      const name = v.props?.name || v.props?.title || v.props?.id || v.id;
      return `${name} :${v.labels[0] || ''}`.trim();
    }
    if (v.type && v.from) return `[${v.type}]`;
    return JSON.stringify(v);
  }
  if (v === null || v === undefined) return 'null';
  return String(v);
}

export function runPanel(ctx, opts = {}) {
  const {
    title = 'Cypher 실행',
    code = '',
    hint = 'Ctrl(⌘) + Enter 로 실행',
    expected = null,
    validate = null,
    height = 260,
    showGraph = true,
    onSuccess = null,
    autoFocus = false,
  } = opts;

  let result = null;
  let view = null;
  // 저장소는 실행 시점에 해석한다(페이지에서 초기화 버튼으로 교체될 수 있음)
  const getStore = () => opts.store || ctx.store;

  const gutter = h('div', { class: 'runner__gutter' }, '1');
  const area = h('textarea', {
    class: 'runner__area',
    spellcheck: 'false',
    'aria-label': `${title} 코드 편집기`,
    value: code,
  });
  const out = h('div', { class: 'runner__out' });
  const runBtn = h('button', { class: 'btn btn--primary', type: 'button' }, '▶ 실행');
  const resetBtn = h('button', { class: 'btn btn--sm', type: 'button' }, '초기화');
  const docsBtn = h('button', { class: 'btn btn--sm', type: 'button' }, '지원 문법');
  const copyBtn = h('button', { class: 'btn btn--sm', type: 'button' }, '복사');
  const hintEl = h('span', { class: 'runner__hint' }, hint);

  const docs = h('div', { class: 'runner__docs', hidden: true });

  function syncGutter() {
    const lines = area.value.split('\n').length;
    gutter.textContent = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1).join('\n');
  }
  area.addEventListener('input', syncGutter);
  area.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      execute();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = area;
      area.value = area.value.slice(0, s) + '  ' + area.value.slice(en);
      area.selectionStart = area.selectionEnd = s + 2;
      syncGutter();
    }
  });

  function showError(err) {
    const box = h('div', { class: 'error-box' }, err.message);
    if (err.line) box.append(h('span', { class: 'error-box__where' }, `위치: ${err.line}행 ${err.col || 1}열`));
    else box.append(h('span', { class: 'error-box__where' }, '힌트: 지원 문법 버튼을 눌러 범위를 확인하세요.'));
    out.replaceChildren(box);
  }

  function destroyView() {
    if (view) {
      try {
        view.destroy();
      } catch {
        /* ignore */
      }
      view = null;
    }
  }

  async function renderResult(res) {
    destroyView();
    out.replaceChildren();
    const s = res.stats || {};
    const strip = h(
      'div',
      { class: 'result-strip' },
      h('span', {}, '행 ', h('b', {}, String(res.rows.length))),
      h('span', { class: 'dot' }),
      h('span', {}, '노드 ', h('b', {}, String(res.resultGraph.nodes.length))),
      h('span', {}, '관계 ', h('b', {}, String(res.resultGraph.edges.length))),
      h('span', { class: 'dot' }),
      h('span', {}, '소요 ', h('b', {}, `${res.ms.toFixed(2)}ms`)),
      s.nodesCreated ? h('span', { class: 'dot' }) : null,
      s.nodesCreated ? h('span', {}, '생성 노드 ', h('b', {}, String(s.nodesCreated))) : null,
      s.relationshipsCreated ? h('span', {}, '생성 관계 ', h('b', {}, String(s.relationshipsCreated))) : null,
      s.propertiesSet ? h('span', {}, '속성 ', h('b', {}, String(s.propertiesSet))) : null
    );
    out.append(strip);

    const pane = h('div', { class: 'result-pane' });

    if (res.warnings?.length) {
      pane.append(
        h(
          'div',
          { class: 'callout callout--warn', style: { margin: '0' } },
          h('span', { class: 'callout__icon' }, '!'),
          h('div', { class: 'callout__body' }, ...res.warnings.map((w) => h('p', {}, w)))
        )
      );
    }

    if (res.rows.length) {
      pane.append(buildRowsTable(res));
    } else if (!res.resultGraph.nodes.length) {
      pane.append(h('div', { class: 'result-empty' }, '결과 행이 없습니다. MATCH 조건이나 WHERE를 확인해 보세요.'));
    }

    if (validate) {
      const verdict = validate(res, getStore());
      if (verdict) {
        pane.append(h('div', { class: verdict.ok ? 'ok-box' : 'map-feedback is-bad' }, verdict.message));
        if (verdict.ok && onSuccess) onSuccess(res);
      }
    }

    if (showGraph && res.resultGraph.nodes.length) {
      const canvas = h('div', { class: 'graph-canvas', style: { height: `${height}px` } });
      const card = h(
        'div',
        { class: 'graph-card' },
        h(
          'div',
          { class: 'graph-card__head' },
          h('div', {}, h('div', { class: 'graph-card__title' }, '쿼리 결과 그래프'), h('div', { class: 'graph-card__sub' }, 'RETURN에 포함된 노드와 관계만 표시됩니다'))
        ),
        h('div', { class: 'graph-canvas-wrap' }, canvas)
      );
      pane.append(card);
      view = await GraphView.create(canvas, { seed: 11, nodeShape: 'box', height });
      if (view) {
        view.setData(res.resultGraph);
        ctx.addCleanup?.(() => {
          view?.destroy();
          view = null;
        });
      }
    }

    out.append(pane);
  }

  function buildRowsTable(res) {
    const shown = res.rows.slice(0, 60);
    const table = h(
      'table',
      { class: 'table table--compact table--zebra' },
      h('thead', {}, h('tr', {}, res.columns.map((c) => h('th', {}, c)))),
      h(
        'tbody',
        {},
        shown.map((row) =>
          h(
            'tr',
            {},
            res.columns.map((c) => {
              const v = row[c];
              const text = cellValue(v);
              const isNum = typeof v === 'number';
              return h('td', { class: isNum ? 'num' : '' }, text);
            })
          )
        )
      )
    );
    const wrap = h('div', { class: 'table-wrap' }, table);
    if (res.rows.length > shown.length) {
      return h('div', {}, wrap, h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)', marginTop: '6px' } }, `${res.rows.length}행 중 ${shown.length}행만 표시합니다.`));
    }
    return wrap;
  }

  function execute() {
    const store = getStore();
    if (!store) {
      showError(new CypherError('그래프 저장소가 준비되지 않았습니다.'));
      return;
    }
    try {
      result = runCypher(store, area.value);
      renderResult(result);
    } catch (err) {
      if (err instanceof CypherError) {
        showError(err);
      } else {
        console.error(err);
        showError(new CypherError(`예상치 못한 오류: ${err.message}`));
      }
    }
  }

  runBtn.addEventListener('click', execute);
  resetBtn.addEventListener('click', () => {
    area.value = code;
    syncGutter();
    out.replaceChildren();
    destroyView();
  });
  copyBtn.addEventListener('click', () => copyText(area.value, '쿼리를 복사했습니다'));
  docsBtn.addEventListener('click', () => {
    if (!docs.childElementCount) {
      docs.append(
        h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' } }, '이 학습 엔진이 실제로 지원하는 범위입니다. Neo4j 전체 문법이 아닙니다.'),
        buildDocList('절', SUPPORTED.clauses),
        buildDocList('패턴', SUPPORTED.patterns),
        buildDocList('연산자', SUPPORTED.operators),
        buildDocList('함수', SUPPORTED.functions),
        buildDocList('미지원', SUPPORTED.notSupported, 'badge--danger')
      );
    }
    docs.hidden = !docs.hidden;
    docsBtn.classList.toggle('is-on', !docs.hidden);
  });

  const el = h(
    'div',
    { class: 'runner' },
    h(
      'div',
      { class: 'runner__head' },
      h('span', { class: 'badge badge--accent' }, 'Cypher'),
      h('span', { class: 'runner__title' }, title),
      copyBtn,
      docsBtn
    ),
    h('div', { class: 'runner__editor' }, gutter, area),
    h('div', { class: 'runner__bar' }, runBtn, resetBtn, hintEl),
    docs,
    out
  );

  if (expected) {
    el.append(
      h(
        'details',
        { class: 'accordion', style: { borderRadius: '0', border: '0', borderTop: '1px solid var(--border)' } },
        h('summary', { class: 'accordion__head', style: { cursor: 'pointer' } }, '기대 결과 보기'),
        h('div', { class: 'accordion__body', html: expected })
      )
    );
  }

  syncGutter();
  if (autoFocus) setTimeout(() => area.focus(), 200);

  return { el, execute, get result() { return result; }, setCode(v) { area.value = v; syncGutter(); } };
}

function buildDocList(title, items, tone = 'badge') {
  return h(
    'div',
    { style: { marginTop: '8px' } },
    h('div', { style: { fontSize: 'var(--fs-2xs)', fontWeight: '700', color: 'var(--ink-3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '4px' } }, title),
    h(
      'div',
      { class: 'chip-row' },
      items.map((it) =>
        h('span', { class: `badge ${tone === 'badge' ? '' : tone}`, style: { fontFamily: 'var(--font-mono)', fontWeight: '500' } }, it)
      )
    )
  );
}

export { highlight };
