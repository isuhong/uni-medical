/* =========================================================================
   UNI Medical — VMI 재고 관리 데모 데이터
   실제 유엔아이메디컬 취급군(비침습 고정·압박·재활 소모품)을 기반으로 구성한
   데모용 카탈로그 및 3개 거래처(대학병원 / 2차병원 / 개인의원) 시나리오.
   * 데모/포트폴리오 목적의 가상 데이터입니다.
   ========================================================================= */

// ---- 제품 카탈로그 (유엔아이메디컬 취급군 기반) ------------------------------
const CATALOG = [
  // 고정 (Fixation / Casting)
  { sku:"UNI-CB-3040", name:"캐스트 밴드 (유리섬유) 4in", cat:"고정",   unit:"롤",  price:3200,  pack:10 },
  { sku:"UNI-CB-3020", name:"캐스트 밴드 (유리섬유) 2in", cat:"고정",   unit:"롤",  price:2600,  pack:10 },
  { sku:"UNI-SC-1100", name:"소프트 캐스트 언더패딩",       cat:"고정",   unit:"롤",  price:900,   pack:12 },
  { sku:"UNI-ST-2200", name:"스토키넷 (신축 튜브 붕대)",    cat:"고정",   unit:"롤",  price:1400,  pack:12 },
  { sku:"UNI-SP-5500", name:"알루미늄 핑거 스플린트",        cat:"고정",   unit:"개",  price:1800,  pack:20 },

  // 압박 (Compression)
  { sku:"UNI-EB-4010", name:"탄력 압박 붕대 4in",           cat:"압박",   unit:"롤",  price:1100,  pack:12 },
  { sku:"UNI-EB-4006", name:"탄력 압박 붕대 6in",           cat:"압박",   unit:"롤",  price:1500,  pack:12 },
  { sku:"UNI-CS-4400", name:"압박 스타킹 (무릎형)",          cat:"압박",   unit:"켤레",price:8900,  pack:5  },
  { sku:"UNI-CW-4700", name:"손목 압박 서포터",             cat:"압박",   unit:"개",  price:4200,  pack:10 },

  // 재활 (Rehab)
  { sku:"UNI-KB-6100", name:"무릎 보조기 (경첩형)",          cat:"재활",   unit:"개",  price:26000, pack:2  },
  { sku:"UNI-AB-6300", name:"발목 보조기 (에어형)",          cat:"재활",   unit:"개",  price:19000, pack:2  },
  { sku:"UNI-TB-6500", name:"허리 보조 벨트",               cat:"재활",   unit:"개",  price:15000, pack:4  },
  { sku:"UNI-RE-6800", name:"재활 저항 밴드 세트",          cat:"재활",   unit:"세트",price:6500,  pack:6  },

  // 일반 소모품 (Consumables)
  { sku:"UNI-GZ-7100", name:"멸균 거즈 4x4",               cat:"소모품", unit:"팩",  price:600,   pack:50 },
  { sku:"UNI-TP-7300", name:"의료용 종이테이프",            cat:"소모품", unit:"롤",  price:400,   pack:24 },
  { sku:"UNI-CW-7500", name:"소독 솜 (알코올)",            cat:"소모품", unit:"박스",price:2800,  pack:20 },
];

function findProduct(sku){ return CATALOG.find(p => p.sku === sku); }

// ---- 거래처(계정) --------------------------------------------------------
// dailyUse: 최근 실사용 추정 소진량(단위/일). 발주 예측의 기준값.
// stock: 현재 재고. lastOrder: 최근 발주일. addedDays: 마지막 입고 후 경과 관측 기준.
const ACCOUNTS = {
  // ===== 1. 대학병원 (대형, 다품목·고회전) =====
  "hy-univ": {
    password: "hanyang",
    profile: {
      name: "한양대학교병원",
      type: "대학병원 (3차)",
      tier: "univ",
      contact: "구매물류팀 · 정형외과 병동",
      region: "서울 성동구",
      beds: 850,
      since: "2019-03",
    },
    inventory: [
      { sku:"UNI-CB-3040", stock: 42,  dailyUse: 6.5, reorderPoint: 30, parLevel: 90 },
      { sku:"UNI-CB-3020", stock: 18,  dailyUse: 4.2, reorderPoint: 25, parLevel: 70 },
      { sku:"UNI-SC-1100", stock: 55,  dailyUse: 5.0, reorderPoint: 30, parLevel: 80 },
      { sku:"UNI-ST-2200", stock: 61,  dailyUse: 3.1, reorderPoint: 20, parLevel: 60 },
      { sku:"UNI-EB-4006", stock: 12,  dailyUse: 5.5, reorderPoint: 28, parLevel: 80 },
      { sku:"UNI-KB-6100", stock: 9,   dailyUse: 0.9, reorderPoint: 6,  parLevel: 20 },
      { sku:"UNI-AB-6300", stock: 14,  dailyUse: 1.2, reorderPoint: 8,  parLevel: 24 },
      { sku:"UNI-GZ-7100", stock: 120, dailyUse: 22.0,reorderPoint: 100,parLevel: 350 },
      { sku:"UNI-TP-7300", stock: 48,  dailyUse: 6.0, reorderPoint: 30, parLevel: 90 },
      { sku:"UNI-CS-4400", stock: 7,   dailyUse: 1.1, reorderPoint: 8,  parLevel: 24 },
    ],
    orderHistory: [
      { date:"2026-08-04", items:[["UNI-CB-3040",60],["UNI-GZ-7100",300]] },
      { date:"2026-07-21", items:[["UNI-EB-4006",70],["UNI-TP-7300",70]] },
      { date:"2026-07-07", items:[["UNI-CB-3040",60],["UNI-SC-1100",70]] },
    ],
  },

  // ===== 2. 2차병원 (중형, 정형·재활 집중) =====
  "semyung-2": {
    password: "semyung",
    profile: {
      name: "세명정형외과병원",
      type: "종합병원 (2차)",
      tier: "secondary",
      contact: "원무·구매 담당",
      region: "경기 안양시",
      beds: 180,
      since: "2021-06",
    },
    inventory: [
      { sku:"UNI-CB-3040", stock: 22,  dailyUse: 2.4, reorderPoint: 14, parLevel: 40 },
      { sku:"UNI-CB-3020", stock: 16,  dailyUse: 1.6, reorderPoint: 10, parLevel: 30 },
      { sku:"UNI-SP-5500", stock: 25,  dailyUse: 1.8, reorderPoint: 12, parLevel: 40 },
      { sku:"UNI-EB-4010", stock: 8,   dailyUse: 2.2, reorderPoint: 12, parLevel: 36 },
      { sku:"UNI-KB-6100", stock: 5,   dailyUse: 0.6, reorderPoint: 4,  parLevel: 12 },
      { sku:"UNI-AB-6300", stock: 11,  dailyUse: 0.8, reorderPoint: 5,  parLevel: 16 },
      { sku:"UNI-TB-6500", stock: 6,   dailyUse: 0.7, reorderPoint: 4,  parLevel: 12 },
      { sku:"UNI-RE-6800", stock: 19,  dailyUse: 1.0, reorderPoint: 8,  parLevel: 24 },
      { sku:"UNI-CW-4700", stock: 4,   dailyUse: 0.9, reorderPoint: 6,  parLevel: 20 },
      { sku:"UNI-GZ-7100", stock: 40,  dailyUse: 6.0, reorderPoint: 30, parLevel: 100 },
    ],
    orderHistory: [
      { date:"2026-08-01", items:[["UNI-RE-6800",24],["UNI-SP-5500",40]] },
      { date:"2026-07-14", items:[["UNI-CB-3040",40],["UNI-AB-6300",16]] },
    ],
  },

  // ===== 3. 개인의원 (소형, 단순 품목·저재고) =====
  "mirae-clinic": {
    password: "mirae",
    profile: {
      name: "미래정형외과의원",
      type: "개인의원 (1차)",
      tier: "clinic",
      contact: "간호실장",
      region: "부산 해운대구",
      beds: 0,
      since: "2023-02",
    },
    inventory: [
      { sku:"UNI-CB-3020", stock: 6,   dailyUse: 0.8, reorderPoint: 5,  parLevel: 16 },
      { sku:"UNI-SP-5500", stock: 10,  dailyUse: 0.6, reorderPoint: 5,  parLevel: 20 },
      { sku:"UNI-EB-4010", stock: 3,   dailyUse: 1.0, reorderPoint: 6,  parLevel: 18 },
      { sku:"UNI-CW-4700", stock: 5,   dailyUse: 0.4, reorderPoint: 4,  parLevel: 12 },
      { sku:"UNI-TB-6500", stock: 2,   dailyUse: 0.3, reorderPoint: 3,  parLevel: 8 },
      { sku:"UNI-GZ-7100", stock: 14,  dailyUse: 2.5, reorderPoint: 15, parLevel: 40 },
      { sku:"UNI-TP-7300", stock: 9,   dailyUse: 1.2, reorderPoint: 8,  parLevel: 24 },
      { sku:"UNI-CW-7500", stock: 5,   dailyUse: 0.7, reorderPoint: 5,  parLevel: 15 },
    ],
    orderHistory: [
      { date:"2026-08-08", items:[["UNI-GZ-7100",40],["UNI-TP-7300",24]] },
      { date:"2026-07-25", items:[["UNI-EB-4010",18]] },
    ],
  },
};

/* =========================================================================
   본사(유엔아이메디컬) 관제용 데이터
   - HQ_ACCOUNT: 본사 로그인 계정
   - FLEET: 관제 대시보드용 거래처 풀. 위 3개 상세 계정 + 요약형 거래처 다수.
     (실제로는 1,500개 거래처. 데모는 대표 12개 + 집계치로 표현)
   ========================================================================= */

const HQ_ACCOUNT = {
  password: "uni-hq",
  profile: {
    name: "유엔아이메디컬 (본사)",
    role: "VMI 운영본부",
    contact: "영업·물류관리팀",
    region: "경기 성남시 · 중앙물류센터",
  },
};

// 거래처 풀: 상세 3곳(위 ACCOUNTS와 id 연결) + 요약형 9곳
// status: healthy | watch | risk  (본사 관점 종합 신호)
// monthlyRevenue: 월 매출(원), openIssues: 미처리 문의 수
const FLEET = [
  { id:"hy-univ",      name:"한양대학교병원",   type:"대학병원", tier:"univ",
    region:"서울 성동구", skus:10, risk:3, watch:3, monthlyRevenue:8_420_000,
    turnover:9.2, fillRate:0.985, openIssues:1, status:"watch", detailed:true },
  { id:"semyung-2",    name:"세명정형외과병원", type:"2차병원", tier:"secondary",
    region:"경기 안양시", skus:10, risk:2, watch:2, monthlyRevenue:3_180_000,
    turnover:7.4, fillRate:0.972, openIssues:0, status:"watch", detailed:true },
  { id:"mirae-clinic", name:"미래정형외과의원", type:"개인의원", tier:"clinic",
    region:"부산 해운대구", skus:8, risk:2, watch:1, monthlyRevenue:940_000,
    turnover:6.1, fillRate:0.958, openIssues:0, status:"risk", detailed:true },

  { id:"c-004", name:"서울백년병원",       type:"2차병원", tier:"secondary",
    region:"서울 강서구", skus:14, risk:0, watch:1, monthlyRevenue:4_260_000,
    turnover:8.1, fillRate:0.991, openIssues:0, status:"healthy" },
  { id:"c-005", name:"우리정형외과의원",   type:"개인의원", tier:"clinic",
    region:"대구 수성구", skus:7,  risk:1, watch:2, monthlyRevenue:1_120_000,
    turnover:5.7, fillRate:0.949, openIssues:2, status:"risk" },
  { id:"c-006", name:"한빛종합병원",       type:"2차병원", tier:"secondary",
    region:"인천 남동구", skus:16, risk:0, watch:0, monthlyRevenue:5_010_000,
    turnover:8.8, fillRate:0.994, openIssues:0, status:"healthy" },
  { id:"c-007", name:"강남연세재활의원",   type:"개인의원", tier:"clinic",
    region:"서울 강남구", skus:9,  risk:0, watch:1, monthlyRevenue:1_680_000,
    turnover:6.9, fillRate:0.977, openIssues:1, status:"healthy" },
  { id:"c-008", name:"부산365병원",        type:"2차병원", tier:"secondary",
    region:"부산 부산진구", skus:13, risk:2, watch:1, monthlyRevenue:3_540_000,
    turnover:7.0, fillRate:0.961, openIssues:1, status:"watch" },
  { id:"c-009", name:"참사랑정형외과",     type:"개인의원", tier:"clinic",
    region:"광주 서구", skus:6,  risk:1, watch:0, monthlyRevenue:760_000,
    turnover:5.2, fillRate:0.945, openIssues:0, status:"risk" },
  { id:"c-010", name:"대전선병원",         type:"대학병원", tier:"univ",
    region:"대전 중구", skus:18, risk:1, watch:2, monthlyRevenue:7_890_000,
    turnover:9.0, fillRate:0.988, openIssues:0, status:"watch" },
  { id:"c-011", name:"굿모닝재활의원",     type:"개인의원", tier:"clinic",
    region:"경기 수원시", skus:8,  risk:0, watch:0, monthlyRevenue:1_340_000,
    turnover:7.2, fillRate:0.982, openIssues:0, status:"healthy" },
  { id:"c-012", name:"제일정형외과병원",   type:"2차병원", tier:"secondary",
    region:"울산 남구", skus:12, risk:0, watch:1, monthlyRevenue:2_960_000,
    turnover:7.8, fillRate:0.979, openIssues:1, status:"healthy" },
];

// 전체 거래처(데모 대표 외 나머지) 집계 — 대시보드 총계용
const FLEET_TOTALS = {
  totalAccounts: 1500,        // 전체 거래처 수
  activeThisMonth: 1418,      // 이번 달 발주 발생 거래처
  monthlyRevenue: 1_284_000_000, // 이번 달 누적 매출(원)
  avgFillRate: 0.976,         // 평균 발주 충족률
  wasteReduction: 0.34,       // 폐기 절감률(전년 대비)
  openIssues: 27,             // 전체 미처리 문의
};

// SKU별 수요·운영 지표(본사 제품 분석용)
const SKU_METRICS = [
  { sku:"UNI-GZ-7100", monthlyQty:214_000, trend:+0.08, accounts:1290, turnover:11.2, wasteRate:0.03, recWins:142 },
  { sku:"UNI-CB-3040", monthlyQty: 48_600, trend:+0.12, accounts: 870, turnover: 9.4, wasteRate:0.05, recWins:98 },
  { sku:"UNI-EB-4006", monthlyQty: 61_200, trend:-0.03, accounts: 940, turnover: 8.9, wasteRate:0.04, recWins:76 },
  { sku:"UNI-TP-7300", monthlyQty:132_500, trend:+0.02, accounts:1180, turnover:10.1, wasteRate:0.02, recWins:54 },
  { sku:"UNI-KB-6100", monthlyQty:  3_100, trend:+0.21, accounts: 410, turnover: 4.8, wasteRate:0.09, recWins:63 },
  { sku:"UNI-CS-4400", monthlyQty: 12_400, trend:+0.06, accounts: 520, turnover: 6.2, wasteRate:0.07, recWins:41 },
  { sku:"UNI-AB-6300", monthlyQty:  5_900, trend:+0.15, accounts: 480, turnover: 5.1, wasteRate:0.08, recWins:37 },
  { sku:"UNI-RE-6800", monthlyQty:  8_700, trend:+0.09, accounts: 610, turnover: 6.6, wasteRate:0.06, recWins:29 },
];

// 본사 인박스(거래처 → 본사 문의). 소통 기능의 본사측 뷰.
const HQ_INBOX = [
  { id:"m-101", account:"한양대학교병원",   cat:"품질 건의",   preview:"캐스트 밴드 절단면 거칠다는 병동 의견", time:"2시간 전", unread:true },
  { id:"m-102", account:"강남연세재활의원", cat:"신제품 요청", preview:"경량 발목 보조기 취급 가능한지 문의", time:"5시간 전", unread:true },
  { id:"m-103", account:"부산365병원",     cat:"배송/발주",   preview:"이번 주 정기 배송 일정 조정 요청",   time:"어제",     unread:false },
  { id:"m-104", account:"우리정형외과의원", cat:"제품 문의",   preview:"압박 스타킹 사이즈 규격표 요청",     time:"어제",     unread:false },
  { id:"m-105", account:"대전선병원",       cat:"품질 건의",   preview:"거즈 로트 일부 개봉 시 밀봉 불량",   time:"2일 전",   unread:false },
];

// AI 인사이트(본사 관제용 자동 생성 카드) — 데모용 규칙 기반 결과 예시
const AI_INSIGHTS = [
  { level:"risk",  title:"결품 위험 거래처 5곳",
    body:"미래정형외과의원 등 5개 거래처에서 3일 내 결품이 예측됩니다. 정기 배송 전 선제 발주를 권장합니다.",
    action:"대상 거래처 보기" },
  { level:"opportunity", title:"교차판매 기회 · 재활군",
    body:"재활 소모품 회전이 빠른 2차병원 8곳에 무릎 보조기(UNI-KB-6100) 도입 여지가 큽니다. 추천 성공률 최근 63건.",
    action:"추천 캠페인 만들기" },
  { level:"info", title:"폐기 절감 34% 달성",
    body:"AI 발주 적용 거래처의 유효기간 경과 폐기가 전년 대비 34% 감소했습니다. 미적용 거래처 82곳 전환 여지.",
    action:"미적용 거래처 보기" },
];
