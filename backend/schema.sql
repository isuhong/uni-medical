-- =========================================================================
-- 유엔아이메디컬 VMI — 데이터베이스 스키마 (초안)
-- 대상: Supabase (PostgreSQL 15+)
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 실행
-- 그다음 seed.sql 을 실행해 데모 데이터를 넣는다.
--
-- 설계 원칙
--   1. 프런트엔드 js/data.js 의 구조를 그대로 옮긴다. 화면 코드를 최소한으로 고치기 위함.
--   2. 계산(소진 예측·적정재고·상태)은 지금처럼 프런트 engine.js 에서 한다.
--      단, 물류센터 상태만 v_warehouse 뷰로도 제공해 목록 정렬·필터에 쓸 수 있게 한다.
--   3. 비밀번호는 이 DB에 저장하지 않는다. Supabase Auth 를 쓴다. (아래 '인증' 주석 참고)
-- =========================================================================

-- ---- 정리 (재실행 편의용. 운영 DB에서는 이 블록을 지울 것) -----------------
drop view   if exists v_warehouse cascade;
drop table  if exists shipments         cascade;
drop table  if exists messages          cascade;
drop table  if exists order_items       cascade;
drop table  if exists orders            cascade;
drop table  if exists inventory         cascade;
drop table  if exists warehouse_monthly cascade;
drop table  if exists warehouse_stock   cascade;
drop table  if exists sku_metrics       cascade;
drop table  if exists account_metrics   cascade;
drop table  if exists accounts          cascade;
drop table  if exists products          cascade;
drop function if exists current_account_id() cascade;
drop function if exists is_hq() cascade;


-- =========================================================================
-- 1. 제품 카탈로그
-- =========================================================================
create table products (
  sku        text primary key,                    -- 예: UNI-GZ-7100
  name       text        not null,
  category   text        not null,                -- 고정 | 압박 | 재활 | 소모품
  unit       text        not null,                -- 롤 | 개 | 팩 …
  price      integer     not null check (price >= 0),   -- 원 단위 (KRW)
  pack       integer     not null check (pack  >  0),   -- 발주 단위
  created_at timestamptz not null default now()
);

comment on column products.pack is '발주 시 이 수량의 배수로 올림한다';


-- =========================================================================
-- 2. 거래처
--
-- 인증: 비밀번호는 여기 두지 않는다. Supabase Auth 의 사용자를 만들고
--       auth_user_id 로 연결한다. 데모 계정은 아래 이메일 규칙을 쓴다.
--         hy-univ      → hy-univ@demo.uni-medical.local
--         uni-hq       → uni-hq@demo.uni-medical.local
--       (실제 서비스로 갈 때는 담당자 실제 이메일로 바꾼다)
-- =========================================================================
create table accounts (
  id           text primary key,                  -- 예: hy-univ, c-004, uni-hq
  name         text        not null,
  type         text        not null,              -- 대학병원 (3차) …
  tier         text            null,              -- univ | secondary | clinic
  region       text            null,
  contact      text            null,
  beds         integer         null,
  since        text            null,              -- YYYY-MM
  is_hq        boolean     not null default false,-- 본사 계정 여부
  is_live      boolean     not null default false,-- 재고를 실시간 연동하는 거래처인지
  auth_user_id uuid            null unique,       -- references auth.users(id)
  created_at   timestamptz not null default now()
);

comment on column accounts.is_live is
  '참이면 inventory 에 실제 재고가 있는 거래처. 거짓이면 요약 지표만 있는 데모 거래처.';


-- 본사 관제 화면용 월간 집계. 원래는 트랜잭션에서 계산할 값이지만
-- 지금은 데모 수치를 그대로 보관한다. (프런트의 FLEET)
create table account_metrics (
  account_id      text primary key references accounts(id) on delete cascade,
  skus            integer not null default 0,
  risk            integer not null default 0,     -- 결품 위험 품목 수
  watch           integer not null default 0,     -- 임박 품목 수
  monthly_revenue bigint  not null default 0,     -- 원
  turnover        numeric(5,2) not null default 0,-- 회전율
  fill_rate       numeric(5,4) not null default 0,-- 0~1
  open_issues     integer not null default 0,
  status          text    not null default 'healthy'
                  check (status in ('healthy','watch','risk')),
  updated_at      timestamptz not null default now()
);


-- =========================================================================
-- 3. 거래처 재고
-- =========================================================================
create table inventory (
  account_id    text    not null references accounts(id) on delete cascade,
  sku           text    not null references products(sku),
  stock         integer not null default 0 check (stock >= 0),
  daily_use     numeric(6,2) not null default 0,  -- 일 평균 사용량
  reorder_point integer not null default 0,       -- 발주점
  par_level     integer not null default 0,       -- 적정 최대재고
  updated_at    timestamptz not null default now(),
  primary key (account_id, sku)
);

create index inventory_sku_idx on inventory (sku);


-- =========================================================================
-- 4. 발주
-- =========================================================================
create table orders (
  id         bigint generated always as identity primary key,
  account_id text        not null references accounts(id) on delete cascade,
  ordered_on date        not null default current_date,
  stage      text        not null default '발주 대기'
             check (stage in ('발주 대기','배송 중','처리 완료')),
  total      bigint      not null default 0,      -- 원
  created_at timestamptz not null default now()
);

create table order_items (
  order_id bigint  not null references orders(id) on delete cascade,
  sku      text    not null references products(sku),
  qty      integer not null check (qty > 0),
  price    integer not null default 0,            -- 주문 시점 단가 (원)
  primary key (order_id, sku)
);

create index orders_account_idx on orders (account_id, ordered_on desc);


-- =========================================================================
-- 5. 중앙물류센터 재고 — '재고현황' 엑셀 시트에 대응
--
--   재고수량   → stock          (담당자가 실사 후 직접 입력)
--   발주 필요  → order_note     (추천값이 채워지되 메모로 덮어쓸 수 있음)
--   입고 예정  → in_note        (동상)
--   *_by_user 가 참이면 사람이 직접 쓴 메모이므로 추천값으로 덮어쓰지 않는다.
-- =========================================================================
create table warehouse_stock (
  sku               text primary key references products(sku),
  stock             integer not null default 0 check (stock >= 0),
  inbound           integer not null default 0,   -- 입고 예정 수량
  inbound_eta       text        null,             -- '8월 21일' 형식 (현장 표기 유지)
  order_note        text        null,
  order_note_by_user boolean not null default false,
  in_note           text        null,
  in_note_by_user   boolean not null default false,
  counted_at        timestamptz     null,         -- 마지막 실사 입력 시각
  updated_at        timestamptz not null default now()
);

-- SKU별 월 출고량. month 는 해당 월의 1일로 저장한다. (2026-07-01 = 2026년 07월)
create table warehouse_monthly (
  sku   text    not null references products(sku) on delete cascade,
  month date    not null,
  qty   integer not null default 0,
  primary key (sku, month)
);

comment on table warehouse_monthly is
  '사용량재고 = 최근 3개월 합, 적정재고 = 사용량재고 × 0.833 (현장 엑셀 수식)';


-- 엑셀 시트와 같은 계산을 뷰로 제공. 프런트는 이 뷰를 그대로 표에 뿌릴 수 있다.
-- 출고 이력 (본사가 등록한 거래처별 출고)
create table if not exists shipments (
  id         bigint generated always as identity primary key,
  account_id text    not null references accounts(id) on delete cascade,
  sku        text    not null references products(sku),
  qty        integer not null check (qty > 0),
  shipped_on date    not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists shipments_recent_idx on shipments (created_at desc);
create index if not exists shipments_day_idx    on shipments (shipped_on);


create view v_warehouse as
with last3 as (
  select sku, sum(qty) as use3
  from (
    select sku, qty,
           row_number() over (partition by sku order by month desc) as rn
    from warehouse_monthly
  ) t
  where rn <= 3
  group by sku
)
select
  w.sku,
  p.name,
  p.category,
  p.unit,
  w.stock,
  coalesce(l.use3, 0)                            as use3,        -- 사용량재고
  round(coalesce(l.use3, 0) * 0.833)::int        as proper,      -- 적정재고
  w.inbound,
  w.inbound_eta,
  w.order_note,
  w.order_note_by_user,
  w.in_note,
  w.in_note_by_user,
  case
    when w.stock <= 0                                     then 'out'
    when w.stock <  round(coalesce(l.use3,0) * 0.833)     then 'now'
    when w.stock <  round(coalesce(l.use3,0) * 0.833)*1.2 then 'soon'
    else 'ok'
  end                                            as status,
  w.counted_at,
  w.updated_at
from warehouse_stock w
join products p on p.sku = w.sku
left join last3 l on l.sku = w.sku;


-- 제품·수요 분석 화면용 SKU 지표 (프런트의 SKU_METRICS)
create table sku_metrics (
  sku            text primary key references products(sku) on delete cascade,
  monthly_qty    integer not null default 0,
  trend          numeric(5,3) not null default 0,   -- -1 ~ 1
  accounts_count integer not null default 0,
  turnover       numeric(5,2) not null default 0,
  waste_rate     numeric(5,3) not null default 0,
  rec_wins       integer not null default 0
);


-- =========================================================================
-- 6. 소통 — 거래처 소통창과 본사 인박스를 한 테이블로 합친다
--    (지금 프런트는 CHAT / HQ_INBOX 로 나뉘어 있어 양방향이 이어지지 않는다)
-- =========================================================================
create table messages (
  id          bigint generated always as identity primary key,
  account_id  text        not null references accounts(id) on delete cascade,
  sender      text        not null check (sender in ('account','hq')),
  sender_name text            null,             -- '한양대학교병원 구매물류팀' 등
  category    text            null,             -- 제품 문의 | 품질 건의 | 신제품 요청 | 배송/발주
  body        text        not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz     null              -- 상대가 읽은 시각. null 이면 미읽음
);

create index messages_account_idx on messages (account_id, created_at desc);
create index messages_unread_idx  on messages (account_id) where read_at is null;


-- =========================================================================
-- 7. 접근 제어 (RLS)
--
--   거래처 계정: 자기 데이터만 읽고 쓴다
--   본사 계정  : 전부 읽고 쓴다
--   제품 카탈로그는 로그인한 사용자 모두 읽기 가능
--
--   ※ 초안이다. 운영 전에 반드시 각 정책을 실제 계정으로 눌러보며 검증할 것.
-- =========================================================================

-- 현재 로그인한 사용자의 거래처 id
create function current_account_id() returns text
language sql stable security definer set search_path = public as $$
  select id from accounts where auth_user_id = auth.uid()
$$;

-- 본사 계정인지
create function is_hq() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_hq from accounts where auth_user_id = auth.uid()), false)
$$;

alter table products          enable row level security;
alter table accounts          enable row level security;
alter table account_metrics   enable row level security;
alter table inventory         enable row level security;
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table warehouse_stock   enable row level security;
alter table warehouse_monthly enable row level security;
alter table sku_metrics       enable row level security;
alter table messages          enable row level security;
alter table shipments         enable row level security;

-- 카탈로그: 로그인한 사용자면 읽기
create policy products_read on products
  for select to authenticated using (true);

-- 거래처: 본인 또는 본사
create policy accounts_read on accounts
  for select to authenticated
  using (is_hq() or id = current_account_id());

create policy account_metrics_read on account_metrics
  for select to authenticated
  using (is_hq() or account_id = current_account_id());

-- 재고: 본인 것은 읽고 쓰기, 본사는 전부
create policy inventory_read on inventory
  for select to authenticated
  using (is_hq() or account_id = current_account_id());

create policy inventory_write on inventory
  for update to authenticated
  using (is_hq() or account_id = current_account_id())
  with check (is_hq() or account_id = current_account_id());

create policy inventory_insert on inventory
  for insert to authenticated
  with check (is_hq() or account_id = current_account_id());

-- 발주
create policy orders_read on orders
  for select to authenticated
  using (is_hq() or account_id = current_account_id());

create policy orders_insert on orders
  for insert to authenticated
  with check (is_hq() or account_id = current_account_id());

create policy orders_update on orders
  for update to authenticated
  using (is_hq()) with check (is_hq());       -- 단계 변경은 본사만

create policy order_items_read on order_items
  for select to authenticated
  using (exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and (is_hq() or o.account_id = current_account_id())));

create policy order_items_insert on order_items
  for insert to authenticated
  with check (exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and (is_hq() or o.account_id = current_account_id())));

-- 물류센터: 읽기는 모두, 쓰기는 본사만
create policy warehouse_read on warehouse_stock
  for select to authenticated using (true);

create policy warehouse_write on warehouse_stock
  for update to authenticated using (is_hq()) with check (is_hq());

create policy warehouse_monthly_read on warehouse_monthly
  for select to authenticated using (true);

create policy warehouse_monthly_insert on warehouse_monthly
  for insert to authenticated with check (is_hq());

create policy warehouse_monthly_update on warehouse_monthly
  for update to authenticated using (is_hq()) with check (is_hq());

create policy shipments_read on shipments
  for select to authenticated using (is_hq());

create policy shipments_insert on shipments
  for insert to authenticated with check (is_hq());

create policy sku_metrics_read on sku_metrics
  for select to authenticated using (is_hq());

-- 메시지: 자기 거래처의 대화만, 본사는 전부
create policy messages_read on messages
  for select to authenticated
  using (is_hq() or account_id = current_account_id());

create policy messages_insert on messages
  for insert to authenticated
  with check (
    (is_hq() and sender = 'hq')
    or (account_id = current_account_id() and sender = 'account'));

create policy messages_update on messages
  for update to authenticated                  -- 읽음 처리
  using (is_hq() or account_id = current_account_id())
  with check (is_hq() or account_id = current_account_id());


-- =========================================================================
-- 8. 편의 함수
-- =========================================================================

-- 발주 한 건을 원자적으로 접수한다.
-- items 예시: '[{"sku":"UNI-GZ-7100","qty":300}]'::jsonb
create or replace function place_order(p_account_id text, p_items jsonb)
returns bigint
language plpgsql security invoker as $$
declare
  v_order_id bigint;
  v_total    bigint;
  v_missing  text;
  v_item     jsonb;
  v_sku      text;
  v_qty      integer;
  v_price    integer;
  v_pack     integer;
begin
  -- 모르는 SKU 가 섞여 있으면 아무것도 만들지 않고 멈춘다
  select string_agg(i->>'sku', ', ')
    into v_missing
    from jsonb_array_elements(p_items) i
   where not exists (select 1 from products p where p.sku = i->>'sku');
  if v_missing is not null then
    raise exception '알 수 없는 SKU: %', v_missing;
  end if;

  -- 총액을 먼저 계산해 insert 에 함께 넣는다.
  -- (거래처는 orders 를 update 할 수 없으므로 나중에 채우면 0 으로 남는다)
  select coalesce(sum(p.price * (i->>'qty')::int), 0)
    into v_total
    from jsonb_array_elements(p_items) i
    join products p on p.sku = i->>'sku';

  insert into orders (account_id, total)
  values (p_account_id, v_total)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sku := v_item->>'sku';
    v_qty := (v_item->>'qty')::int;

    select price, pack into v_price, v_pack from products where sku = v_sku;

    insert into order_items (order_id, sku, qty, price)
    values (v_order_id, v_sku, v_qty, v_price);

    -- 발주분을 거래처 재고에 반영 (데모: 즉시 입고로 처리)
    -- 재고 목록에 없던 품목은 여기서 새로 편입한다. (001)
    insert into inventory (account_id, sku, stock, daily_use, reorder_point, par_level)
    values (p_account_id, v_sku, v_qty, 0.5,
            greatest(4, round(v_pack / 3.0)::int), v_pack * 2)
    on conflict (account_id, sku) do update
       set stock      = inventory.stock + excluded.stock,
           updated_at = now();
  end loop;

  return v_order_id;
end;
$$;

create or replace function ship_stock(p_account_id text, p_sku text, p_qty integer)
returns bigint
language plpgsql security invoker as $$
declare
  v_id    bigint;
  v_stock integer;
  v_month date := date_trunc('month', current_date)::date;
begin
  -- 정책에 기대지 않고 먼저 막는다. RLS 는 조용히 지나가므로 절반만 반영될 수 있다.
  if not is_hq() then
    raise exception '본사 계정만 출고를 등록할 수 있습니다.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception '출고 수량은 1 이상이어야 합니다.';
  end if;

  select stock into v_stock from warehouse_stock where sku = p_sku;
  if v_stock is null then
    raise exception '물류센터에서 관리하지 않는 품목입니다: %', p_sku;
  end if;
  if v_stock < p_qty then
    raise exception '재고가 부족합니다. 현재고 %개, 요청 %개', v_stock, p_qty;
  end if;

  -- 1) 재고 차감
  update warehouse_stock
     set stock = stock - p_qty, updated_at = now()
   where sku = p_sku;

  -- 2) 당월 출고량 누적 (그 달 행이 없으면 새로 만든다)
  insert into warehouse_monthly (sku, month, qty)
  values (p_sku, v_month, p_qty)
  on conflict (sku, month) do update
     set qty = warehouse_monthly.qty + excluded.qty;

  -- 3) 이력
  insert into shipments (account_id, sku, qty)
  values (p_account_id, p_sku, p_qty)
  returning id into v_id;

  return v_id;
end;
$$;

