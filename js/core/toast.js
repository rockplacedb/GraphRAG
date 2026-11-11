/** toast.js — 짧은 피드백 메시지 */
import { h } from './dom.js';

export function toast(message, type = 'info', ms = 2400) {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;
  const el = h(
    'div',
    { class: `toast toast--${type}`, role: 'status' },
    h('span', { 'aria-hidden': 'true' }, type === 'ok' ? '✓' : type === 'warn' ? '!' : type === 'danger' ? '×' : '•'),
    h('span', {}, message)
  );
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 240);
  }, ms);
}

export function copyText(text, okMessage = '복사되었습니다') {
  const done = () => toast(okMessage, 'ok');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallback());
  } else fallback();

  function fallback() {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    } catch {
      toast('복사에 실패했습니다. 직접 선택해 주세요.', 'warn');
    }
  }
}
