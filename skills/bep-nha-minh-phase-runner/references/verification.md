# Verification

## Local Source Checks

Run after code changes:

```powershell
rtk npm run lint
rtk npm run typecheck
rtk npm run build
```

## Docker Full Stack

Start:

```powershell
rtk docker compose up -d --build
```

Status:

```powershell
rtk docker compose ps -a
```

Expected:

```text
postgres: healthy
migrate: exited 0
seed: exited 0
web: healthy
```

Health:

```powershell
rtk proxy powershell -NoProfile -Command "Invoke-RestMethod -Uri http://localhost:3000/api/health | ConvertTo-Json -Depth 5"
```

Homepage:

```powershell
rtk proxy powershell -NoProfile -Command "$res=Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing; Write-Output ('Status=' + $res.StatusCode)"
```

Waitlist submit:

```powershell
rtk proxy powershell -NoProfile -Command "$body=@{name='Phase User'; phone='0909998888'; email='phase@example.com'; district='Quan 3'; preferredMeal='Bua trua'; source='website'} | ConvertTo-Json; Invoke-RestMethod -Uri http://localhost:3000/api/waitlist -Method Post -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 5"
```

Database row check:

```powershell
rtk docker compose exec postgres psql -U bep_user -d bep_nha_minh -c "select id, name, phone, district, status, created_at from waitlist order by created_at desc limit 5;"
```

Stop:

```powershell
rtk docker compose down
```

Reset:

```powershell
rtk docker compose down -v
rtk docker compose up -d --build
```
