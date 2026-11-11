/** theme.js — 라이트/다크 테마 (localStorage 유지 + 시스템 선호 폴백) */

const KEY = 'kglearn.theme.v1';
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function systemPref() {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme() {
  return document.documentElement.dataset.theme || 'light';
}

export function isDark() {
  return currentTheme() === 'dark';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeBtn');
  if (btn) {
    btn.title = theme === 'dark' ? '라이트 테마로' : '다크 테마로';
    btn.setAttribute('aria-label', btn.title);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0b0f1a' : '#f5f6fa';
  for (const fn of listeners) {
    try {
      fn(theme);
    } catch (err) {
      console.warn('[theme] listener failed', err);
    }
  }
}

export function initTheme() {
  const saved = read();
  applyTheme(saved === 'dark' || saved === 'light' ? saved : systemPref());
  document.getElementById('themeBtn')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  });
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
