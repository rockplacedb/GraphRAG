/**
 * chart.js — Apache ECharts 래퍼.
 * ECharts는 첫 차트가 필요할 때 지연 로드한다(초기 부팅 비용 절감, 여전히 오프라인).
 */
import { onThemeChange } from './theme.js';

let promise = null;

export function loadEcharts() {
  if (window.echarts) return Promise.resolve(window.echarts);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/vendor/echarts.min.js';
      s.async = true;
      s.onload = () => (window.echarts ? resolve(window.echarts) : reject(new Error('ECharts 초기화 실패')));
      s.onerror = () => reject(new Error('ECharts 로드 실패: assets/vendor/echarts.min.js'));
      document.head.appendChild(s);
    });
  }
  return promise;
}

const FONT = '"Pretendard Variable", Pretendard, "Malgun Gothic", system-ui, sans-serif';

/** 현재 테마의 CSS 변수를 ECharts 옵션용 색상으로 노출 */
export function chartTheme() {
  const cs = getComputedStyle(document.documentElement);
  const g = (name, fallback = '#64748b') => (cs.getPropertyValue(name) || fallback).trim();
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    dark,
    ink: g('--ink', '#0f172a'),
    ink2: g('--ink-2', '#334155'),
    ink3: g('--ink-3', '#64748b'),
    ink4: g('--ink-4', '#94a3b8'),
    grid: dark ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.16)',
    axis: g('--border-strong', '#cbd5e1'),
    surface: g('--surface', '#fff'),
    accent: g('--brand-500', '#4f46e5'),
    cyan: g('--cyan-500', '#06b6d4'),
    ok: '#16a34a',
    warn: '#d97706',
    danger: '#dc2626',
    purple: '#a855f7',
    blue: '#3b82f6',
    font: FONT,
  };
}

export function baseOption(t) {
  return {
    textStyle: { fontFamily: FONT, color: t.ink2 },
    animationDuration: 420,
    animationEasing: 'cubicOut',
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.dark ? '#131a2a' : '#ffffff',
      borderColor: t.dark ? '#26314a' : '#e3e6ef',
      borderWidth: 1,
      textStyle: { color: t.ink, fontSize: 12, fontFamily: FONT },
      extraCssText: 'box-shadow: 0 8px 24px -12px rgba(15,23,42,.35); border-radius: 8px;',
    },
    legend: {
      textStyle: { color: t.ink3, fontSize: 11, fontFamily: FONT },
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      top: 0,
    },
  };
}

/**
 * 차트를 host에 마운트한다.
 * @param {HTMLElement} host
 * @param {(t:ReturnType<typeof chartTheme>)=>object} buildOption
 * @returns {Promise<{inst:any, update:(fn?:Function)=>void, destroy:()=>void}|null>}
 */
export async function mountChart(host, buildOption) {
  let echarts;
  try {
    echarts = await loadEcharts();
  } catch (err) {
    host.innerHTML = `<p class="chart-loading">차트를 불러오지 못했습니다 (${String(err.message || err)})</p>`;
    return null;
  }
  // 페이지 모듈은 DOM을 만든 뒤 한 번에 append 한다. 그 사이에 실행되면 host가 아직
  // 문서에 붙지 않아 ECharts가 0 크기로 초기화되므로, 부착을 잠깐 기다린다(타이머 기반:
  // 백그라운드 탭에서 rAF가 멈출 수 있다). 끝내 붙지 않아도 ResizeObserver가 복구한다.
  for (let i = 0; i < 30 && !host.isConnected; i++) {
    await new Promise((r) => setTimeout(r, 40));
  }
  if (window.__QA__) window.__QA__.charts++;

  const inst = echarts.init(host, null, { renderer: 'canvas' });
  let current = null;
  const apply = () => {
    current = buildOption(chartTheme());
    inst.setOption(current, { notMerge: true });
  };
  apply();

  const ro = new ResizeObserver(() => {
    try {
      inst.resize();
    } catch {
      /* dispose 경합 무시 */
    }
  });
  ro.observe(host);

  const off = onThemeChange(apply);

  return {
    inst,
    get option() {
      return current;
    },
    update(fn) {
      if (typeof fn === 'function') fn(chartTheme(), current);
      apply();
    },
    destroy() {
      off();
      ro.disconnect();
      try {
        inst.dispose();
      } catch {
        /* ignore */
      }
    },
  };
}
