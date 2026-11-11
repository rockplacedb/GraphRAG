/**
 * qa.mjs — Chrome DevTools Protocol로 대시보드 전 라우트를 검증한다.
 * (puppeteer 없이 Node 24 내장 WebSocket 사용)
 *
 * 사용:
 *   1) chrome --headless=new --remote-debugging-port=9222 ...
 *   2) node scripts/qa.mjs [--width 1440] [--height 1000] [--routes home,theory/why-graph] [--shots]
 *
 * 출력: qa/report.json + (--shots) qa/shots/<slug>.png
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const has = (name) => args.includes(`--${name}`);

const PORT = Number(argVal('port', 9222));
const WIDTH = Number(argVal('width', 1440));
const HEIGHT = Number(argVal('height', 1000));
const DO_SHOTS = has('shots');
const DO_FULL = has('full');
const THEME = argVal('theme', '');
const OUT_DIR = argVal('out', 'qa');

const ALL_ROUTES = [
  'home',
  'theory/why-graph',
  'theory/what-is-kg',
  'theory/internals',
  'theory/modeling',
  'theory/query-languages',
  'theory/algorithms',
  'theory/ontology',
  'theory/graph-rag',
  'theory/operations',
  'lab/setup',
  'lab/modeling',
  'lab/cypher-basics',
  'lab/multi-hop',
  'lab/algorithms',
  'lab/ontology',
  'lab/graph-rag',
  'lab/performance',
  'reference/cheatsheet',
  'reference/glossary',
];
const routeArg = argVal('routes', '');
const ROUTES = routeArg ? routeArg.split(',').map((s) => s.trim()).filter(Boolean) : ALL_ROUTES;
const BASE = argVal('base', 'http://127.0.0.1:4321');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => this._onMessage(ev.data));
  }

  static async connect() {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('CDP 페이지 타깃을 찾지 못했습니다.');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new CDP(ws);
  }

  _onMessage(raw) {
    const msg = JSON.parse(raw);
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    if (msg.method) {
      for (const fn of this.listeners.get(msg.method) || []) {
        try {
          fn(msg.params);
        } catch {
          /* ignore */
        }
      }
    }
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 타임아웃: ${method}`));
        }
      }, 25000);
    });
  }

  async eval(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue,
      awaitPromise,
      userGesture: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

const slug = (r) => r.replace(/\//g, '-');

async function main() {
  await fs.mkdir(path.join(OUT_DIR, 'shots'), { recursive: true });
  const cdp = await CDP.connect();
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (p) => {
    errors.push(`[exception] ${p.exceptionDetails?.exception?.description || p.exceptionDetails?.text}`);
  });
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') {
      const text = (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      errors.push(`[console.${p.type}] ${text}`);
    }
  });
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry?.level === 'error') errors.push(`[log] ${p.entry.text} ${p.entry.url || ''}`);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 테마 고정이 필요하면 먼저 오리진에 올라가 localStorage를 설정한다
  await cdp.send('Page.navigate', { url: `${BASE}/#/home` });
  await sleep(900);
  // 결정적인 검증을 위해 저장 상태를 초기화한다(진도/테마)
  await cdp.eval("localStorage.clear();");
  if (THEME) {
    await cdp.eval(`localStorage.setItem('kglearn.theme.v1', ${JSON.stringify(THEME)}); document.documentElement.dataset.theme = ${JSON.stringify(THEME)};`);
    await sleep(300);
  } else {
    await cdp.eval("document.documentElement.dataset.theme = 'light';");
    await sleep(200);
  }

  const report = { base: BASE, width: WIDTH, height: HEIGHT, at: new Date().toISOString(), routes: [] };

  for (const route of ROUTES) {
    errors.length = 0;
    const url = `${BASE}/#/${route}`;
    try {
      await cdp.send('Page.navigate', { url });
      // SPA 렌더 완료 대기: __QA__.route 가 목표와 일치하고 페이지 헤더가 존재
      const started = Date.now();
      let ready = false;
      while (Date.now() - started < 12000) {
        await sleep(120);
        try {
          ready = await cdp.eval(
            `(function(){ const qa = window.__QA__; if (!qa) return false; const m = document.querySelector('.page__main'); return qa.route === ${JSON.stringify(route)} && !!m && m.children.length > 0; })()`
          );
        } catch {
          ready = false;
        }
        if (ready) break;
      }
      await sleep(route === 'home' ? 1100 : 900); // 그래프/차트 안정화 여유

      const info = await cdp.eval(
        `(function(){
          const qa = window.__QA__ || {};
          const main = document.querySelector('.page__main');
          const canvases = document.querySelectorAll('.graph-canvas canvas');
          let painted = 0;
          for (const c of canvases) {
            try {
              const ctx = c.getContext('2d');
              const cw = c.width, ch = c.height;
              const sx = Math.max(0, Math.floor(cw * 0.25)), sy = Math.max(0, Math.floor(ch * 0.25));
              const d = ctx.getImageData(sx, sy, Math.max(1, Math.min(cw - sx, 200)), Math.max(1, Math.min(ch - sy, 200))).data;
              for (let i = 3; i < d.length; i += 28) { if (d[i] > 8) { painted++; break; } }
            } catch (e) { painted = -1; break; }
          }
          return {
            title: document.title,
            route: qa.route || null,
            errors: qa.errors || [],
            graphs: qa.graphs || 0,
            charts: qa.charts || 0,
            graphCards: document.querySelectorAll('.graph-card').length,
            canvases: canvases.length,
            paintedCanvases: painted,
            runnerPanels: document.querySelectorAll('.runner').length,
            chartCanvases: document.querySelectorAll('.chart-body canvas').length,
            hasObjectObject: document.body.innerText.includes('[object Object]'),
            tables: document.querySelectorAll('.table').length,
            callouts: document.querySelectorAll('.callout').length,
            tocLinks: document.querySelectorAll('.toc a').length,
            h2: main ? main.querySelectorAll('h2').length : 0,
            textLen: main ? main.innerText.replace(/\\s+/g, '').length : 0,
            bodyWidth: document.body.scrollWidth,
            viewport: window.innerWidth,
            overflowX: document.body.scrollWidth > window.innerWidth + 2,
          };
        })()`
      );
      info.ready = ready;
      info.consoleErrors = [...errors];
      info.ok = ready && info.canvases >= 0 && errors.length === 0;

      if (DO_SHOTS) {
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: DO_FULL });
        const file = path.join(OUT_DIR, 'shots', `${slug(route)}.png`);
        await fs.writeFile(file, Buffer.from(shot.data, 'base64'));
        info.shot = file;
      }
      report.routes.push({ route, ...info });
      console.log(
        `${info.ok ? 'OK  ' : 'FAIL'} ${route.padEnd(24)} canvas=${info.canvases} painted=${info.paintedCanvases} runner=${info.runnerPanels} chart=${info.chartCanvases} h2=${info.h2} toc=${info.tocLinks} text=${info.textLen} overflow=${info.overflowX}`
      );
      if (info.errors.length) console.log(`      page errors: ${JSON.stringify(info.errors)}`);
      if (errors.length) console.log(`      console: ${JSON.stringify(errors).slice(0, 600)}`);
    } catch (err) {
      report.routes.push({ route, ok: false, fatal: String(err.message || err) });
      console.log(`FAIL ${route} — ${err.message || err}`);
    }
  }

  // 홈 전체 페이지 스크린샷(레이아웃 확인용)
  if (DO_SHOTS) {
    try {
      await cdp.send('Page.navigate', { url: `${BASE}/#/home` });
      await sleep(1800);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await fs.writeFile(path.join(OUT_DIR, 'shots', 'home-full.png'), Buffer.from(shot.data, 'base64'));
    } catch (err) {
      console.log('full-page shot 실패', err.message);
    }
  }

  const failed = report.routes.filter((r) => !r.ok);
  report.summary = { total: report.routes.length, failed: failed.length };
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n요약: ${report.routes.length - failed.length}/${report.routes.length} 통과`);
  if (failed.length) {
    console.log('실패 목록:');
    for (const f of failed) console.log(` - ${f.route}: ${JSON.stringify(f.errors || f.consoleErrors || f.fatal)}`);
  }
  cdp.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('QA 실패:', err);
  process.exit(2);
});
