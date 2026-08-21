/* =========================================================================
   UNI Medical VMI — 백엔드 접근 계층 (초안)

   화면 코드는 Supabase를 직접 부르지 않고 반드시 이 파일의 API.* 만 쓴다.
   나중에 백엔드를 자체 API 서버로 바꿔도 이 파일만 고치면 되게 하기 위함이다.

   반환 형태는 지금 js/data.js 가 쓰던 모양(카멜케이스)에 맞춘다.
   그래야 engine.js / hq.js / app.js 의 계산·렌더 코드를 그대로 쓸 수 있다.

   사용 전 준비
     1) index.html 에 아래 두 줄을 js/data.js 앞에 넣는다
          <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
          <script src="js/config.js"></script>
          <script src="js/api.js"></script>
     2) js/config.js 에 프로젝트 URL 과 anon key 를 채운다
   ========================================================================= */

const API = (() => {

  let db = null;
  function client(){
    if (db) return db;
    if (typeof SUPABASE_CONFIG === "undefined" || !SUPABASE_CONFIG.url){
      throw new Error("js/config.js 에 Supabase 접속 정보가 없습니다.");
    }
    db = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    return db;
  }

  // 쿼리 실패를 한곳에서 처리한다. 화면에서는 try/catch 후 toast() 로 안내.
  function unwrap({ data, error }){
    if (error) throw new Error(error.message);
    return data;
  }

  // 거래처 id → 로그인용 이메일. 실제 서비스로 갈 때 담당자 실제 이메일로 대체.
  const emailOf = id => `${id}@demo.uni-medical.local`;

  /* ---------- 인증 ---------- */

  async function login(id, pw){
    const { data, error } = await client().auth.signInWithPassword({
      email: emailOf(id.trim()), password: pw,
    });
    if (error) throw new Error("ID 또는 비밀번호가 올바르지 않습니다.");

    const account = unwrap(await client()
      .from("accounts").select("*").eq("auth_user_id", data.user.id).single());
    return toAccount(account);
  }

  async function logout(){
    await client().auth.signOut();
  }

  // 새로고침 후에도 로그인 상태를 잇는다. 없으면 null.
  async function currentAccount(){
    const { data } = await client().auth.getSession();
    if (!data.session) return null;
    const rows = unwrap(await client()
      .from("accounts").select("*").eq("auth_user_id", data.session.user.id));
    return rows.length ? toAccount(rows[0]) : null;
  }

  /* ---------- 제품 ---------- */

  async function getProducts(){
    const rows = unwrap(await client().from("products").select("*").order("sku"));
    return rows.map(r => ({
      sku:r.sku, name:r.name, cat:r.category, unit:r.unit, price:r.price, pack:r.pack,
    }));
  }

  /* ---------- 거래처 재고 ---------- */

  async function getInventory(accountId){
    const rows = unwrap(await client()
      .from("inventory").select("*").eq("account_id", accountId));
    return rows.map(r => ({
      sku:r.sku, stock:r.stock, dailyUse:Number(r.daily_use),
      reorderPoint:r.reorder_point, parLevel:r.par_level,
    }));
  }

  async function setStock(accountId, sku, stock){
    unwrap(await client().from("inventory")
      .update({ stock, updated_at:new Date().toISOString() })
      .eq("account_id", accountId).eq("sku", sku));
  }

  // 추천 제품을 재고 목록에 새로 편입할 때
  async function addInventoryItem(accountId, sku, init){
    unwrap(await client().from("inventory").insert({
      account_id:accountId, sku, stock:init.stock ?? 0,
      daily_use:init.dailyUse ?? 0.5,
      reorder_point:init.reorderPoint ?? 4, par_level:init.parLevel ?? 10,
    }));
  }

  /* ---------- 발주 ---------- */

  // items: [{sku, qty}] — 주문 생성과 재고 반영을 DB 함수에서 한 번에 처리
  async function placeOrder(accountId, items){
    return unwrap(await client().rpc("place_order", {
      p_account_id: accountId, p_items: items,
    }));
  }

  async function getOrders(accountId){
    const rows = unwrap(await client()
      .from("orders")
      .select("id, ordered_on, stage, total, order_items(sku, qty)")
      .eq("account_id", accountId)
      .order("ordered_on", { ascending:false })
      .order("id", { ascending:false }));   // 같은 날 주문의 선후 구분
    return rows.map(o => ({
      id:o.id, date:o.ordered_on, stage:o.stage, total:o.total,
      items:o.order_items.map(i => [i.sku, i.qty]),
    }));
  }

  /* ---------- 본사: 거래처 목록 ---------- */

  async function getFleet(){
    const rows = unwrap(await client()
      .from("accounts")
      .select("id, name, type, tier, region, is_live, account_metrics(*)")
      .eq("is_hq", false));
    return rows.map(a => {
      // PostgREST 는 1:1 이면 객체, 1:N 이면 배열로 준다. 둘 다 받아둔다.
      const am = a.account_metrics;
      const m = (Array.isArray(am) ? am[0] : am) || {};
      return {
        id:a.id, name:a.name, type:a.type, tier:a.tier, region:a.region,
        detailed:a.is_live,
        skus:m.skus ?? 0, risk:m.risk ?? 0, watch:m.watch ?? 0,
        monthlyRevenue:Number(m.monthly_revenue ?? 0),
        turnover:Number(m.turnover ?? 0), fillRate:Number(m.fill_rate ?? 0),
        openIssues:m.open_issues ?? 0, status:m.status ?? "healthy",
      };
    });
  }

  async function getSkuMetrics(){
    const rows = unwrap(await client().from("sku_metrics").select("*"));
    return rows.map(m => ({
      sku:m.sku, monthlyQty:m.monthly_qty, trend:Number(m.trend),
      accounts:m.accounts_count, turnover:Number(m.turnover),
      wasteRate:Number(m.waste_rate), recWins:m.rec_wins,
    }));
  }

  /* ---------- 본사: 중앙물류센터 재고 ---------- */

  // 표에 보일 월 = 직전 완료 3개월 + 당월.
  // 사용량재고는 이 중 '당월을 뺀 3개월' 합이다 (당월은 아직 안 끝났다).
  function warehouseMonthWindow(){
    const now = new Date(), out = [];
    for (let i = 3; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      out.push({ key:`${d.getFullYear()}-${mm}-01`, label:`${d.getFullYear()}년 ${mm}월` });
    }
    return out;
  }

  // v_warehouse 뷰가 사용량재고·적정재고·상태까지 계산해서 준다.
  async function getWarehouse(){
    const rows = unwrap(await client().from("v_warehouse").select("*"));
    const monthly = unwrap(await client()
      .from("warehouse_monthly").select("*").order("month"));

    const win = warehouseMonthWindow();
    const bySku = {};
    monthly.forEach(m => { (bySku[m.sku] ||= {})[m.month] = m.qty; });

    return rows.map(r => ({
      sku:r.sku, stock:r.stock,
      monthly: win.map(w => bySku[r.sku]?.[w.key] ?? 0),
      use3:r.use3, proper:r.proper, status:r.status, parOverride:r.par_override,
      inbound:r.inbound, inboundEta:r.inbound_eta ?? "",
      orderNote:r.order_note, orderNoteByUser:r.order_note_by_user,
      inNote:r.in_note,      inNoteByUser:r.in_note_by_user,
    }));
  }

  // 표 머리글용 월 이름. getWarehouse() 의 monthly 배열과 같은 순서다.
  async function getWarehouseMonths(){
    return warehouseMonthWindow().map(w => w.label);
  }

  // 실사 입력
  async function setWarehouseStock(sku, stock){
    unwrap(await client().from("warehouse_stock").update({
      stock, counted_at:new Date().toISOString(), updated_at:new Date().toISOString(),
    }).eq("sku", sku));
  }

  // 적정재고 직접 지정. null 을 넣으면 자동 계산(사용량재고 × 0.833)으로 돌아간다.
  async function setWarehouseProper(sku, value){
    unwrap(await client().from("warehouse_stock").update({
      par_override: value, updated_at:new Date().toISOString(),
    }).eq("sku", sku));
  }

  // 발주 필요 / 입고 예정 메모. 사람이 쓴 순간부터 추천값이 덮어쓰지 않는다.
  async function setWarehouseNote(sku, field, text){
    const col = field === "orderNote" ? "order_note" : "in_note";
    unwrap(await client().from("warehouse_stock").update({
      [col]: text, [col + "_by_user"]: true, updated_at:new Date().toISOString(),
    }).eq("sku", sku));
  }

  /* ---------- 출고 등록 ---------- */

  // 재고 차감 · 당월 출고량 누적 · 이력 남기기를 DB 함수가 한 번에 한다.
  async function shipStock(accountId, sku, qty){
    return unwrap(await client().rpc("ship_stock", {
      p_account_id: accountId, p_sku: sku, p_qty: qty,
    }));
  }

  const SHIPMENT_COLS =
    "id, account_id, sku, qty, shipped_on, created_at, accounts(name)";

  function toShipment(r){
    return {
      id:r.id, sku:r.sku, qty:r.qty, shippedOn:r.shipped_on, at:r.created_at,
      account: (Array.isArray(r.accounts) ? r.accounts[0] : r.accounts)?.name ?? r.account_id,
    };
  }

  async function getShipments(limit = 10){
    const rows = unwrap(await client()
      .from("shipments").select(SHIPMENT_COLS)
      .order("created_at", { ascending:false })
      .limit(limit));
    return rows.map(toShipment);
  }

  // 기간별 출고 내역 (엑셀 내보내기용). from·to 는 "YYYY-MM-DD", 양끝 포함.
  // shipped_on 은 DB 기준 날짜(UTC)라 이른 아침 건이 하루 밀린다.
  // 화면에 보이는 날짜와 맞추려고 현지 시각 경계로 자른다.
  async function getShipmentsRange(from, to){
    const start = new Date(`${from}T00:00:00`);
    const end   = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);              // 종료일까지 포함
    const rows = unwrap(await client()
      .from("shipments").select(SHIPMENT_COLS)
      .gte("created_at", start.toISOString())
      .lt("created_at",  end.toISOString())
      .order("created_at", { ascending:true }));
    return rows.map(toShipment);
  }

  // 오늘 출고 수량 합계 (상단 지표)
  async function getShippedToday(){
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const rows = unwrap(await client()
      .from("shipments").select("qty").gte("created_at", midnight.toISOString()));
    return rows.reduce((s,r)=> s + r.qty, 0);
  }

  /* ---------- 소통 ---------- */

  // 거래처 화면과 본사 인박스가 같은 테이블을 본다.
  async function getMessages(accountId){
    const rows = unwrap(await client()
      .from("messages").select("*")
      .eq("account_id", accountId).order("created_at"));
    return rows.map(toMessage);
  }

  // 본사 인박스 목록: 거래처별 마지막 메시지와 미읽음 수
  async function getInbox(){
    const rows = unwrap(await client()
      .from("messages").select("*, accounts(name)")
      .order("created_at", { ascending:false }));

    const byAccount = new Map();
    rows.forEach(r => {
      const cur = byAccount.get(r.account_id);
      if (!cur){
        byAccount.set(r.account_id, {
          accountId:r.account_id, account:r.accounts?.name ?? r.account_id,
          cat:r.category ?? "문의", preview:r.body, time:r.created_at,
          unread: r.sender === "account" && !r.read_at ? 1 : 0,
        });
      } else if (r.sender === "account" && !r.read_at){
        cur.unread += 1;
      }
    });
    return [...byAccount.values()];
  }

  async function sendMessage(accountId, sender, body, category){
    const row = unwrap(await client().from("messages")
      .insert({ account_id:accountId, sender, body, category:category ?? null })
      .select().single());
    return toMessage(row);
  }

  // 상대가 보낸 미읽음 메시지를 읽음 처리
  async function markRead(accountId, sender){
    unwrap(await client().from("messages")
      .update({ read_at:new Date().toISOString() })
      .eq("account_id", accountId).eq("sender", sender).is("read_at", null));
  }

  // 새 메시지를 실시간으로 받는다. 반환값의 unsubscribe() 로 해제.
  function watchMessages(accountId, onInsert){
    const ch = client()
      .channel(`messages:${accountId}`)
      .on("postgres_changes",
          { event:"INSERT", schema:"public", table:"messages",
            filter:`account_id=eq.${accountId}` },
          payload => onInsert(toMessage(payload.new)))
      .subscribe();
    return { unsubscribe: () => client().removeChannel(ch) };
  }

  // 물류센터 재고 변화를 실시간으로 받는다. (실시간 재고 관리 화면)
  function watchWarehouse(onChange){
    const ch = client()
      .channel("warehouse")
      .on("postgres_changes",
          { event:"UPDATE", schema:"public", table:"warehouse_stock" },
          payload => onChange(payload.new))
      .subscribe();
    return { unsubscribe: () => client().removeChannel(ch) };
  }

  /* ---------- 변환 ---------- */

  function toAccount(r){
    return {
      id:r.id, isHQ:r.is_hq,
      profile:{ name:r.name, type:r.type, tier:r.tier, region:r.region,
                contact:r.contact, beds:r.beds, since:r.since },
    };
  }

  function toMessage(r){
    return {
      id:r.id, accountId:r.account_id,
      who: r.sender === "hq" ? "hq" : "account",
      name:r.sender_name, cat:r.category, text:r.body,
      at:r.created_at, readAt:r.read_at,
    };
  }

  return {
    login, logout, currentAccount,
    getProducts,
    getInventory, setStock, addInventoryItem,
    placeOrder, getOrders,
    getFleet, getSkuMetrics,
    getWarehouse, getWarehouseMonths, setWarehouseStock, setWarehouseProper, setWarehouseNote,
    shipStock, getShipments, getShipmentsRange, getShippedToday,
    getMessages, getInbox, sendMessage, markRead,
    watchMessages, watchWarehouse,
  };
})();
