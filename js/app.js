/* =========================================================================
   UNI Medical VMI — 앱 로직
   로그인 · 재고 입력/조정 · 발주 추천 · 제품 추천 · 소통창
   상태는 세션 동안 메모리에 유지 (데모). 새로고침 시 초기화.
   ========================================================================= */

let SESSION  = null;   // { id, acc } — 현재 로그인 거래처
let CHAT_LOG = [];     // 본사와 주고받은 메시지 (API.getMessages)
let CHAT_SUB = null;   // 실시간 구독 핸들

/* ---------- 로그인 ---------- */
// Supabase Auth 로 인증하고, 거래처 재고까지 받아온 뒤 화면에 들어간다.
async function attemptLogin(id, pw){
  const rawId = id?.trim(), rawPw = pw?.trim();
  const err = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  err.textContent = "";
  btn.disabled = true;
  try {
    const acc = await API.login(rawId, rawPw);

    // 본사(HQ) 계정 분기 — 완전히 다른 콘솔로 진입
    if (acc.isHQ){ SESSION = null; await enterHQ(); return; }   // 목록을 받아온 뒤 진입

    // 대시보드·재고·발주 화면이 SESSION.acc.inventory 를 읽는다
    acc.inventory = await API.getInventory(acc.id);
    acc.orderHistory = await API.getOrders(acc.id);

    SESSION = { id:acc.id, acc };
    CART = null;   // 계정 진입 시 발주 카트 초기화(다음 발주 탭 진입에서 권장안으로 채움)
    showApp();
  } catch (e){
    err.textContent = e.message || "로그인에 실패했습니다.";
  } finally {
    btn.disabled = false;
  }
}

// ID 만 채운다. 비밀번호는 Supabase Auth 에 있고 저장소에 두지 않는다.
function fillDemo(id){
  document.getElementById("loginId").value = id;
  const pw = document.getElementById("loginPw");
  pw.value = "";
  pw.focus();
}

function logout(){
  chatUnsub();
  API.logout().catch(()=>{});   // Supabase 세션도 함께 종료
  SESSION = null;
  document.getElementById("appRoot").style.display = "none";
  const hq = document.getElementById("hqRoot");
  if (hq) hq.style.display = "none";
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
  if (name !== "contact") chatUnsub();
  document.querySelectorAll("#appRoot .tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll("#appRoot .view").forEach(v =>
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
      <td data-label="제품"><div class="pname">${x.product.name}</div>
          <div class="sku">${x.sku}</div></td>
      <td class="num-cell" data-label="현재고">${x.stock} ${x.product.unit}</td>
      <td class="num-cell" data-label="예상 소진">${x.daysLeft ?? "—"}일</td>
      <td data-label="결품 위험">${riskMeter(x.stockoutProb)}</td>
      <td data-label="상태">${statusPill(x)}</td>
      <td class="num-cell" data-label="권장 발주일">${x.reorderDate ? fmtDate(x.reorderDate) : "—"}</td>
    </tr>`).join("");
  document.getElementById("dashRows").innerHTML = rows;
}

/* ---------- 재고 입력/조정 ---------- */
function renderInventory(){
  const analyzed = analyzeAccount(SESSION.acc);
  const rows = analyzed.map(x => `
    <tr>
      <td data-label="분류"><span class="cat-tag">${x.product.cat}</span></td>
      <td data-label="제품"><div class="pname">${x.product.name}</div>
          <div class="sku">${x.sku}</div></td>
      <td data-label="현재고 조정">
        <div class="qty-adjust">
          <button onclick="adjustStock('${x.sku}',-1)" aria-label="감소">–</button>
          <input type="number" value="${x.stock}" min="0"
                 onchange="setStock('${x.sku}', this.value)">
          <button onclick="adjustStock('${x.sku}',1)" aria-label="증가">+</button>
        </div>
      </td>
      <td class="num-cell" data-label="일 사용량">${x.dailyUse}/일</td>
      <td class="num-cell" data-label="예상 소진">${x.daysLeft ?? "—"}일</td>
      <td data-label="상태">${statusPill(x)}</td>
    </tr>`).join("");
  document.getElementById("invRows").innerHTML = rows;
}
function findInv(sku){ return SESSION.acc.inventory.find(i=>i.sku===sku); }

// 화면을 먼저 바꾸고 저장은 뒤따른다(입력 반응이 느려지지 않게).
// 저장이 실패하면 이전 값으로 되돌리고 알린다.
async function saveStock(sku, next){
  const it = findInv(sku);
  const prev = it.stock;
  if (next === prev){ renderInventory(); return; }   // 표기만 정리

  it.stock = next;
  renderInventory(); refreshBadge();
  try {
    await API.setStock(SESSION.id, sku, next);
  } catch (e){
    it.stock = prev;
    renderInventory(); refreshBadge();
    toast("재고 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
function adjustStock(sku, delta){
  saveStock(sku, Math.max(0, findInv(sku).stock + delta));
}
function setStock(sku, val){
  saveStock(sku, Math.max(0, parseInt(val)||0));
}

/* ---------- 발주 추천 ---------- */
// 장바구니(발주 카트). 발주 탭 진입 시 권장 발주안으로 초기 세팅.
let CART = null;   // [{sku, qty}]

function buildDefaultCart(){
  const plan = buildReorderPlan(analyzeAccount(SESSION.acc));
  return plan.map(i => ({ sku:i.sku, qty:i.qty }));
}
function cartLine(sku){ return CART.find(c => c.sku === sku); }

function renderOrders(){
  const analyzed = analyzeAccount(SESSION.acc);
  // 최초 진입 시에만 권장 발주안으로 채운다 (사용자가 비운 상태는 유지)
  if (CART === null) CART = buildDefaultCart();
  renderCart();

  // 예측 발주 일정 (임박순)
  const sched = analyzed.filter(x=>x.reorderDate).slice(0,8).map(x=>`
    <tr>
      <td data-label="제품"><div class="pname">${x.product.name}</div><div class="sku">${x.sku}</div></td>
      <td class="num-cell" data-label="예상 소진">${x.daysLeft ?? "—"}일</td>
      <td class="num-cell" data-label="권장 수량">${x.suggestQty} ${x.product.unit}</td>
      <td data-label="권장 발주일">${x.reorderDate ? fmtDate(x.reorderDate) : "—"}</td>
      <td data-label="상태">${statusPill(x)}</td>
    </tr>`).join("");
  document.getElementById("schedRows").innerHTML = sched;

  // 품목 추가 드롭다운: 카트에 없는 전 카탈로그
  const inCart = new Set(CART.map(c=>c.sku));
  const opts = CATALOG.filter(p=>!inCart.has(p.sku))
    .map(p=>`<option value="${p.sku}">${p.name} · ${p.sku}</option>`).join("");
  const sel = document.getElementById("addItemSel");
  sel.innerHTML = `<option value="">＋ 품목 추가…</option>` + opts;
}

function renderCart(){
  const box = document.getElementById("orderPlan");
  if (CART.length === 0){
    box.innerHTML = `<div class="empty">발주할 품목이 없습니다.<br>
      아래에서 품목을 추가하거나, 권장 발주안을 다시 불러올 수 있습니다.
      <div style="margin-top:14px">
        <button class="btn ghost" style="width:auto;padding:9px 16px;display:inline-block"
                onclick="resetCart()">권장 발주안 불러오기</button>
      </div></div>`;
    return;
  }
  let total = 0;
  const lines = CART.map(c => {
    const p = findProduct(c.sku);
    const sub = c.qty * p.price; total += sub;
    return `
      <div class="cart-line">
        <div class="info">
          <div class="pname">${p.name}</div>
          <div class="sku">${p.sku} · ${won(p.price)}/${p.unit} · 발주단위 ${p.pack}</div>
        </div>
        <div class="qty-adjust">
          <button onclick="cartAdjust('${c.sku}',${-p.pack})" aria-label="감소">–</button>
          <input type="number" min="0" value="${c.qty}"
                 onchange="cartSet('${c.sku}', this.value)">
          <button onclick="cartAdjust('${c.sku}',${p.pack})" aria-label="증가">+</button>
        </div>
        <div class="cart-sub">${won(sub)}</div>
        <button class="cart-remove" onclick="cartRemove('${c.sku}')" aria-label="삭제">✕</button>
      </div>`;
  }).join("");

  box.innerHTML = lines + `
    <div class="order-foot">
      <span style="color:var(--ink-soft);font-size:13px">발주 합계</span>
      <span class="order-total">${won(total)}</span>
      <span class="spacer" style="flex:1"></span>
      <button class="btn ghost" style="width:auto;padding:10px 16px"
              onclick="resetCart()">권장안으로 초기화</button>
      <button class="btn" id="placeOrderBtn" style="width:auto;padding:10px 20px"
              onclick="placeOrder()">발주 확정</button>
    </div>`;
}

// 발주 단위(pack) 만큼 증감
function cartAdjust(sku, delta){
  const l = cartLine(sku); if(!l) return;
  l.qty = Math.max(0, l.qty + delta);
  if (l.qty === 0) cartRemove(sku); else renderCart();
}
function cartSet(sku, val){
  const l = cartLine(sku); if(!l) return;
  l.qty = Math.max(0, parseInt(val)||0);
  if (l.qty === 0) cartRemove(sku); else renderCart();
}
function cartRemove(sku){
  CART = CART.filter(c=>c.sku!==sku);
  renderOrders();
}
function cartAddFromSelect(sku){
  if (!sku) return;
  if (!cartLine(sku)){
    const p = findProduct(sku);
    CART.push({ sku, qty: p.pack });   // 기본 1팩
  }
  renderOrders();
  toast(`${findProduct(sku).name} 추가됨`);
}
function resetCart(){
  CART = buildDefaultCart();
  renderOrders();
  toast("권장 발주안으로 초기화했습니다.");
}

// 주문 저장과 재고 반영은 DB 함수(place_order)가 한 번에 처리한다.
// 끝난 뒤 재고·이력을 서버에서 다시 읽어 화면을 맞춘다.
async function placeOrder(){
  if (!CART || CART.length === 0){ toast("발주할 품목이 없습니다."); return; }
  const btn = document.getElementById("placeOrderBtn");
  if (btn) btn.disabled = true;

  try {
    const orderId = await API.placeOrder(SESSION.id, CART.map(c => ({ sku:c.sku, qty:c.qty })));

    SESSION.acc.inventory    = await API.getInventory(SESSION.id);
    SESSION.acc.orderHistory = await API.getOrders(SESSION.id);

    // 방금 만든 주문을 id 로 집는다 (같은 날 주문이 여럿일 수 있다)
    const placed = SESSION.acc.orderHistory.find(o => Number(o.id) === Number(orderId));
    toast(`발주가 접수되었습니다 · ${won(placed ? placed.total : 0)} (입고까지 약 ${LEAD_TIME_DAYS}일)`);

    CART = buildDefaultCart();   // 반영된 재고 기준으로 권장안 재설정
    renderOrders(); refreshBadge();   // 버튼은 여기서 다시 그려진다
  } catch (e){
    toast("발주 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    if (btn) btn.disabled = false;
  }
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
// 본사 인박스와 같은 messages 테이블을 본다. 양쪽이 하나의 대화다.

function chatUnsub(){
  if (CHAT_SUB){ CHAT_SUB.unsubscribe(); CHAT_SUB = null; }
}

async function renderContact(){
  const el = document.getElementById("msgList");
  try {
    CHAT_LOG = await API.getMessages(SESSION.id);
  } catch (e){
    el.innerHTML = `<div class="empty">대화를 불러오지 못했습니다.</div>`;
    return;
  }
  drawChat();

  // 본사가 보낸 메시지를 읽음 처리
  API.markRead(SESSION.id, "hq").catch(()=>{});

  // 본사가 새로 보내면 바로 붙인다
  chatUnsub();
  CHAT_SUB = API.watchMessages(SESSION.id, m => {
    if (CHAT_LOG.some(x => x.id === m.id)) return;   // 내가 방금 보낸 것
    CHAT_LOG.push(m);
    drawChat();
    if (m.who === "hq") API.markRead(SESSION.id, "hq").catch(()=>{});
  });
}

function drawChat(){
  const el = document.getElementById("msgList");
  if (!CHAT_LOG.length){
    el.innerHTML = `<div class="empty">아직 주고받은 메시지가 없습니다.<br>
      제품 문의나 건의사항을 남겨주세요.</div>`;
    return;
  }
  el.innerHTML = CHAT_LOG.map(m=>`
    <div class="msg ${m.who==="account" ? "me" : "them"}">
      <div class="who">${m.who==="account" ? "우리 병원" : (m.name || "유엔아이메디컬 CS")}</div>
      <div>${m.cat ? `[${escapeHtml(m.cat)}] ` : ""}${escapeHtml(m.text)}</div>
      <div class="time">${fmtWhen(m.at)}</div>
    </div>`).join("");
  el.scrollTop = el.scrollHeight;
}

async function sendMessage(){
  const ta  = document.getElementById("chatText");
  const cat = document.getElementById("chatCat").value;
  const btn = document.getElementById("chatSend");
  const text = ta.value.trim();
  if (!text) return;

  btn.disabled = true;
  try {
    const m = await API.sendMessage(SESSION.id, "account", text, cat);
    CHAT_LOG.push(m);
    ta.value = "";
    drawChat();
  } catch (e){
    toast("메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 공통 UI ---------- */
function statusPill(x){
  const label = { ok:"충분", soon:"발주 임박", now:"발주 필요", out:"결품" }[x.status];
  return `<span class="pill ${x.status}">${label}</span>`;
}
// [AI 데모] 결품 위험 확률 → 색상 배지. 실서비스: 분류 모델 예측 확률.
function riskMeter(prob){
  const pct = Math.round((prob||0)*100);
  const cls = pct>=66 ? "now" : pct>=33 ? "soon" : "ok";
  return `<span class="risk-badge ${cls}">${pct}%</span>`;
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
// 오늘이면 시:분, 어제면 '어제 시:분', 그 밖이면 월/일
function fmtWhen(iso){
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const hhmm = d.toTimeString().slice(0,5);
  if (d.toDateString() === now.toDateString()) return hhmm;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `어제 ${hhmm}`;
  return `${d.getMonth()+1}/${d.getDate()}`;
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
  document.querySelectorAll("#appRoot .tab").forEach(t=>
    t.addEventListener("click", ()=>switchTab(t.dataset.tab)));
  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("chatSend").addEventListener("click", sendMessage);
  document.getElementById("addItemSel").addEventListener("change", function(){
    cartAddFromSelect(this.value); this.value = "";
  });
});
