-- =========================================================================
-- 003 · 출고 등록
--
-- 본사가 '어느 거래처에 어느 품목을 몇 개 내보냈는지'를 직접 등록하면
--   1) 물류센터 재고수량에서 차감하고
--   2) 당월 출고량에 더하고
--   3) 출고 이력을 남긴다
-- 세 가지가 한 번에 일어나야 하므로 DB 함수로 묶는다.
--
-- 함께 고치는 것 — warehouse_monthly 쓰기 정책
--   이 표에는 읽기 정책만 걸려 있었다. RLS 는 막을 때 예외를 던지지 않고
--   대상 행이 없는 것처럼 처리하므로, 정책 없이 월별 출고량을 갱신하면
--   에러 없이 조용히 지나간다. (002 에서 고친 orders.total 과 같은 함정)
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- =========================================================================

-- 1. 출고 이력 --------------------------------------------------------------

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

alter table shipments enable row level security;

-- 출고는 본사 업무다. 거래처는 보지도 쓰지도 않는다.
drop policy if exists shipments_read   on shipments;
drop policy if exists shipments_insert on shipments;

create policy shipments_read on shipments
  for select to authenticated using (is_hq());

create policy shipments_insert on shipments
  for insert to authenticated with check (is_hq());

-- 2. 월별 출고량 쓰기 정책 ---------------------------------------------------

drop policy if exists warehouse_monthly_insert on warehouse_monthly;
drop policy if exists warehouse_monthly_update on warehouse_monthly;

create policy warehouse_monthly_insert on warehouse_monthly
  for insert to authenticated with check (is_hq());

create policy warehouse_monthly_update on warehouse_monthly
  for update to authenticated using (is_hq()) with check (is_hq());

-- 3. 출고 등록 함수 ----------------------------------------------------------

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
