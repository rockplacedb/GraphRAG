/**
 * main.js — 앱 부트스트랩: 사이드바, 커맨드 팔레트, 읽기 진행률, 라우터 연결.
 */
import { h, clear } from './core/dom.js';
import { initTheme } from './core/theme.js';
import { progress } from './core/progress.js';
import { toast } from './core/toast.js';
import { createRouter } from './core/router.js';
import { ROUTES, SECTIONS, TRACKS } from './data/sections.js';

/* ---------------- QA 훅 (브라우저 검증용) ---------------- */
const qa = (window.__QA__ = { errors: [], graphs: 0, charts: 0, route: null, routes: ROUTES.map((r) => r.id) });
window.addEventListener('error', (e) => qa.errors.push(String(e.message || e.error || 'error')));
window.addEventListener('unhandledrejection', (e) => qa.errors.push(String(e.reason?.message || e.reason || 'rejection')));
window.__dshToast = toast;

initTheme();

const sidebarEl = document.getElementById('sidebar');
const mount = document.getElementById('view');
const readingBar = document.getElementById('readingBar');
const paletteEl = document.getElementById('palette');
const paletteInput = document.getElementById('paletteInput');
const paletteList = document.getElementById('paletteList');

/* ---------------- 사이드바 ---------------- */
const BRAND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="9" cy="18" r="2.4"/><path d="M8.1 6.5l7.6 1.2M7.2 8.2l1.3 7.4M16.4 9.7l-5.6 6.6"/></svg>`;

/**
 * "이어서 학습" 대상 계산.
 * 절대 현재 페이지를 가리키지 않는다(해시가 같으면 아무 반응이 없기 때문).
 * 우선순위: 마지막으로 학습한 페이지 → 현재 페이지의 다음 장 → 첫 미학습 장 → 처음.
 */
function computeResume(currentId) {
  const tracks = TRACKS;
  if (!tracks.length) return { target: null, label: '' };

  const indexOf = (id) => tracks.findIndex((t) => t.id === id);
  const isDone = (r) => progress.isVisited(r.id) || Boolean(progress.getQuiz(r.id));
  const allDone = tracks.every(isDone);

  // visited 배열은 "최초 방문 순서"이므로 마지막 항목이 가장 최근에 새로 연 장이다.
  const visitedTracks = progress
    .snapshot()
    .visited.filter((id) => indexOf(id) >= 0);

  let target = null;
  let mode = 'resume';

  if (!visitedTracks.length) {
    target = tracks[0];
    mode = 'start';
  } else {
    // progress.last() 는 재방문에서도 갱신되므로 "마지막으로 본 장"으로 더 정확하다.
    const lastVisit = progress.last();
    const recentId =
      lastVisit && indexOf(lastVisit) >= 0 ? lastVisit : visitedTracks[visitedTracks.length - 1];
    if (recentId !== currentId) {
      target = tracks[indexOf(recentId)];
      mode = 'resume';
    } else {
      // 지금 보고 있는 장이 가장 최근 학습 지점이면 다음 장으로
      const i = indexOf(currentId);
      target = tracks[i + 1] || tracks.find((t) => !isDone(t)) || tracks[0];
      mode = 'next';
    }
  }

  // 어떤 경우에도 현재 페이지로 이동시키지 않는다
  if (target && target.id === currentId) {
    const i = indexOf(target.id);
    target = tracks[(i + 1) % tracks.length] || target;
  }

  // 라벨은 실제 대상에 맞춘다: 바로 다음 장일 때만 "다음 장"
  let label;
  if (allDone) label = '복습하기 →';
  else if (mode === 'start') label = '첫 장 시작 →';
  else if (mode === 'next' && target && indexOf(target.id) === indexOf(currentId) + 1) label = '다음 장 →';
  else label = '이어서 학습 →';

  return { target, label };
}

function ring(pct) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(1, pct)) * c;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '44');
  svg.setAttribute('height', '44');
  svg.setAttribute('viewBox', '0 0 44 44');
  svg.setAttribute('class', 'side-progress__ring');
  svg.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(ns, 'circle');
  bg.setAttribute('cx', '22');
  bg.setAttribute('cy', '22');
  bg.setAttribute('r', String(r));
  bg.setAttribute('fill', 'none');
  bg.style.stroke = 'var(--border-strong)';
  bg.setAttribute('stroke-width', '4');
  const fg = document.createElementNS(ns, 'circle');
  fg.setAttribute('cx', '22');
  fg.setAttribute('cy', '22');
  fg.setAttribute('r', String(r));
  fg.setAttribute('fill', 'none');
  fg.style.stroke = 'var(--brand-500)';
  fg.setAttribute('stroke-width', '4');
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', `${done} ${c}`);
  fg.setAttribute('transform', 'rotate(-90 22 22)');
  const label = document.createElementNS(ns, 'text');
  label.setAttribute('x', '22');
  label.setAttribute('y', '22');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'central');
  label.setAttribute('font-size', '11');
  label.setAttribute('font-weight', '700');
  label.style.fill = 'var(--ink)';
  label.textContent = `${Math.round(pct * 100)}%`;
  svg.append(bg, fg, label);
  return svg;
}

function navItem(route, currentId) {
  const visited = progress.isVisited(route.id);
  const quiz = progress.getQuiz(route.id);
  const done = visited || Boolean(quiz);
  const a = h(
    'a',
    {
      class: `nav-item${route.id === currentId ? ' is-current' : ''}${done ? ' is-done' : ''}`,
      href: `#/${route.id}`,
      dataset: { route: route.id },
      title: route.summary,
    },
    route.num ? h('span', { class: 'nav-item__num' }, route.num) : h('span', { class: 'nav-item__num' }, '·'),
    h('span', { class: 'nav-item__label' }, route.title),
    h('span', { class: 'nav-item__dot', 'aria-hidden': 'true' })
  );
  return a;
}

function renderSidebar(currentId) {
  const scroll = sidebarEl.scrollTop;
  clear(sidebarEl);

  sidebarEl.append(
    h(
      'a',
      { class: 'brand', href: '#/home', style: { textDecoration: 'none', color: 'inherit' } },
      h('span', { class: 'brand__mark', html: BRAND_ICON }),
      h('span', {}, h('span', { class: 'brand__title', style: { display: 'block' } }, 'Graph · RAG 학습실'), h('span', { class: 'brand__sub', style: { display: 'block' } }, 'FOR DB ENGINEERS'))
    )
  );

  const total = TRACKS.length;
  const done = TRACKS.filter((r) => progress.isVisited(r.id) || progress.getQuiz(r.id)).length;
  const pct = total ? done / total : 0;
  const resume = computeResume(currentId);

  sidebarEl.append(
    h(
      'div',
      { class: 'side-progress' },
      ring(pct),
      h(
        'div',
        { class: 'side-progress__text' },
        h('div', { class: 'side-progress__label' }, '전체 진도'),
        h('div', { class: 'side-progress__value' }, `${done} / ${total} 페이지`),
        resume.target
          ? h(
              'a',
              {
                class: 'side-progress__link',
                href: `#/${resume.target.id}`,
                title: `${resume.target.num} ${resume.target.title} (${resume.label})`,
              },
              resume.label
            )
          : null,
        resume.target ? h('div', { class: 'side-progress__next' }, `${resume.target.num} ${resume.target.title}`) : null
      )
    )
  );

  const home = ROUTES.find((r) => r.id === 'home');
  if (home) {
    const nav = h('nav', { class: 'nav-group', 'aria-label': '개요' });
    nav.append(navItem(home, currentId));
    sidebarEl.append(nav);
  }

  for (const sec of SECTIONS) {
    const items = ROUTES.filter((r) => r.section === sec.key);
    if (!items.length) continue;
    const nav = h('nav', { class: 'nav-group', 'aria-label': sec.label });
    nav.append(h('div', { class: 'nav-group__title' }, h('span', {}, sec.label), h('span', {}, sec.hint)));
    for (const r of items) nav.append(navItem(r, currentId));
    sidebarEl.append(nav);
  }

  sidebarEl.append(
    h(
      'div',
      { class: 'sidebar__foot' },
      h('div', {}, '실습은 별도 설치 없이 브라우저에서 실행됩니다.'),
      h('div', { style: { marginTop: '6px' } }, 'Neo4j 코드는 5.x 기준입니다.')
    )
  );
  sidebarEl.scrollTop = scroll;
}

/* ---------------- 모바일 사이드바 ---------------- */
let scrim = null;
function closeNav() {
  sidebarEl.classList.remove('is-open');
  document.getElementById('navToggle')?.setAttribute('aria-expanded', 'false');
  scrim?.classList.remove('is-on');
}
function toggleNav() {
  const open = !sidebarEl.classList.contains('is-open');
  sidebarEl.classList.toggle('is-open', open);
  document.getElementById('navToggle')?.setAttribute('aria-expanded', String(open));
  if (!scrim) {
    scrim = h('div', { class: 'sidebar-scrim', onClick: closeNav });
    document.body.appendChild(scrim);
  }
  scrim.classList.toggle('is-on', open);
}

document.getElementById('navToggle')?.addEventListener('click', toggleNav);
sidebarEl.addEventListener('click', (e) => {
  if (e.target.closest('.nav-item') && window.matchMedia('(max-width: 1180px)').matches) closeNav();
});

/* ---------------- 커맨드 팔레트 ---------------- */
let paletteActive = 0;
let paletteItems = [];

function openPalette() {
  paletteEl.hidden = false;
  paletteInput.value = '';
  renderPalette('');
  paletteInput.focus();
}
function closePalette() {
  paletteEl.hidden = true;
}
function renderPalette(q) {
  const needle = q.trim().toLowerCase();
  paletteItems = ROUTES.filter((r) => {
    if (!needle) return true;
    const hay = [r.title, r.summary, r.num, ...(r.keywords || [])].join(' ').toLowerCase();
    return hay.includes(needle);
  }).slice(0, 12);
  paletteActive = 0;
  clear(paletteList);
  if (!paletteItems.length) {
    paletteList.append(h('li', { class: 'palette__empty' }, '검색 결과가 없습니다.'));
    return;
  }
  paletteItems.forEach((r, i) => {
    const li = h('li', {}, itemButton(r, i));
    paletteList.append(li);
  });
}
function itemButton(r, i) {
  const btn = h(
    'button',
    {
      class: `palette__item${i === paletteActive ? ' is-active' : ''}`,
      type: 'button',
      onClick: () => {
        location.hash = `#/${r.id}`;
        closePalette();
      },
    },
    h('em', {}, r.num || '홈'),
    h('b', {}, r.title),
    h('span', {}, r.summary)
  );
  return btn;
}
function refreshActive() {
  Array.from(paletteList.querySelectorAll('.palette__item')).forEach((el, i) => {
    el.classList.toggle('is-active', i === paletteActive);
    if (i === paletteActive) el.scrollIntoView({ block: 'nearest' });
  });
}

paletteInput?.addEventListener('input', (e) => renderPalette(e.target.value));
paletteInput?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    paletteActive = Math.min(paletteItems.length - 1, paletteActive + 1);
    refreshActive();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    paletteActive = Math.max(0, paletteActive - 1);
    refreshActive();
  } else if (e.key === 'Enter') {
    const r = paletteItems[paletteActive];
    if (r) {
      location.hash = `#/${r.id}`;
      closePalette();
    }
  } else if (e.key === 'Escape') {
    closePalette();
  }
});
paletteEl?.addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-close')) closePalette();
});
document.getElementById('paletteBtn')?.addEventListener('click', openPalette);

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    paletteEl.hidden ? openPalette() : closePalette();
  } else if (e.key === 'Escape' && !paletteEl.hidden) {
    closePalette();
  } else if (!mod && !paletteEl.hidden && e.key === '/') {
    e.preventDefault();
    paletteInput.focus();
  }
});

/* ---------------- 읽기 진행률 ---------------- */
let ticking = false;
window.addEventListener(
  'scroll',
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (readingBar) readingBar.style.width = `${(pct * 100).toFixed(2)}%`;
      ticking = false;
    });
  },
  { passive: true }
);

/* ---------------- 라우터 ---------------- */
const router = createRouter({
  routes: ROUTES,
  mount,
  onRendered: (id) => {
    qa.route = id;
    renderSidebar(id);
    if (readingBar) readingBar.style.width = '0%';
    document.getElementById('app')?.classList.remove('is-nav-open');
  },
});

renderSidebar('home');
router.start();

/* 진도 갱신 시 사이드바 동기화(퀴즈 저장 등) */
progress.subscribe(() => {
  const id = qa.route || 'home';
  const active = document.activeElement;
  const wasSearch = active && active.id === 'paletteInput';
  if (!wasSearch) renderSidebar(id);
});

/* 디버그용 */
window.__app = { router, progress, ROUTES };
