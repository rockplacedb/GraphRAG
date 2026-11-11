/**
 * sqlDdl.js — “이미 운영 중인” 모두몰 PostgreSQL 스키마.
 * Lab 1(모델링 매핑)과 이론 페이지에서 그대로 인용한다.
 */

export const MODUMALL_DDL = `-- 모두몰 운영 DB (PostgreSQL 15) 일부 발췌
CREATE TABLE customers (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  grade         TEXT        NOT NULL DEFAULT 'NORMAL', -- VIP | NORMAL
  region        TEXT,
  joined_at     DATE        NOT NULL
);

CREATE TABLE categories (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL UNIQUE
);

CREATE TABLE suppliers (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  country       TEXT,
  risk_score    NUMERIC(3,2) NOT NULL DEFAULT 0,  -- 0.00 ~ 1.00
  lead_days     INTEGER     NOT NULL,
  contract_at   DATE
);

CREATE TABLE products (
  id            BIGSERIAL PRIMARY KEY,
  sku           TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  price         NUMERIC(12,2) NOT NULL,
  stock         INTEGER     NOT NULL DEFAULT 0,
  category_id   BIGINT      NOT NULL REFERENCES categories(id),
  supplier_id   BIGINT      NOT NULL REFERENCES suppliers(id)
);

CREATE TABLE orders (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   BIGINT      NOT NULL REFERENCES customers(id),
  ordered_at    TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL,  -- PAID | RETURNED | CANCELED
  amount        NUMERIC(12,2) NOT NULL
);

CREATE TABLE order_items (
  order_id      BIGINT      NOT NULL REFERENCES orders(id),
  product_id    BIGINT      NOT NULL REFERENCES products(id),
  quantity      INTEGER     NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE reviews (
  id            BIGSERIAL PRIMARY KEY,
  customer_id   BIGINT      NOT NULL REFERENCES customers(id),
  product_id    BIGINT      NOT NULL REFERENCES products(id),
  rating        SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT,
  created_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE returns (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT      NOT NULL REFERENCES orders(id),
  product_id    BIGINT      NOT NULL REFERENCES products(id),
  reason_code   TEXT        NOT NULL, -- DAMAGED | DEFECT | NOISE | FOREIGN | CHANGE_MIND
  status        TEXT        NOT NULL, -- ACCEPTED | REVIEWING | REJECTED
  created_at    TIMESTAMPTZ NOT NULL
);`;

export const TABLE_NOTES = [
  { table: 'customers', role: '노드 :Customer', note: '엔티티. 노드 :Customer 로 승격' },
  { table: 'categories', role: '노드 :Category', note: '엔티티(분류). 노드 :Category 또는 라벨로 흡수' },
  { table: 'suppliers', role: '노드 :Supplier', note: '엔티티. 노드 :Supplier — 리스크 전파의 시작점' },
  { table: 'products', role: '노드 :Product', note: '엔티티. 노드 :Product. category_id/supplier_id 는 FK → 관계' },
  { table: 'orders', role: '노드 :Order', note: '엔티티이자 “사건”. 노드 :Order' },
  { table: 'order_items', role: '관계 :CONTAINS', note: '조인 테이블. 노드가 아니라 (Order)-[:CONTAINS {qty, unitPrice}]->(Product) 관계로 펼친다' },
  { table: 'reviews', role: '노드 :Review', note: '엔티티(사건+내용). 노드 :Review. 작성자/대상은 관계로' },
  { table: 'returns', role: '노드 :Return', note: '엔티티(사건). 노드 :Return. 주문/상품과 관계로 연결' },
];

/** Lab 1 매핑 도구의 정답/힌트 데이터 */
export const MAPPING_TARGETS = [
  { id: 'Customer', kind: 'node', hint: '고객은 독립적으로 존재하는 사물입니다.' },
  { id: 'Category', kind: 'node', hint: '분류는 독립 엔티티로 두거나 Product 속성으로 흡수할 수 있습니다. 여기서는 노드로.' },
  { id: 'Supplier', kind: 'node', hint: '리스크 전파 분석의 시작점이므로 반드시 노드.' },
  { id: 'Product', kind: 'node', hint: '상품은 엔티티. sku 를 유니크 키로.' },
  { id: 'Order', kind: 'node', hint: '주문은 “사건”이지만 자체 속성(상태·금액·일자)이 많아 노드가 맞습니다.' },
  { id: 'OrderItem', kind: 'relation', hint: '조인 테이블은 관계로 펼칩니다. 수량·단가는 관계 속성으로.' },
  { id: 'Review', kind: 'node', hint: '리뷰는 작성자·대상·평점·본문을 가진 사건입니다.' },
  { id: 'Return', kind: 'node', hint: '반품도 사건. 사유 코드가 분석의 핵심 속성입니다.' },
];

export const MAPPING_SLOTS = [
  { key: 'customers', label: 'customers', accept: 'Customer' },
  { key: 'categories', label: 'categories', accept: 'Category' },
  { key: 'suppliers', label: 'suppliers', accept: 'Supplier' },
  { key: 'products', label: 'products', accept: 'Product' },
  { key: 'orders', label: 'orders', accept: 'Order' },
  { key: 'order_items', label: 'order_items', accept: 'OrderItem' },
  { key: 'reviews', label: 'reviews', accept: 'Review' },
  { key: 'returns', label: 'returns', accept: 'Return' },
];
