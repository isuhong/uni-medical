-- =========================================================================
-- 002 · place_order: 발주 합계가 0원으로 저장되던 문제
--
-- 문제
--   기존 place_order 는 orders 를 먼저 insert 한 뒤, 마지막에
--     update orders set total = v_total where id = v_order_id;
--   로 합계를 채웠다. 그런데 orders 의 update 정책은 본사 전용이다.
--
--     create policy orders_update on orders
--       for update to authenticated
--       using (is_hq()) with check (is_hq());   -- 단계 변경은 본사만
--
--   place_order 는 security invoker 라 호출자(거래처)의 RLS 가 적용된다.
--   거래처 계정에서는 이 update 가 0행을 고치고 에러 없이 지나가,
--   total 이 기본값 0 인 채로 남았다. 화면에 발주 금액이 0원으로 뜬 이유다.
--
-- 조치
--   update 를 없애고, 총액을 미리 계산해 insert 시점에 넣는다.
--   orders 의 insert 정책은 본인 계정이면 허용하므로 RLS 를 건드리지 않아도 된다.
--   '단계 변경은 본사만' 이라는 원래 의도도 그대로 유지된다.
--
--   001 의 재고 upsert 도 이 파일에 함께 들어 있다.
--   001 을 실행했든 안 했든, 이 파일만 실행하면 최종 상태가 된다.
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- =========================================================================

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
