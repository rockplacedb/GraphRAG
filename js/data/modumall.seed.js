/**
 * modumall.seed.js — 모두몰(MODUMALL) 도메인 시드 데이터.
 * 실제 PostgreSQL에서 운영 중이라는 설정으로, 모든 노드에 사람이 읽을 수 있는 id 속성을 둔다.
 * 생성 규칙은 결정적이다(무작위 없음) → 수업/실습에서 항상 같은 결과.
 */
import { GraphStore } from '../engine/graph-store.js';

export const CUSTOMERS = [
  { id: 'c1', name: '김하늘', grade: 'VIP', region: '서울', joined: '2023-03-11' },
  { id: 'c2', name: '이도윤', grade: 'NORMAL', region: '경기', joined: '2023-07-02' },
  { id: 'c3', name: '박서연', grade: 'VIP', region: '부산', joined: '2022-11-19' },
  { id: 'c4', name: '최민준', grade: 'NORMAL', region: '서울', joined: '2024-01-08' },
  { id: 'c5', name: '정하윤', grade: 'VIP', region: '인천', joined: '2023-05-27' },
  { id: 'c6', name: '강지호', grade: 'NORMAL', region: '대전', joined: '2024-02-14' },
  { id: 'c7', name: '윤서아', grade: 'NORMAL', region: '서울', joined: '2023-09-30' },
  { id: 'c8', name: '임도현', grade: 'VIP', region: '대구', joined: '2022-08-05' },
  { id: 'c9', name: '한지민', grade: 'NORMAL', region: '광주', joined: '2024-03-21' },
  { id: 'c10', name: '오세준', grade: 'NORMAL', region: '서울', joined: '2023-12-03' },
  { id: 'c11', name: '신유나', grade: 'VIP', region: '경기', joined: '2024-04-09' },
  { id: 'c12', name: '배준서', grade: 'NORMAL', region: '부산', joined: '2022-12-17' },
];

export const CATEGORIES = [
  { id: 'cat-audio', name: '오디오' },
  { id: 'cat-power', name: '전원' },
  { id: 'cat-acc', name: '액세서리' },
  { id: 'cat-computer', name: '컴퓨터 주변기기' },
  { id: 'cat-home', name: '데스크' },
];

export const SUPPLIERS = [
  { id: 's1', name: '한빛전자', country: '한국', riskScore: 0.18, leadDays: 7, contract: '2023-01-15' },
  { id: 's2', name: '대성테크', country: '중국', riskScore: 0.62, leadDays: 21, contract: '2022-06-01' },
  { id: 's3', name: '파워넷', country: '한국', riskScore: 0.31, leadDays: 10, contract: '2023-04-20' },
  { id: 's4', name: '데스크랩', country: '베트남', riskScore: 0.47, leadDays: 14, contract: '2023-09-12' },
];

export const PRODUCTS = [
  { id: 'p1', name: '무선 이어폰', price: 89000, category: 'cat-audio', supplier: 's1', stock: 320 },
  { id: 'p2', name: '블루투스 스피커', price: 129000, category: 'cat-audio', supplier: 's1', stock: 84 },
  { id: 'p3', name: '노이즈캔슬링 헤드폰', price: 289000, category: 'cat-audio', supplier: 's2', stock: 41 },
  { id: 'p4', name: '보조 배터리 10000mAh', price: 32000, category: 'cat-power', supplier: 's3', stock: 512 },
  { id: 'p5', name: '65W 고속 충전기', price: 45000, category: 'cat-power', supplier: 's3', stock: 240 },
  { id: 'p6', name: 'USB-C 케이블', price: 9000, category: 'cat-acc', supplier: 's3', stock: 1200 },
  { id: 'p7', name: '노트북 파우치', price: 21000, category: 'cat-acc', supplier: 's4', stock: 180 },
  { id: 'p8', name: '무선 마우스', price: 39000, category: 'cat-computer', supplier: 's2', stock: 260 },
  { id: 'p9', name: '기계식 키보드', price: 119000, category: 'cat-computer', supplier: 's2', stock: 96 },
  { id: 'p10', name: '모니터 받침대', price: 34000, category: 'cat-home', supplier: 's4', stock: 140 },
  { id: 'p11', name: '스마트 플러그', price: 25000, category: 'cat-home', supplier: 's4', stock: 300 },
  { id: 'p12', name: '4K 웹캠', price: 159000, category: 'cat-computer', supplier: 's1', stock: 58 },
  { id: 'p13', name: '휴대용 SSD 1TB', price: 139000, category: 'cat-computer', supplier: 's2', stock: 77 },
  { id: 'p14', name: '스탠드 조명', price: 52000, category: 'cat-home', supplier: 's4', stock: 64 },
];

const PRICE = new Map(PRODUCTS.map((p) => [p.id, p.price]));

/** 주문: 고객, 날짜, 상태, 포함 상품 */
export const ORDERS = [
  { id: 'o1001', customer: 'c1', date: '2024-05-02', status: 'PAID', items: ['p1'] },
  { id: 'o1002', customer: 'c2', date: '2024-05-03', status: 'PAID', items: ['p4', 'p6'] },
  { id: 'o1003', customer: 'c3', date: '2024-05-05', status: 'PAID', items: ['p3'] },
  { id: 'o1004', customer: 'c1', date: '2024-05-09', status: 'PAID', items: ['p1', 'p4'] },
  { id: 'o1005', customer: 'c4', date: '2024-05-12', status: 'RETURNED', items: ['p2'] },
  { id: 'o1006', customer: 'c5', date: '2024-05-14', status: 'PAID', items: ['p8', 'p9'] },
  { id: 'o1007', customer: 'c6', date: '2024-05-16', status: 'PAID', items: ['p13'] },
  { id: 'o1008', customer: 'c7', date: '2024-05-18', status: 'PAID', items: ['p5'] },
  { id: 'o1009', customer: 'c2', date: '2024-05-21', status: 'PAID', items: ['p1', 'p7'] },
  { id: 'o1010', customer: 'c8', date: '2024-05-24', status: 'PAID', items: ['p3', 'p13'] },
  { id: 'o1011', customer: 'c9', date: '2024-05-26', status: 'RETURNED', items: ['p14'] },
  { id: 'o1012', customer: 'c10', date: '2024-05-28', status: 'PAID', items: ['p12'] },
  { id: 'o1013', customer: 'c5', date: '2024-06-01', status: 'PAID', items: ['p10', 'p11'] },
  { id: 'o1014', customer: 'c11', date: '2024-06-03', status: 'RETURNED', items: ['p3'] },
  { id: 'o1015', customer: 'c12', date: '2024-06-05', status: 'PAID', items: ['p4', 'p5'] },
  { id: 'o1016', customer: 'c1', date: '2024-06-08', status: 'PAID', items: ['p6'] },
  { id: 'o1017', customer: 'c4', date: '2024-06-10', status: 'PAID', items: ['p1', 'p8'] },
  { id: 'o1018', customer: 'c8', date: '2024-06-12', status: 'PAID', items: ['p2'] },
];

export const REVIEWS = [
  { id: 'r1', customer: 'c1', product: 'p1', rating: 5, date: '2024-05-06', text: '음질이 좋고 착용감도 편해요' },
  { id: 'r2', customer: 'c2', product: 'p4', rating: 4, date: '2024-05-07', text: '가볍고 충전이 빨라요' },
  { id: 'r3', customer: 'c3', product: 'p3', rating: 5, date: '2024-05-08', text: '노이즈캔슬링이 기대 이상입니다' },
  { id: 'r4', customer: 'c4', product: 'p2', rating: 2, date: '2024-05-15', text: '일주일 만에 전원이 안 들어옵니다' },
  { id: 'r5', customer: 'c5', product: 'p8', rating: 4, date: '2024-05-17', text: '무난합니다' },
  { id: 'r6', customer: 'c6', product: 'p13', rating: 5, date: '2024-05-19', text: '속도가 빠르고 발열이 적어요' },
  { id: 'r7', customer: 'c7', product: 'p5', rating: 3, date: '2024-05-20', text: '발열이 조금 있습니다' },
  { id: 'r8', customer: 'c8', product: 'p3', rating: 4, date: '2024-05-25', text: '소음은 좋은데 무겁습니다' },
  { id: 'r9', customer: 'c9', product: 'p14', rating: 1, date: '2024-05-27', text: '박스가 찌그러져 왔고 조명이 깜빡입니다' },
  { id: 'r10', customer: 'c1', product: 'p4', rating: 5, date: '2024-05-11', text: '두 번째 구매입니다' },
];

export const RETURNS = [
  { id: 'ret1', order: 'o1005', product: 'p2', reason: '파손', date: '2024-05-16', status: 'ACCEPTED' },
  { id: 'ret2', order: 'o1011', product: 'p14', reason: '불량(깜빡임)', date: '2024-05-29', status: 'ACCEPTED' },
  { id: 'ret3', order: 'o1014', product: 'p3', reason: '소음', date: '2024-06-06', status: 'REVIEWING' },
  { id: 'ret4', order: 'o1003', product: 'p3', reason: '단순 변심', date: '2024-05-10', status: 'REJECTED' },
  { id: 'ret5', order: 'o1009', product: 'p1', reason: '이물질', date: '2024-05-24', status: 'ACCEPTED' },
];

const orderAmount = (items) => items.reduce((sum, pid) => sum + (PRICE.get(pid) || 0), 0);

/** @returns {{nodes: Array, edges: Array}} */
export function modumallSeed() {
  const nodes = [];
  const edges = [];

  for (const c of CUSTOMERS) nodes.push({ id: c.id, labels: ['Customer'], props: { ...c } });
  for (const cat of CATEGORIES) nodes.push({ id: cat.id, labels: ['Category'], props: { ...cat } });
  for (const s of SUPPLIERS) nodes.push({ id: s.id, labels: ['Supplier'], props: { ...s } });
  for (const p of PRODUCTS) {
    nodes.push({ id: p.id, labels: ['Product'], props: { id: p.id, name: p.name, price: p.price, stock: p.stock } });
    edges.push({ id: `${p.id}-IN_CATEGORY-${p.category}`, type: 'IN_CATEGORY', from: p.id, to: p.category });
    edges.push({ id: `${p.id}-SUPPLIED_BY-${p.supplier}`, type: 'SUPPLIED_BY', from: p.id, to: p.supplier });
  }
  for (const o of ORDERS) {
    nodes.push({
      id: o.id,
      labels: ['Order'],
      props: { id: o.id, amount: orderAmount(o.items), status: o.status, date: o.date, itemCount: o.items.length },
    });
    edges.push({ id: `${o.customer}-PLACED-${o.id}`, type: 'PLACED', from: o.customer, to: o.id });
    for (const pid of o.items) edges.push({ id: `${o.id}-CONTAINS-${pid}`, type: 'CONTAINS', from: o.id, to: pid });
  }
  for (const r of REVIEWS) {
    nodes.push({ id: r.id, labels: ['Review'], props: { id: r.id, name: `리뷰 ★${r.rating}`, rating: r.rating, text: r.text, date: r.date } });
    edges.push({ id: `${r.customer}-WROTE-${r.id}`, type: 'WROTE', from: r.customer, to: r.id });
    edges.push({ id: `${r.id}-REVIEWS-${r.product}`, type: 'REVIEWS', from: r.id, to: r.product });
  }
  for (const ret of RETURNS) {
    nodes.push({ id: ret.id, labels: ['Return'], props: { ...ret, name: `반품: ${ret.reason}` } });
    edges.push({ id: `${ret.order}-HAS_RETURN-${ret.id}`, type: 'HAS_RETURN', from: ret.order, to: ret.id });
    edges.push({ id: `${ret.id}-FOR_PRODUCT-${ret.product}`, type: 'FOR_PRODUCT', from: ret.id, to: ret.product });
  }

  return { nodes, edges };
}

export function seedGraphStore() {
  return new GraphStore(modumallSeed());
}

/** 고객별 지출 요약(대시보드/시각화용) */
export function customerSpend() {
  const map = new Map(CUSTOMERS.map((c) => [c.id, { id: c.id, name: c.name, grade: c.grade, amount: 0, orders: 0 }]));
  for (const o of ORDERS) {
    const rec = map.get(o.customer);
    if (!rec) continue;
    rec.amount += orderAmount(o.items);
    rec.orders += 1;
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/** 상품별 판매 수량/매출(PageRank 해석용) */
export function productSales() {
  const map = new Map(PRODUCTS.map((p) => [p.id, { id: p.id, name: p.name, qty: 0, amount: 0, category: p.category }]));
  for (const o of ORDERS) {
    if (o.status === 'RETURNED') continue;
    for (const pid of o.items) {
      const rec = map.get(pid);
      if (!rec) continue;
      rec.qty += 1;
      rec.amount += PRICE.get(pid) || 0;
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

export const SEED_META = {
  nodes: CUSTOMERS.length + CATEGORIES.length + SUPPLIERS.length + PRODUCTS.length + ORDERS.length + REVIEWS.length + RETURNS.length,
  edges:
    PRODUCTS.length * 2 +
    ORDERS.length +
    ORDERS.reduce((n, o) => n + o.items.length, 0) +
    REVIEWS.length * 2 +
    RETURNS.length * 2,
  counts: {
    Customer: CUSTOMERS.length,
    Product: PRODUCTS.length,
    Category: CATEGORIES.length,
    Supplier: SUPPLIERS.length,
    Order: ORDERS.length,
    Review: REVIEWS.length,
    Return: RETURNS.length,
  },
};

/** 실습 공통 시나리오 메타 */
export const SCENARIO = {
  company: '모두몰',
  companyEn: 'MODUMALL',
  industry: '생활가전·IT 액세서리 온라인 쇼핑몰',
  database: 'PostgreSQL 15 (운영 중)',
  scale: '고객 12명 · 상품 14개 · 주문 18건 (샘플 슬라이스)',
  questions: [
    { id: 'R1', title: '함께 구매 추천', desc: '“이 상품을 산 고객이 함께 산 상품”을 2홉으로 추천. RDB에서는 self-join + group by가 중첩된다.' },
    { id: 'R2', title: '반품 연쇄 추적', desc: '반품 사유 → 주문 → 상품 → 공급사까지 한 번에 따라가 원인 후보를 좁힌다.' },
    { id: 'R3', title: '공급사 리스크 전파', desc: '특정 공급사의 상품이 걸린 주문·고객·리뷰를 3홉 이내에서 모아 영향 범위를 파악한다.' },
  ],
};
