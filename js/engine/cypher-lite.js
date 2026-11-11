/**
 * cypher-lite.js — 교육용 Cypher 부분집합 엔진(브라우저 실행).
 *
 * 실제 Neo4j가 아니다. 지원 범위를 명시하고, 미지원 구문은 위치를 담은 한국어 오류로 알려준다.
 * DOM에 의존하지 않으므로 Node 테스트에서 그대로 실행할 수 있다.
 */
import { GraphStore } from './graph-store.js';

/* =====================================================================
   0. 오류 / 메타
   ===================================================================== */
export class CypherError extends Error {
  constructor(message, pos = -1, source = '') {
    super(message);
    this.name = 'CypherError';
    this.pos = pos;
    this.source = source;
    if (pos >= 0 && source) {
      const before = source.slice(0, pos);
      this.line = before.split('\n').length;
      this.col = pos - before.lastIndexOf('\n');
    }
  }
}

export const SUPPORTED = {
  clauses: ['MATCH', 'WHERE', 'RETURN', 'CREATE', 'MERGE', 'SET', 'DELETE / DETACH DELETE', 'ORDER BY · SKIP · LIMIT', 'DISTINCT'],
  operators: ['=', '<>', '!=', '<', '<=', '>', '>=', 'AND', 'OR', 'NOT', 'IN', 'IS NULL', 'STARTS WITH', 'ENDS WITH', 'CONTAINS'],
  functions: ['count(*), count(x)', 'collect(x)', 'sum / avg / min / max', 'labels(n)', 'type(r)', 'id(x)', 'keys(x)', 'size(x)', 'toLower / toUpper / trim', 'coalesce(...)', 'abs / round / floor / ceil'],
  patterns: ['(n:Label)', '(n:Label {prop: 값})', '[:TYPE]', '-[:TYPE]->', '<-[:TYPE]-', '-[:TYPE]-', '[:A|B]', '-[*1..3]->'],
  notSupported: [
    'OPTIONAL MATCH',
    'WITH',
    'UNWIND',
    'CALL / 프로시저',
    'LOAD CSV',
    '경로 변수 p = (a)-[*]->(b)',
    'UNION',
    'MERGE ... ON CREATE / ON MATCH SET',
    '정규식 =~',
    'CASE 식',
    'CONSTRAINT / INDEX DDL',
  ],
};

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* =====================================================================
   1. 토크나이저
   ===================================================================== */
const PUNCS = [
  '..', '->', '<-', '+=', '!=', '<>', '<=', '>=',
  '(', ')', '[', ']', '{', '}', ',', '.', ':', ';', '*', '+', '-', '=', '<', '>', '|',
];

const isIdentStart = (c) => /[A-Za-z_가-힣]/.test(c);
const isIdentChar = (c) => /[A-Za-z0-9_가-힣]/.test(c);
const isDigit = (c) => c >= '0' && c <= '9';

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new CypherError('주석이 닫히지 않았습니다 (/* … */)', i, src);
      i = end + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\') {
          const n = src[j + 1];
          out += n === 'n' ? '\n' : n === 't' ? '\t' : n === '\\' ? '\\' : n === quote ? quote : n;
          j += 2;
        } else {
          out += src[j];
          j++;
        }
      }
      if (j >= src.length) throw new CypherError('문자열이 닫히지 않았습니다', i, src);
      toks.push({ t: 'str', v: out, pos: i });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      const end = src.indexOf('`', i + 1);
      if (end < 0) throw new CypherError('백틱 식별자가 닫히지 않았습니다', i, src);
      toks.push({ t: 'word', v: src.slice(i + 1, end), pos: i, quoted: true });
      i = end + 1;
      continue;
    }
    if (c === '$') {
      let j = i + 1;
      let name = '';
      while (j < src.length && isIdentChar(src[j])) {
        name += src[j];
        j++;
      }
      if (!name) throw new CypherError('$ 뒤에 파라미터 이름이 필요합니다', i, src);
      toks.push({ t: 'param', v: name, pos: i });
      i = j;
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] || ''))) {
      let j = i;
      let num = '';
      while (j < src.length && isDigit(src[j])) num += src[j++];
      if (src[j] === '.' && isDigit(src[j + 1] || '')) {
        num += src[j++];
        while (j < src.length && isDigit(src[j])) num += src[j++];
      }
      toks.push({ t: 'num', v: Number(num), pos: i });
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i;
      let w = '';
      while (j < src.length && isIdentChar(src[j])) w += src[j++];
      toks.push({ t: 'word', v: w, pos: i });
      i = j;
      continue;
    }
    let punc = null;
    for (const p of PUNCS) {
      if (src.startsWith(p, i)) {
        punc = p;
        break;
      }
    }
    if (!punc) throw new CypherError(`예상치 못한 문자 '${c}'`, i, src);
    toks.push({ t: 'punc', v: punc, pos: i });
    i += punc.length;
  }
  toks.push({ t: 'eof', v: '', pos: src.length });
  return toks;
}

/* =====================================================================
   2. 파서
   ===================================================================== */
class Parser {
  constructor(toks, src) {
    this.toks = toks;
    this.src = src;
    this.i = 0;
  }
  get tok() {
    return this.toks[this.i];
  }
  peek(o = 1) {
    return this.toks[this.i + o] || { t: 'eof', v: '', pos: this.src.length };
  }
  atEnd() {
    return this.tok.t === 'eof';
  }
  isWord(v) {
    return this.tok.t === 'word' && (v === undefined || this.tok.v.toUpperCase() === v);
  }
  isPunc(v) {
    return this.tok.t === 'punc' && this.tok.v === v;
  }
  next() {
    const t = this.tok;
    if (this.i < this.toks.length - 1) this.i++;
    return t;
  }
  eatWord(v) {
    if (this.isWord(v)) {
      this.next();
      return true;
    }
    return false;
  }
  eatPunc(v) {
    if (this.isPunc(v)) {
      this.next();
      return true;
    }
    return false;
  }
  expectPunc(v) {
    if (!this.eatPunc(v)) this.error(`'${v}' 가 필요합니다 (현재: ${this.describe(this.tok)})`);
  }
  expectWord(v) {
    if (!this.eatWord(v)) this.error(`'${v}' 가 필요합니다`);
  }
  ident() {
    if (this.tok.t !== 'word') this.error(`식별자가 필요합니다 (현재: ${this.describe(this.tok)})`);
    return this.next().v;
  }
  describe(t) {
    if (t.t === 'eof') return '쿼리 끝';
    return String(t.v);
  }
  error(msg, tok = this.tok) {
    throw new CypherError(msg, tok.pos, this.src);
  }

  /* ---------- 쿼리 ---------- */
  parseQuery() {
    const clauses = [];
    while (!this.atEnd()) {
      if (this.eatPunc(';')) continue;
      if (this.tok.t !== 'word') this.error(`절이 필요합니다 (현재: ${this.describe(this.tok)})`);
      const w = this.tok.v.toUpperCase();
      if (w === 'MATCH') clauses.push(this.parseMatch());
      else if (w === 'CREATE') clauses.push(this.parseCreate());
      else if (w === 'MERGE') clauses.push(this.parseMerge());
      else if (w === 'SET') clauses.push(this.parseSet());
      else if (w === 'DETACH') {
        this.next();
        clauses.push(this.parseDelete(true));
      } else if (w === 'DELETE') clauses.push(this.parseDelete(false));
      else if (w === 'RETURN') clauses.push(this.parseReturn());
      else if (w === 'OPTIONAL') this.error('OPTIONAL MATCH는 지원하지 않습니다. 별도 쿼리로 나누거나 WHERE로 대체하세요.');
      else if (w === 'WITH') this.error('WITH는 지원하지 않습니다. 서브쿼리를 두 번 실행해 보세요.');
      else if (w === 'UNWIND') this.error('UNWIND는 지원하지 않습니다.');
      else if (w === 'CALL') this.error('CALL(프로시저)은 지원하지 않습니다.');
      else if (w === 'LOAD') this.error('LOAD CSV는 지원하지 않습니다. 데이터는 화면의 시드 버튼으로 적재됩니다.');
      else if (w === 'ORDER' || w === 'SKIP' || w === 'LIMIT') this.error(`${w}는 RETURN 뒤에만 올 수 있습니다.`);
      else if (w === 'UNION') this.error('UNION은 지원하지 않습니다.');
      else this.error(`알 수 없는 절: ${this.tok.v}`);
    }
    if (!clauses.length) this.error('실행할 절이 없습니다.');
    return clauses;
  }

  parseMatch() {
    this.expectWord('MATCH');
    const patterns = this.parsePatternList();
    let where = null;
    if (this.eatWord('WHERE')) where = this.parseExpression();
    return { type: 'match', patterns, where };
  }

  parseCreate() {
    this.expectWord('CREATE');
    return { type: 'create', patterns: this.parsePatternList() };
  }

  parseMerge() {
    this.expectWord('MERGE');
    const pattern = this.parsePatternPart();
    return { type: 'merge', pattern };
  }

  parseSet() {
    this.expectWord('SET');
    const items = [];
    do {
      if (this.tok.t !== 'word') this.error('SET 대상(변수)이 필요합니다');
      const v = this.next().v;
      if (this.eatPunc('.')) {
        const prop = this.ident();
        this.expectPunc('=');
        items.push({ v, prop, op: '=', expr: this.parseExpression() });
      } else if (this.eatPunc('+=')) {
        items.push({ v, prop: null, op: '+=', expr: this.parseExpression() });
      } else if (this.eatPunc('=')) {
        items.push({ v, prop: null, op: '=', expr: this.parseExpression() });
      } else {
        this.error("SET 뒤에는 '.속성', '=', '+=' 가 필요합니다");
      }
    } while (this.eatPunc(','));
    return { type: 'set', items };
  }

  parseDelete(detach) {
    this.expectWord('DELETE');
    const vars = [this.ident()];
    while (this.eatPunc(',')) vars.push(this.ident());
    return { type: 'delete', vars, detach };
  }

  parseReturn() {
    this.expectWord('RETURN');
    const distinct = this.eatWord('DISTINCT');
    const items = [];
    if (this.isPunc('*')) {
      this.next();
      items.push({ expr: { k: 'star' }, alias: '*' });
    } else {
      do {
        const expr = this.parseExpression();
        let alias = null;
        if (this.eatWord('AS')) alias = this.ident();
        items.push({ expr, alias: alias || defaultAlias(expr, items.length) });
      } while (this.eatPunc(','));
    }
    let orderBy = [];
    if (this.isWord('ORDER')) {
      this.next();
      this.expectWord('BY');
      do {
        const expr = this.parseExpression();
        const desc = this.eatWord('DESC');
        if (!desc) this.eatWord('ASC');
        orderBy.push({ expr, desc });
      } while (this.eatPunc(','));
    }
    let skip = null;
    let limit = null;
    if (this.eatWord('SKIP')) skip = this.parseExpression();
    if (this.eatWord('LIMIT')) limit = this.parseExpression();
    return { type: 'return', distinct, items, orderBy, skip, limit };
  }

  /* ---------- 패턴 ---------- */
  parsePatternList() {
    const parts = [this.parsePatternPart()];
    while (this.eatPunc(',')) parts.push(this.parsePatternPart());
    return parts;
  }

  parsePatternPart() {
    if (this.tok.t === 'word' && this.peek().t === 'punc' && this.peek().v === '=') {
      this.error('경로 변수(p = ...)는 지원하지 않습니다.');
    }
    const start = this.parseNodePattern();
    const segs = [];
    while (this.isPunc('-') || this.isPunc('<-')) {
      const seg = this.parseRelSegment();
      const toNode = this.parseNodePattern();
      segs.push({ ...seg, toNode });
    }
    return { start, segs, nodes: [start, ...segs.map((s) => s.toNode)] };
  }

  parseNodePattern() {
    this.expectPunc('(');
    let v = null;
    if (this.tok.t === 'word') v = this.next().v;
    const labels = [];
    while (this.eatPunc(':')) labels.push(this.ident());
    let props = null;
    if (this.isPunc('{')) props = this.parseMap();
    this.expectPunc(')');
    return { v, labels, props };
  }

  parseRelSegment() {
    let left = false;
    let right = false;
    if (this.eatPunc('<-')) left = true;
    else this.expectPunc('-');

    let v = null;
    const types = [];
    let min = 1;
    let max = 1;
    let props = null;

    if (this.eatPunc('[')) {
      if (this.tok.t === 'word') v = this.next().v;
      if (this.eatPunc(':')) {
        types.push(this.ident());
        while (this.eatPunc('|')) {
          this.eatPunc(':');
          types.push(this.ident());
        }
      }
      if (this.eatPunc('*')) {
        min = 1;
        max = 5;
        if (this.tok.t === 'num') min = this.next().v;
        if (this.eatPunc('..')) {
          max = this.tok.t === 'num' ? this.next().v : 5;
        } else {
          max = min;
        }
        if (max < min) this.error('가변 길이의 최대 홉이 최소 홉보다 작습니다');
        if (max > 6) {
          max = 6;
        }
      }
      if (this.isPunc('{')) props = this.parseMap();
      this.expectPunc(']');
    }

    if (this.eatPunc('->')) right = true;
    else if (this.eatPunc('-')) {
      /* '--' */
    } else {
      this.error("관계 패턴을 닫는 '-' 또는 '->' 가 필요합니다");
    }

    const direction = right && !left ? 'out' : left && !right ? 'in' : 'both';
    return { v, types, min, max, props, direction };
  }

  parseMap() {
    this.expectPunc('{');
    const map = {};
    if (!this.isPunc('}')) {
      do {
        let key;
        if (this.tok.t === 'word') key = this.next().v;
        else if (this.tok.t === 'str') key = this.next().v;
        else this.error('맵의 키가 필요합니다');
        this.expectPunc(':');
        map[key] = this.parseExpression();
      } while (this.eatPunc(','));
    }
    this.expectPunc('}');
    return map;
  }

  /* ---------- 표현식 ---------- */
  parseExpression() {
    return this.parseOr();
  }
  parseOr() {
    let l = this.parseAnd();
    while (this.isWord('OR')) {
      this.next();
      l = { k: 'or', l, r: this.parseAnd() };
    }
    return l;
  }
  parseAnd() {
    let l = this.parseNot();
    while (this.isWord('AND')) {
      this.next();
      l = { k: 'and', l, r: this.parseNot() };
    }
    return l;
  }
  parseNot() {
    if (this.isWord('NOT')) {
      this.next();
      return { k: 'not', e: this.parseNot() };
    }
    return this.parseComparison();
  }
  parseComparison() {
    let l = this.parsePrimary();
    for (;;) {
      if (this.tok.t === 'punc' && ['=', '<>', '!=', '<', '<=', '>', '>='].includes(this.tok.v)) {
        const op = this.next().v;
        l = { k: 'cmp', op: op === '!=' ? '<>' : op, l, r: this.parsePrimary() };
      } else if (this.isWord('IS')) {
        this.next();
        const not = this.eatWord('NOT');
        this.expectWord('NULL');
        l = { k: 'isnull', e: l, not };
      } else if (this.isWord('IN')) {
        this.next();
        l = { k: 'in', l, r: this.parsePrimary() };
      } else if (this.isWord('CONTAINS')) {
        this.next();
        l = { k: 'contains', l, r: this.parsePrimary() };
      } else if (this.isWord('STARTS')) {
        this.next();
        this.expectWord('WITH');
        l = { k: 'starts', l, r: this.parsePrimary() };
      } else if (this.isWord('ENDS')) {
        this.next();
        this.expectWord('WITH');
        l = { k: 'ends', l, r: this.parsePrimary() };
      } else {
        break;
      }
    }
    return l;
  }
  parsePrimary() {
    if (this.eatPunc('(')) {
      const e = this.parseExpression();
      this.expectPunc(')');
      return e;
    }
    if (this.tok.t === 'num') return { k: 'lit', v: this.next().v };
    if (this.tok.t === 'str') return { k: 'lit', v: this.next().v };
    if (this.tok.t === 'param') return { k: 'param', name: this.next().v };
    if (this.isPunc('[')) {
      this.next();
      const items = [];
      if (!this.isPunc(']')) {
        do {
          items.push(this.parseExpression());
        } while (this.eatPunc(','));
      }
      this.expectPunc(']');
      return { k: 'list', items };
    }
    if (this.tok.t === 'word') {
      const word = this.tok.v;
      const upper = word.toUpperCase();
      if (upper === 'TRUE') {
        this.next();
        return { k: 'lit', v: true };
      }
      if (upper === 'FALSE') {
        this.next();
        return { k: 'lit', v: false };
      }
      if (upper === 'NULL') {
        this.next();
        return { k: 'lit', v: null };
      }
      const following = this.peek();
      if (following.t === 'punc' && following.v === '(') {
        this.next(); // 함수 이름
        this.next(); // '('
        const args = [];
        if (this.isPunc('*')) {
          this.next();
          args.push({ k: 'star' });
        } else if (!this.isPunc(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.eatPunc(','));
        }
        this.expectPunc(')');
        return { k: 'fn', name: upper, args };
      }
      this.next();
      let node = { k: 'var', name: word };
      while (this.eatPunc('.')) node = { k: 'prop', base: node, name: this.ident() };
      return node;
    }
    this.error(`값이 필요합니다 (현재: ${this.describe(this.tok)})`);
  }
}

function defaultAlias(expr, idx) {
  if (expr.k === 'var') return expr.name;
  if (expr.k === 'prop') return `${defaultAlias(expr.base, idx)}.${expr.name}`;
  if (expr.k === 'fn') return `${expr.name.toLowerCase()}(${idx + 1})`;
  return `col_${idx + 1}`;
}

/* =====================================================================
   3. 평가기
   ===================================================================== */
const AGG_FNS = new Set(['COUNT', 'COLLECT', 'SUM', 'AVG', 'MIN', 'MAX']);

const isNode = (v) => Boolean(v && v.props && Array.isArray(v.labels));
const isEdge = (v) => Boolean(v && v.props && typeof v.type === 'string' && v.from && v.to);

function looseEq(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return a === b || (a == null && b == null);
  if (typeof a === 'number' && typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b))) return a === Number(b);
  if (typeof b === 'number' && typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a))) return b === Number(a);
  if ((isNode(a) && isNode(b)) || (isEdge(a) && isEdge(b))) return a.id === b.id;
  return a === b;
}

function truthy(v) {
  if (v === null || v === undefined) return false;
  if (v === true) return true;
  if (v === false) return false;
  return Boolean(v);
}

function containsAgg(expr) {
  if (!expr) return false;
  if (expr.k === 'fn' && AGG_FNS.has(expr.name)) return true;
  for (const key of ['l', 'r', 'e', 'base']) {
    if (expr[key] && typeof expr[key] === 'object' && containsAgg(expr[key])) return true;
  }
  if (expr.args && expr.args.some((a) => a && containsAgg(a))) return true;
  if (expr.items && expr.items.some((a) => a && containsAgg(a))) return true;
  return false;
}

export function evalExpr(expr, row, env, groupRows) {
  switch (expr.k) {
    case 'lit':
      return expr.v;
    case 'param': {
      if (!(expr.name in env.params)) throw new CypherError(`정의되지 않은 파라미터 $${expr.name}`, -1, env.source || '');
      return env.params[expr.name];
    }
    case 'var': {
      if (!(expr.name in row)) throw new CypherError(`정의되지 않은 변수 '${expr.name}' 입니다. MATCH에서 바인딩했는지 확인하세요.`, -1, env.source || '');
      return row[expr.name];
    }
    case 'prop': {
      const base = evalExpr(expr.base, row, env, groupRows);
      return getProp(base, expr.name);
    }
    case 'list':
      return expr.items.map((e) => evalExpr(e, row, env, groupRows));
    case 'not':
      return !truthy(evalExpr(expr.e, row, env, groupRows));
    case 'and':
      return truthy(evalExpr(expr.l, row, env, groupRows)) && truthy(evalExpr(expr.r, row, env, groupRows));
    case 'or':
      return truthy(evalExpr(expr.l, row, env, groupRows)) || truthy(evalExpr(expr.r, row, env, groupRows));
    case 'isnull': {
      const v = evalExpr(expr.e, row, env, groupRows);
      const isnull = v === null || v === undefined;
      return expr.not ? !isnull : isnull;
    }
    case 'cmp': {
      const a = evalExpr(expr.l, row, env, groupRows);
      const b = evalExpr(expr.r, row, env, groupRows);
      if (a === null || a === undefined || b === null || b === undefined) return null;
      switch (expr.op) {
        case '=':
          return looseEq(a, b);
        case '<>':
          return !looseEq(a, b);
        case '<':
          return a < b;
        case '<=':
          return a <= b;
        case '>':
          return a > b;
        case '>=':
          return a >= b;
        default:
          return null;
      }
    }
    case 'in': {
      const a = evalExpr(expr.l, row, env, groupRows);
      const list = evalExpr(expr.r, row, env, groupRows);
      if (!Array.isArray(list)) return null;
      return list.some((x) => looseEq(a, x));
    }
    case 'contains': {
      const a = evalExpr(expr.l, row, env, groupRows);
      const b = evalExpr(expr.r, row, env, groupRows);
      if (a == null || b == null) return null;
      return String(a).includes(String(b));
    }
    case 'starts': {
      const a = evalExpr(expr.l, row, env, groupRows);
      const b = evalExpr(expr.r, row, env, groupRows);
      if (a == null || b == null) return null;
      return String(a).startsWith(String(b));
    }
    case 'ends': {
      const a = evalExpr(expr.l, row, env, groupRows);
      const b = evalExpr(expr.r, row, env, groupRows);
      if (a == null || b == null) return null;
      return String(a).endsWith(String(b));
    }
    case 'fn':
      return evalFn(expr, row, env, groupRows);
    default:
      throw new CypherError(`평가할 수 없는 식: ${expr.k}`, -1, env.source || '');
  }
}

function getProp(base, name) {
  if (base === null || base === undefined) return null;
  if (isNode(base) || isEdge(base)) {
    const v = base.props[name];
    return v === undefined ? null : v;
  }
  if (typeof base === 'object') return base[name] === undefined ? null : base[name];
  return null;
}

function evalFn(expr, row, env, groupRows) {
  const { name } = expr;
  if (AGG_FNS.has(name)) {
    if (!groupRows) throw new CypherError(`${name}()는 집계 함수이므로 RETURN에서만 쓸 수 있습니다.`);
    const arg = expr.args[0];
    if (!arg || arg.k === 'star') return name === 'COUNT' ? groupRows.length : null;
    const values = groupRows.map((r) => evalExpr(arg, r, env)).filter((v) => v !== null && v !== undefined);
    switch (name) {
      case 'COUNT':
        return values.length;
      case 'COLLECT':
        return values;
      case 'SUM':
        return values.reduce((a, b) => a + Number(b), 0);
      case 'AVG': {
        if (!values.length) return null;
        return values.reduce((a, b) => a + Number(b), 0) / values.length;
      }
      case 'MIN': {
        if (!values.length) return null;
        return values.reduce((a, b) => (a < b ? a : b));
      }
      case 'MAX': {
        if (!values.length) return null;
        return values.reduce((a, b) => (a > b ? a : b));
      }
      default:
        return null;
    }
  }
  const args = (expr.args || []).map((a) => evalExpr(a, row, env));
  switch (name) {
    case 'LABELS':
      return isNode(args[0]) ? [...args[0].labels] : [];
    case 'TYPE':
      return isEdge(args[0]) ? args[0].type : null;
    case 'ID':
    case 'ELEMENTID':
      return args[0] && typeof args[0] === 'object' ? args[0].id : args[0];
    case 'KEYS':
      return args[0] && typeof args[0] === 'object' ? Object.keys(args[0].props || {}) : [];
    case 'SIZE':
    case 'LENGTH':
      if (Array.isArray(args[0])) return args[0].length;
      if (typeof args[0] === 'string') return args[0].length;
      return 0;
    case 'TOLOWER':
      return args[0] == null ? null : String(args[0]).toLowerCase();
    case 'TOUPPER':
      return args[0] == null ? null : String(args[0]).toUpperCase();
    case 'TRIM':
      return args[0] == null ? null : String(args[0]).trim();
    case 'COALESCE': {
      for (const a of args) if (a !== null && a !== undefined) return a;
      return null;
    }
    case 'ABS':
      return Math.abs(Number(args[0]));
    case 'ROUND':
      return Math.round(Number(args[0]));
    case 'FLOOR':
      return Math.floor(Number(args[0]));
    case 'CEIL':
      return Math.ceil(Number(args[0]));
    case 'EXISTS':
      return args[0] !== null && args[0] !== undefined;
    case 'STARTNODE':
      return isEdge(args[0]) ? env.store.getNode(args[0].from) : null;
    case 'ENDNODE':
      return isEdge(args[0]) ? env.store.getNode(args[0].to) : null;
    default:
      throw new CypherError(`지원하지 않는 함수입니다: ${name}()`, -1, env.source || '');
  }
}

/* =====================================================================
   4. 실행기
   ===================================================================== */
function evalMap(mapExpr, row, env) {
  const out = {};
  for (const [k, v] of Object.entries(mapExpr || {})) out[k] = evalExpr(v, row, env);
  return out;
}

function nodeMatches(node, pat, row, env) {
  if (!node) return false;
  for (const l of pat.labels) if (!node.labels.includes(l)) return false;
  if (pat.v && row[pat.v] && row[pat.v].id && row[pat.v].id !== node.id) return false;
  if (pat.props) {
    const want = evalMap(pat.props, row, env);
    for (const [k, v] of Object.entries(want)) {
      if (v === null) {
        if (node.props[k] !== undefined && node.props[k] !== null) return false;
      } else if (!looseEq(node.props[k], v)) return false;
    }
  }
  return true;
}

function edgeMatches(edge, seg, row, env) {
  if (seg.types.length && !seg.types.includes(edge.type)) return false;
  if (seg.props) {
    const want = evalMap(seg.props, row, env);
    for (const [k, v] of Object.entries(want)) if (!looseEq(edge.props[k], v)) return false;
  }
  return true;
}

function runMatchClause(store, clause, rows, env) {
  let current = rows;
  for (const part of clause.patterns) {
    const next = [];
    for (const row of current) {
      const matched = matchPattern2(store, part, row, env);
      for (const r of matched) next.push(r);
      if (next.length > env.maxRows * 5) {
        env.warnings.push(`결과 행이 ${next.length}개를 넘어 중단했습니다. LIMIT으로 줄여 보세요.`);
        break;
      }
    }
    current = next;
    if (!current.length) break;
  }
  if (clause.where) {
    current = current.filter((row) => truthy(evalExpr(clause.where, row, env)));
  }
  if (current.length > env.maxRows) {
    env.warnings.push(`결과 행이 최대치(${env.maxRows})를 넘어 잘렸습니다. ORDER BY/LIMIT으로 줄여 보세요.`);
    current = current.slice(0, env.maxRows);
  }
  return current;
}

/**
 * 노드 패턴 + 관계 세그먼트를 동시에 처리하는 매처.
 * 세그먼트마다 도착 노드 패턴을 검사하므로 `(a)-[:T]->(b:Label)` 이 정확히 동작한다.
 */
function matchPattern2(store, part, baseRow, env) {
  const { start, segs } = part;
  let states = [];
  const boundStart = start.v ? baseRow[start.v] : null;
  let candidates;
  if (boundStart && isNode(boundStart)) candidates = [boundStart];
  else if (start.labels.length) candidates = store.nodesByLabel(start.labels[0]);
  else candidates = store.allNodes();

  for (const cand of candidates) {
    if (!nodeMatches(cand, start, baseRow, env)) continue;
    const row = { ...baseRow };
    if (start.v) row[start.v] = cand;
    states.push({ row, current: cand, used: new Set() });
  }

  for (const seg of segs) {
    const nextStates = [];
    const max = Math.min(seg.max, 6);
    for (const st of states) {
      let frontier = [{ node: st.current, used: st.used, edges: [] }];
      for (let hop = 1; hop <= max; hop++) {
        const nf = [];
        for (const f of frontier) {
          for (const nb of store.neighbors(f.node.id, { dir: seg.direction, types: seg.types.length ? seg.types : null })) {
            if (f.used.has(nb.edge.id)) continue;
            if (!edgeMatches(nb.edge, seg, st.row, env)) continue;
            const used = new Set(f.used);
            used.add(nb.edge.id);
            const item = { node: nb.node, used, edges: [...f.edges, nb.edge] };
            nf.push(item);
            if (hop >= seg.min) {
              if (seg.toNode && !nodeMatches(nb.node, seg.toNode, st.row, env)) continue;
              const row = { ...st.row };
              if (seg.v) row[seg.v] = nb.edge;
              if (seg.toNode && seg.toNode.v) row[seg.toNode.v] = nb.node;
              nextStates.push({ row, current: nb.node, used });
            }
          }
        }
        frontier = nf;
        if (!frontier.length) break;
      }
      if (nextStates.length > env.maxStates) {
        env.warnings.push('탐색 경로가 너무 많아 일부를 생략했습니다. LIMIT을 추가하세요.');
        break;
      }
    }
    states = nextStates;
    if (!states.length) break;
  }
  return states.map((s) => s.row);
}

function createPath(store, part, row, env, stats) {
  const nodes = part.nodes || [part.start];
  let current = row;
  let prev = null;
  let prevSeg = null;

  for (let i = 0; i < nodes.length; i++) {
    const np = nodes[i];
    let node = null;
    if (np.v && current[np.v] && isNode(current[np.v])) {
      node = current[np.v];
      for (const l of np.labels) if (!node.labels.includes(l)) store._indexLabel(node.id, l);
      if (np.props) Object.assign(node.props, evalMap(np.props, current, env));
    } else {
      const props = np.props ? evalMap(np.props, current, env) : {};
      const forcedId = props.id != null ? String(props.id) : undefined;
      node = store.addNode({ id: forcedId, labels: np.labels, props });
      stats.nodesCreated++;
      env.touched.add(node);
    }
    if (np.v) current = { ...current, [np.v]: node };

    if (prev) {
      const seg = prevSeg;
      const type = seg.types[0];
      if (!type) throw new CypherError('관계를 생성하려면 타입이 필요합니다: 예) -[:BOUGHT]->');
      const props = seg.props ? evalMap(seg.props, current, env) : {};
      const realFrom = seg.direction === 'in' ? node : prev;
      const realTo = seg.direction === 'in' ? prev : node;
      const edge = store.addEdge({ from: realFrom.id, to: realTo.id, type, props });
      stats.relationshipsCreated++;
      env.touched.add(edge);
      if (seg.v) current = { ...current, [seg.v]: edge };
    }
    prev = node;
    prevSeg = part.segs[i];
  }
  return current;
}

function setClause(store, clause, rows, env, stats) {
  return rows.map((row) => {
    const next = { ...row };
    for (const item of clause.items) {
      const target = next[item.v];
      if (!target || typeof target !== 'object') {
        throw new CypherError(`SET 대상 '${item.v}'가 바인딩되어 있지 않습니다.`, -1, env.source || '');
      }
      if (item.prop) {
        const v = evalExpr(item.expr, next, env);
        if (v === null || v === undefined) delete target.props[item.prop];
        else target.props[item.prop] = v;
        stats.propertiesSet++;
      } else {
        const map = evalExpr(item.expr, next, env) || {};
        if (item.op === '+=') Object.assign(target.props, map);
        else target.props = { ...map };
        stats.propertiesSet += Object.keys(map).length;
      }
    }
    return next;
  });
}

function deleteClause(store, clause, rows, env, stats) {
  for (const row of rows) {
    for (const v of clause.vars) {
      const target = row[v];
      if (!target) continue;
      if (isNode(target)) {
        if (!clause.detach && store.degree(target.id) > 0) {
          throw new CypherError(
            `'${v}' 노드에 아직 관계가 남아 있어 삭제할 수 없습니다. DETACH DELETE를 사용하세요.`,
            -1,
            env.source || ''
          );
        }
        store.removeNode(target.id);
        stats.nodesDeleted++;
      } else if (isEdge(target)) {
        store.removeEdge(target.id);
        stats.relationshipsDeleted++;
      }
    }
  }
  return rows;
}

/* ---------- RETURN ---------- */
function runReturnClause(clause, rows, env) {
  if (clause.items.length === 1 && clause.items[0].expr.k === 'star') {
    const keys = new Set();
    for (const r of rows) for (const k of Object.keys(r)) if (!k.startsWith('__')) keys.add(k);
    clause = { ...clause, items: [...keys].map((k) => ({ expr: { k: 'var', name: k }, alias: k })) };
  }

  const hasAgg = clause.items.some((it) => containsAgg(it.expr));
  const projected = [];

  if (!hasAgg) {
    for (const row of rows) {
      const out = {};
      for (const item of clause.items) out[item.alias] = evalExpr(item.expr, row, env);
      projected.push({ out, src: row });
    }
  } else {
    const nonAgg = clause.items.filter((it) => !containsAgg(it.expr));
    const groups = new Map();
    for (const row of rows) {
      const keyParts = nonAgg.map((it) => JSON.stringify(normalizeForJson(evalExpr(it.expr, row, env))));
      const key = keyParts.join('\u0001');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    if (!rows.length && !nonAgg.length) {
      // 집계만 있고 행이 없을 때: count(*) = 0
      const out = {};
      for (const item of clause.items) out[item.alias] = evalExpr(item.expr, {}, env, []);
      projected.push({ out, src: {} });
    }
    for (const groupRows of Array.from(groups.values())) {
      const seed = groupRows[0] || {};
      const out = {};
      for (const item of clause.items) out[item.alias] = evalExpr(item.expr, seed, env, groupRows);
      projected.push({ out, src: seed });
    }
  }

  let list = projected;
  if (clause.distinct) {
    const seen = new Set();
    list = list.filter((p) => {
      const key = JSON.stringify(normalizeForJson(p.out));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  for (let i = clause.orderBy.length - 1; i >= 0; i--) {
    const ob = clause.orderBy[i];
    list = [...list].sort((a, b) => {
      const av = evalExpr(ob.expr, { ...a.src, ...a.out }, env);
      const bv = evalExpr(ob.expr, { ...b.src, ...b.out }, env);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return ob.desc ? -cmp : cmp;
    });
  }

  if (clause.skip) {
    const n = Number(evalExpr(clause.skip, {}, env));
    if (Number.isFinite(n)) list = list.slice(n);
  }
  if (clause.limit) {
    const n = Number(evalExpr(clause.limit, {}, env));
    if (Number.isFinite(n)) list = list.slice(0, n);
  }

  return {
    columns: clause.items.map((it) => it.alias),
    rows: list.map((p) => p.out),
  };
}

function normalizeForJson(v) {
  if (isNode(v)) return { __node: v.id };
  if (isEdge(v)) return { __edge: v.id };
  if (Array.isArray(v)) return v.map(normalizeForJson);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = normalizeForJson(val);
    return o;
  }
  return v;
}

/* ---------- 결과 그래프 수집 ---------- */
function collectGraph(values, store) {
  const nodes = new Map();
  const edges = new Map();
  const addValue = (v) => {
    if (isNode(v)) nodes.set(v.id, v);
    else if (isEdge(v)) {
      edges.set(v.id, v);
      const f = store.getNode(v.from);
      const t = store.getNode(v.to);
      if (f) nodes.set(f.id, f);
      if (t) nodes.set(t.id, t);
    } else if (Array.isArray(v)) v.forEach(addValue);
    else if (v && typeof v === 'object') Object.values(v).forEach(addValue);
  };
  values.forEach(addValue);
  return {
    nodes: [...nodes.values()].map((n) => ({
      id: n.id,
      label: n.props.name || n.props.title || n.props.label || n.props.id || n.id,
      group: n.labels[0] || 'default',
      props: n.props,
    })),
    edges: [...edges.values()].map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.props && e.props.label ? String(e.props.label) : undefined,
    })),
  };
}

/* ---------- 문장 분리 ---------- */
export function splitStatements(src) {
  const out = [];
  let buf = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      buf += c;
      if (c === '\\') {
        buf += src[i + 1] || '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      buf += c;
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') {
        buf += src[i];
        i++;
      }
      continue;
    }
    if (c === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * 쿼리 실행
 * @param {GraphStore} store
 * @param {string} source
 * @param {{params?:object, maxRows?:number}} options
 */
export function runCypher(store, source, options = {}) {
  const { params = {}, maxRows = 2000 } = options;
  const text = String(source || '').trim();
  if (!text) throw new CypherError('실행할 쿼리가 비어 있습니다.');
  const statements = splitStatements(text);
  if (!statements.length) throw new CypherError('실행할 쿼리가 비어 있습니다.');

  const total = {
    nodesCreated: 0,
    nodesDeleted: 0,
    relationshipsCreated: 0,
    relationshipsDeleted: 0,
    propertiesSet: 0,
  };
  const warnings = [];
  let last = null;
  const started = now();

  for (const stmt of statements) {
    const toks = tokenize(stmt);
    const parser = new Parser(toks, stmt);
    let clauses;
    try {
      clauses = parser.parseQuery();
    } catch (err) {
      if (err instanceof CypherError) {
        if (err.pos < 0) err.pos = parser.tok.pos;
        if (!err.source) err.source = stmt;
        throw err;
      }
      throw err;
    }

    const env = {
      store,
      params,
      maxRows,
      maxStates: 6000,
      warnings,
      source: stmt,
      touched: new Set(),
    };
    const stats = {
      nodesCreated: 0,
      nodesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      propertiesSet: 0,
    };

    let rows = [{}];
    let ret = null;
    for (const clause of clauses) {
      switch (clause.type) {
        case 'match':
          rows = runMatchClause(store, clause, rows, env);
          break;
        case 'create':
          for (const part of clause.patterns) rows = rows.map((row) => createPath(store, part, row, env, stats));
          break;
        case 'merge': {
          rows = rows.map((row) => {
            const matched = matchPattern2(store, clause.pattern, row, env);
            if (matched.length) return { ...row, ...matched[0] };
            return createPath(store, clause.pattern, row, env, stats);
          });
          break;
        }
        case 'set':
          rows = setClause(store, clause, rows, env, stats);
          break;
        case 'delete':
          rows = deleteClause(store, clause, rows, env, stats);
          break;
        case 'return':
          ret = runReturnClause(clause, rows, env);
          break;
        default:
          throw new CypherError(`처리할 수 없는 절: ${clause.type}`, -1, stmt);
      }
    }

    for (const k of Object.keys(total)) total[k] += stats[k];

    const finalRows = ret ? ret.rows : [];
    const columns = ret ? ret.columns : [];

    // 결과 그래프: RETURN에 등장한 엔티티 + 변경된 엔티티
    const graphValues = [];
    for (const r of finalRows) for (const v of Object.values(r)) graphValues.push(v);
    if (!ret) for (const t of env.touched) graphValues.push(t);
    else for (const t of env.touched) graphValues.push(t);

    last = {
      columns,
      rows: finalRows,
      resultGraph: collectGraph(graphValues, store),
      stats: { ...stats },
      warnings: [...new Set(warnings)],
      ms: Math.max(0.01, now() - started),
      statement: stmt,
      touchedCount: env.touched.size,
    };
  }

  last.stats = total;
  last.ms = Math.max(0.01, now() - started);
  return last;
}

export { GraphStore };
