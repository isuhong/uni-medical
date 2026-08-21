/* =========================================================================
   UNI Medical — 본사(HQ) VMI 관제 콘솔
   거래처 전체를 가로질러 보는 공급자 관점 뷰.
   탭: 관제 대시보드 · 거래처 관리 · 발주 파이프라인 · 제품·수요 분석 · 소통 인박스
   ========================================================================= */

let HQ_FILTER = "all";   // 거래처 상태 필터
let HQ_DRILL = null;     // 드릴다운으로 선택된 거래처 id
let HQ_THREAD = null;    // 인박스에서 열려 있는 대화의 거래처 id
let HQ_MSGS   = [];      // 소통 인박스 목록 (API.getInbox)
let HQ_THREAD_LOG = [];  // 열린 대화의 메시지
let HQ_SUB    = null;    // 실시간 구독 핸들
let HQ_FLEET = [];       // API.getFleet() 결과. data.js 의 FLEET 을 대체한다.

async function enterHQ(){
  document.getElementById("loginRoot").style.display = "none";
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("hqRoot").style.display = "";
  try {
    HQ_FLEET = await API.getFleet();
  } catch (e){
    HQ_FLEET = [];
    toast("거래처 목록을 불러오지 못했습니다.");
  }
  hqSwitchTab("overview");
}

async function hqSwitchTab(name){
  if (name !== "inbox") hqUnsub();
  document.querySelectorAll("#hqRoot .tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll("#hqRoot .view").forEach(v =>
    v.classList.toggle("active", v.id === "hq-"+name));
  if (name === "overview")  hqOverview();
  if (name === "accounts")  await hqAccounts();
  if (name === "pipeline")  hqPipeline();
  if (name === "stock")     await hqStock();
  if (name === "products")  hqProducts();
  if (name === "inbox")     await hqInbox();
}

/* ---------- 관제 대시보드 ---------- */
function hqOverview(){
  const t = FLEET_TOTALS;
  document.getElementById("hqStatAccounts").textContent = t.totalAccounts.toLocaleString();
  document.getElementById("hqStatActive").textContent   = t.activeThisMonth.toLocaleString();
  document.getElementById("hqStatRev").textContent      = "₩" + (t.monthlyRevenue/1e8).toFixed(1) + "억";
  document.getElementById("hqStatFill").textContent     = (t.avgFillRate*100).toFixed(1) + "%";

  // AI 인사이트 카드
  document.getElementById("hqInsights").innerHTML = AI_INSIGHTS.map(x=>`
    <div class="ai-card ${x.level}">
      <div class="ai-head">
        <span class="ai-dot ${x.level}"></span>
        <span class="ai-kicker">${aiKicker(x.level)}</span>
      </div>
      <div class="ai-title">${x.title}</div>
      <div class="ai-body">${x.body}</div>
      <button class="ai-action" onclick="hqSwitchTab('accounts')">${x.action} →</button>
    </div>`).join("");

  // 주의 필요 거래처 Top (risk 우선)
  const flagged = [...HQ_FLEET].filter(f=>f.status!=="healthy")
    .sort((a,b)=> statusRank(b.status)-statusRank(a.status) || b.risk-a.risk)
    .slice(0,6);
  document.getElementById("hqFlaggedRows").innerHTML = flagged.map(f=>`
    <tr onclick="hqDrill('${f.id}')" style="cursor:pointer">
      <td data-label="거래처"><div class="pname">${f.name}</div>
          <div class="sku">${f.type} · ${f.region}</div></td>
      <td class="num-cell" data-label="결품 위험">${f.risk}건</td>
      <td class="num-cell" data-label="임박">${f.watch}건</td>
      <td class="num-cell" data-label="충족률">${(f.fillRate*100).toFixed(1)}%</td>
      <td data-label="상태">${fleetPill(f.status)}</td>
    </tr>`).join("");
}
function aiKicker(l){ return {risk:"결품 리스크", opportunity:"매출 기회", info:"운영 성과"}[l]; }

/* ---------- 거래처 관리 ---------- */
async function hqAccounts(){
  // 드릴다운 상태면 상세 패널
  if (HQ_DRILL){ await hqAccountDetail(HQ_DRILL); return; }
  document.getElementById("hqAccountDetail").style.display = "none";
  document.getElementById("hqAccountList").style.display = "";

  const counts = {
    all: HQ_FLEET.length,
    risk: HQ_FLEET.filter(f=>f.status==="risk").length,
    watch: HQ_FLEET.filter(f=>f.status==="watch").length,
    healthy: HQ_FLEET.filter(f=>f.status==="healthy").length,
  };
  document.getElementById("hqFilterBar").innerHTML = ["all","risk","watch","healthy"]
    .map(k=>`<button class="chip ${HQ_FILTER===k?'on':''}" onclick="hqSetFilter('${k}')">
        ${filterLabel(k)} <b>${counts[k]}</b></button>`).join("");

  const rows = HQ_FLEET
    .filter(f => HQ_FILTER==="all" || f.status===HQ_FILTER)
    .sort((a,b)=> statusRank(b.status)-statusRank(a.status) || b.monthlyRevenue-a.monthlyRevenue)
    .map(f=>`
      <tr onclick="hqDrill('${f.id}')" style="cursor:pointer">
        <td data-label="거래처"><div class="pname">${f.name} ${f.detailed?'<span class="live-tag">실계정</span>':''}</div>
            <div class="sku">${f.type} · ${f.region}</div></td>
        <td class="num-cell" data-label="품목수">${f.skus}</td>
        <td class="num-cell" data-label="월 매출">${won(f.monthlyRevenue)}</td>
        <td class="num-cell" data-label="회전율">${f.turnover.toFixed(1)}</td>
        <td class="num-cell" data-label="충족률">${(f.fillRate*100).toFixed(1)}%</td>
        <td data-label="상태">${fleetPill(f.status)}</td>
      </tr>`).join("");
  document.getElementById("hqAccountRows").innerHTML = rows;
}
function hqSetFilter(k){ HQ_FILTER=k; hqAccounts(); }
function filterLabel(k){ return {all:"전체",risk:"위험",watch:"주의",healthy:"정상"}[k]; }

function hqDrill(id){ HQ_DRILL=id; hqSwitchTab("accounts"); }
function hqBackToList(){ HQ_DRILL=null; hqAccounts(); }

// 거래처 상세 — 실계정(accounts.is_live)이면 실제 재고까지 드릴다운
async function hqAccountDetail(id){
  const f = HQ_FLEET.find(x=>x.id===id);
  document.getElementById("hqAccountList").style.display = "none";
  const box = document.getElementById("hqAccountDetail");
  box.style.display = "";
  if (!f){ box.innerHTML = `<div class="empty">거래처를 찾을 수 없습니다.</div>`; return; }

  let inv = "";
  // 실계정(accounts.is_live)만 재고를 열람한다. 본사는 RLS 상 전 거래처를 읽을 수 있다.
  let analyzed = null;
  if (f.detailed){
    try { analyzed = analyzeAccount({ inventory: await API.getInventory(id) }); }
    catch (e){ analyzed = null; }
  }
  if (f.detailed && !analyzed){
    inv = `<div class="panel"><div class="empty">재고를 불러오지 못했습니다.</div></div>`;
  } else if (analyzed){
    inv = `
      <div class="panel">
        <div class="panel-head"><h3>실시간 재고 (본사 열람)</h3>
          <span class="spacer"></span><span class="ai-badge">AI 예측</span></div>
        <div class="table-scroll"><table>
          <thead><tr><th>제품</th><th style="text-align:right">현재고</th>
            <th style="text-align:right">일사용</th><th style="text-align:right">예상 소진</th>
            <th style="text-align:right">결품 위험</th><th>상태</th></tr></thead>
          <tbody>${analyzed.slice(0,8).map(x=>`
            <tr>
              <td data-label="제품"><div class="pname">${x.product.name}</div><div class="sku">${x.sku}</div></td>
              <td class="num-cell" data-label="현재고">${x.stock} ${x.product.unit}</td>
              <td class="num-cell" data-label="일사용">${x.dailyUse}/일</td>
              <td class="num-cell" data-label="예상 소진">${x.daysLeft ?? "—"}일</td>
              <td data-label="결품 위험">${riskMeter(x.stockoutProb)}</td>
              <td data-label="상태">${statusPill(x)}</td>
            </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  } else {
    inv = `<div class="panel"><div class="empty">이 거래처는 데모 요약 계정입니다.<br>
      실시간 재고 드릴다운은 실계정에서 확인할 수 있습니다.</div></div>`;
  }

  box.innerHTML = `
    <button class="back-btn" onclick="hqBackToList()">← 거래처 목록</button>
    <div class="detail-head">
      <div>
        <div class="detail-name">${f.name} ${fleetPill(f.status)}</div>
        <div class="detail-meta">${f.type} · ${f.region}</div>
      </div>
    </div>
    <div class="stat-grid" style="margin-bottom:22px">
      <div class="stat"><div class="num">${f.skus}</div><div class="lbl">관리 품목</div></div>
      <div class="stat alert"><div class="num">${f.risk}</div><div class="lbl">결품 위험</div></div>
      <div class="stat"><div class="num" style="font-size:20px">${won(f.monthlyRevenue)}</div><div class="lbl">월 매출</div></div>
      <div class="stat"><div class="num">${(f.fillRate*100).toFixed(1)}%</div><div class="lbl">발주 충족률</div></div>
    </div>
    ${inv}
    <div class="detail-actions">
      <button class="btn" style="width:auto;padding:11px 20px" onclick="toast('선제 발주 제안을 거래처에 전송했습니다.')">선제 발주 제안</button>
      <button class="btn ghost" style="width:auto;padding:11px 20px" onclick="hqMessageAccount('${f.id}')">메시지 보내기</button>
    </div>`;
}

/* ---------- 발주 파이프라인 ---------- */
function hqPipeline(){
  // HQ_FLEET 에서 발주 상태를 합성 (실계정은 실제 orderHistory 최신 반영)
  const rows = HQ_FLEET.map(f=>{
    const real = ACCOUNTS[f.id];
    const last = real?.orderHistory?.[0];
    const lastDate = last ? last.date : "—";
    const lastQty = last ? last.items.reduce((s,i)=>s+i[1],0) : Math.round(f.skus*8);
    // 파이프라인 단계: 위험군은 발주 대기, 나머지는 최근 처리/배송
    const stage = f.status==="risk" ? "발주 대기"
                : f.status==="watch" ? "배송 중" : "처리 완료";
    return { f, lastDate, lastQty, stage };
  }).sort((a,b)=> stageRank(a.stage)-stageRank(b.stage));

  const counts = {
    "발주 대기": rows.filter(r=>r.stage==="발주 대기").length,
    "배송 중":   rows.filter(r=>r.stage==="배송 중").length,
    "처리 완료": rows.filter(r=>r.stage==="처리 완료").length,
  };
  document.getElementById("hqPipeStats").innerHTML = `
    <div class="stat alert"><div class="num">${counts["발주 대기"]}</div><div class="lbl">발주 대기</div></div>
    <div class="stat warn"><div class="num">${counts["배송 중"]}</div><div class="lbl">배송 중</div></div>
    <div class="stat"><div class="num">${counts["처리 완료"]}</div><div class="lbl">처리 완료</div></div>
    <div class="stat"><div class="num">${(FLEET_TOTALS.wasteReduction*100).toFixed(0)}%</div><div class="lbl">폐기 절감(YoY)</div></div>`;

  document.getElementById("hqPipeRows").innerHTML = rows.map(r=>`
    <tr>
      <td data-label="거래처"><div class="pname">${r.f.name}</div>
          <div class="sku">${r.f.type} · ${r.f.region}</div></td>
      <td data-label="단계">${stagePill(r.stage)}</td>
      <td class="num-cell" data-label="최근 발주일">${r.lastDate}</td>
      <td class="num-cell" data-label="수량">${r.lastQty}</td>
      <td data-label="처리">${r.stage==="발주 대기"
        ? `<button class="mini-btn" onclick="toast('${r.f.name} 발주를 승인했습니다.')">승인</button>`
        : '<span class="sku">—</span>'}</td>
    </tr>`).join("");
}
function stageRank(s){ return {"발주 대기":0,"배송 중":1,"처리 완료":2}[s]; }

/* ---------- 실시간 재고 관리 ----------
   실제 운영 중인 '재고현황' 엑셀 시트와 같은 열 구성으로 만든 화면.
   품명 및 규격 · 재고수량 · 적정재고 · 발주 필요 · 입고 예정 · 사용량재고 · 월별 출고량
   - 재고수량: 실사 후 담당자가 직접 입력하는 칸
   - 발주 필요 / 입고 예정: 추천값이 채워지되 메모처럼 덮어쓸 수 있는 칸
   - 출고: 담당자가 거래처·품목·수량을 골라 등록한다. 재고수량에서 빠지고
     당월 출고량에 쌓인다. (실서비스에서는 WMS 출고 트랜잭션이 이 자리를 대체) */

const WH_PROPER_RATIO = 0.833;  // 적정재고 = 사용량재고 × 0.833 (엑셀 시트와 동일)

let WH_ITEMS        = [];   // API.getWarehouse() 결과. data.js 의 WAREHOUSE 를 대체한다.
let WH_MONTH_LABELS = [];   // API.getWarehouseMonths() 결과. data.js 의 WH_MONTHS 를 대체한다.

let WH_FILTER    = "all";
let WH_SHIPMENTS = [];   // 최근 출고 이력
let WH_TODAY_OUT = 0;    // 오늘 출고 수량 합계

// ---- 계산 (엑셀 수식과 같은 정의) ----
// 사용량재고 = 직전 완료 3개월 출고량 합.
// 배열 마지막은 당월이고 아직 안 끝났으므로 뺀다.
function whUse3(w){ return w.monthly.slice(0,-1).reduce((a,b)=>a+b,0); }
function whProper(w){ return Math.round(whUse3(w) * WH_PROPER_RATIO); }  // 적정재고
function whDaily(w){ return Math.round(whUse3(w) / 90); }   // 일 평균 출고
function whStatus(w){
  const p = whProper(w);
  if (w.stock <= 0)      return "out";
  if (w.stock < p)       return "now";
  if (w.stock < p * 1.2) return "soon";
  return "ok";
}
function whPill(s){
  const label = { ok:"정상", soon:"발주 임박", now:"발주 필요", out:"결품" }[s];
  return `<span class="pill ${s}">${label}</span>`;
}
function whNum(n){ return (n||0).toLocaleString("ko-KR"); }

// ---- 추천값 ----
// 발주 필요: 적정재고까지 채우는 수량을 100단위로 올림
function whRecOrder(w){
  const st = whStatus(w);
  if (st === "ok")   return "";
  if (st === "soon") return "발주 시점 임박";
  const gap = Math.max(whProper(w) - w.stock, 0);
  return `${whNum(Math.ceil(gap/100)*100)}개 발주 권장`;
}
// 입고 예정: 확정된 입고 일정을 엑셀에 쓰던 형식 그대로
function whRecInbound(w){
  return w.inbound > 0 ? `${w.inboundEta} - ${whNum(w.inbound)}개` : "";
}
function whNote(w, field){
  return w[field+"ByUser"] ? (w[field] ?? "")
       : (field === "orderNote" ? whRecOrder(w) : whRecInbound(w));
}

async function hqStock(){
  try {
    WH_ITEMS        = await API.getWarehouse();
    WH_MONTH_LABELS = await API.getWarehouseMonths();
    WH_TODAY_OUT    = await API.getShippedToday();
  } catch (e){
    WH_ITEMS = []; WH_MONTH_LABELS = [];
    toast("물류센터 재고를 불러오지 못했습니다.");
  }
  hqWhHead();
  hqWhFilterBar();
  hqWhStats();
  hqWhRows();
  hqShipForm();
  hqShipList();    // 아래 둘은 재고 표를 막지 않도록 기다리지 않는다
  hqFieldRows();
}

// 엑셀처럼 연도 묶음 행 + 열 이름 행, 두 줄짜리 머리글
function hqWhHead(){
  // 월 창이 해를 넘기면(예: 11월~2월) 두 해를 함께 적는다
  const y0 = WH_MONTH_LABELS[0]?.slice(0,5) ?? "";
  const y1 = WH_MONTH_LABELS[WH_MONTH_LABELS.length-1]?.slice(0,5) ?? "";
  const year = y0 === y1 ? y0 : `${y0} ~ ${y1}`;
  document.getElementById("hqWhHeadYear").innerHTML =
    `<th colspan="6"></th><th colspan="${WH_MONTH_LABELS.length}" class="year-head">${year}</th><th></th>`;
  document.getElementById("hqWhHead").innerHTML = `
    <th>품명 및 규격</th>
    <th class="col-num">재고수량</th>
    <th class="col-num">적정재고</th>
    <th class="memo-col">발주 필요</th>
    <th class="memo-col">입고 예정</th>
    <th class="col-num use3-head">사용량재고<br>(${WH_MONTH_LABELS.slice(0,-1).map(m=>m.slice(6,9)).join(", ")})</th>
    ${WH_MONTH_LABELS.map(m=>`<th class="col-num">${m.slice(6)} 출고량</th>`).join("")}
    <th>상태</th>`;
}

function hqWhFilterBar(){
  const counts = { all: WH_ITEMS.length };
  ["now","soon","ok"].forEach(k =>
    counts[k] = WH_ITEMS.filter(w => whStatus(w)===k || (k==="now" && whStatus(w)==="out")).length);
  const label = { all:"전체", now:"발주 필요", soon:"발주 임박", ok:"정상" };
  document.getElementById("hqWhFilterBar").innerHTML = ["all","now","soon","ok"]
    .map(k=>`<button class="chip ${WH_FILTER===k?'on':''}" onclick="hqWhSetFilter('${k}')">
        ${label[k]} <b>${counts[k]}</b></button>`).join("");
}
function hqWhSetFilter(k){ WH_FILTER = k; hqWhFilterBar(); hqWhRows(); }

function hqWhStats(){
  const need = WH_ITEMS.filter(w => ["now","out"].includes(whStatus(w))).length;
  const fieldRisk = HQ_FLEET.reduce((s,f)=>s+f.risk, 0);
  document.getElementById("hqStockStats").innerHTML = `
    <div class="stat"><div class="num">${WH_ITEMS.length}</div><div class="lbl">물류센터 관리 SKU</div></div>
    <div class="stat alert"><div class="num">${need}</div><div class="lbl">발주 필요 SKU</div></div>
    <div class="stat"><div class="num" style="font-size:20px">${whNum(WH_TODAY_OUT)}</div><div class="lbl">오늘 출고 수량</div></div>
    <div class="stat warn"><div class="num">${fieldRisk}</div><div class="lbl">현장 결품 위험 품목</div></div>`;
}

function hqWhRows(){
  const rows = WH_ITEMS
    .map(w => ({ w, st: whStatus(w) }))
    .filter(r => WH_FILTER==="all"
      || (WH_FILTER==="now" ? ["now","out"].includes(r.st) : r.st===WH_FILTER))
    .map(({w,st})=>{
      const p = findProduct(w.sku);
      return `
      <tr data-sku="${w.sku}">
        <td data-label="품명 및 규격"><div class="pname">${p.name}</div>
            <div class="sku">${w.sku} · ${p.cat} · ${p.unit}</div></td>
        <td class="col-num" data-label="재고수량">
          <input class="sheet-num" type="text" inputmode="numeric" value="${whNum(w.stock)}"
                 onchange="whSetStock('${w.sku}', this.value)"
                 aria-label="${p.name} 재고수량">
        </td>
        <td class="col-num proper-cell" data-label="적정재고">${whNum(whProper(w))}</td>
        <td class="memo-col" data-label="발주 필요">
          <input class="note-input ${w.orderNoteByUser?'':'rec'}" type="text"
                 value="${whNote(w,'orderNote')}" placeholder="메모"
                 title="추천값입니다. 지우고 직접 메모할 수 있습니다."
                 onchange="whSetNote('${w.sku}','orderNote', this.value)">
        </td>
        <td class="memo-col" data-label="입고 예정">
          <input class="note-input ${w.inNoteByUser?'':'rec'}" type="text"
                 value="${whNote(w,'inNote')}" placeholder="예: 8월 21일 - 300개"
                 title="추천값입니다. 지우고 직접 메모할 수 있습니다."
                 onchange="whSetNote('${w.sku}','inNote', this.value)">
        </td>
        <td class="col-num use3-cell" data-label="사용량재고">${whNum(whUse3(w))}</td>
        ${w.monthly.map((m,i)=>`<td class="col-num" data-label="${WH_MONTH_LABELS[i].slice(6)} 출고량">${whNum(m)}</td>`).join("")}
        <td data-label="상태" class="status-cell">${whPill(st)}</td>
      </tr>`;
    }).join("");
  document.getElementById("hqWhRows").innerHTML = rows
    || `<tr><td colspan="${7+WH_MONTH_LABELS.length}"><div class="empty">해당 상태의 품목이 없습니다.</div></td></tr>`;
}

// 표 전체를 다시 그리지 않고 한 행만 갱신 — 입력 중인 칸을 건드리지 않기 위해
function whRefreshRow(sku, skipStockInput){
  const w  = WH_ITEMS.find(x=>x.sku===sku);
  const tr = document.querySelector(`#hqWhRows tr[data-sku="${sku}"]`);
  if (!w || !tr) return;
  const stockInput = tr.querySelector(".sheet-num");
  if (stockInput && !skipStockInput && document.activeElement !== stockInput){
    stockInput.value = whNum(w.stock);
  }
  tr.querySelector(".status-cell").innerHTML = whPill(whStatus(w));
  const note = tr.querySelectorAll(".note-input")[0];
  if (note && !w.orderNoteByUser && document.activeElement !== note){
    note.value = whRecOrder(w);
  }
}

async function whSetStock(sku, val){
  const w = WH_ITEMS.find(x=>x.sku===sku);
  if (!w) return;
  const prev = w.stock;
  w.stock = Math.max(0, parseInt(String(val).replace(/[^0-9]/g,""), 10) || 0);
  whShowStock(sku);   // 화면부터 맞추고 저장은 뒤따른다

  try {
    await API.setWarehouseStock(sku, w.stock);
    toast(`${findProduct(sku).name} 재고를 ${whNum(w.stock)}개로 반영했습니다.`);
  } catch (e){
    w.stock = prev;
    whShowStock(sku);
    toast("재고 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

// 한 행의 재고수량 칸과 그에 딸린 표시만 다시 그린다 (표 전체를 건드리지 않는다)
function whShowStock(sku){
  const w = WH_ITEMS.find(x=>x.sku===sku);
  if (!w) return;
  whRefreshRow(sku, true);
  const tr = document.querySelector(`#hqWhRows tr[data-sku="${sku}"]`);
  if (tr) tr.querySelector(".sheet-num").value = whNum(w.stock);   // 천단위 표기로 정리
  hqWhStats(); hqWhFilterBar();
}

// 추천값을 지우고 직접 쓴 순간부터는 그 칸을 사람의 메모로 취급한다
async function whSetNote(sku, field, val){
  const w = WH_ITEMS.find(x=>x.sku===sku);
  if (!w) return;
  const prevText = w[field], prevByUser = w[field+"ByUser"];
  w[field] = val;
  w[field+"ByUser"] = true;

  const cell = () => {
    const tr = document.querySelector(`#hqWhRows tr[data-sku="${sku}"]`);
    return tr ? tr.querySelectorAll(".note-input")[field==="orderNote" ? 0 : 1] : null;
  };
  cell()?.classList.remove("rec");

  try {
    await API.setWarehouseNote(sku, field, val);
  } catch (e){
    w[field] = prevText;
    w[field+"ByUser"] = prevByUser;
    const c = cell();
    if (c && document.activeElement !== c){
      c.value = whNote(w, field);
      if (!prevByUser) c.classList.add("rec");
    }
    toast("메모 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/* ---- 출고 등록 ----
   담당자가 거래처·품목·수량을 골라 등록하면 DB 함수 ship_stock 이
   재고 차감 · 당월 출고량 누적 · 이력 남기기를 한 번에 처리한다. */

function hqShipForm(){
  const box = document.getElementById("hqShipForm");
  if (!box) return;
  const accs = HQ_FLEET.map(f=>`<option value="${f.id}">${f.name}</option>`).join("");
  box.innerHTML = `
    <div class="ship-form">
      <label>거래처
        <select id="shipAccount" class="ship-acct"><option value="">선택…</option>${accs}</select>
      </label>
      <label>품목
        <select id="shipSku" class="ship-sku"><option value="">선택…</option></select>
      </label>
      <label>수량
        <input id="shipQty" type="text" inputmode="numeric" placeholder="예: 500"
               aria-label="출고 수량">
      </label>
      <button class="btn" id="shipBtn" onclick="hqShip()">출고 등록</button>
    </div>`;
  hqShipSkuOptions();
}

// 품목 목록은 현재고를 함께 보여준다. 출고 후에도 고른 품목을 유지한다.
function hqShipSkuOptions(){
  const sel = document.getElementById("shipSku");
  if (!sel) return;
  const keep = sel.value;
  sel.innerHTML = `<option value="">선택…</option>` + WH_ITEMS.map(w=>{
    const p = findProduct(w.sku);
    return `<option value="${w.sku}">${p.name} · 재고 ${whNum(w.stock)}</option>`;
  }).join("");
  sel.value = keep;
}

async function hqShip(){
  const accSel = document.getElementById("shipAccount");
  const skuSel = document.getElementById("shipSku");
  const qtyIn  = document.getElementById("shipQty");
  const btn    = document.getElementById("shipBtn");
  if (!accSel || !skuSel || !qtyIn) return;

  const accountId = accSel.value, sku = skuSel.value;
  const qty = parseInt(String(qtyIn.value).replace(/[^0-9]/g,""), 10) || 0;

  if (!accountId){ toast("거래처를 선택해 주세요."); return; }
  if (!sku){ toast("품목을 선택해 주세요."); return; }
  if (qty <= 0){ toast("출고 수량을 입력해 주세요."); return; }

  // 보내기 전에 한 번 거르고, 최종 판정은 DB 가 한다
  const w = WH_ITEMS.find(x=>x.sku===sku);
  if (w && w.stock < qty){
    toast(`재고가 부족합니다. 현재고 ${whNum(w.stock)}개`);
    return;
  }

  btn.disabled = true;
  try {
    await API.shipStock(accountId, sku, qty);

    // 재고와 당월 출고량이 DB 에서 바뀌었으니 다시 읽어 화면을 맞춘다
    WH_ITEMS     = await API.getWarehouse();
    WH_TODAY_OUT = await API.getShippedToday();

    qtyIn.value = "";
    hqWhRows(); hqWhStats(); hqWhFilterBar(); hqShipSkuOptions();
    await hqShipList();
    toast(`${findProduct(sku).name} ${whNum(qty)}개를 출고 처리했습니다.`);
  } catch (e){
    toast(e.message || "출고 등록에 실패했습니다.");
  } finally {
    btn.disabled = false;
  }
}

async function hqShipList(){
  const box = document.getElementById("hqShipRows");
  if (!box) return;
  try {
    WH_SHIPMENTS = await API.getShipments(8);
  } catch (e){
    box.innerHTML = `<div class="empty">출고 이력을 불러오지 못했습니다.</div>`;
    return;
  }
  box.innerHTML = WH_SHIPMENTS.length ? WH_SHIPMENTS.map(e=>`
    <div class="feed-row">
      <span class="feed-time">${new Date(e.at).toTimeString().slice(0,8)}</span>
      <span class="feed-acct">${e.account}</span>
      <span class="feed-sku">${findProduct(e.sku).name}</span>
      <span class="feed-qty">−${whNum(e.qty)}</span>
    </div>`).join("")
    : `<div class="empty">아직 등록된 출고가 없습니다.</div>`;
}

/* ---- 엑셀(CSV)로 내보내기 — 쓰던 시트와 같은 열 순서 ---- */
function whExportCsv(){
  const head = ["품명 및 규격","재고수량","적정재고","발주 필요","입고 예정",
                `사용량재고(${WH_MONTH_LABELS.slice(0,-1).map(m=>m.slice(6,9)).join(", ")})`,
                ...WH_MONTH_LABELS.map(m=>`${m} 출고량`)];
  const rows = WH_ITEMS.map(w=>{
    const p = findProduct(w.sku);
    return [`${p.name} [${w.sku}]`, w.stock, whProper(w),
            whNote(w,"orderNote"), whNote(w,"inNote"), whUse3(w), ...w.monthly];
  });
  const esc = v => `"${String(v).replace(/"/g,'""')}"`;
  const csv = "\ufeff" + [head, ...rows].map(r=>r.map(esc).join(",")).join("\r\n");
  const d = new Date();
  const name = `재고현황_${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,"0")}_${String(d.getDate()).padStart(2,"0")}.csv`;

  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`${name} 로 내보냈습니다.`);
}

// 거래처 현장 재고 — 실시간 연동 거래처의 발주 필요/결품 품목을 모아 본다
async function hqFieldRows(){
  const alerts = [];
  const live = HQ_FLEET.filter(f => f.detailed);
  try {
    const invs = await Promise.all(live.map(f => API.getInventory(f.id)));
    live.forEach((f, i)=>{
      analyzeAccount({ inventory: invs[i] })
        .filter(x => x.status==="now" || x.status==="out")
        .forEach(x => alerts.push({ id:f.id, name:f.name, x }));
    });
  } catch (e){
    document.getElementById("hqFieldRows").innerHTML =
      `<tr><td colspan="6"><div class="empty">현장 재고를 불러오지 못했습니다.</div></td></tr>`;
    return;
  }
  alerts.sort((a,b)=> (a.x.daysLeft ?? 999) - (b.x.daysLeft ?? 999));

  document.getElementById("hqFieldRows").innerHTML = alerts.length ? alerts.map(a=>`
    <tr>
      <td data-label="거래처"><div class="pname">${a.name}</div>
          <div class="sku">${a.x.product.cat}</div></td>
      <td data-label="제품"><div class="pname">${a.x.product.name}</div>
          <div class="sku">${a.x.sku}</div></td>
      <td class="num-cell" data-label="현재고">${a.x.stock} ${a.x.product.unit}</td>
      <td class="num-cell" data-label="예상 소진">${a.x.daysLeft ?? "—"}일</td>
      <td data-label="상태">${statusPill(a.x)}</td>
      <td data-label="대응">
        <button class="mini-btn" onclick="hqPropose('${a.id}','${a.x.sku}',${a.x.suggestQty})">선제 발주</button>
      </td>
    </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty">지금 대응이 필요한 현장 품목이 없습니다.</div></td></tr>`;
}
function hqPropose(accId, sku, qty){
  const f = HQ_FLEET.find(x=>x.id===accId);
  toast(`${f ? f.name : accId}에 ${findProduct(sku).name} ${qty}개 선제 발주를 제안했습니다.`);
}

/* ---------- 제품·수요 분석 ---------- */
function hqProducts(){
  const totalQty = SKU_METRICS.reduce((s,m)=>s+m.monthlyQty,0);
  document.getElementById("hqProdSummary").innerHTML = `
    <div class="stat"><div class="num" style="font-size:20px">${totalQty.toLocaleString()}</div><div class="lbl">월 출고 수량(개)</div></div>
    <div class="stat"><div class="num">${SKU_METRICS.length}</div><div class="lbl">분석 대상 SKU</div></div>
    <div class="stat"><div class="num">${SKU_METRICS.reduce((s,m)=>s+m.recWins,0)}</div><div class="lbl">추천 성공(건)</div></div>
    <div class="stat"><div class="num">${(SKU_METRICS.reduce((s,m)=>s+m.wasteRate,0)/SKU_METRICS.length*100).toFixed(1)}%</div><div class="lbl">평균 폐기율</div></div>`;

  const maxQty = Math.max(...SKU_METRICS.map(m=>m.monthlyQty));
  document.getElementById("hqProdRows").innerHTML = SKU_METRICS
    .sort((a,b)=>b.monthlyQty-a.monthlyQty).map(m=>{
      const p = findProduct(m.sku);
      const bar = Math.round(m.monthlyQty/maxQty*100);
      const tr = m.trend>=0 ? `<span class="trend up">▲ ${(m.trend*100).toFixed(0)}%</span>`
                            : `<span class="trend down">▼ ${(Math.abs(m.trend)*100).toFixed(0)}%</span>`;
      return `
      <tr>
        <td data-label="제품"><div class="pname">${p.name}</div>
            <div class="sku">${m.sku} · ${p.cat}</div></td>
        <td data-label="월 출고">
          <div class="bar-wrap"><div class="bar" style="width:${bar}%"></div></div>
          <div class="sku" style="text-align:right">${m.monthlyQty.toLocaleString()}</div>
        </td>
        <td class="num-cell" data-label="추세">${tr}</td>
        <td class="num-cell" data-label="취급 거래처">${m.accounts}</td>
        <td class="num-cell" data-label="회전율">${m.turnover.toFixed(1)}</td>
        <td class="num-cell" data-label="폐기율">${(m.wasteRate*100).toFixed(0)}%</td>
      </tr>`;
    }).join("");
}

/* ---------- 소통 인박스 ---------- */
// 거래처 소통창과 같은 messages 테이블을 본다. 대화는 거래처당 하나다.

function hqUnsub(){
  if (HQ_SUB){ HQ_SUB.unsubscribe(); HQ_SUB = null; }
}

async function hqInbox(){
  // 열린 대화가 있으면 채팅창을 그린다
  if (HQ_THREAD){ await hqRenderThread(HQ_THREAD); return; }
  hqUnsub();
  document.getElementById("hqInboxThread").style.display = "none";
  document.getElementById("hqInboxListWrap").style.display = "";

  const list = document.getElementById("hqInboxList");
  try {
    HQ_MSGS = await API.getInbox();
  } catch (e){
    list.innerHTML = `<div class="empty">소통 내역을 불러오지 못했습니다.</div>`;
    return;
  }

  const unread = HQ_MSGS.filter(m=>m.unread).length;
  document.getElementById("hqInboxCount").textContent =
    `미처리 ${unread}건 · 전체 ${HQ_MSGS.length}건`;

  list.innerHTML = HQ_MSGS.length ? HQ_MSGS.map(m=>`
    <div class="inbox-row ${m.unread?'unread':''}" onclick="hqOpenThread('${m.accountId}')">
      <div class="inbox-main">
        <div class="inbox-top">
          <span class="inbox-acct">${m.account}</span>
          <span class="inbox-cat">${m.cat}</span>
          ${m.unread?`<span class="inbox-badge">NEW ${m.unread>1?m.unread:""}</span>`:''}
        </div>
        <div class="inbox-preview">${escapeHtml(m.preview)}</div>
      </div>
      <div class="inbox-time">${fmtWhen(m.time)}</div>
    </div>`).join("")
    : `<div class="empty">아직 오간 메시지가 없습니다.</div>`;
}

// 인박스 항목 열기 — 거래처 채팅창으로 진입
function hqOpenThread(accountId){
  HQ_THREAD = accountId;
  hqSwitchTab("inbox");
}
function hqCloseThread(){ hqUnsub(); HQ_THREAD = null; hqInbox(); }

// 거래처 상세의 '메시지 보내기' → 해당 거래처 채팅창을 연다.
// 오간 메시지가 없어도 빈 대화로 열린다.
function hqMessageAccount(fleetId){
  HQ_THREAD = fleetId;
  hqSwitchTab("inbox");
}

// 채팅창 (거래처 소통창과 동일한 형태)
async function hqRenderThread(accountId){
  const f = HQ_FLEET.find(x=>x.id===accountId);
  document.getElementById("hqInboxListWrap").style.display = "none";
  const box = document.getElementById("hqInboxThread");
  box.style.display = "";

  const name = f ? f.name : accountId;
  const meta = f ? `${f.type} · ${f.region}` : "거래처";
  const cat  = HQ_MSGS.find(m=>m.accountId===accountId)?.cat ?? "본사 발신";

  box.innerHTML = `
    <button class="back-btn" onclick="hqCloseThread()">← 소통 인박스</button>
    <div class="detail-head">
      <div>
        <div class="detail-name">${name} <span class="inbox-cat">${cat}</span></div>
        <div class="detail-meta">${meta}</div>
      </div>
      ${f ? `<button class="mini-btn" style="margin-left:auto"
               onclick="hqDrill('${f.id}')">거래처 상세 보기</button>` : ""}
    </div>
    <div class="panel">
      <div class="msg-list" id="hqThreadMsgs"></div>
      <div class="chat-input">
        <textarea id="hqThreadText" placeholder="거래처에 보낼 내용을 입력하세요…"></textarea>
        <button class="chat-send" id="hqThreadSend" onclick="hqSendMessage()">보내기</button>
      </div>
    </div>`;

  try {
    HQ_THREAD_LOG = await API.getMessages(accountId);
  } catch (e){
    document.getElementById("hqThreadMsgs").innerHTML =
      `<div class="empty">대화를 불러오지 못했습니다.</div>`;
    return;
  }
  hqDrawThread();

  // 거래처가 보낸 메시지를 읽음 처리
  API.markRead(accountId, "account").catch(()=>{});

  hqUnsub();
  HQ_SUB = API.watchMessages(accountId, m => {
    if (HQ_THREAD !== accountId) return;
    if (HQ_THREAD_LOG.some(x => x.id === m.id)) return;   // 내가 방금 보낸 것
    HQ_THREAD_LOG.push(m);
    hqDrawThread();
    if (m.who === "account") API.markRead(accountId, "account").catch(()=>{});
  });

  const ta = document.getElementById("hqThreadText");
  ta.addEventListener("keydown", e=>{
    if (e.key==="Enter" && (e.metaKey || e.ctrlKey)) hqSendMessage();
  });
}

function hqDrawThread(){
  const el = document.getElementById("hqThreadMsgs");
  if (!el) return;
  if (!HQ_THREAD_LOG.length){
    el.innerHTML = `<div class="empty">아직 주고받은 메시지가 없습니다.<br>
      아래에 내용을 입력해 먼저 말을 건네보세요.</div>`;
    return;
  }
  el.innerHTML = HQ_THREAD_LOG.map(m=>`
    <div class="msg ${m.who==="hq" ? "me" : "them"}">
      <div class="who">${m.who==="hq" ? (m.name || "유엔아이메디컬 CS")
                                      : (m.name || "거래처 담당자")}</div>
      <div>${m.cat ? `[${escapeHtml(m.cat)}] ` : ""}${escapeHtml(m.text)}</div>
      <div class="time">${fmtWhen(m.at)}</div>
    </div>`).join("");
  el.scrollTop = el.scrollHeight;
}

async function hqSendMessage(){
  const ta  = document.getElementById("hqThreadText");
  const btn = document.getElementById("hqThreadSend");
  if (!HQ_THREAD || !ta) return;
  const text = ta.value.trim();
  if (!text) return;

  if (btn) btn.disabled = true;
  try {
    const m = await API.sendMessage(HQ_THREAD, "hq", text, null);
    HQ_THREAD_LOG.push(m);
    ta.value = "";
    hqDrawThread();
    const f = HQ_FLEET.find(x=>x.id===HQ_THREAD);
    toast(`${f ? f.name : HQ_THREAD}에 메시지를 보냈습니다.`);
  } catch (e){
    toast("메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------- 공통 ---------- */
function fleetPill(s){
  const label = {healthy:"정상", watch:"주의", risk:"위험"}[s];
  const cls   = {healthy:"ok", watch:"soon", risk:"now"}[s];
  return `<span class="pill ${cls}">${label}</span>`;
}
function statusRank(s){ return {risk:2, watch:1, healthy:0}[s]; }
function stagePill(s){
  const cls = {"발주 대기":"now","배송 중":"soon","처리 완료":"ok"}[s];
  return `<span class="pill ${cls}">${s}</span>`;
}
