# Dữ liệu địa chỉ Việt Nam

## Mô hình

Form mới chỉ chọn **Tỉnh/Thành phố -> Phường/Xã** (danh mục cũng chứa đặc khu).
Không nhập quận/huyện. Địa chỉ cũ giữ `district` nullable và các tên lịch sử;
không tự gán mã hành chính mới. Khi sửa địa chỉ cũ, người dùng chọn lại tỉnh/xã.

Nguồn pháp lý: [Quyết định 19/2025/QĐ-TTg](https://congbao.chinhphu.vn/van-ban/quyet-dinh-so-19-2025-qd-ttg-45430/57441.htm),
có hiệu lực 01/07/2025. Dữ liệu vận hành dùng bản mở
[vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database),
MIT, ghim commit trong `scripts/locations/source.ts`. Đây là bộ dữ liệu cộng đồng,
không phải dịch vụ của Chính phủ; tên tiếng Anh là bản dịch từ nguồn cộng đồng.
Bản ghim gồm 34 tỉnh/thành, 3.321 đơn vị cấp xã và các cập nhật của nguồn sau 2025.
Không khẳng định mọi mục đã được đối chiếu pháp lý độc lập.

## Chạy Local

```powershell
npm run db:up
npm run locations:sync
```

`locations:sync` đọc `data/locations/vietnam.json`, kiểm tra SHA-256 với manifest,
kiểm tra mã và quan hệ tỉnh/xã rồi ghi PostgreSQL trong một transaction.
Chạy lại không tạo trùng. Không cần Internet. Không thay đổi địa chỉ hoặc đơn cũ.
Chỉ một phiên bản active; các phiên bản cũ được giữ để bảo toàn FK và snapshots.

Local Docker: build lại image API sau khi cập nhật dữ liệu/code, chạy migration,
rồi chạy job đồng bộ riêng (không thay NODE_ENV của service đang chạy):

```powershell
docker compose build api
docker compose run --rm migrate
docker compose run --rm -e NODE_ENV=development api npm run locations:sync
```

CLI hiện chỉ cho phép database local/dev (`localhost`, loopback hoặc host
`postgres`) và từ chối NODE_ENV=production. Không dùng override này để triển khai
production. Production cần job nhập dữ liệu được review, quyền DB giới hạn và
kiểm tra danh mục trước khi mở nhận địa chỉ mới; chưa được triển khai trong task này.

## API Và Cache

- `GET /api/v1/locations/provinces`
- `GET /api/v1/locations/provinces/{provinceCode}/wards`

Response v1: `data: {datasetId, items: [{code, name, nameEn}]}`.
Mã giữ kiểu string, bảo toàn số 0 đầu. Browser gọi BFF cùng origin tại
`/api/locations/...`; BFF không chuyển cookie hoặc Authorization vào lookup.
Tên hiển thị VI/EN theo ngôn ngữ giao diện.

API và browser dùng cache bộ nhớ 5 phút, gộp request đang chạy; HTTP cache 5 phút.
Các lớp có thể giữ phiên bản cũ trong tối đa khoảng 10 phút. Lỗi không được cache.
Sau khi đổi phiên bản, restart API và reload trang để làm mới ngay.
POST/PUT địa chỉ luôn kiểm tra lại mã theo dataset active ở DB.
Tỉnh không tồn tại trả 404; dữ liệu chưa đồng bộ trả 503; xã không thuộc tỉnh khi
lưu trả 400. UI giữ draft và cho retry, không fallback sang nhập mã tùy ý.

## Lưu Trữ Và Snapshot

- `location_datasets`: revision, checksum, nguồn, thời điểm nhập, active.
- `location_provinces`: PK `(dataset_id, code)`, tên VI/EN.
- `location_wards`: PK `(dataset_id, code)`, FK tỉnh, unique bộ ba dataset/tỉnh/xã.
- `customer_addresses`: FK bộ ba và snapshots `city`, `ward`, tên tiếng Anh.
  Trigger ghi tên chuẩn từ DB, bỏ district cho địa chỉ mới.
- Đơn COMMERCE DELIVERY mới lưu mã, dataset và tên VI/EN trong
  `recipient_snapshot`; trigger không cho sửa recipient snapshot sau accepted.
  Đơn LEGACY không bị rewrite. Checkout API chưa được triển khai ở phần này.

Rollback migration bị từ chối nếu đã có địa chỉ/đơn dùng snapshot mới, tránh mất
dữ liệu. Không xóa dữ liệu khách hàng để ép rollback. Dùng migration sửa tiến tới.

## Cập Nhật Danh Mục

Review thay đổi nguồn và văn bản hành chính trước khi đổi commit ghim.
Sau khi đổi pin, `npm run locations:download` tải JSON + LICENSE và tạo manifest;
review diff rồi commit cả dữ liệu/license/manifest. `locations:sync` chỉ nhập
bản đóng gói, không tự lấy latest. Không sửa tên trực tiếp trong phiên bản đã nhập.
Không có lịch tự động hoặc external API trong request địa chỉ/checkout.

## Kiểm Tra

```powershell
npm run verify:locations
npm run verify:locations:proxy
npm run verify:customer-addresses
npm run verify:customer-addresses:proxy
```

Test DB dùng database local ngẫu nhiên riêng, tự dọn sau chạy; không gửi email
hay chạy OAuth. Bao phủ up/down/up, dữ liệu cũ, sync offline/idempotent, lookup/cache,
tỉnh/xã không khớp, tên chuẩn, snapshot lịch sử và chặn rollback mất dữ liệu.
