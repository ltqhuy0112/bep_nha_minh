# Phase 3.1 - Catalog

## Phạm vi và Implementation Packet

Đầu vào: schema đã duyệt trong [Phase 1](phase_1_review_decisions.md), API foundation trong [Phase 2](phase_2_foundation.md). Thực hiện theo quy trình Architect -> Implementer -> Independent Reviewer trong [mục lục commerce](README.md).

- Catalog chỉ đọc: danh sách sản phẩm phân trang, chi tiết VI/EN, lịch giao hàng và availability.
- Không đổi schema/migration đã apply. Không thêm auth, cart, checkout, reservation, worker hoặc broker.
- Một sản phẩm hiện khi chưa archived và có bản dịch đúng locale yêu cầu. Không fallback VI cho EN. `accepting_orders=false` vẫn hiện nhưng tạm ngừng nhận đơn; đây không phải field publication.
- Quyết định làm rõ sau packet ban đầu: bỏ filter `accepting_orders=true` để không đánh đồng dừng nhận đơn với ẩn catalog. Architect đã xác nhận.
- Ảnh là presentation map theo slug, không thêm field vào schema chưa được duyệt; sản phẩm chưa có ảnh dùng logo, không gán ảnh món khác.

## API và cấu trúc

Runtime API dùng namespace `/api/v1/catalog`:

| GET | Query | Kết quả |
| --- | --- | --- |
| `/products` | locale, page=1, pageSize=12 (max 50) | items, total, page, pageSize |
| `/products/:slug` | locale | Chi tiết, giá/version và trạng thái nhận đơn |
| `/fulfillment-slots` | date YYYY-MM-DD | Enabled slots, giờ local, cutoffAt, cutoffPassed |
| `/products/:slug/availability` | locale, date, slotKey | Tồn khả dụng, cấu hình inventory và cờ trạng thái |

Envelope giữ `version: v1`; validation 400, tài nguyên không tồn tại 404, method không hỗ trợ 405, lỗi DB 500 không lộ chi tiết nội bộ.

Backend chia theo feature catalog, tách validation/service/repository; shared chứa DTO thuần. Frontend chia feature catalog với components/hooks/services. Page chỉ routing và compose. BFF `/api/catalog/...` chỉ proxy các GET được allowlist, không mở proxy tùy ý, không gửi credential của người dùng sang upstream.

Các request catalog không cache availability. PostgreSQL là nguồn giờ chuẩn; cutoff được tính từ date + slot time tại `Asia/Ho_Chi_Minh` trừ cutoff minutes. Đúng thời điểm cutoff được xem là đã đóng. Không dùng timezone của máy chạy web.

`availableQuantity = capacity - reserved - committed` là số lượng tham khảo, không phải reservation. Chưa có inventory thì trả 0 và `inventoryConfigured=false`. Món bị block/ngừng nhận đơn và slot qua cutoff không được giao diện mô tả là đang nhận đơn chỉ vì còn số lượng.

## Cấu hình và vận hành

- `COMMERCE_API_URL` chỉ dùng phía server web. Local mặc định `http://127.0.0.1:3001`; Docker `http://commerce-api:3001`.
- Runtime API Docker chỉ expose port nội bộ; web vẫn là entrypoint public.
- Migration Phase 2 đã apply vào PostgreSQL local ngày 2026-09-10 sau backup trong container: `/tmp/bep-before-phase3-20260910.dump`. Backup này nằm trong filesystem container, không thay thế backup bền vững cho production.
- `db:seed:catalog` chỉ cho local/non-production, insert-only, không overwrite catalog đang có. Bốn sản phẩm demo dùng giá mẫu và `accepting_orders=false`.
- Cập nhật 2026-09-10: người dùng đã duyệt bốn slot LUNCH_1, LUNCH_2, DINNER_1, DINNER_2 và cutoff 120 phút; giờ chuẩn tại [Phase 1 decisions](phase_1_review_decisions.md). Lệnh `db:configure:slots` thêm lịch vào DB mà không tạo tồn kho hoặc bật nhận đơn/checkout. Các fixture giờ khác trong test vẫn chỉ nằm trong database tạm.
- Legacy admin/waitlist và homepage tĩnh vẫn được giữ; catalog truy cập qua `/vi/menu`, `/en/menu` và link Menu.

## Verification

- [x] Isolated PostgreSQL: 37 HTTP checks và SQL assertions, gồm boundary cutoff, phân trang, translation/visibility, Unicode slug, lỗi DB, read-only counters và cấu hình lịch đã duyệt (idempotent, giữ disabled, từ chối conflict).
- [x] BFF: allowlist, validation, không chuyển tiếp credentials/headers nội bộ, v1 errors, no-store và upstream unavailable.
- [x] Phase 2 regression: 55 schema checks và API foundation tests; lint, typecheck, source boundaries và build.
- [x] Docker API/web/PostgreSQL healthy; BFF catalog VI/EN và slots trả 200, trang menu trả 200; admin orders chưa đăng nhập trả 401. Chỉ recreate API/web, không chạy lại seed legacy.
- [x] Browser desktop/mobile 390px: catalog VI/EN, chi tiết giữ slug khi đổi locale, không tràn ngang, ảnh load, xóa/chọn lại ngày, empty slots và không có lỗi hydration.
- [x] Independent review: PASS sau khi sửa giới hạn slug không khớp schema; BFF và URL frontend encode từng segment, kiểm tra cả Unicode/underscore/URL-like/percent slug.

Kết quả chạy thử: `http://localhost:3000/vi/menu` và `http://localhost:3000/en/menu`. Docker tiếp tục chạy. Chưa commit/push; chưa bật nhận đơn. Lịch giao chuẩn được cấu hình riêng sau approval, không cần đổi migration. Phase tiếp theo là 3.2 Customer Auth, cần chốt các security/configuration gates liên quan trước khi bật từng flow.

Cấu hình lịch 2026-09-10: lần đầu thêm 4 slot, lần hai thêm 0; API qua Docker web trả cutoff 08:30, 10:00, 15:00, 16:30 theo Asia/Ho_Chi_Minh. Xác minh vẫn có 0 sản phẩm accepting_orders và 0 inventory rows. Không cần rebuild ứng dụng để thấy cấu hình DB mới; command cấu hình trong Docker cần image mới như README hướng dẫn.

Checkout concurrency, auth ownership, reservation và worker E2E chưa thuộc phase này, không được ghi PASS.
