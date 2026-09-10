# Docker Run Commands

Ghi chú các lệnh chạy Docker cho project **Bếp Nhà Mình**.

## Chạy Full Project

```powershell
rtk docker compose up -d --build
```

Lệnh này sẽ:

- Build image `bep-nha-minh-api:local`.
- Build image `bep-nha-minh-web:local`.
- Start PostgreSQL.
- Chạy migration.
- Chạy seed data.
- Start web ở `http://localhost:3000`.

## Kiểm Tra Trạng Thái

```powershell
rtk docker compose ps -a
```

Kết quả mong đợi:

```text
postgres  Up ... healthy
migrate   Exited (0)
seed      Exited (0)
web       Up ... healthy
```

## Kiểm Tra Health API

```powershell
rtk curl -s -o NUL -w "%{http_code}" http://localhost:3000/api/health
```

Kết quả mong đợi:

```text
200
```

## Chạy Runtime Verify

```powershell
rtk npm run verify
```

Kết quả mong đợi:

```text
Runtime verification passed.
```

## Xem Logs

```powershell
rtk docker compose logs -f
```

Xem logs riêng web:

```powershell
rtk docker compose logs -f web
```

Xem logs riêng database:

```powershell
rtk docker compose logs -f postgres
```

## Tắt Toàn Bộ Docker Stack

```powershell
rtk docker compose down
```

Lệnh này tắt web, postgres, migrate, seed container nhưng giữ data volume PostgreSQL.

## Reset Database Và Seed Lại Từ Đầu

```powershell
rtk docker compose down -v
rtk docker compose up -d --build
```

Lệnh `down -v` xóa PostgreSQL volume. Dùng khi muốn dữ liệu sạch hoàn toàn.

## Seed Lại Data Khi DB Đang Chạy

```powershell
rtk npm run db:seed
```

Hoặc chạy seed trong Docker:

```powershell
rtk docker compose run --rm seed
```

## Build Riêng Image

Build backend/tools image:

```powershell
rtk npm run docker:build:api
```

Build web image:

```powershell
rtk npm run docker:build:web
```

## Mở App

```text
http://localhost:3000
http://localhost:3000/vi
http://localhost:3000/en
http://localhost:3000/admin/login
```

Admin demo:

```text
Email: admin@bepnhaminh.local
Password: Admin12345!@#
```

## Lỗi Thường Gặp

Nếu port `3000` hoặc `5432` bị chiếm, kiểm tra:

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5432
```

Nếu Docker build báo thiếu native package như `lightningcss-linux-x64-musl`, kiểm tra Dockerfile đang dùng:

```text
RUN npm ci --include=optional
```

Nếu web chưa healthy, xem logs:

```powershell
rtk docker compose logs -f web
```
