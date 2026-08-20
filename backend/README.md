# 백엔드 (Supabase)

유엔아이메디컬 VMI의 데이터 저장소. 별도 서버 코드 없이 PostgreSQL·인증·실시간 구독을 쓴다.

```
backend/
├── schema.sql   테이블 · 뷰 · RLS 정책 · place_order 함수
├── seed.sql     데모 데이터 (js/data.js 에서 생성)
└── README.md    이 파일
```

프런트엔드에서 이 DB를 부르는 코드는 `../js/api.js` 한 파일에 모여 있다.
화면 코드는 Supabase를 직접 부르지 않는다.

---

## 1. Supabase 프로젝트 만들기

여기부터 3번까지는 대시보드에서 손으로 해야 한다. Claude Code가 대신 못 하는 부분이다.

1. supabase.com 가입 → New project
2. 이름 `uni-medical`, 리전 **Northeast Asia (Seoul)**, DB 비밀번호는 따로 보관
3. 생성까지 2분쯤 걸린다

무료 플랜은 **7일간 요청이 없으면 프로젝트가 자동 일시정지**된다. 대시보드에서 되살릴 수 있지만,
실제로 쓰기 시작하면 유료 플랜을 고려해야 한다.

## 2. 스키마와 데이터 넣기

SQL Editor에서 순서대로 실행한다.

1. `schema.sql` 전체를 붙여넣고 Run
2. `seed.sql` 전체를 붙여넣고 Run
3. 확인:
   ```sql
   select count(*) from products;   -- 16
   select count(*) from accounts;   -- 13
   select sku, stock, proper, status from v_warehouse order by status, sku;
   ```
   마지막 쿼리에서 `out` 1건, `now` 4건 정도가 나오면 정상이다.

## 3. 로그인 계정 만들기

비밀번호는 DB에 두지 않는다. Supabase Auth에 사용자를 만들고 `accounts.auth_user_id`로 잇는다.

Authentication → Users → **Add user** 에서 아래 넷을 만든다. (Auto Confirm User 체크)

| 이메일 | 비밀번호 | 연결할 거래처 |
|---|---|---|
| `uni-hq@demo.uni-medical.local` | (직접 정함) | uni-hq |
| `hy-univ@demo.uni-medical.local` | (직접 정함) | hy-univ |
| `semyung-2@demo.uni-medical.local` | (직접 정함) | semyung-2 |
| `mirae-clinic@demo.uni-medical.local` | (직접 정함) | mirae-clinic |

만든 뒤 SQL Editor에서 연결한다.

```sql
update accounts a
   set auth_user_id = u.id
  from auth.users u
 where u.email = a.id || '@demo.uni-medical.local';

-- 확인: 네 줄이 나와야 한다
select id, name, is_hq, auth_user_id from accounts where auth_user_id is not null;
```

데모 계정 안내를 로그인 화면에 그대로 두려면 비밀번호를 기존과 같게(`hanyang`, `semyung`,
`mirae`, `uni-hq`) 맞추면 된다. 다만 **공개 저장소이므로 실제 데이터를 넣는 순간 전부 바꿔야 한다.**

## 4. 프런트엔드 연결

1. `js/config.js` 에 Project URL과 anon key를 채운다
   (Project Settings → API. anon key는 브라우저에 노출되어도 되는 키다. service_role key는 절대 넣지 않는다)
2. `index.html` 의 스크립트 태그를 이 순서로 둔다
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="js/config.js"></script>
   <script src="js/api.js"></script>
   <script src="js/data.js"></script>
   <script src="js/engine.js"></script>
   <script src="js/hq.js"></script>
   <script src="js/app.js"></script>
   ```
3. 화면을 하나씩 `API.*` 호출로 바꾼다. 순서는 아래 5번.

## 5. 연결 순서

한 번에 다 바꾸지 않는다. 하나 끝날 때마다 브라우저에서 눌러보고 커밋한다.

1. **로그인** — `attemptLogin()` 을 `API.login()` 으로. 여기가 되면 나머지는 같은 패턴이다
2. **거래처 재고** — `renderInventory()` / `setStock()` / `adjustStock()`
3. **발주** — `placeOrder()` 를 `API.placeOrder()` 로
4. **본사 거래처 목록** — `FLEET` 을 `API.getFleet()` 으로
5. **실시간 재고 관리** — `WAREHOUSE` 를 `API.getWarehouse()` 로. 실사 입력과 메모 저장 연결
6. **소통** — `CHAT` 과 `HQ_INBOX` 를 `API.getMessages()` / `API.getInbox()` 로 합친다.
   여기까지 오면 거래처가 보낸 메시지가 본사 인박스에 실제로 뜬다

전부 끝나면 `js/data.js` 는 지워도 된다. 그 전까지는 아직 연결 안 된 화면이 참조하므로 남겨둔다.

## 6. 남은 일

- `place_order` 는 발주를 즉시 입고로 처리한다(데모). 실제로는 배송 단계를 거쳐야 한다
- `account_metrics` 와 `sku_metrics` 는 지금 고정값이다. 트랜잭션에서 집계하도록 바꿔야 한다
- 실시간 재고 관리 화면의 출고 시뮬레이션은 데모용이다. 실제 WMS 출고 데이터로 대체할 자리
- RLS 정책은 초안이다. 운영 전에 거래처 계정으로 로그인해 남의 데이터가 안 보이는지 직접 확인할 것
