/**
 * dom.js — 의존성 없는 DOM 생성 헬퍼.
 * h('div.card.spot', {onClick}, child...) 처럼 태그 문자열에 클래스를 붙일 수 있다.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function appendAll(node, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false || k === true) continue;
    if (Array.isArray(k)) appendAll(node, k);
    else if (k instanceof Node) node.appendChild(k);
    else if (typeof k === 'object' && k.el instanceof Node) node.appendChild(k.el); // {el, ready} 래퍼 허용
    else node.appendChild(document.createTextNode(String(k)));
  }
}

function applyAttrs(node, attrs) {
  if (!attrs) return;
  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') {
      node.setAttribute('class', [node.getAttribute('class'), val].filter(Boolean).join(' '));
    } else if (key === 'style' && typeof val === 'object') {
      for (const [p, v] of Object.entries(val)) {
        if (p.startsWith('--')) node.style.setProperty(p, String(v));
        else node.style[p] = v;
      }
    } else if (key === 'dataset') {
      Object.assign(node.dataset, val);
    } else if (key === 'html') {
      node.innerHTML = val;
    } else if (key === 'text') {
      node.textContent = val;
    } else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'value' || key === 'checked' || key === 'selected' || key === 'disabled') {
      node[key] = val;
    } else if (key === 'htmlFor') {
      node.htmlFor = val;
    } else {
      node.setAttribute(key, val === true ? '' : String(val));
    }
  }
}

export function h(spec, attrs, ...kids) {
  let actualAttrs = attrs;
  if (
    attrs !== null &&
    attrs !== undefined &&
    (Array.isArray(attrs) || typeof attrs !== 'object' || attrs instanceof Node)
  ) {
    kids.unshift(attrs);
    actualAttrs = {};
  }
  const parts = spec.split('.');
  const tag = parts.shift() || 'div';
  const node = document.createElement(tag);
  if (parts.length) node.className = parts.join(' ');
  applyAttrs(node, actualAttrs);
  appendAll(node, kids);
  return node;
}

export function s(spec, attrs, ...kids) {
  let actualAttrs = attrs;
  if (attrs !== null && attrs !== undefined && (Array.isArray(attrs) || typeof attrs !== 'object')) {
    kids.unshift(attrs);
    actualAttrs = {};
  }
  const parts = spec.split('.');
  const tag = parts.shift() || 'g';
  const node = document.createElementNS(SVG_NS, tag);
  if (parts.length) node.setAttribute('class', parts.join(' '));
  applyAttrs(node, actualAttrs);
  appendAll(node, kids);
  return node;
}

/** 문서 조각 */
export function frag(...kids) {
  const f = document.createDocumentFragment();
  appendAll(f, kids);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 한글 제목도 안전한 앵커 id를 만든다. */
export function slug(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'sec';
}

export function fmtNum(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** 엘리먼트를 잠깐 보였다가 사라지게 (aria-live 피드백) */
export function flash(node, cls = 'is-flash', ms = 600) {
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms);
}

/** 숫자 카운트업 애니메이션(가벼운 버전) */
export function countUp(node, to, { duration = 520, format = fmtNum } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = format(to);
    return;
  }
  const from = Number(node.dataset.v || 0);
  node.dataset.v = String(to);
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = format(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
    else node.textContent = format(to);
  };
  requestAnimationFrame(tick);
}
