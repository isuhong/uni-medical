-- =========================================================================
-- 유엔아이메디컬 VMI — 데모 시드 데이터
-- js/data.js 에서 자동 생성. 직접 고치지 말고 gen-seed.js 를 다시 돌릴 것.
-- 전부 가상 데이터다. 실제 거래 정보가 아니다.
--
-- 실행 순서: schema.sql → seed.sql
-- =========================================================================

begin;

truncate messages, order_items, orders, inventory,
         warehouse_monthly, warehouse_stock, sku_metrics,
         account_metrics, accounts, products restart identity cascade;


-- ---- 제품 카탈로그 (16종) ----
insert into products (sku, name, category, unit, price, pack) values
  ('UNI-CB-3040', '캐스트 밴드 (유리섬유) 4in', '고정', '롤', 3200, 10),
  ('UNI-CB-3020', '캐스트 밴드 (유리섬유) 2in', '고정', '롤', 2600, 10),
  ('UNI-SC-1100', '소프트 캐스트 언더패딩', '고정', '롤', 900, 12),
  ('UNI-ST-2200', '스토키넷 (신축 튜브 붕대)', '고정', '롤', 1400, 12),
  ('UNI-SP-5500', '알루미늄 핑거 스플린트', '고정', '개', 1800, 20),
  ('UNI-EB-4010', '탄력 압박 붕대 4in', '압박', '롤', 1100, 12),
  ('UNI-EB-4006', '탄력 압박 붕대 6in', '압박', '롤', 1500, 12),
  ('UNI-CS-4400', '압박 스타킹 (무릎형)', '압박', '켤레', 8900, 5),
  ('UNI-CW-4700', '손목 압박 서포터', '압박', '개', 4200, 10),
  ('UNI-KB-6100', '무릎 보조기 (경첩형)', '재활', '개', 26000, 2),
  ('UNI-AB-6300', '발목 보조기 (에어형)', '재활', '개', 19000, 2),
  ('UNI-TB-6500', '허리 보조 벨트', '재활', '개', 15000, 4),
  ('UNI-RE-6800', '재활 저항 밴드 세트', '재활', '세트', 6500, 6),
  ('UNI-GZ-7100', '멸균 거즈 4x4', '소모품', '팩', 600, 50),
  ('UNI-TP-7300', '의료용 종이테이프', '소모품', '롤', 400, 24),
  ('UNI-CW-7500', '소독 솜 (알코올)', '소모품', '박스', 2800, 20);


-- ---- 거래처 (본사 1 + 거래처 12) ----
insert into accounts (id, name, type, tier, region, contact, beds, since, is_hq, is_live) values
  ('uni-hq', '유엔아이메디컬 (본사)', 'VMI 운영본부', null, '경기 성남시 · 중앙물류센터', '영업·물류관리팀', null, null, true, false),
  ('hy-univ', '한양대학교병원', '대학병원 (3차)', 'univ', '서울 성동구', '구매물류팀 · 정형외과 병동', 850, '2019-03', false, true),
  ('semyung-2', '세명정형외과병원', '종합병원 (2차)', 'secondary', '경기 안양시', '원무·구매 담당', 180, '2021-06', false, true),
  ('mirae-clinic', '미래정형외과의원', '개인의원 (1차)', 'clinic', '부산 해운대구', '간호실장', 0, '2023-02', false, true),
  ('c-004', '서울백년병원', '2차병원', 'secondary', '서울 강서구', null, null, null, false, false),
  ('c-005', '우리정형외과의원', '개인의원', 'clinic', '대구 수성구', null, null, null, false, false),
  ('c-006', '한빛종합병원', '2차병원', 'secondary', '인천 남동구', null, null, null, false, false),
  ('c-007', '강남연세재활의원', '개인의원', 'clinic', '서울 강남구', null, null, null, false, false),
  ('c-008', '부산365병원', '2차병원', 'secondary', '부산 부산진구', null, null, null, false, false),
  ('c-009', '참사랑정형외과', '개인의원', 'clinic', '광주 서구', null, null, null, false, false),
  ('c-010', '대전선병원', '대학병원', 'univ', '대전 중구', null, null, null, false, false),
  ('c-011', '굿모닝재활의원', '개인의원', 'clinic', '경기 수원시', null, null, null, false, false),
  ('c-012', '제일정형외과병원', '2차병원', 'secondary', '울산 남구', null, null, null, false, false);


-- ---- 거래처 월간 지표 (본사 관제 화면용) ----
insert into account_metrics (account_id, skus, risk, watch, monthly_revenue, turnover, fill_rate, open_issues, status) values
  ('hy-univ', 10, 3, 3, 8420000, 9.2, 0.985, 1, 'watch'),
  ('semyung-2', 10, 2, 2, 3180000, 7.4, 0.972, 0, 'watch'),
  ('mirae-clinic', 8, 2, 1, 940000, 6.1, 0.958, 0, 'risk'),
  ('c-004', 14, 0, 1, 4260000, 8.1, 0.991, 0, 'healthy'),
  ('c-005', 7, 1, 2, 1120000, 5.7, 0.949, 2, 'risk'),
  ('c-006', 16, 0, 0, 5010000, 8.8, 0.994, 0, 'healthy'),
  ('c-007', 9, 0, 1, 1680000, 6.9, 0.977, 1, 'healthy'),
  ('c-008', 13, 2, 1, 3540000, 7, 0.961, 1, 'watch'),
  ('c-009', 6, 1, 0, 760000, 5.2, 0.945, 0, 'risk'),
  ('c-010', 18, 1, 2, 7890000, 9, 0.988, 0, 'watch'),
  ('c-011', 8, 0, 0, 1340000, 7.2, 0.982, 0, 'healthy'),
  ('c-012', 12, 0, 1, 2960000, 7.8, 0.979, 1, 'healthy');


-- ---- 거래처 재고 (28건) ----
insert into inventory (account_id, sku, stock, daily_use, reorder_point, par_level) values
  ('hy-univ', 'UNI-CB-3040', 42, 6.5, 30, 90),
  ('hy-univ', 'UNI-CB-3020', 18, 4.2, 25, 70),
  ('hy-univ', 'UNI-SC-1100', 55, 5, 30, 80),
  ('hy-univ', 'UNI-ST-2200', 61, 3.1, 20, 60),
  ('hy-univ', 'UNI-EB-4006', 12, 5.5, 28, 80),
  ('hy-univ', 'UNI-KB-6100', 9, 0.9, 6, 20),
  ('hy-univ', 'UNI-AB-6300', 14, 1.2, 8, 24),
  ('hy-univ', 'UNI-GZ-7100', 120, 22, 100, 350),
  ('hy-univ', 'UNI-TP-7300', 48, 6, 30, 90),
  ('hy-univ', 'UNI-CS-4400', 7, 1.1, 8, 24),
  ('semyung-2', 'UNI-CB-3040', 22, 2.4, 14, 40),
  ('semyung-2', 'UNI-CB-3020', 16, 1.6, 10, 30),
  ('semyung-2', 'UNI-SP-5500', 25, 1.8, 12, 40),
  ('semyung-2', 'UNI-EB-4010', 8, 2.2, 12, 36),
  ('semyung-2', 'UNI-KB-6100', 5, 0.6, 4, 12),
  ('semyung-2', 'UNI-AB-6300', 11, 0.8, 5, 16),
  ('semyung-2', 'UNI-TB-6500', 6, 0.7, 4, 12),
  ('semyung-2', 'UNI-RE-6800', 19, 1, 8, 24),
  ('semyung-2', 'UNI-CW-4700', 4, 0.9, 6, 20),
  ('semyung-2', 'UNI-GZ-7100', 40, 6, 30, 100),
  ('mirae-clinic', 'UNI-CB-3020', 6, 0.8, 5, 16),
  ('mirae-clinic', 'UNI-SP-5500', 10, 0.6, 5, 20),
  ('mirae-clinic', 'UNI-EB-4010', 3, 1, 6, 18),
  ('mirae-clinic', 'UNI-CW-4700', 5, 0.4, 4, 12),
  ('mirae-clinic', 'UNI-TB-6500', 2, 0.3, 3, 8),
  ('mirae-clinic', 'UNI-GZ-7100', 14, 2.5, 15, 40),
  ('mirae-clinic', 'UNI-TP-7300', 9, 1.2, 8, 24),
  ('mirae-clinic', 'UNI-CW-7500', 5, 0.7, 5, 15);


-- ---- 발주 이력 ----
do $$
declare v_id bigint;
begin
  insert into orders (account_id, ordered_on, stage, total)
    values ('hy-univ', '2026-08-04', '처리 완료', 372000) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-CB-3040', 60, 3200);
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-GZ-7100', 300, 600);
  insert into orders (account_id, ordered_on, stage, total)
    values ('hy-univ', '2026-07-21', '처리 완료', 133000) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-EB-4006', 70, 1500);
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-TP-7300', 70, 400);
  insert into orders (account_id, ordered_on, stage, total)
    values ('hy-univ', '2026-07-07', '처리 완료', 255000) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-CB-3040', 60, 3200);
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-SC-1100', 70, 900);
  insert into orders (account_id, ordered_on, stage, total)
    values ('semyung-2', '2026-08-01', '처리 완료', 228000) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-RE-6800', 24, 6500);
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-SP-5500', 40, 1800);
  insert into orders (account_id, ordered_on, stage, total)
    values ('semyung-2', '2026-07-14', '처리 완료', 432000) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-CB-3040', 40, 3200);
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-AB-6300', 16, 19000);
  insert into orders (account_id, ordered_on, stage, total)
    values ('mirae-clinic', '2026-08-08', '처리 완료', 33600) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-GZ-7100', 40, 600);
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-TP-7300', 24, 400);
  insert into orders (account_id, ordered_on, stage, total)
    values ('mirae-clinic', '2026-07-25', '처리 완료', 19800) returning id into v_id;
  insert into order_items (order_id, sku, qty, price) values (v_id, 'UNI-EB-4010', 18, 1100);
end $$;


-- ---- 중앙물류센터 재고 (16 SKU) ----
insert into warehouse_stock (sku, stock, inbound, inbound_eta) values
  ('UNI-GZ-7100', 612000, 0, null),
  ('UNI-TP-7300', 298000, 200000, '8월 22일'),
  ('UNI-EB-4006', 96400, 120000, '8월 21일'),
  ('UNI-CB-3040', 168000, 0, null),
  ('UNI-EB-4010', 121000, 0, null),
  ('UNI-SC-1100', 143000, 0, null),
  ('UNI-CB-3020', 82000, 0, null),
  ('UNI-ST-2200', 76000, 0, null),
  ('UNI-CW-7500', 61000, 0, null),
  ('UNI-CS-4400', 41000, 0, null),
  ('UNI-SP-5500', 33500, 30000, '8월 24일'),
  ('UNI-TB-6500', 26400, 0, null),
  ('UNI-RE-6800', 24600, 0, null),
  ('UNI-CW-4700', 18900, 25000, '8월 23일'),
  ('UNI-AB-6300', 4200, 18000, '8월 21일'),
  ('UNI-KB-6100', 0, 0, null);


-- ---- 월별 출고량 (2026년 02월 ~ 2026년 07월, 96건) ----
insert into warehouse_monthly (sku, month, qty) values
  ('UNI-GZ-7100', '2026-02-01', 205300),
  ('UNI-GZ-7100', '2026-03-01', 221400),
  ('UNI-GZ-7100', '2026-04-01', 198700),
  ('UNI-GZ-7100', '2026-05-01', 226100),
  ('UNI-GZ-7100', '2026-06-01', 214800),
  ('UNI-GZ-7100', '2026-07-01', 209500),
  ('UNI-TP-7300', '2026-02-01', 128400),
  ('UNI-TP-7300', '2026-03-01', 135600),
  ('UNI-TP-7300', '2026-04-01', 130200),
  ('UNI-TP-7300', '2026-05-01', 139800),
  ('UNI-TP-7300', '2026-06-01', 133100),
  ('UNI-TP-7300', '2026-07-01', 136400),
  ('UNI-EB-4006', '2026-02-01', 63800),
  ('UNI-EB-4006', '2026-03-01', 59400),
  ('UNI-EB-4006', '2026-04-01', 62100),
  ('UNI-EB-4006', '2026-05-01', 58700),
  ('UNI-EB-4006', '2026-06-01', 60900),
  ('UNI-EB-4006', '2026-07-01', 57600),
  ('UNI-CB-3040', '2026-02-01', 46200),
  ('UNI-CB-3040', '2026-03-01', 49800),
  ('UNI-CB-3040', '2026-04-01', 47500),
  ('UNI-CB-3040', '2026-05-01', 51300),
  ('UNI-CB-3040', '2026-06-01', 48900),
  ('UNI-CB-3040', '2026-07-01', 50400),
  ('UNI-EB-4010', '2026-02-01', 42600),
  ('UNI-EB-4010', '2026-03-01', 45100),
  ('UNI-EB-4010', '2026-04-01', 43800),
  ('UNI-EB-4010', '2026-05-01', 46200),
  ('UNI-EB-4010', '2026-06-01', 44700),
  ('UNI-EB-4010', '2026-07-01', 45900),
  ('UNI-SC-1100', '2026-02-01', 35800),
  ('UNI-SC-1100', '2026-03-01', 38200),
  ('UNI-SC-1100', '2026-04-01', 36400),
  ('UNI-SC-1100', '2026-05-01', 39100),
  ('UNI-SC-1100', '2026-06-01', 37600),
  ('UNI-SC-1100', '2026-07-01', 38500),
  ('UNI-CB-3020', '2026-02-01', 28100),
  ('UNI-CB-3020', '2026-03-01', 30200),
  ('UNI-CB-3020', '2026-04-01', 29600),
  ('UNI-CB-3020', '2026-05-01', 31400),
  ('UNI-CB-3020', '2026-06-01', 28900),
  ('UNI-CB-3020', '2026-07-01', 30700),
  ('UNI-ST-2200', '2026-02-01', 21900),
  ('UNI-ST-2200', '2026-03-01', 23400),
  ('UNI-ST-2200', '2026-04-01', 22100),
  ('UNI-ST-2200', '2026-05-01', 24300),
  ('UNI-ST-2200', '2026-06-01', 22700),
  ('UNI-ST-2200', '2026-07-01', 23600),
  ('UNI-CW-7500', '2026-02-01', 19800),
  ('UNI-CW-7500', '2026-03-01', 21300),
  ('UNI-CW-7500', '2026-04-01', 20400),
  ('UNI-CW-7500', '2026-05-01', 22100),
  ('UNI-CW-7500', '2026-06-01', 20900),
  ('UNI-CW-7500', '2026-07-01', 21600),
  ('UNI-CS-4400', '2026-02-01', 11900),
  ('UNI-CS-4400', '2026-03-01', 12800),
  ('UNI-CS-4400', '2026-04-01', 12200),
  ('UNI-CS-4400', '2026-05-01', 13100),
  ('UNI-CS-4400', '2026-06-01', 12600),
  ('UNI-CS-4400', '2026-07-01', 12900),
  ('UNI-SP-5500', '2026-02-01', 14900),
  ('UNI-SP-5500', '2026-03-01', 16200),
  ('UNI-SP-5500', '2026-04-01', 15300),
  ('UNI-SP-5500', '2026-05-01', 16800),
  ('UNI-SP-5500', '2026-06-01', 15700),
  ('UNI-SP-5500', '2026-07-01', 16400),
  ('UNI-TB-6500', '2026-02-01', 7100),
  ('UNI-TB-6500', '2026-03-01', 7800),
  ('UNI-TB-6500', '2026-04-01', 7300),
  ('UNI-TB-6500', '2026-05-01', 8100),
  ('UNI-TB-6500', '2026-06-01', 7600),
  ('UNI-TB-6500', '2026-07-01', 7900),
  ('UNI-RE-6800', '2026-02-01', 8300),
  ('UNI-RE-6800', '2026-03-01', 9100),
  ('UNI-RE-6800', '2026-04-01', 8600),
  ('UNI-RE-6800', '2026-05-01', 9400),
  ('UNI-RE-6800', '2026-06-01', 8800),
  ('UNI-RE-6800', '2026-07-01', 9200),
  ('UNI-CW-4700', '2026-02-01', 9700),
  ('UNI-CW-4700', '2026-03-01', 10600),
  ('UNI-CW-4700', '2026-04-01', 10100),
  ('UNI-CW-4700', '2026-05-01', 11000),
  ('UNI-CW-4700', '2026-06-01', 10400),
  ('UNI-CW-4700', '2026-07-01', 10800),
  ('UNI-AB-6300', '2026-02-01', 5600),
  ('UNI-AB-6300', '2026-03-01', 6100),
  ('UNI-AB-6300', '2026-04-01', 5800),
  ('UNI-AB-6300', '2026-05-01', 6300),
  ('UNI-AB-6300', '2026-06-01', 6000),
  ('UNI-AB-6300', '2026-07-01', 6200),
  ('UNI-KB-6100', '2026-02-01', 2900),
  ('UNI-KB-6100', '2026-03-01', 3200),
  ('UNI-KB-6100', '2026-04-01', 3000),
  ('UNI-KB-6100', '2026-05-01', 3400),
  ('UNI-KB-6100', '2026-06-01', 3100),
  ('UNI-KB-6100', '2026-07-01', 3300);


-- ---- SKU 수요 지표 ----
insert into sku_metrics (sku, monthly_qty, trend, accounts_count, turnover, waste_rate, rec_wins) values
  ('UNI-GZ-7100', 214000, 0.08, 1290, 11.2, 0.03, 142),
  ('UNI-CB-3040', 48600, 0.12, 870, 9.4, 0.05, 98),
  ('UNI-EB-4006', 61200, -0.03, 940, 8.9, 0.04, 76),
  ('UNI-TP-7300', 132500, 0.02, 1180, 10.1, 0.02, 54),
  ('UNI-KB-6100', 3100, 0.21, 410, 4.8, 0.09, 63),
  ('UNI-CS-4400', 12400, 0.06, 520, 6.2, 0.07, 41),
  ('UNI-AB-6300', 5900, 0.15, 480, 5.1, 0.08, 37),
  ('UNI-RE-6800', 8700, 0.09, 610, 6.6, 0.06, 29);


-- ---- 거래처 ↔ 본사 대화 (11건) ----
-- 프런트의 CHAT(거래처 쪽)과 HQ_INBOX(본사 쪽)를 한 테이블로 합친 결과다.
insert into messages (account_id, sender, sender_name, category, body, created_at, read_at) values
  ('hy-univ', 'account', '한양대학교병원 구매물류팀', '품질 건의', '[품질 건의] 정형외과 병동에서 캐스트 밴드(UNI-CB-3040) 절단면이 거칠다는 의견이 반복해서 올라옵니다.', now() - interval '1 day', now()),
  ('hy-univ', 'hq', '유엔아이메디컬 CS', '품질 건의', '접수했습니다. 사용 중이신 로트번호를 알려주시면 품질팀에서 동일 로트 출고분을 함께 확인하겠습니다.', now() - interval '1 day', now()),
  ('hy-univ', 'account', '한양대학교병원 구매물류팀', '품질 건의', '로트 CB2608-A 입니다. 이번 주 입고분부터 증상이 보였습니다.', now() - interval '2 hours', null),
  ('c-007', 'account', '강남연세재활의원', '신제품 요청', '[신제품 요청] 에어형보다 가벼운 경량 발목 보조기를 찾는 환자가 늘고 있습니다. 취급 계획이 있을까요?', now() - interval '5 hours', null),
  ('c-008', 'account', '부산365병원 구매팀', '배송/발주', '[배송/발주] 이번 주 정기 배송을 수요일에서 금요일 오전으로 옮길 수 있을까요? 병동 공사가 있습니다.', now() - interval '2 days', now()),
  ('c-008', 'hq', '유엔아이메디컬 CS', '배송/발주', '금요일 오전 배송으로 조정해 두었습니다. 변경된 일정은 배송 전날 문자로 다시 안내드립니다.', now() - interval '2 days', now()),
  ('c-008', 'account', '부산365병원 구매팀', '배송/발주', '확인했습니다. 감사합니다.', now() - interval '1 day', now()),
  ('c-005', 'account', '우리정형외과의원', '제품 문의', '[제품 문의] 압박 스타킹(UNI-CS-4400) 사이즈 규격표를 받아볼 수 있을까요? 환자 상담용으로 필요합니다.', now() - interval '1 day', now()),
  ('c-005', 'hq', '유엔아이메디컬 CS', '제품 문의', '규격표 PDF를 담당 영업 이메일로 발송했습니다. 인쇄용 상담 카드도 함께 보내드렸습니다.', now() - interval '1 day', now()),
  ('c-010', 'account', '대전선병원 구매물류팀', '품질 건의', '[품질 건의] 멸균 거즈(UNI-GZ-7100) 일부 팩에서 개봉 전 밀봉이 헐거운 것이 확인됐습니다.', now() - interval '2 days', now()),
  ('c-010', 'hq', '유엔아이메디컬 CS', '품질 건의', '해당 로트 출고를 보류하고 교환분을 다음 정기 배송에 포함했습니다. 회수 대상 수량을 알려주시면 반품 처리하겠습니다.', now() - interval '2 days', now());


commit;

-- 확인용
-- select count(*) from products;          -- 16
-- select count(*) from accounts;          -- 13
-- select count(*) from inventory;         -- 28
-- select count(*) from warehouse_monthly; -- 96
-- select count(*) from messages;          -- 11
-- select sku, stock, proper, status from v_warehouse order by status, sku;