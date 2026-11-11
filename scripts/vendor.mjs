#!/usr/bin/env node
/**
 * vendor.mjs — 외부 CDN 의존 없이 동작하도록 시각화 라이브러리를 로컬로 내려받는다.
 *
 * 셸의 tar.exe에 의존하지 않는다(사용자 홈 경로에 비ASCII 문자가 있어 인코딩 사고가 난다).
 * 순수 Node로 gzip 해제 + tar 엔트리 파싱을 직접 수행한다.
 *
 * 사용: node scripts/vendor.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'vendor');
const FORCE = process.argv.includes('--force');

/** @type {{pkg:string, version:string, entry:string, out:string, licenseOut:string}[]} */
const DEPS = [
  {
    pkg: 'vis-network',
    version: '10.1.5',
    entry: 'package/standalone/umd/vis-network.min.js',
    out: 'vis-network.min.js',
    licenseOut: 'vis-network.LICENSE.txt',
  },
  {
    pkg: 'echarts',
    version: '6.1.0',
    entry: 'package/dist/echarts.min.js',
    out: 'echarts.min.js',
    licenseOut: 'echarts.LICENSE.txt',
  },
];

/** tar(ustar) 버퍼를 엔트리 목록으로 파싱한다. */
function parseTar(buf) {
  const entries = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.toString('utf8', off, off + 100).replace(/\0.*$/s, '');
    if (!name) {
      // 두 개의 연속된 빈 블록이면 종료
      if (buf.toString('utf8', off, off + 512).replace(/\0/g, '').trim() === '') {
        off += 512;
        continue;
      }
      off += 512;
      continue;
    }
    const size = parseInt(buf.toString('utf8', off + 124, off + 136).replace(/\0.*$/s, '').trim(), 8) || 0;
    const type = buf.toString('utf8', off + 156, off + 157);
    entries.push({ name, start: off + 512, size, type });
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function vendorOne(dep) {
  const target = path.join(OUT, dep.out);
  if (!FORCE && fs.existsSync(target) && fs.statSync(target).size > 1000) {
    const kb = (fs.statSync(target).size / 1024).toFixed(0);
    console.log(`= ${dep.pkg}@${dep.version} 이미 존재 (${kb}KB) — 건너뜀`);
    return { ...dep, size: fs.statSync(target).size, sha: sha256(fs.readFileSync(target)), skipped: true };
  }

  const tarUrl = `https://registry.npmjs.org/${dep.pkg}/-/${dep.pkg}-${dep.version}.tgz`;
  process.stdout.write(`↓ ${dep.pkg}@${dep.version} … `);
  const tgz = await download(tarUrl);
  const tar = zlib.gunzipSync(tgz);
  const entries = parseTar(tar);

  const js = entries.find((e) => e.name === dep.entry);
  if (!js) throw new Error(`${dep.pkg}: ${dep.entry} 를 tarball에서 찾지 못했습니다.`);

  const body = tar.subarray(js.start, js.start + js.size);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(target, body);

  // 라이선스 파일은 여러 개일 수 있다(예: vis-network 는 MIT + Apache-2.0 듀얼).
  const lics = entries.filter((e) => /^package\/LICEN[CS]E/i.test(e.name) || /^package\/NOTICE/i.test(e.name));
  if (lics.length) {
    const combined = lics
      .map((e) => {
        const text = tar.subarray(e.start, e.start + e.size).toString('utf8');
        return `${'='.repeat(72)}\n${e.name}\n${'='.repeat(72)}\n${text.trim()}\n`;
      })
      .join('\n\n');
    fs.writeFileSync(path.join(OUT, dep.licenseOut), combined);
  }
  console.log(`ok (${(body.length / 1024).toFixed(0)}KB, license x${lics.length})`);
  return { ...dep, size: body.length, sha: sha256(body), license: lics.length ? dep.licenseOut : null, skipped: false };
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function writeManifest(results) {
  const payload = {
    generatedAt: new Date().toISOString(),
    note: '이 디렉터리는 scripts/vendor.mjs 가 생성합니다. 사이트는 이 파일들만으로 오프라인 동작합니다.',
    libraries: results.map((r) => ({
      name: r.pkg,
      version: r.version,
      file: r.out,
      bytes: r.size,
      sha256_16: r.sha,
      license: r.license || null,
      npm: `https://www.npmjs.com/package/${r.pkg}/v/${r.version}`,
    })),
  };
  fs.writeFileSync(path.join(OUT, 'versions.json'), JSON.stringify(payload, null, 2) + '\n');
}

const results = [];
for (const dep of DEPS) results.push(await vendorOne(dep));
writeManifest(results);

const total = results.reduce((n, r) => n + r.size, 0);
console.log(`\n총 ${(total / 1024 / 1024).toFixed(2)}MB → assets/vendor/`);
