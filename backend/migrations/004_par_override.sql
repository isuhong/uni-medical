-- =========================================================================
-- 004 · 적정재고를 손으로 고칠 수 있게 한다
--
-- 지금까지 적정재고는 사용량재고 × 0.833 으로만 정해졌다.
-- 품목에 따라 담당자가 따로 잡고 싶은 경우가 있어, 덮어쓸 값을 둔다.
--
--   par_override 가 null  → 지금까지처럼 자동 계산 (기본값)
--   par_override 에 값    → 그 값을 적정재고로 쓴다
--
-- 계산식 자체는 바꾸지 않았다. 기본 동작은 그대로다.
--
-- 함께 고치는 것 — v_warehouse 뷰의 사용량재고
--   뷰는 '월 내림차순 상위 3개월' 을 쓰고 있어서, 당월 행이 생기는 순간
--   당월을 포함해 버린다. 003 에서 화면은 '직전 완료 3개월' 로 바꿨는데
--   뷰만 옛 규칙으로 남아 있었다. 같은 규칙으로 맞춘다.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- =========================================================================

alter table warehouse_stock
  add column if not exists par_override integer null check (par_override >= 0);

comment on column warehouse_stock.par_override is
  '담당자가 직접 지정한 적정재고. null 이면 사용량재고 × 0.833 으로 자동 계산한다.';

-- 열이 하나 늘어나므로 replace 가 아니라 다시 만든다
drop view if exists v_warehouse cascade;

create view v_warehouse as
with last3 as (
  select sku, sum(qty) as use3
  from (
    select sku, qty,
           row_number() over (partition by sku order by month desc) as rn
    from warehouse_monthly
    where month < date_trunc('month', current_date)::date   -- 당월 제외
  ) t
  where rn <= 3
  group by sku
),
calc as (
  select w.sku,
         coalesce(l.use3, 0) as use3,
         coalesce(w.par_override,
                  round(coalesce(l.use3, 0) * 0.833)::int) as proper
    from warehouse_stock w
    left join last3 l on l.sku = w.sku
)
select
  w.sku,
  p.name,
  p.category,
  p.unit,
  w.stock,
  c.use3          as use3,          -- 사용량재고 (직전 완료 3개월 합)
  c.proper        as proper,        -- 적정재고 (지정값 우선, 없으면 자동 계산)
  w.par_override,
  w.inbound,
  w.inbound_eta,
  w.order_note,
  w.order_note_by_user,
  w.in_note,
  w.in_note_by_user,
  case
    when w.stock <= 0              then 'out'
    when w.stock <  c.proper       then 'now'
    when w.stock <  c.proper * 1.2 then 'soon'
    else 'ok'
  end             as status,
  w.counted_at,
  w.updated_at
from warehouse_stock w
join products p on p.sku = w.sku
join calc     c on c.sku = w.sku;
