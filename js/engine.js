/* =========================================================================
   UNI Medical — 재고 분석 엔진
   소진 시점 예측 · 발주 시점/수량 추천 · 사용 패턴 기반 제품 추천
   (규칙 기반 데모. 실제 서비스에서는 거래처별 시계열 수요예측 모델로 대체.)
   ========================================================================= */

const LEAD_TIME_DAYS = 3;   // 발주 후 입고까지 리드타임(데모 가정)
const SAFETY_DAYS    = 2;   // 안전재고(일)

// 품목 1건에 대한 재고 상태 계산
function analyzeItem(item){
  const p = findProduct(item.sku);
  const daysLeft = item.dailyUse > 0 ? item.stock / item.dailyUse : Infinity;
  // 발주 권고 시점 = 소진일 - (리드타임 + 안전재고)
  const daysToReorder = daysLeft - (LEAD_TIME_DAYS + SAFETY_DAYS);

  let status;                      // ok | soon | now | out
  if (item.stock <= 0)                     status = "out";
  else if (item.stock <= item.reorderPoint) status = "now";
  else if (daysToReorder <= 3)              status = "soon";
  else                                      status = "ok";

  // 권장 발주량 = par(적정 최대재고)까지 채우되, 발주단위(pack)로 올림
  const gap = Math.max(item.parLevel - item.stock, 0);
  const suggestQty = gap > 0 ? Math.ceil(gap / p.pack) * p.pack : 0;

  return {
    ...item, product: p,
    daysLeft: isFinite(daysLeft) ? Math.round(daysLeft) : null,
    daysToReorder: isFinite(daysToReorder) ? Math.round(daysToReorder) : null,
    status, suggestQty,
    reorderDate: isFinite(daysToReorder) ? addDays(new Date(), daysToReorder) : null,
  };
}

function analyzeAccount(acc){
  return acc.inventory.map(analyzeItem)
    .sort((a,b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

// 지금 발주해야 하는(now/out) 품목만 추려 발주안 구성
function buildReorderPlan(analyzed){
  return analyzed
    .filter(x => x.status === "now" || x.status === "out")
    .map(x => ({ sku:x.sku, name:x.product.name, qty:x.suggestQty,
                 unit:x.product.unit, price:x.product.price,
                 subtotal:x.suggestQty * x.product.price }));
}

/* ---- 사용 패턴 기반 제품 추천 -------------------------------------------
   로직:
   1) 사용 중인 카테고리 비중을 계산 → 주력 카테고리 파악
   2) 아직 취급하지 않는 같은/인접 카테고리 제품을 후보로
   3) 회전이 빠른 품목의 상위 대체·업그레이드 제품을 우선 노출
   각 추천에 "근거(reason)"를 함께 반환 → 근거 있는 제안                       */
function recommendProducts(acc, analyzed){
  const owned = new Set(acc.inventory.map(i => i.sku));
  const catUse = {};                       // 카테고리별 일사용량 합
  analyzed.forEach(x => {
    catUse[x.product.cat] = (catUse[x.product.cat] || 0) + x.dailyUse;
  });
  const topCat = Object.entries(catUse).sort((a,b)=>b[1]-a[1])[0]?.[0];

  const recs = [];

  // (1) 주력 카테고리의 미취급 제품
  CATALOG.filter(p => p.cat === topCat && !owned.has(p.sku))
    .slice(0,2)
    .forEach(p => recs.push({
      product:p, tag:"주력군 확장",
      reason:`'${topCat}' 소모품 사용 비중이 가장 높습니다. 함께 쓰이는 ${p.name} 도입 시 결품 리스크를 낮출 수 있습니다.`,
    }));

  // (2) 빠르게 소진되는 품목의 인접 규격 제안 (교차판매)
  const fast = analyzed.filter(x=>x.dailyUse>=2).sort((a,b)=>b.dailyUse-a.dailyUse)[0];
  if (fast){
    const alt = CATALOG.find(p =>
      p.cat === fast.product.cat && !owned.has(p.sku) && p.sku !== fast.sku);
    if (alt) recs.push({
      product:alt, tag:"교차 판매",
      reason:`${fast.product.name} 회전이 빠릅니다(약 ${fast.dailyUse}/일). 인접 규격 ${alt.name} 를 함께 비치하면 대응 폭이 넓어집니다.`,
    });
  }

  // (3) 재활 상향 제안 (개인/2차 → 보조기 확대)
  if (acc.profile.tier !== "univ"){
    const up = CATALOG.find(p => p.cat==="재활" && !owned.has(p.sku));
    if (up) recs.push({
      product:up, tag:"상향 판매",
      reason:`재활 수요가 있는 거래처에서 ${up.name} 취급 시 환자 회전당 객단가를 높일 수 있습니다.`,
    });
  }

  // 중복 제거
  const seen = new Set();
  return recs.filter(r => !seen.has(r.product.sku) && seen.add(r.product.sku)).slice(0,3);
}

// ---- 유틸 ----------------------------------------------------------------
function addDays(d, n){ const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function fmtDate(d){
  if(!d) return "—";
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}
function won(n){ return "₩" + n.toLocaleString("ko-KR"); }
