/* =========================================================================
   UNI Medical VMI — 앱 로직
   로그인 · 재고 입력/조정 · 발주 추천 · 제품 추천 · 소통창
   상태는 세션 동안 메모리에 유지 (데모). 새로고침 시 초기화.
   ========================================================================= */

let SESSION = null;   // { id, acc } — 현재 로그인 거래처
let CHAT = {};        // 거래처별 메시지 로그(데모)

/* ---------- 로그인 ---------- */
function attemptLogin(id, pw){
  const acc = ACCOUNTS[id?.trim()];
  if (!acc || acc.password !== pw?.trim()){
    document.getElementById("loginError").textContent =
      "거래처 ID 또는 비밀번호가 올바르지 않습니다.";
    return;
  }
  // 깊은 복사로 세션 재고 확보 (원본 불변)
  SESSION = { id, acc: JSON.parse(JSON.stringify(acc)) };
  if (!CHAT[id]) CHAT[id] = seedChat(SESSION.acc);
  showApp();
}

function fillDemo(id){
  document.getElementById("loginId").value = id;
  document.getElementById("loginPw").value = ACCOUNTS[id].password;
}

function logout(){
  SESSION = null;
  document.getElementById("appRoot").style.display = "none";
  document.getElementById("loginRoot").style.display = "";
  document.getElementById("loginError").textContent = "";
}

/* ---------- 앱 진입 ---------- */
function showApp(){
  document.getElementById("loginRoot").style.display = "none";
  document.getElementById("appRoot").style.display = "";
  const p = SESSION.acc.profile;
  document.getElementById("acctName").textContent = p.name;
  document.getElementById("acctMeta").textContent =
    `${p.type} · ${p.region} · 거래 시작 ${p.since}`;
  switchTab("dashboard");
}

function switchTab(name){
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".view").forEach(v =>
    v.classList.toggle("active", v.id === "view-"+name));
  if (name === "dashboard")  renderDashboard();
  if (name === "inventory")  renderInventory();
  if (name === "orders")     renderOrders();
  if (name === "recommend")  renderRecommend();
  if (name === "contact")    renderContact();
}

/* ---------- 대시보드 ---------- */
function renderDashboard(){
  const analyzed = analyzeAccount(SESSION.acc);
  const now  = analyzed.filter(x=>x.status==="now"||x.status==="out").length;
  const soon = analyzed.filter(x=>x.status==="soon").length;
  const skus = analyzed.length;
  const value = analyzed.reduce((s,x)=>s+x.stock*x.product.price,0);

  document.getElementById("statNow").textContent  = now;
  document.getElementById("statSoon").textContent = soon;
  document.getElementById("statSku").textContent  = skus;
  document.getElementById("statVal").textContent  = won(value);

  // 임박 품목 요약 테이블
  const rows = analyzed.slice(0,6).map(x => `
    <tr>
      <td><div class="pname">${x.product.name}</div>
          <div class="sku">${x.sku}</div></td>
      <td class="num-cell">${x.stock} ${x.product.unit}</td>
      <td class="num-cell">${x.daysLeft ?? "—"}일</td>
      <td>${statusPill(x)}</td>
      <td class="num-cell">${x.reorderDate ? fmtDate(x.reorderDate) : "—"}</td>
    </tr>`).join("");
  document.getElementById("dashRows").innerHTML = rows;
}

/* ---------- 재고 입력/조정 ---------- */
function renderInventory(){
  const analyzed = analyzeAccount(SESSION.acc);
  const rows = analyzed.map(x => `
    <tr>
      <td><span class="cat-tag">${x.product.cat}</span></td>
      <td><div class="pname">${x.product.name}</div>
          <div class="sku">${x.sku}</div></td>
      <td>
        <div class="qty-adjust">
          <button onclick="adjustStock('${x.sku}',-1)" aria-label="감소">–</button>
          <input type="number" value="${x.stock}" min="0"
                 onchange="setStock('${x.sku}', this.value)">
          <button onclick="adjustStock('${x.sku}',1)" aria-label="증가">+</button>
        </div>
      </td>
      <td class="num-cell">${x.dailyUse}/일</td>
      <td class="num-cell">${x.daysLeft ?? "—"}일</td>
      <td>${statusPill(x)}</td>
    </tr>`).join("");
  document.getElementById("invRows").innerHTML = rows;
}
function findInv(sku){ return SESSION.acc.inventory.find(i=>i.sku===sku); }
function adjustStock(sku, delta){
  const it = findInv(sku); it.stock = Math.max(0, it.stock + delta);
  renderInventory(); refreshBadge();
}
function setStock(sku, val){
  const it = findInv(sku); it.stock = Math.max(0, parseInt(val)||0);
  renderInventory(); refreshBadge();
}

/* ---------- 발주 추천 ---------- */
function renderOrders(){
  const analyzed = analyzeAccount(SESSION.acc);
  const plan = buildReorderPlan(analyzed);
  const box = document.getElementById("orderPlan");

  if (plan.length === 0){
    box.innerHTML = `<div class="empty">지금 발주가 필요한 품목이 없습니다.<br>
      임박 품목은 대시보드에서 확인할 수 있습니다.</div>`;
  } else {
    const total = plan.reduce((s,i)=>s+i.subtotal,0);
    box.innerHTML =
      plan.map(i=>`
        <div class="order-line">
          <div class="info">
            <div class="pname">${i.name}</div>
            <div class="sku">${i.sku}</div>
          </div>
          <div class="qty">${i.qty} ${i.unit} × ${won(i.price)}</div>
          <div class="sub">${won(i.subtotal)}</div>
        </div>`).join("") +
      `<div class="order-foot">
         <span style="color:var(--ink-soft);font-size:13px">권장 발주 합계</span>
         <span class="order-total">${won(total)}</span>
         <span class="spacer" style="flex:1"></span>
         <button class="btn" style="width:auto;padding:10px 20px"
                 onclick="placeOrder(${total})">발주 확정</button>
       </div>`;
  }

  // 예측 발주 일정 (임박순)
  const sched = analyzed.filter(x=>x.reorderDate).slice(0,8).map(x=>`
    <tr>
      <td><div class="pname">${x.product.name}</div><div class="sku">${x.sku}</div></td>
      <td class="num-cell">${x.daysLeft ?? "—"}일</td>
      <td class="num-cell">${x.suggestQty} ${x.product.unit}</td>
      <td>${x.reorderDate ? fmtDate(x.reorderDate) : "—"}</td>
      <td>${statusPill(x)}</td>
    </tr>`).join("");
  document.getElementById("schedRows").innerHTML = sched;
}

function placeOrder(total){
  const plan = buildReorderPlan(analyzeAccount(SESSION.acc));
  plan.forEach(i => { const it=findInv(i.sku); if(it) it.stock += i.qty; });
  SESSION.acc.orderHistory.unshift({
    date: new Date().toISOString().slice(0,10),
    items: plan.map(i=>[i.sku,i.qty])
  });
  toast(`발주가 접수되었습니다 · ${won(total)} (입고까지 약 ${LEAD_TIME_DAYS}일)`);
  renderOrders(); refreshBadge();
}

/* ---------- 제품 추천 ---------- */
function renderRecommend(){
  const analyzed = analyzeAccount(SESSION.acc);
  const recs = recommendProducts(SESSION.acc, analyzed);
  const box = document.getElementById("recStrip");
  box.innerHTML = recs.map(r=>`
    <div class="rec-card fade">
      <div class="rec-tag">${r.tag}</div>
      <div class="rec-name">${r.product.name}</div>
      <div class="rec-sku">${r.product.sku} · ${r.product.cat}</div>
      <div class="rec-reason">${r.reason}</div>
      <div class="rec-foot">
        <span class="rec-price">${won(r.product.price)}</span>
        <span class="sku">/ ${r.product.unit}</span>
        <button class="rec-add" onclick="addRecommended('${r.product.sku}')">담기</button>
      </div>
    </div>`).join("");
}
function addRecommended(sku){
  if (findInv(sku)){ toast("이미 재고 목록에 있는 품목입니다."); return; }
  const p = findProduct(sku);
  SESSION.acc.inventory.push({
    sku, stock:0, dailyUse:0.5,
    reorderPoint:Math.max(4,Math.round(p.pack/3)), parLevel:p.pack*2
  });
  toast(`${p.name} 를 재고 목록에 추가했습니다.`);
  refreshBadge();
}

/* ---------- 소통창 ---------- */
function seedChat(acc){
  return [
    { who:"them", name:"유엔아이메디컬 CS", t:"2일 전",
      text:`${acc.profile.name} 담당자님, 안녕하세요. 제품 사용 관련 문의나 건의사항은 이 창으로 남겨주세요.` },
  ];
}
function renderContact(){
  const log = CHAT[SESSION.id];
  document.getElementById("msgList").innerHTML = log.map(m=>`
    <div class="msg ${m.who}">
      <div class="who">${m.who==="me" ? "우리 병원" : m.name}</div>
      <div>${escapeHtml(m.text)}</div>
      <div class="time">${m.t}</div>
    </div>`).join("");
  const el = document.getElementById("msgList"); el.scrollTop = el.scrollHeight;
}
function sendMessage(){
  const ta = document.getElementById("chatText");
  const cat = document.getElementById("chatCat").value;
  const text = ta.value.trim();
  if (!text) return;
  const log = CHAT[SESSION.id];
  log.push({ who:"me", name:"우리 병원", t:"방금", text:`[${cat}] ${text}` });
  ta.value = "";
  renderContact();
  // 자동 응답(데모)
  setTimeout(()=>{
    log.push({ who:"them", name:"유엔아이메디컬 CS", t:"방금",
      text:autoReply(cat) });
    renderContact();
  }, 700);
}
function autoReply(cat){
  const map = {
    "제품 문의":"문의 감사합니다. 해당 제품 규격/호환 정보를 확인해 영업담당이 곧 회신드리겠습니다.",
    "품질 건의":"소중한 피드백 감사합니다. 품질팀에 전달했으며 로트 확인 후 조치 결과를 공유하겠습니다.",
    "신제품 요청":"요청 주신 품목의 도입 가능성을 검토해 담당 MD가 안내드리겠습니다.",
    "배송/발주":"발주·배송 관련 사항은 물류팀에서 당일 내 확인해 회신드리겠습니다.",
  };
  return map[cat] || "확인 후 회신드리겠습니다.";
}

/* ---------- 공통 UI ---------- */
function statusPill(x){
  const label = { ok:"충분", soon:"발주 임박", now:"발주 필요", out:"결품" }[x.status];
  return `<span class="pill ${x.status}">${label}</span>`;
}
function refreshBadge(){
  const analyzed = analyzeAccount(SESSION.acc);
  const n = analyzed.filter(x=>x.status==="now"||x.status==="out").length;
  const b = document.getElementById("tabOrderBadge");
  if (b){ b.textContent = n>0 ? ` (${n})` : ""; }
}
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(window.__tt);
  window.__tt = setTimeout(()=>t.classList.remove("show"), 2600);
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

/* ---------- 바인딩 ---------- */
window.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("loginBtn").addEventListener("click", ()=>{
    attemptLogin(document.getElementById("loginId").value,
                 document.getElementById("loginPw").value);
  });
  document.getElementById("loginPw").addEventListener("keydown", e=>{
    if (e.key==="Enter") document.getElementById("loginBtn").click();
  });
  document.querySelectorAll(".tab").forEach(t=>
    t.addEventListener("click", ()=>switchTab(t.dataset.tab)));
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("chatSend").addEventListener("click", sendMessage);
});
