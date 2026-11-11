/**
 * components.js — 상태를 가진 UI 조각들(탭, 접이식, 퀴즈, 스텝, 재생 바, 체크리스트).
 */
import { h, clear, $$ } from '../core/dom.js';

/* ---------------- 탭 ---------------- */
export function tabsBlock(items) {
  const bar = h('div', { class: 'tabs__bar', role: 'tablist' });
  const panelWrap = h('div', { class: 'tabs__panels' });
  const buttons = [];
  items.forEach((item, i) => {
    const btn = h(
      'button',
      {
        class: `tab${i === 0 ? ' is-on' : ''}`,
        type: 'button',
        role: 'tab',
        'aria-selected': i === 0 ? 'true' : 'false',
        onClick: () => select(i),
      },
      item.label
    );
    buttons.push(btn);
    bar.append(btn);

    const panel = h('div', { class: `tabs__panel${i === 0 ? '' : ' is-hidden'}` });
    if (i !== 0) panel.hidden = true;
    if (item.content instanceof Node) panel.append(item.content);
    else if (typeof item.content === 'string') panel.innerHTML = item.content;
    panelWrap.append(panel);
  });
  function select(idx) {
    buttons.forEach((b, i) => {
      b.classList.toggle('is-on', i === idx);
      b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      panelWrap.children[i].hidden = i !== idx;
    });
  }
  return h('div', { class: 'tabs' }, bar, panelWrap);
}

/* ---------------- 접이식 ---------------- */
export function accordionBlock(items, { openFirst = false } = {}) {
  const wrap = h('div');
  items.forEach((item, i) => {
    const body = h('div', { class: 'accordion__body' });
    if (item.content instanceof Node) body.append(item.content);
    else if (Array.isArray(item.content)) body.append(...item.content);
    else body.innerHTML = item.content || '';
    const open = openFirst && i === 0;
    body.hidden = !open;
    const box = h(
      'div',
      { class: `accordion${open ? ' is-open' : ''}` },
      h(
        'button',
        {
          class: 'accordion__head',
          type: 'button',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => {
            const isOpen = body.hidden;
            body.hidden = !isOpen;
            box.classList.toggle('is-open', isOpen);
            box.querySelector('.accordion__head').setAttribute('aria-expanded', String(isOpen));
          },
        },
        h('span', {}, item.title),
        item.badge ? h('span', { class: 'badge' }, item.badge) : null,
        h('span', { class: 'chev', 'aria-hidden': 'true' }, '▸')
      ),
      body
    );
    wrap.append(box);
  });
  return wrap;
}

/* ---------------- 스텝(실습) ---------------- */
export function stepsBlock(items, { onStep } = {}) {
  const wrap = h('div', { class: 'steps' });
  items.forEach((item, i) => {
    const step = h(
      'div',
      { class: 'step', dataset: { step: String(i) } },
      h('div', { class: 'step__num' }, item.icon || String(i + 1)),
      h(
        'div',
        { class: 'step__body' },
        h('div', { class: 'step__title' }, item.title),
        item.desc ? h('div', { class: 'step__desc', html: item.desc }) : null,
        item.body || null
      )
    );
    wrap.append(step);
    onStep?.(step, i);
  });
  return wrap;
}

/** 특정 스텝을 완료/활성 표시 */
export function markStep(root, index, state = 'done') {
  const step = root.querySelector(`.step[data-step="${index}"]`);
  if (!step) return;
  step.classList.toggle('is-done', state === 'done');
  step.classList.toggle('is-active', state === 'active');
}

/* ---------------- 퀴즈 ---------------- */
export function quizBlock(ctx, { id, title = '스스로 점검', questions = [], pass = 0.6 }) {
  const prev = ctx.progress?.getQuiz(id);
  let revealed = false;
  let answers = new Array(questions.length).fill(-1);

  const qBoxes = [];
  const qWrap = h('div', { class: 'quiz' });
  const result = h('div', { class: 'quiz__result' });
  const submitBtn = h('button', { class: 'btn btn--primary', type: 'button' }, '정답 확인');
  const retryBtn = h('button', { class: 'btn', type: 'button' }, '다시 풀기');
  retryBtn.disabled = true;

  questions.forEach((q, qi) => {
    const opts = h('div', { class: 'quiz__opts', role: 'group', 'aria-label': q.q });
    const optEls = q.options.map((text, oi) => {
      const btn = h(
        'button',
        {
          class: 'quiz__opt',
          type: 'button',
          onClick: () => {
            if (revealed) return;
            answers[qi] = oi;
            optEls.forEach((el, i) => el.classList.toggle('is-selected', i === oi));
          },
        },
        h('span', { class: 'quiz__opt-key' }, String.fromCharCode(65 + oi)),
        h('span', {}, text)
      );
      opts.append(btn);
      return btn;
    });
    const explain = h('div', { class: 'quiz__explain', hidden: true }, q.explain || '');
    const box = h(
      'div',
      { class: 'quiz__q' },
      h('div', { class: 'quiz__q-text' }, h('span', { class: 'quiz__q-num' }, `Q${qi + 1}`), h('span', {}, q.q)),
      opts,
      explain
    );
    qBoxes.push({ box, optEls, explain });
    qWrap.append(box);
  });

  function check() {
    if (answers.some((a) => a < 0)) {
      result.textContent = '아직 풀지 않은 문항이 있습니다.';
      result.className = 'quiz__result is-fail';
      return;
    }
    revealed = true;
    let score = 0;
    questions.forEach((q, qi) => {
      const { optEls, explain } = qBoxes[qi];
      const chosen = answers[qi];
      const correct = chosen === q.answer;
      if (correct) score++;
      optEls.forEach((el, i) => {
        el.disabled = true;
        el.classList.remove('is-selected');
        if (i === q.answer) el.classList.add('is-correct');
        else if (i === chosen) el.classList.add('is-wrong');
      });
      explain.hidden = false;
    });
    const pct = score / questions.length;
    result.className = `quiz__result ${pct >= pass ? 'is-pass' : 'is-fail'}`;
    result.textContent =
      pct >= pass
        ? `정답 ${score}/${questions.length} — 통과입니다. (${(pct * 100).toFixed(0)}%)`
        : `정답 ${score}/${questions.length} — ${Math.round(pass * 100)}% 이상이면 통과입니다. 해설을 읽고 다시 도전해 보세요.`;
    ctx.progress?.setQuiz(id, score, questions.length);
    submitBtn.disabled = true;
    retryBtn.disabled = false;
  }

  function retry() {
    revealed = false;
    answers = new Array(questions.length).fill(-1);
    for (const { optEls, explain } of qBoxes) {
      for (const el of optEls) {
        el.disabled = false;
        el.classList.remove('is-correct', 'is-wrong', 'is-selected');
      }
      explain.hidden = true;
    }
    result.className = 'quiz__result';
    result.textContent = '';
    submitBtn.disabled = false;
    retryBtn.disabled = true;
  }

  submitBtn.addEventListener('click', check);
  retryBtn.addEventListener('click', retry);

  const head = h(
    'div',
    { class: 'row' },
    h('span', { class: 'card__title' }, title),
    h('span', { class: 'badge badge--accent' }, `${questions.length}문항`),
    prev ? h('span', { class: 'badge badge--ok' }, `최고 ${prev.best}/${prev.of}`) : null
  );

  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'card__head' }, h('div', { class: 'card__head-text' }, head)),
    h('div', { class: 'card__body' }, qWrap, h('div', { class: 'quiz__actions', style: { marginTop: '16px' } }, submitBtn, retryBtn, h('span', { class: 'spacer' }), h('span', { class: 'quiz__score', id: `quiz-score-${id}` }, ''))),
    h('div', { class: 'card__foot' }, h('div', {}, result))
  );
}

/* ---------------- 재생 바 ---------------- */
export function playbar({ length = 0, onStep, onReset, label = '단계', autoplay = false }) {
  let step = -1;
  let playing = false;
  let timer = null;
  const range = h('input', {
    type: 'range',
    min: '0',
    max: String(Math.max(0, length - 1)),
    step: '1',
    value: '0',
    'aria-label': `${label} 선택`,
    onInput: (e) => {
      pause();
      setStep(Number(e.target.value));
    },
  });
  const stepText = h('span', { class: 'playbar__step' }, `${label} 0/${length}`);
  const log = h('div', { class: 'playbar__log' }, '재생을 누르면 단계별로 진행합니다.');
  const playBtn = h(
    'button',
    { class: 'btn btn--sm', type: 'button' },
    '▶ 재생'
  );
  const resetBtn = h('button', { class: 'btn btn--sm', type: 'button' }, '↺ 초기화');

  function setStep(i) {
    step = Math.max(-1, Math.min(length - 1, i));
    range.value = String(Math.max(0, step));
    stepText.textContent = `${label} ${step + 1}/${length}`;
    onStep?.(step);
  }
  function play() {
    if (playing) return;
    playing = true;
    playBtn.textContent = '⏸ 일시정지';
    if (step >= length - 1) setStep(-1);
    timer = setInterval(() => {
      if (step >= length - 1) {
        pause();
        return;
      }
      setStep(step + 1);
    }, 720);
    playBtn._tick = timer;
  }
  function pause() {
    playing = false;
    playBtn.textContent = '▶ 재생';
    clearInterval(timer);
    timer = null;
  }
  playBtn.addEventListener('click', () => (playing ? pause() : play()));
  resetBtn.addEventListener('click', () => {
    pause();
    setStep(-1);
    onReset?.();
    log.textContent = '초기화되었습니다.';
  });

  const el = h(
    'div',
    { class: 'playbar' },
    playBtn,
    range,
    stepText,
    resetBtn,
    log
  );

  // 자동 재생(페이지 진입 시)은 기본 비활성
  if (autoplay) setTimeout(play, 600);
  setStep(-1);

  return {
    el,
    setStep,
    setLog: (text) => (log.textContent = text),
    get step() {
      return step;
    },
    destroy: pause,
  };
}

/* ---------------- 비교 패널 ---------------- */
export function compareBlock(cols) {
  return h(
    'div',
    { class: 'compare' },
    cols.map((c) => {
      const body = h('div', { class: 'compare__body' });
      if (c.items) {
        body.append(h('ul', {}, c.items.map((it) => h('li', {}, it))));
      } else if (c.html) body.innerHTML = c.html;
      else if (c.body instanceof Node) body.append(c.body);
      return h(
        'div',
        { class: 'compare__col' },
        h('div', { class: `compare__head compare__head--${c.tone || 'c'}` }, c.title),
        body
      );
    })
  );
}

/* ---------------- 체크리스트 ---------------- */
export function checklist(items, { onChange } = {}) {
  const wrap = h('div', { class: 'checklist' });
  items.forEach((text, i) => {
    const input = h('input', { type: 'checkbox', id: `chk-${i}-${Math.random().toString(36).slice(2, 7)}` });
    const label = h('label', { class: 'check-item', for: input.id }, input, h('span', {}, text));
    input.addEventListener('change', () => {
      label.classList.toggle('is-on', input.checked);
      onChange?.(wrap.querySelectorAll('input:checked').length, items.length);
    });
    wrap.append(label);
  });
  return wrap;
}

/* ---------------- KV ---------------- */
export function kvBlock(pairs) {
  const dl = h('dl', { class: 'kv' });
  for (const [k, v] of pairs) dl.append(h('dt', {}, k), h('dd', {}, v));
  return dl;
}

export { clear, $$ };
