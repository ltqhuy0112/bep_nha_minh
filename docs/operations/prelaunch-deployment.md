# Prelaunch Render va Neon

Tai lieu nay huong dan moi truong xem truoc mien phi, khong phai production. Trang thai deploy va domain phai duoc xac minh tren Render; file cau hinh khong phai bang chung service da chay.

## Thiet lap mot lan

1. Tao Neon Free va lay `DATABASE_URL` PostgreSQL co `sslmode=require`. Gia tri nay chi nhap trong Render, khong commit.
2. Tao Render Blueprint tu branch `codex/prelaunch-free`; giu hai service o Free plan, region Ohio cung Neon hien tai, auto deploy `After CI Checks Pass`. Ghi lai URL HTTPS `onrender.com` that sau khi Render cap.
3. Nhap `NEXT_PUBLIC_SITE_URL` va `PUBLIC_WEB_URL` bang URL web that; nhap `COMMERCE_API_URL` bang URL API that. Khong dung localhost. Giu `NEXT_PUBLIC_ORDERING_ENABLED=false` va `CUSTOMER_AUTH_ENABLED=false`.
4. `AUTH_SECRET` do Render tao. `DATABASE_URL` cung co o web service vi cac route admin/waitlist legacy hien dung shared server database code.
5. Ban preview dung Render GitHub App va `checksPass`, khong can deploy-hook secret. Job production thu cong la tuy chon rieng: tao environment `production`, chi cho `main`, yeu cau phe duyet, va luu `RENDER_API_DEPLOY_HOOK_URL`, `RENDER_WEB_DEPLOY_HOOK_URL`.

## CI va deploy gate

Push len `codex/prelaunch-free` chay CI: lint, typecheck, `verify:prelaunch` khong can database va build. Render tu deploy branch nay sau khi checks pass. CI dung `NEXT_PUBLIC_SITE_URL=https://example.invalid`; Render build dung URL web that. `workflow_dispatch` mac dinh `deploy=false`.

Job deploy chi chay khi chon `deploy=true` tu `main`, CI pass va environment `production` duoc phe duyet. Job kiem tra hook la HTTPS tai `api.render.com`, POST SHA commit chinh xac bang `ref`, va khong in URL hook hoac credential.

Job nay chi gui yeu cau deploy bat dong bo den Render. No khong cho Render build/deploy xong va khong xac nhan service healthy; operator phai kiem tra trang thai deploy va health endpoint trong Render sau do.

Khong tu dong chay migration, seed, reset hoac thao tac destructive. Lan tao service dau tien can operator kiem tra CI va cau hinh truoc khi deploy.

## Migration va catalog gate

Sau backup, peer review va approval, chi chay tu controlled terminal voi `DATABASE_URL` target trong session hien tai: `npm ci --include=dev`, sau do `npm run db:up`.

Khong chay `npm run db:seed:catalog` tren production vi source hien chi dung local. Khong chay `npm run db:seed` vi tao demo orders va admin. Sau migration, chi duoc import catalog da phe duyet tu `products` va `product_translations`; khong duoc co customer, auth, waitlist, order hay application data khac. Import nay chua duoc tu dong hoa hoac thuc thi trong repository. Xac minh catalog truoc khi bat ordering.

## Gioi han Free va SEO

Render neu ro Free instances khong danh cho production. Free web service sleep sau 15 phut khong co traffic va request ke tiep mat khoang mot phut de cold start. Khi service sleep, request `/robots.txt` nhan response disallow-all cua Render va khong danh thuc service. Vi vay crawl/SEO khong on dinh; day chi la preview, khong phai production readiness hoac cam ket SEO.

Hai service chia se 750 Free instance hours moi workspace moi thang. Web BFF timeout cart/API sau 10 giay, nen API cold start co the timeout va nguoi dung phai retry. Khong dung Render Free Postgres lam noi luu du lieu ben vung.

## Tai lieu chinh thuc

- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploy-hooks
- https://neon.com/docs/connect/connection-errors
