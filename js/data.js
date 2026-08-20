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
