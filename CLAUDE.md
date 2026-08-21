# 유엔아이메디컬 VMI — 프로젝트 가이드

이 파일은 Claude Code가 매 세션 처음에 읽는 문서다.
프로젝트의 배경·규칙·현재 상태를 담는다. 작업하며 달라진 사실은 이 파일을 고쳐서 유지한다.

---

## 1. 무엇을 만들고 있나

병·의원 소모품 유통사 **유엔아이메디컬**의 **공급자 주도 재고관리(VMI, Vendor Managed Inventory)** 웹 서비스다.

거래처(병·의원)의 소모품 사용·발주 데이터를 바탕으로 소진 시점을 예측하고,
적정 발주 시점과 수량을 제안하며, 본사가 1,500개 거래처의 재고를 한 화면에서 관제한다.

현재는 **프런트엔드만 완성된 상태**이고, 모든 데이터는 `frontend/js/data.js`에 하드코딩된 가상 데이터다.
새로고침하면 입력한 내용이 사라진다. **지금 하려는 일은 여기에 백엔드를 붙여 데이터를 실제로 저장하는 것이다.**

---

## 2. 폴더 구조

저장소 하나로 관리한다. (github.com/isuhong/uni-medical)

```
uni-medical/
├── CLAUDE.md          ← 이 파일
├── index.html         ← 로그인 + 거래처 앱 + 본사 콘솔, 전 화면이 한 파일
├── css/style.css
├── js/
│   ├── config.js      ← Supabase 접속 정보 (커밋 전 값 확인)
│   ├── api.js         ← 백엔드 접근 계층. DB 호출은 전부 여기를 거친다
│   ├── data.js        ← 데모 데이터. 백엔드 연결이 끝나면 삭제할 파일
│   ├── engine.js      ← 소진 예측 · 발주 추천 · 제품 추천 로직
│   ├── hq.js          ← 본사(HQ) 콘솔 화면
│   └── app.js         ← 거래처 화면 · 공통 UI
└── backend/
    ├── schema.sql     ← 테이블 · 뷰 · RLS · place_order 함수
    ├── seed.sql       ← 데모 데이터 (data.js 에서 생성)
    └── README.md      ← Supabase 세팅 절차
```

`index.html` 이 루트에 있어야 GitHub Pages 배포가 유지된다. 파일 위치를 옮기지 않는다.

---

## 3. 도메인 용어

| 용어 | 뜻 |
|---|---|
| VMI | 공급자가 거래처의 재고를 대신 관리하고 필요한 시점에 채워주는 방식 |
| 거래처 | 유엔아이메디컬에 소모품을 공급받는 병·의원. 대학병원(3차) / 2차병원 / 개인의원으로 나뉜다 |
| 본사(HQ) | 유엔아이메디컬. 중앙물류센터를 운영하며 전 거래처를 관제한다 |
| SKU | 제품 단위 식별자. `UNI-GZ-7100` 형태 |
| 적정재고 | 보유해야 할 기준 수량. 물류센터는 최근 3개월 사용량 × 0.833 |
| 사용량재고 | 최근 3개월 출고량 합계 |
| 리드타임 | 발주 후 입고까지 걸리는 기간. 현재 3일로 가정 |
| 안전재고 | 리드타임 외에 여유로 두는 기간. 현재 2일로 가정 |
| 충족률 | 거래처가 요청한 발주 중 제때 채워준 비율 |
| 실사 | 창고에서 직접 세어 실제 수량을 확인하는 일 |

---

## 4. 화면 구성

**거래처 화면** (`app.js`) — 로그인 후 진입
대시보드 / 재고 입력 / 발주 추천 / 제품 추천 / 소통창

**본사 콘솔** (`hq.js`) — `uni-hq` 계정으로 진입
관제 대시보드 / 거래처 관리 / 발주 파이프라인 / 실시간 재고 관리 / 제품·수요 분석 / 소통 인박스

- **실시간 재고 관리**는 실제로 쓰던 `재고현황` 엑셀 시트를 그대로 옮긴 화면이다.
  열 순서(품명 및 규격 → 재고수량 → 적정재고 → 발주 필요 → 입고 예정 → 사용량재고 → 월별 출고량)를 바꾸지 않는다.
  담당자가 재고수량을 직접 입력하고, 발주 필요·입고 예정 칸은 추천값이 채워지되 메모로 덮어쓸 수 있다.
  월별 출고량 열은 **직전 완료 3개월 + 당월** 네 달만 보여준다. 달이 바뀌면 창이 저절로 밀린다.
- **출고 등록**(같은 화면)에서 거래처·품목·수량을 고르면 DB 함수 `ship_stock` 이
  재고 차감 · 당월 출고량 누적 · 이력 기록을 한 번에 처리한다.
  거래처 발주(`place_order`)와는 아직 연결하지 않았다. 물류센터 재고는 이 등록으로만 줄어든다.
- **소통 인박스**에서 거래처를 누르면 채팅창이 열리고, 거래처 상세의 '메시지 보내기'도 같은 채팅창으로 연결된다.

---

## 5. 계산 규칙 (임의로 바꾸지 말 것)

현장에서 쓰던 방식을 그대로 옮긴 것이므로, 개선 아이디어가 있어도 먼저 물어본다.

```
거래처 재고
  잔여일       = 현재고 / 일평균사용량
  발주권고시점 = 소진일 − (리드타임 3일 + 안전재고 2일)
  권장 발주량  = 적정 최대재고(parLevel)까지 채우되 발주단위(pack)로 올림
  상태         = 현재고 0 이하 → 결품
                 현재고 ≤ reorderPoint → 발주 필요
                 발주권고까지 3일 이하 → 발주 임박
                 그 외 → 충분

물류센터 재고 (실시간 재고 관리 화면)
  사용량재고 = 직전 완료 3개월 출고량 합   (당월은 아직 진행 중이라 제외)
  적정재고   = 사용량재고 × 0.833
  상태       = 재고 0 → 결품
               재고 < 적정재고 → 발주 필요
               재고 < 적정재고 × 1.2 → 발주 임박
               그 외 → 정상
```

'결품 위험 %'는 발주권고까지 남은 일수를 로지스틱 함수로 변환한 근사값이다.
실서비스에서는 분류 모델로 대체할 자리이며, 지금은 데모임을 UI에 명시하고 있다.

---

## 6. 만들 백엔드

### 방침
- **Supabase(PostgreSQL + Auth + Realtime)** 를 사용한다. 별도 서버 코드를 두지 않는 방향을 우선한다.
- 프런트엔드는 빌드 과정 없는 정적 파일 구조를 유지한다.
- 프런트에서 Supabase를 직접 호출하지 않는다. **`frontend/js/api.js` 한 겹을 두고 그 안에서만 호출한다.**
  나중에 백엔드를 자체 API 서버로 바꿔도 `api.js`만 고치면 되도록 하기 위함이다.

### 테이블 초안
`data.js`의 구조를 그대로 옮긴다.

| 테이블 | 내용 | 대응하는 현재 데이터 |
|---|---|---|
| `products` | 제품 카탈로그 (sku, name, cat, unit, price, pack) | `CATALOG` |
| `accounts` | 거래처 (id, name, type, tier, region, since, 로그인 정보) | `ACCOUNTS` + `FLEET` |
| `inventory` | 거래처별 재고 (account_id, sku, stock, daily_use, reorder_point, par_level) | `ACCOUNTS[].inventory` |
| `orders` / `order_items` | 발주 이력 | `ACCOUNTS[].orderHistory` |
| `warehouse_stock` | 물류센터 재고 (sku, stock, inbound, inbound_eta, order_note, in_note, note_by_user) | `WAREHOUSE` |
| `warehouse_monthly` | SKU별 월 출고량 (sku, month, qty) | `WAREHOUSE[].monthly` |
| `messages` | 거래처 ↔ 본사 대화 (account_id, sender, body, created_at, read_at) | `CHAT` + `HQ_INBOX` |

`CHAT`(거래처 쪽)과 `HQ_INBOX`(본사 쪽)는 지금 프런트에서 따로 놀고 있다. **`messages` 한 테이블로 합쳐 양방향이 이어지게 한다.**

`FLEET_TOTALS`, `SKU_METRICS`, `AI_INSIGHTS`는 집계·생성 결과이므로 테이블로 옮기지 않고 쿼리나 뷰로 계산한다.

### api.js 계약 (구현 완료)
모두 Promise를 반환하고, 실패 시 예외를 던진다. 화면에서는 `try/catch` 후 `toast()` 로 안내한다.
반환 형태는 `data.js` 가 쓰던 카멜케이스에 맞춰져 있어 `engine.js` 는 고치지 않아도 된다.

```
API.login(id, pw) / logout() / currentAccount()
API.getProducts()
API.getInventory(accountId) / setStock(accountId, sku, stock) / addInventoryItem(accountId, sku, init)
API.placeOrder(accountId, items) / getOrders(accountId)
API.getFleet() / getSkuMetrics()
API.getWarehouse() / setWarehouseStock(sku, stock) / setWarehouseNote(sku, field, text)
API.getMessages(accountId) / getInbox() / sendMessage(accountId, sender, body, category) / markRead(accountId, sender)
API.watchMessages(accountId, onInsert) / watchWarehouse(onChange)   ← 실시간 구독
```

새 함수가 필요하면 화면에서 Supabase를 직접 부르지 말고 이 파일에 추가한다.

### 작업 순서
1~3은 완료. 남은 것은 `backend/README.md` 5절의 화면 연결 순서를 따른다.
로그인 → 거래처 재고 → 발주 → 본사 거래처 목록 → 실시간 재고 관리 → 소통.
한 화면씩 바꾸고 브라우저에서 눌러본 뒤 커밋한다.

---

## 7. 코드 규칙

**프런트엔드**
- 순수 HTML/CSS/JS. 프레임워크·번들러·npm 의존성을 추가하지 않는다. (Supabase는 CDN으로 불러온다)
- 기존 방식을 유지한다: 인라인 `onclick` 핸들러, 전역 함수, `innerHTML`로 렌더링.
- 색상·간격은 `style.css`의 CSS 변수(`--pine`, `--ink`, `--line`, `--ok`, `--soon`, `--now`)를 쓴다. 새 색을 하드코딩하지 않는다.
- UI 문구는 한국어. 상태 이름은 화면마다 다르게 부르지 않는다(정상 / 발주 임박 / 발주 필요 / 결품).
- 표는 모바일에서 카드형으로 바뀌므로 `<td>`에 `data-label` 속성을 반드시 붙인다.
- 사용자가 입력 중인 칸을 다시 그리지 않는다. 부분 갱신 함수(`whRefreshRow` 등)를 쓴다.

**백엔드**
- 비밀번호는 절대 평문으로 저장하지 않는다. Supabase Auth를 쓰거나 해시한다.
- 거래처는 자기 데이터만, 본사는 전체를 볼 수 있어야 한다. RLS 정책을 반드시 건다.
- 마이그레이션은 파일로 남긴다. 대시보드에서 손으로 고치고 끝내지 않는다.

---

## 8. 작업 방식

- **기능 하나 끝날 때마다 커밋한다.** 한 번에 몰아서 커밋하지 않는다.
- 커밋 메시지는 한국어, prefix를 붙인다: `feat:` `fix:` `refactor:` `docs:` `chore:`
- 파일을 지우거나 대량 변경하기 전에 반드시 먼저 알리고 승인을 받는다.
- 작업을 마치기 전에 검증한다. 서버를 띄우고 실제로 눌러본 뒤 "완료"라고 말한다.
- 구조를 바꾸는 결정(테이블 설계, 라이브러리 도입, 계산 규칙 변경)은 먼저 제안하고 답을 기다린다.
- 모르면 추측해서 채우지 말고 묻는다.

---

## 9. 하지 말 것

- 실제 거래처명·실거래 데이터를 저장소에 커밋하지 않는다. 지금 데이터는 전부 가상이며, 그 상태를 유지한다.
- API 키, DB 접속 정보를 코드에 직접 쓰지 않는다. `.env`에 두고 `.gitignore`에 넣는다.
- 5절의 계산 규칙을 상의 없이 바꾸지 않는다.
- 실시간 재고 관리 화면의 열 구성을 바꾸지 않는다. 현장에서 쓰던 엑셀과 같아야 하는 것이 이 화면의 목적이다.
- 화면을 '개선'한다며 디자인을 다시 만들지 않는다. 요청받은 것만 바꾼다.

---

## 10. 현재 상태

- 프런트엔드: 완성. GitHub Pages 배포 중
- 백엔드: Supabase 구축 완료. `schema.sql` · `seed.sql` 실행, Auth 계정 4개 연결까지 끝났다
- 화면을 하나씩 `API.*` 로 교체하는 중이다

| 화면 | 상태 | 쓰는 API |
|---|---|---|
| 로그인 | 완료 | `login` · `getInventory` |
| 거래처 재고 | 완료 | `setStock` |
| 발주 | 완료 | `placeOrder` · `getOrders` |
| 본사 거래처 목록 | 완료 | `getFleet` · `getInventory` |
| 실시간 재고 관리 | 완료 | `getWarehouse` · `getWarehouseMonths` · `setWarehouseStock` · `setWarehouseNote` |
| 출고 등록 | 완료 | `shipStock` · `getShipments` · `getShippedToday` |
| 소통 | 남음 | `getMessages` · `getInbox` · `sendMessage` |

아직 `js/data.js` 를 읽는 곳: 제품 카탈로그(`CATALOG` · `findProduct`), 소통창,
본사 화면의 집계값(`FLEET_TOTALS` · `AI_INSIGHTS`), 발주 파이프라인의 `ACCOUNTS`.
본사 거래처 목록은 `HQ_FLEET`(= `API.getFleet()`)으로, 물류센터는 `WH_ITEMS` ·
`WH_MONTH_LABELS` 로 바뀌었다. data.js 가 아직 로드되므로 전역 이름이 겹치지 않게
새 이름을 썼다.

4초 출고 시뮬레이션과 상단 동기화 바는 제거했다(003). 물류센터 재고는 실사 입력과
출고 등록으로만 바뀐다.

`warehouse_monthly` 에는 읽기 정책만 있어 월별 출고량을 쓸 수 없었다. 003 에서
본사용 insert/update 정책을 더했다. RLS 는 막을 때 예외를 던지지 않고 조용히
지나가므로, 새로 쓰는 표가 생기면 정책부터 확인한다.
`addRecommended()` 의 재고 편입은 아직 메모리에만 반영된다. 제품 추천 단계에서 잇는다.

발주분의 재고 반영은 DB 함수 `place_order` 가 맡는다. 재고 목록에 없던 품목도
upsert 로 새로 편입한다 (`backend/migrations/001_place_order_upsert.sql`).
스키마를 고칠 때는 `backend/migrations/` 에 번호 붙인 파일을 남기고 `schema.sql` 도 같이 맞춘다.

전부 교체되면 `js/data.js` 를 지운다.

**작업 환경 메모** — 이 저장소는 클라우드 세션에서 `git push` 가 403으로 막혀 있다.
당분간 변경된 파일을 사람이 GitHub 웹에서 직접 업로드하는 방식으로 진행한다.
