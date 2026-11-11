/**
 * code.js — 의존성 없는 구문 강조기.
 * Cypher / SQL / SPARQL / Turtle / Bash / JSON 정도만 지원하면 충분하다.
 * (CDN 하이라이터를 쓰지 않아 오프라인에서도 동일하게 보인다)
 */

const KW = {
  cypher: `MATCH OPTIONAL WHERE RETURN CREATE MERGE DELETE DETACH SET REMOVE WITH UNWIND
    ORDER BY SKIP LIMIT AS DISTINCT AND OR NOT IN IS NULL TRUE FALSE STARTS ENDS CONTAINS
    CALL YIELD USE UNION ALL ASC DESC EXISTS CASE WHEN THEN ELSE END FOREACH ON CONSTRAINT
    INDEX DROP REQUIRE UNIQUE NODE RELATIONSHIP PROPERTY LOAD CSV FROM HEADERS FIELDTERMINATOR
    RANGE SHOW PROFILES PROFILE EXPLAIN`,
  sql: `SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER FULL CROSS ON USING GROUP BY ORDER HAVING
    LIMIT OFFSET INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX VIEW PRIMARY KEY
    FOREIGN REFERENCES WITH RECURSIVE UNION ALL AS AND OR NOT NULL IS IN DISTINCT EXISTS
    CASE WHEN THEN ELSE END CONSTRAINT CHECK CASCADE DEFAULT EXPLAIN ANALYZE VACUUM
    INTEGER BIGINT TEXT VARCHAR NUMERIC BOOLEAN TIMESTAMP TIMESTAMPTZ DATE SERIAL UUID
    COUNT SUM AVG MIN MAX COALESCE ROW_NUMBER OVER PARTITION GENERATED ALWAYS IDENTITY
    BEGIN COMMIT ROLLBACK TRUNCATE ALTER ADD COLUMN DROP CASCADE IF`,
  sparql: `PREFIX SELECT WHERE FILTER DISTINCT REDUCED OPTIONAL UNION ASK CONSTRUCT DESCRIBE
    GRAPH SERVICE BIND VALUES ORDER BY LIMIT OFFSET GROUP HAVING STR STRLEN ASC DESC
    COUNT SUM AVG MIN MAX EXISTS NOT IN AS FROM NAMED INSERT DELETE DATA WITH USING
    a true false BIND`,
  turtle: `PREFIX BASE a true false`,
  bash: `docker run --rm -d --name -p -v neo4j start stop ps logs exec cypher-shell
    curl echo cd ls cat export npm node server http`,
  json: `true false null`,
};

const RULES = {
  cypher: [
    { cls: 'tok-com', re: `//[^\\n]*` },
    { cls: 'tok-str', re: `'(?:\\\\.|[^'\\\\])*'|"(?:\\\\.|[^"\\\\])*"` },
    { cls: 'tok-bool', re: `\\b(?:TRUE|FALSE|NULL)\\b` },
    { cls: 'tok-kw', re: `\\b(?:${KW.cypher.split(/\s+/).join('|')})\\b` },
    { cls: 'tok-fn', re: `\\b(?:count|collect|labels|type|id|elementId|keys|properties|size|length|nodes|relationships|toLower|toUpper|substring|trim|split|abs|round|ceil|floor|coalesce|exists|startNode|endNode|duration|date|datetime|point|apoc)\\b(?=\\s*\\()` },
    { cls: 'tok-lbl', re: `:[A-Za-z_가-힣][\\w가-힣]*` },
    { cls: 'tok-num', re: `\\b\\d+(?:\\.\\d+)?\\b` },
    { cls: 'tok-punc', re: `[-\\[\\](){}<>|,;=*.$]+` },
    { cls: 'tok-var', re: `[A-Za-z_가-힣][\\w가-힣]*` },
  ],
  sql: [
    { cls: 'tok-com', re: `--[^\\n]*|/\\*[\\s\\S]*?\\*/` },
    { cls: 'tok-str', re: `'(?:''|[^'])*'` },
    { cls: 'tok-kw', re: `\\b(?:${KW.sql.split(/\s+/).join('|')})\\b` },
    { cls: 'tok-fn', re: `\\b[A-Za-z_][\\w]*(?=\\s*\\()` },
    { cls: 'tok-num', re: `\\b\\d+(?:\\.\\d+)?\\b` },
    { cls: 'tok-lbl', re: `\\$\\d+` },
    { cls: 'tok-punc', re: `[()\\[\\],;.*=<>+\\-|]+` },
    { cls: 'tok-var', re: `[A-Za-z_가-힣][\\w가-힣]*` },
  ],
  sparql: [
    { cls: 'tok-com', re: `#[^\\n]*` },
    { cls: 'tok-str', re: `"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'` },
    { cls: 'tok-kw', re: `\\b(?:${KW.sparql.split(/\s+/).join('|')})\\b` },
    { cls: 'tok-lbl', re: `<[^>\\s]+>|\\b(?:ex|rdf|rdfs|owl|xsd|sh|schema|foaf|skos):[\\w-]+` },
    { cls: 'tok-var', re: `\\?[\\w가-힣]+|[A-Za-z_][\\w가-힣]*` },
    { cls: 'tok-punc', re: `[{}()\\[\\].,;*]|=` },
  ],
  turtle: [
    { cls: 'tok-com', re: `#[^\\n]*` },
    { cls: 'tok-str', re: `"""(?:[\\s\\S]*?)"""|"(?:\\\\.|[^"\\\\])*"` },
    { cls: 'tok-kw', re: `@prefix|@base|\\b(?:a|PREFIX|BASE)\\b` },
    { cls: 'tok-lbl', re: `<[^>\\s]+>|\\b(?:ex|rdf|rdfs|owl|xsd|sh|skos|schema):[\\w-]+` },
    { cls: 'tok-punc', re: `[.;,\\[\\]()]` },
    { cls: 'tok-var', re: `[A-Za-z_가-힣][\\w가-힣]*` },
  ],
  bash: [
    { cls: 'tok-com', re: `#[^\\n]*` },
    { cls: 'tok-str', re: `"(?:\\\\.|[^"\\\\])*"|'(?:[^'])*'` },
    { cls: 'tok-kw', re: `\\b(?:${KW.bash.split(/\s+/).join('|')})\\b` },
    { cls: 'tok-var', re: `\\$\\w+|--?[\\w-]+` },
    { cls: 'tok-num', re: `\\b\\d+\\b` },
    { cls: 'tok-punc', re: `[|&;<>()=]` },
  ],
  json: [
    { cls: 'tok-str', re: `"(?:\\\\.|[^"\\\\])*"` },
    { cls: 'tok-bool', re: `\\b(?:true|false|null)\\b` },
    { cls: 'tok-num', re: `-?\\b\\d+(?:\\.\\d+)?\\b` },
    { cls: 'tok-punc', re: `[{}[\\]:,]` },
  ],
  text: [],
};

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const compiled = new Map();
function compile(lang) {
  if (compiled.has(lang)) return compiled.get(lang);
  const rules = RULES[lang] || [];
  let re = null;
  if (rules.length) {
    const src = rules.map((r) => `(${r.re})`).join('|');
    re = new RegExp(src, 'gi');
  }
  const out = { rules, re };
  compiled.set(lang, out);
  return out;
}

/** 코드 문자열을 강조된 HTML로 변환 */
export function highlight(code, lang = 'text') {
  const { rules, re } = compile(lang);
  if (!re) return esc(code);
  let out = '';
  let last = 0;
  re.lastIndex = 0;
  let m;
  let guard = 0;
  while ((m = re.exec(code)) !== null && guard++ < 20000) {
    if (m.index > last) out += esc(code.slice(last, m.index));
    let cls = null;
    let text = m[0];
    for (let gi = 1; gi <= rules.length; gi++) {
      if (m[gi] !== undefined) {
        cls = rules[gi - 1].cls;
        text = m[gi];
        break;
      }
    }
    out += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  out += esc(code.slice(last));
  return out;
}

/** 언어 표시 이름 */
export const LANG_LABEL = {
  cypher: 'Cypher',
  sql: 'SQL',
  sparql: 'SPARQL',
  turtle: 'Turtle',
  bash: 'Shell',
  json: 'JSON',
  text: 'Text',
};
