-- =========================================================================
-- 001 · place_order: 재고 목록에 없던 품목도 발주할 수 있게 한다
--
-- 문제
--   기존 place_order 는 발주분을 `update inventory ... where account_id/sku`
--   로만 반영했다. 재고 목록에 없던 SKU 를 발주하면 이 update 가 0행을 고치고
--   조용히 지나가, 주문은 남지만 재고에는 아무것도 생기지 않았다.
--   프런트(app.js placeOrder)는 이 경우 재고 줄을 새로 만들어 두었으므로,
--   화면과 DB 가 어긋나 새로고침하면 그 품목이 사라졌다.
--
-- 조치
--   update 를 upsert 로 바꾼다. 없으면 새로 편입하고, 있으면 수량을 더한다.
--   새로 편입할 때의 기본값은 프런트가 쓰던 계산식을 그대로 옮겼다.
--     일사용량   0.5
--     발주점     max(4, round(pack/3))
--     적정재고   pack * 2
--
-- 실행: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- =========================================================================

create or replace function place_order(p_account_id text, p_items jsonb)
returns bigint
language plpgsql security invoker as $$
declare
  v_order_id bigint;
  v_total    bigint := 0;
  v_item     jsonb;
  v_sku      text;
  v_qty      integer;
  v_price    integer;
  v_pack     integer;
begin
  insert into orders (account_id) values (p_account_id) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sku := v_item->>'sku';
    v_qty := (v_item->>'qty')::int;

    select price, pack into v_price, v_pack from products where sku = v_sku;
    if v_price is null then
      raise exception '알 수 없는 SKU: %', v_sku;
    end if;

    insert into order_items (order_id, sku, qty, price)
    values (v_order_id, v_sku, v_qty, v_price);

    v_total := v_total + v_price * v_qty;

    -- 발주분을 거래처 재고에 반영 (데모: 즉시 입고로 처리)
    -- 재고 목록에 없던 품목은 여기서 새로 편입한다.
    insert into inventory (account_id, sku, stock, daily_use, reorder_point, par_level)
    values (p_account_id, v_sku, v_qty, 0.5,
            greatest(4, round(v_pack / 3.0)::int), v_pack * 2)
    on conflict (account_id, sku) do update
       set stock      = inventory.stock + excluded.stock,
           updated_at = now();
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;
