# Phase 2 - Schema và API foundation

Schema đầu vào: [Phase 1 đã được người dùng phê duyệt](phase_1_review_decisions.md).
Quy trình: Architect -> Implementer -> Independent Reviewer, xem [mục lục và quy trình commerce](README.md). Schema chuẩn là bản review đã duyệt, không dùng các prompt/schema nháp cũ.

## Implementation Packet

Người dùng đã yêu cầu bắt đầu code sau khi approve schema. Agent A phân tích, Agent B1 phụ trách migration, Agent B2 phụ trách API, main agent phụ trách verification/integration, Agent C review độc lập.

Phạm vi đợt này:

- Bốn additive migrations tạo schema commerce đã duyệt, compatibility backfill và constraints/indexes.
- Runtime Node HTTP độc lập với liveness/readiness và OpenAPI v1 cho các endpoint foundation.
- Giữ Next.js routes/admin/auth/waitlist hiện tại hoạt động; chưa chuyển toàn bộ HTTP nghiệp vụ sang runtime mới.
- Kiểm thử schema trên database tạm; test API bằng ephemeral port.

Không bật checkout/auth/cart/worker/outbox publisher hay cấu hình fulfillment thật. Những nghiệp vụ này thuộc các phase sau; API foundation không được mô tả như đã tách xong mọi route legacy.

## Thứ tự triển khai

1. `20260910000100000_create_commerce_foundation.js`: customer identities, catalog/localization, slot/inventory/cart.
2. `20260910000200000_extend_legacy_orders_for_commerce.js`: order/item/history/audit extensions và FK RESTRICT.
3. `20260910000300000_create_commerce_execution_schema.js`: reservation/payment/access/idempotency/validation/alerts/outbox/dedupe; FK validation sau khi có bảng.
4. `20260910000400000_backfill_and_harden_commerce_schema.js`: LEGACY provenance/backfill, conditional COMMERCE requirements.
5. API contracts/runtime và verification. Một chủ sở hữu duy nhất cho migration chain.

PK/FK/UNIQUE/CHECK/index tuân theo danh mục Phase 1; cross-row invariant không bị thay bằng CHECK giả. Không seed giờ slot, không tạo reservation/payment cho legacy, không thêm integrity_status hoặc lease review worker.

Runtime mới chỉ có:

- `GET /api/v1/health/live`: kiểm tra process, không truy vấn DB.
- `GET /api/v1/health/ready`: truy vấn DB có timeout; DB lỗi trả 503 không lộ connection string.
- `GET /api/v1/openapi.json`: chỉ công bố endpoint đã triển khai.

Snapshot, idempotency, reserve/release và lock-order business là hợp đồng cho phase checkout/worker kế tiếp. Schema có fields/constraints hỗ trợ; chưa khẳng định các transaction nghiệp vụ đã tồn tại.

## Cấu hình/gates giữ nguyên

- Slot times thật chưa chốt: không production seed/enable fulfillment.
- Tại thời điểm Phase 2, VIEW/reset/verification/proof TTL chưa đủ. Approval sau đó đã chốt các TTL, gồm proof 24h CLAIM-only: xem [Phase 1 decisions](phase_1_review_decisions.md). Phải đối chiếu proof storage và các runtime gates trước khi bật flow; không suy ra implementation đã tồn tại chỉ từ việc tạo schema.
- Retry/backoff/DLQ/replay/backlog policy chưa đủ: không bật worker/broker processing.
- Không thêm READY/DELIVERING -> CANCELLED. Mọi transition hiện có giữ nguyên.

## Lệnh sử dụng

Chạy từ repo root:

```powershell
rtk npm run verify:phase2:schema
rtk npm run verify:phase2:api
rtk npm run typecheck
rtk npm run lint
rtk npm run verify:source
rtk npm run build
rtk npm run api:dev
```

`verify:phase2:schema` dùng TEST_DATABASE_URL (hoặc DATABASE_URL/default local) làm kết nối quản trị để tạo một database tên ngẫu nhiên `bep_phase2_test_<uuid>`. User PostgreSQL cần quyền CREATE DATABASE. Test chỉ drop database mà chính lần chạy đó tạo; không chạy down/reset trên database ứng dụng. Giờ slot trong test là fixture tạm, không phải cấu hình kinh doanh.

Migration ứng dụng sau khi xem kết quả và chuẩn bị backup vẫn dùng `rtk npm run db:up`. Việc chạy test không tự áp migration vào DB app đang chạy. Down bị chặn nếu còn dữ liệu commerce cần bảo toàn; không dùng rollback như reset production.

`api:dev` chạy runtime nền tảng tại `http://127.0.0.1:3001`; có thể cấu hình `API_HOST` và `API_PORT`. Runtime đọc `.env` ở repo root. `DATABASE_URL` bắt buộc trong production và phải là URL PostgreSQL hợp lệ. `API_READY_TIMEOUT_MS` mặc định 1000 ms (tối đa 10000), `API_DB_POOL_MAX` mặc định 10 (tối đa 100). `api:start` chạy cùng entrypoint bằng `tsx`, nên môi trường đó cần có `tsx`; chưa phải Docker production rollout của runtime mới.

## Kết quả thực thi

- [x] B1 migration hoàn tất. `origin DEFAULT LEGACY` giữ tương thích với legacy writers chưa truyền origin.
- [x] B2 runtime/API contracts hoàn tất trong phạm vi foundation.
- [x] Isolated schema up/down/up: 55 checks thành công, bảo toàn legacy và chặn rollback dữ liệu commerce.
- [x] API smoke tests thành công, bao gồm startup từ chối URL DB sai; readiness thực tế trả 200 với PostgreSQL và OpenAPI trả tài liệu raw 3.1.0. Process smoke test đã dừng.
- [x] Lint/typecheck/source/build thực thi thành công.
- [x] Agent C review độc lập: PASS sau khi sửa rollback guard, startup URL validation và payment metadata constraints.

Không áp migration vào database ứng dụng, không seed dữ liệu production, không commit/push trong đợt này. Các lỗi review đã được sửa và chạy lại verification trước khi bàn giao.

Acceptance checkout, reservation contention, customer claim, review worker races và broker replay vẫn là PLANNED cho các phase thực thi nghiệp vụ. SQL constraint/lease tests ở đây không phải E2E chứng minh các service đó đã chạy.
