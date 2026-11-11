/**
 * router.js — 해시 라우터.
 * 페이지 모듈은 { default: {id, title, render(ctx)} } 형태이며 지연 로딩된다.
 */
import { h, clear } from './dom.js';
import { progress } from './progress.js';

export function createRouter({ routes, mount, onRendered }) {
  const byId = new Map(routes.map((r) => [r.id, r]));
  const order = routes.map((r) => r.id);
  let cleanups = [];
  let token = 0;
  let tocObserver = null;
  let scrollHandler = null;

  function currentId() {
    const raw = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
    return raw || 'home';
  }

  function teardown() {
    for (const fn of cleanups) {
      try {
        fn();
      } catch (err) {
        console.warn('[router] cleanup 실패', err);
      }
    }
    cleanups = [];
    tocObserver?.disconnect();
    tocObserver = null;
    if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }

  function setTitle(title) {
    document.title = title ? `${title} · 지식 그래프 학습 대시보드` : '지식 그래프 학습 대시보드';
  }

  function buildCrumbs(route, page) {
    const host = document.getElementById('crumbs');
    if (!host) return;
    const groupLabel = { theory: '이론', lab: '실습', reference: '부록' }[route.section] || '홈';
    clear(host);
    if (route.section === 'home') {
      host.append(h('b', {}, page.title || route.title));
      return;
    }
    host.append(
      h('a', { href: '#/home' }, '홈'),
      h('span', { class: 'crumbs__sep', 'aria-hidden': 'true' }, '/'),
      h('a', { href: `#/${route.section === 'theory' ? 'theory/why-graph' : route.section === 'lab' ? 'lab/setup' : 'reference/cheatsheet'}` }, groupLabel),
      h('span', { class: 'crumbs__sep', 'aria-hidden': 'true' }, '/'),
      h('b', {}, page.title || route.title)
    );
  }

  function buildToc(mainEl, tocEl) {
    const heads = Array.from(mainEl.querySelectorAll('.section > .section__head > h2, .section > h2'));
    if (!heads.length) {
      tocEl.hidden = true;
      return;
    }
    tocEl.hidden = false;
    const title = h('div', { class: 'toc__title' }, '이 페이지에서');
    const links = [];
    const seen = new Set();
    for (const head of heads) {
      let id = head.id;
      if (!id) {
        id = `s-${links.length + 1}`;
        head.id = id;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      const label = head.textContent.replace(/^\s*\d+\s*/, '').trim();
      const a = h('a', { href: `javascript:void 0`, dataset: { anchor: id } }, label);
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(id);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#/${currentId()}`);
      });
      links.push(a);
      tocEl.append(a);
    }
    if (!links.length) {
      tocEl.hidden = true;
      return;
    }
    tocEl.prepend(title);

    if ('IntersectionObserver' in window) {
      tocObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const id = entry.target.id;
            for (const a of links) a.classList.toggle('is-active', a.dataset.anchor === id);
          }
        },
        { rootMargin: '-72px 0px -68% 0px', threshold: 0 }
      );
      for (const head of heads) tocObserver.observe(head);
    }
  }

  function buildPager(mainEl, id) {
    const i = order.indexOf(id);
    const prev = byId.get(order[i - 1]);
    const next = byId.get(order[i + 1]);
    if (!prev && !next) return;
    const pager = h('nav', { class: 'pager', 'aria-label': '페이지 이동' });
    if (prev) {
      pager.append(
        h(
          'a',
          { class: 'pager__link', href: `#/${prev.id}` },
          h('span', {}, '← 이전'),
          h('b', {}, prev.title)
        )
      );
    }
    if (next) {
      pager.append(
        h(
          'a',
          { class: 'pager__link pager__link--next', href: `#/${next.id}` },
          h('span', {}, '다음 →'),
          h('b', {}, next.title)
        )
      );
    }
    mainEl.append(pager);
  }

  async function render(force = false) {
    const myToken = ++token;
    const id = currentId();
    const route = byId.get(id);
    if (!route) {
      if (id !== 'home') {
        location.replace('#/home');
        return;
      }
      mount.replaceChildren(h('div', { class: 'boot' }, h('p', {}, '페이지를 찾을 수 없습니다.')));
      return;
    }

    teardown();
    setTitle(route.title);

    const page = h('div', { class: 'page' });
    const main = h('article', { class: 'page__main', id: 'page-main' });
    const toc = h('aside', { class: 'page__toc toc', 'aria-label': '페이지 내 목차' });
    page.append(main, toc);
    mount.replaceChildren(page);
    if (force) window.scrollTo({ top: 0, behavior: 'auto' });

    let mod;
    try {
      mod = await route.load();
    } catch (err) {
      console.error('[router] 모듈 로드 실패', route.id, err);
      main.append(errorPanel(`페이지 모듈을 불러오지 못했습니다: ${route.id}`, err));
      return;
    }
    if (myToken !== token) return;

    const def = mod.default || mod.page;
    if (!def || typeof def.render !== 'function') {
      main.append(errorPanel(`페이지 모듈 형식이 올바르지 않습니다: ${route.id}`));
      return;
    }

    const ctx = {
      id: route.id,
      route,
      el: main,
      addCleanup: (fn) => cleanups.push(fn),
      toast: (msg, type) => window.__dshToast?.(msg, type),
      progress,
      isDark: () => document.documentElement.dataset.theme === 'dark',
    };

    try {
      const out = await def.render(ctx);
      if (out && typeof out.destroy === 'function') cleanups.push(out.destroy);
    } catch (err) {
      console.error('[router] 렌더 실패', route.id, err);
      main.append(errorPanel('페이지를 그리는 중 오류가 발생했습니다.', err));
    }
    if (myToken !== token) {
      teardown();
      return;
    }

    buildPager(main, id);
    buildToc(main, toc);
    buildCrumbs(route, def);
    setTitle(def.title || route.title);

    progress.markVisited(id);
    onRendered?.(id, def, ctx);

    if (route.section !== 'home') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function errorPanel(message, err) {
    return h(
      'div',
      { class: 'callout callout--danger', style: { marginBlock: '16px' } },
      h('span', { class: 'callout__icon', 'aria-hidden': 'true' }, '!'),
      h(
        'div',
        { class: 'callout__body' },
        h('div', { class: 'callout__title' }, message),
        err ? h('p', { class: 'mono' }, String(err.message || err)) : null,
        h('p', {}, h('a', { href: '#/home' }, '홈으로 돌아가기'))
      )
    );
  }

  function start() {
    window.addEventListener('hashchange', () => render());
    render(true);
  }

  return { start, render, go: (id) => (location.hash = `#/${id}`) };
}
