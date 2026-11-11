#!/usr/bin/env node
/**
 * serve.mjs — 의존성 없는 초소형 정적 서버 (ES 모듈은 file:// 로 열리지 않는다).
 * 사용: node scripts/serve.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4321);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const abs = path.resolve(ROOT, '.' + pathname);
  // 경로 탈출 방지
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.readFile(abs, (err, buf) => {
    if (err) {
      // 해시 라우터이므로 알 수 없는 경로는 셸로 되돌린다.
      fs.readFile(path.join(ROOT, 'index.html'), (e2, shell) => {
        if (e2) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 ' + pathname);
          return;
        }
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }).end(shell);
      });
      return;
    }
    if (pathname === '/' || pathname.endsWith('.html')) {
      res.writeHead(200, { 'content-type': MIME['.html'] || 'text/html', 'cache-control': 'no-store' });
    } else {
      res.writeHead(200, {
        'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache',
      });
    }
    res.end(buf);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[dsh] 지식 그래프 학습 대시보드 → http://${HOST}:${PORT}/`);
  console.log(`[dsh] root: ${ROOT}`);
});
