# Phase 3.5 - Guest / Account Cart

## Phạm vi

Giỏ hàng guest và account, thêm/sửa/xóa món, chọn một ngày/khung giao cho toàn giỏ,
gộp giỏ có xác nhận. Dùng bảng foundation `carts`, `cart_items` hiện có; không thêm
migration. Không tạo order/payment/reservation, không giữ tồn kho và không bật
checkout. Redis/RabbitMQ và Java worker không thuộc phase này.

## API

- `GET /api/v1/cart?locale=vi|en`: đọc giỏ hiện tại, không tạo cart khi đọc.
- `POST /api/v1/cart`: command JSON strict schema, locale bắt buộc.
- Browser gọi BFF `/api/cart`; API không nhận accountId/cartId/giá từ client.

| action | Input ngoài action/locale | Hành vi |
| --- | --- | --- |
| initialize | Không | Tạo/lấy giỏ active của owner hiện tại |
| set-item | slug, quantity, expectedVersion, source? | Đặt số lượng tuyệt đối; 0 xóa món |
| set-slot | businessDate, slotKey, expectedVersion | Lịch chung cho toàn giỏ; chặn slot tắt/quá cutoff |
| merge | expectedVersion, guestVersion, slotSource? | Cộng số lượng theo product, consume guest cart |

`source=guest` chỉ chọn giỏ được chứng minh bằng guest cookie, không phải một ID
tùy ý. Khi có session, luôn xác thực session trước kể cả khi sửa giỏ guest.
Giúp giảm/xóa món guest trước khi gộp nếu tổng số lượng vượt giới hạn.

Response gồm id/version/owner, items (giá và priceVersion hiện tại), subtotal,
totalQuantity, limits, businessDate/slotKey, guestCart nếu account còn giỏ guest.
GET chưa có cart trả id=null/version=0/items=[]. Dữ liệu trả về no-store.

## Quyền Sở Hữu Và Đồng Thời

- Guest cookie ngẫu nhiên 256-bit, HttpOnly, SameSite=Lax, Path=/, Secure + __Host-
  trên HTTPS. DB chỉ lưu hash. Cookie guest hiện có thời hạn phiên trình duyệt;
  không tự cam kết lưu sau đóng trình duyệt, không dùng localStorage.
- Chưa thêm TTL/cleanup policy cho guest cart vào business decisions; foundation
  cho phép expires_at=null. Production retention/cleanup cần chốt riêng.
- Session account được kiểm tra dưới lock qua `withSession`; session sai/revoked
  trả 401, không âm thầm chuyển về guest. Admin cookie không có quyền giỏ khách.
- Thứ tự lock: account -> session -> account cart -> guest cart khi cần gộp.
  Guest-only chỉ khóa giỏ của mình, không lấy account lock.
- Mọi mutation kiểm tra expectedVersion dưới row lock; thành công tăng version.
  Hai mutation cùng version: tối đa một thành công, request còn lại nhận 409.
- Giới hạn mặc định 20/product, tổng 50 suất, kiểm tra trong transaction;
  cấu hình bằng CART_MAX_PER_PRODUCT / CART_MAX_TOTAL_QUANTITY (1..10000).
- Giá do DB cung cấp; stock availability chỉ tham khảo, không reserve hay đảm bảo
  giữ giá. Checkout tương lai phải kiểm tra lại tất cả trong transaction của nó.
- Mutation phải đúng Origin, JSON <=16 KiB; dùng shared limiter theo network
  address, không tin X-Forwarded-For tùy ý. Cần ingress/rate policy production:
  các khách qua cùng BFF hiện chia bucket network, chưa phân biệt IP khách thật.

## Gộp Giỏ

Không sửa luồng login/OAuth. Sau login, giỏ account hiển thị giỏ guest đang có
để người dùng xác nhận. Cùng sản phẩm cộng quantity; không truncate/drop ngầm.
Hai lịch khác nhau bắt buộc chọn lịch guest hoặc account. Nếu account chưa có lịch,
có thể kế thừa lịch guest. Lịch được chọn phải còn khả dụng tại thời điểm gộp.
Quota/cutoff/version lỗi rollback toàn bộ, cả hai giỏ còn nguyên.
Thành công: guest cart chuyển MERGED, tăng version, xóa guest cookie. Replay không
gộp lần hai. Địa chỉ/profile/order không bị gộp hoặc đổi ownership theo email.

## UI Và Test

Route `/vi/cart`, `/en/cart`, noindex. Catalog có nút thêm vào giỏ; header có liên
kết giỏ. UI feature chia components/hooks/services/types/copy, page chỉ compose.
Nút checkout disabled. Không retry mutation tự động. 409 yêu cầu xem dữ liệu mới.

Chỉ chạy kiểm tra liên quan:

```powershell
npm run verify:cart
npm run typecheck
```

`verify:cart` chạy test DB riêng + BFF mock. Không gửi email, không chạy Google/
Facebook, không seed lại database ứng dụng. Các regression script của phase cũ
được giữ vì vẫn bảo vệ hành vi đã triển khai, không gộp vào lệnh verify:cart.

## Trạng Thái

**PHASE 3.5 DEVELOPMENT COMPLETE / PRODUCTION GATED**

Ngày 2026-09-11: người dùng chấp nhận UI hiện tại vì mockup đã mất.
Không còn chờ mockup để chốt phase; không tự động triển khai Phase 4.

Đã triển khai API/BFF/UI và nối nút thêm món trên catalog, liên kết giỏ trên header.
`npm run verify:cart` PASS: 52 HTTP checks trên database tách biệt và test BFF
(query, Origin, cookie isolation, body limits, guest-cookie forwarding/clearing).
Next.js production build PASS, có routes `/{locale}/cart` và `/api/cart`.
Không chạy lại OAuth/email/admin regression và không có migration mới.

Typecheck và scoped ESLint PASS. Review backend không phát hiện lỗi quyền sở hữu,
quota/rollback hoặc version serialization. Concurrent merge-vs-guest-write chưa có
test riêng; chưa tuyên bố exhaustive concurrency coverage.

Browser local xác nhận trang giỏ guest trống và nút thêm món trên catalog. Danh mục
local hiện accepting_orders=false nên nút bị disable đúng trạng thái; không tự bật
bán. UI có món được kiểm tra bằng API/database fixture tách biệt trên port 3101
và bản web build port 3100: thêm món từ trang chi tiết, tăng quantity 1->2, subtotal
10.000->20.000 VND, lưu slot chung, đổi VI/EN giữ giỏ, xóa về empty state đều đúng.
Screenshot desktop/mobile 390px và DOM check không tràn ngang. Không tạo order,
không thay danh mục/tài khoản thật. Fixture mode dùng `scripts/verify/cart.ts --serve-ui`,
giữ database tách biệt tới SIGINT/SIGTERM rồi cleanup, không nằm trong lệnh test mặc định.

UI hiện theo design system của project đã được người dùng chấp nhận.
Hai port fixture 3100/3101 đã đóng; chưa kiểm tra lại cleanup database fixture.

Không đồng nghĩa commerce đã production-ready: checkout chưa bật, guest retention
và ingress/rate-limit policy vẫn cần chốt trước production.
