/* =========================================================================
   UNI Medical — 본사(HQ) VMI 관제 콘솔
   거래처 전체를 가로질러 보는 공급자 관점 뷰.
   탭: 관제 대시보드 · 거래처 관리 · 발주 파이프라인 · 제품·수요 분석 · 소통 인박스
   ========================================================================= */

let HQ_FILTER = "all";   // 거래처 상태 필터
let HQ_DRILL = null;     // 드릴다운으로 선택된 거래처 id
let HQ_THREAD = null;    // 인박스에서 열려 있는 대화 id

function enterHQ(){
  document.getElementById("loginRoot").style.display = "none";
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("hqRoot").style.display = "";
  hqSwitchTab("overview");
}

function hqSwitchTab(name){
  document.querySelectorAll("#hqRoot .tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll("#hqRoot .view").forEach(v =>
    v.classList.toggle("active", v.id === "hq-"+name));
  if (name === "overview")  hqOverview();
  if (name === "accounts")  hqAccounts();
  if (name === "pipeline")  hqPipeline();
  if (name === "products")  hqProducts();
  if (name === "inbox")     hqInbox();
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
  const flagged = [...FLEET].filter(f=>f.status!=="healthy")
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
function hqAccounts(){
  // 드릴다운 상태면 상세 패널
  if (HQ_DRILL){ hqAccountDetail(HQ_DRILL); return; }
  document.getElementById("hqAccountDetail").style.display = "none";
  document.getElementById("hqAccountList").style.display = "";

  const counts = {
    all: FLEET.length,
    risk: FLEET.filter(f=>f.status==="risk").length,
    watch: FLEET.filter(f=>f.status==="watch").length,
    healthy: FLEET.filter(f=>f.status==="healthy").length,
  };
  document.getElementById("hqFilterBar").innerHTML = ["all","risk","watch","healthy"]
    .map(k=>`<button class="chip ${HQ_FILTER===k?'on':''}" onclick="hqSetFilter('${k}')">
        ${filterLabel(k)} <b>${counts[k]}</b></button>`).join("");

  const rows = FLEET
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

// 거래처 상세 — 실계정(ACCOUNTS)이면 실제 재고까지 드릴다운
function hqAccountDetail(id){
  const f = FLEET.find(x=>x.id===id);
  document.getElementById("hqAccountList").style.display = "none";
  const box = document.getElementById("hqAccountDetail");
  box.style.display = "";

  let inv = "";
  const real = ACCOUNTS[id];
  if (real){
    const analyzed = analyzeAccount({inventory: real.inventory, profile: real.profile});
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
      실시간 재고 드릴다운은 실계정(한양대학교병원·세명정형외과병원·미래정형외과의원)에서 확인할 수 있습니다.</div></div>`;
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
  // FLEET에서 발주 상태를 합성 (실계정은 실제 orderHistory 최신 반영)
  const rows = FLEET.map(f=>{
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
function hqInbox(){
  // 열린 대화가 있으면 채팅창을 그린다
  if (HQ_THREAD){ hqRenderThread(HQ_THREAD); return; }
  document.getElementById("hqInboxThread").style.display = "none";
  document.getElementById("hqInboxListWrap").style.display = "";

  const unread = HQ_INBOX.filter(m=>m.unread).length;
  document.getElementById("hqInboxCount").textContent =
    `미처리 ${unread}건 · 전체 ${FLEET_TOTALS.openIssues}건`;
  document.getElementById("hqInboxList").innerHTML = HQ_INBOX.map(m=>`
    <div class="inbox-row ${m.unread?'unread':''}" onclick="hqOpenThread('${m.id}')">
      <div class="inbox-main">
        <div class="inbox-top">
          <span class="inbox-acct">${m.account}</span>
          <span class="inbox-cat">${m.cat}</span>
          ${m.unread?'<span class="inbox-badge">NEW</span>':''}
        </div>
        <div class="inbox-preview">${escapeHtml(m.preview)}</div>
      </div>
      <div class="inbox-time">${m.time}</div>
    </div>`).join("");
}

// 인박스 항목 열기 — 거래처 채팅창으로 진입
function hqOpenThread(id){
  const m = HQ_INBOX.find(x=>x.id===id);
  if (!m) return;
  m.unread = false;
  HQ_THREAD = id;
  hqSwitchTab("inbox");
}
function hqCloseThread(){ HQ_THREAD = null; hqInbox(); }

// 거래처 상세의 '메시지 보내기' → 해당 거래처 채팅창을 연다.
// 기존 문의가 없으면 본사에서 시작하는 새 대화를 만든다.
function hqMessageAccount(fleetId){
  const f = FLEET.find(x=>x.id===fleetId);
  if (!f) return;
  let m = HQ_INBOX.find(x => x.accountId===fleetId || x.account===f.name);
  if (!m){
    m = { id:"m-"+fleetId, accountId:f.id, account:f.name, cat:"본사 발신",
          preview:"본사에서 시작한 대화입니다.", time:"방금", unread:false, thread:[] };
    HQ_INBOX.unshift(m);
  }
  HQ_THREAD = m.id;
  hqSwitchTab("inbox");
}

// 채팅창 (거래처 소통창과 동일한 형태)
function hqRenderThread(id){
  const m = HQ_INBOX.find(x=>x.id===id);
  if (!m){ hqCloseThread(); return; }
  document.getElementById("hqInboxListWrap").style.display = "none";
  const box = document.getElementById("hqInboxThread");
  box.style.display = "";

  const f = FLEET.find(x => x.id===m.accountId || x.name===m.account);
  const meta = f ? `${f.type} · ${f.region}` : "거래처";

  box.innerHTML = `
    <button class="back-btn" onclick="hqCloseThread()">← 소통 인박스</button>
    <div class="detail-head">
      <div>
        <div class="detail-name">${m.account} <span class="inbox-cat">${m.cat}</span></div>
        <div class="detail-meta">${meta}</div>
      </div>
      ${f ? `<button class="mini-btn" style="margin-left:auto"
               onclick="hqDrill('${f.id}')">거래처 상세 보기</button>` : ""}
    </div>
    <div class="panel">
      <div class="msg-list" id="hqThreadMsgs"></div>
      <div class="chat-input">
        <textarea id="hqThreadText" placeholder="거래처에 보낼 내용을 입력하세요…"></textarea>
        <button class="chat-send" onclick="hqSendMessage()">보내기</button>
      </div>
    </div>`;

  hqRenderThreadMsgs(m);
  const ta = document.getElementById("hqThreadText");
  ta.addEventListener("keydown", e=>{
    if (e.key==="Enter" && (e.metaKey || e.ctrlKey)) hqSendMessage();
  });
}

function hqRenderThreadMsgs(m){
  const el = document.getElementById("hqThreadMsgs");
  if (!el) return;
  if (!m.thread.length){
    el.innerHTML = `<div class="empty">아직 주고받은 메시지가 없습니다.<br>
      아래에 내용을 입력해 먼저 말을 건네보세요.</div>`;
    return;
  }
  el.innerHTML = m.thread.map(x=>`
    <div class="msg ${x.who==="hq" ? "me" : "them"}">
      <div class="who">${x.name}</div>
      <div>${escapeHtml(x.text)}</div>
      <div class="time">${x.t}</div>
    </div>`).join("");
  el.scrollTop = el.scrollHeight;
}

function hqSendMessage(){
  const m = HQ_INBOX.find(x=>x.id===HQ_THREAD);
  const ta = document.getElementById("hqThreadText");
  if (!m || !ta) return;
  const text = ta.value.trim();
  if (!text) return;

  m.thread.push({ who:"hq", name:"유엔아이메디컬 CS", t:"방금", text });
  m.preview = text;
  m.time = "방금";
  m.unread = false;
  ta.value = "";
  hqRenderThreadMsgs(m);
  toast(`${m.account}에 메시지를 보냈습니다.`);

  // 거래처 수신 확인(데모)
  setTimeout(()=>{
    m.thread.push({ who:"acct", name:`${m.account} 담당자`, t:"방금",
      text:"확인했습니다. 내용 검토 후 회신드리겠습니다." });
    m.preview = "확인했습니다. 내용 검토 후 회신드리겠습니다.";
    if (HQ_THREAD === m.id) hqRenderThreadMsgs(m);
  }, 900);
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
