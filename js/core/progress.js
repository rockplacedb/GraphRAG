/** progress.js — 방문/퀴즈 진도 저장 */

const KEY = 'kglearn.progress.v1';
const listeners = new Set();
let state = load();

function load() {
  const empty = { visited: [], quiz: {}, steps: {}, last: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
      quiz: parsed.quiz && typeof parsed.quiz === 'object' ? parsed.quiz : {},
      steps: parsed.steps && typeof parsed.steps === 'object' ? parsed.steps : {},
      last: typeof parsed.last === 'string' ? parsed.last : null,
    };
  } catch {
    return empty;
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 저장 불가 환경(프라이빗 모드 등)에서도 학습은 계속된다 */
  }
  for (const fn of listeners) fn(progress.snapshot());
}

export const progress = {
  markVisited(id) {
    if (!state.visited.includes(id)) {
      state.visited.push(id);
      persist();
    }
    state.last = id;
    persist();
  },
  isVisited(id) {
    return state.visited.includes(id);
  },
  setQuiz(id, score, of) {
    const prev = state.quiz[id];
    if (prev && prev.best >= score && prev.of === of) return;
    state.quiz[id] = { score, of, best: prev ? Math.max(prev.best || 0, score) : score, at: Date.now() };
    persist();
  },
  getQuiz(id) {
    return state.quiz[id] || null;
  },
  quizCount() {
    return Object.keys(state.quiz).length;
  },
  setStep(labId, stepIndex) {
    const cur = state.steps[labId] || 0;
    if (stepIndex <= cur) return;
    state.steps[labId] = stepIndex;
    persist();
  },
  getStep(labId) {
    return state.steps[labId] || 0;
  },
  last() {
    return state.last;
  },
  visitedSet() {
    return new Set(state.visited);
  },
  snapshot() {
    return { visited: [...state.visited], quiz: { ...state.quiz }, steps: { ...state.steps }, last: state.last };
  },
  reset() {
    state = { visited: [], quiz: {}, steps: {}, last: null };
    persist();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
