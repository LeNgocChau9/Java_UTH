# Hướng dẫn Docker, pgAdmin và psql

Tài liệu này dùng khi cả nhóm chạy chung một database LivingDocs. Postgres và pgAdmin nằm trong `docker-compose.yml`, cùng mạng `livingdocs`, và chỉ khởi động pgAdmin sau khi Postgres sẵn sàng.

## 1. Chạy đồng bộ

1. Ở thư mục gốc repo, copy file mẫu:

```powershell
copy .env.example .env
```

2. Giữ các giá trị database khớp nhau:

| Biến | Giá trị mẫu | Ý nghĩa |
| --- | --- | --- |
| `POSTGRES_DB` | `livingdocs` | Tên database |
| `POSTGRES_USER` | `LivingDocs` | Role Postgres |
| `POSTGRES_PASSWORD` | mật khẩu trong `.env` | Mật khẩu role |
| `DB_PORT` | `5433` | Cổng trên máy host. Container vẫn nghe 5432 |
| `PGADMIN_PORT` | `5050` | Trang pgAdmin |
| `PGADMIN_DEFAULT_EMAIL` | `admin@livingdocs.dev` | Email đăng nhập pgAdmin |
| `PGADMIN_DEFAULT_PASSWORD` | mật khẩu trong `.env` | Mật khẩu pgAdmin |

Spring Boot đọc `DB_PORT` (mặc định 5433). Compose map `${DB_PORT}:5432`, nên ứng dụng trên máy host và container dùng cùng một cổng đã khai báo.

3. Bật cả hai service:

```powershell
docker compose up -d
docker compose ps
```

Postgres phải `healthy` rồi pgAdmin mới chạy. Lần đầu, script `docker/postgres/init/01-pgvector.sql` tạo extension `vector`. Script này chỉ chạy khi volume còn trống.

4. Mở pgAdmin tại `http://localhost:5050`. Đăng nhập bằng email và mật khẩu pgAdmin trong `.env`. Server **LivingDocs** đã được khai báo sẵn, host nội bộ là `postgres`, cổng `5432`. Nhập mật khẩu `POSTGRES_PASSWORD` khi được hỏi.

Trong pgAdmin không điền `localhost` làm host database. `localhost` bên trong container pgAdmin không phải Postgres.

## 2. Vào psql

```powershell
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs
```

Lệnh hay dùng sau khi đã vào psql:

```sql
\l
\c livingdocs
\dt
\d doc_templates
\d document_template_versions
\q
```

- `\l` liệt kê database.
- `\c livingdocs` chuyển sang database làm việc.
- `\dt` liệt kê bảng.
- `\d tên_bảng` xem cột, khóa và index.
- `\q` thoát.

Một câu lệnh rồi thoát, không cần mở shell tương tác:

```powershell
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -c "\dt"
```

## 3. Export database

Đứng ở thư mục muốn lưu file.

Xuất toàn bộ database ra SQL, gồm schema và dữ liệu:

```powershell
docker exec livingdocs-postgres pg_dump -U LivingDocs -d livingdocs --no-owner --no-acl -f /tmp/livingdocs.sql
docker cp livingdocs-postgres:/tmp/livingdocs.sql .\livingdocs.sql
```

Chỉ xuất cấu trúc, không kèm dữ liệu:

```powershell
docker exec livingdocs-postgres pg_dump -U LivingDocs -d livingdocs --schema-only --no-owner --no-acl -f /tmp/livingdocs-schema.sql
docker cp livingdocs-postgres:/tmp/livingdocs-schema.sql .\livingdocs-schema.sql
```

Chỉ xuất dữ liệu:

```powershell
docker exec livingdocs-postgres pg_dump -U LivingDocs -d livingdocs --data-only --no-owner --no-acl -f /tmp/livingdocs-data.sql
docker cp livingdocs-postgres:/tmp/livingdocs-data.sql .\livingdocs-data.sql
```

Xuất một bảng, ví dụ `doc_templates`:

```powershell
docker exec livingdocs-postgres pg_dump -U LivingDocs -d livingdocs -t doc_templates --no-owner --no-acl -f /tmp/doc_templates.sql
docker cp livingdocs-postgres:/tmp/doc_templates.sql .\doc_templates.sql
```

File dump có thể chứa dữ liệu người dùng. Không commit file `.sql` xuất từ database thật.

Trong pgAdmin: chuột phải database **livingdocs** → **Backup**. Format Plain cho ra file SQL. Format Custom dùng khi cần `pg_restore`.

## 4. Import database

Đưa file SQL vào container rồi chạy. Ví dụ file `schema_update.sql` đang ở thư mục hiện tại:

```powershell
docker cp .\schema_update.sql livingdocs-postgres:/tmp/schema_update.sql
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -v ON_ERROR_STOP=1 -f /tmp/schema_update.sql
```

`-v ON_ERROR_STOP=1` dừng ngay khi gặp lỗi, tránh import dở.

Nạp một file dump Plain đã xuất bằng `pg_dump`:

```powershell
docker cp .\livingdocs.sql livingdocs-postgres:/tmp/livingdocs.sql
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -v ON_ERROR_STOP=1 -f /tmp/livingdocs.sql
```

Nạp file Custom (Backup format Custom của pgAdmin):

```powershell
docker cp .\livingdocs.dump livingdocs-postgres:/tmp/livingdocs.dump
docker exec -it livingdocs-postgres pg_restore -U LivingDocs -d livingdocs --no-owner --no-acl --clean --if-exists /tmp/livingdocs.dump
```

`--clean` xóa đối tượng cũ trước khi tạo lại. Chỉ dùng trên database dành cho nhóm dev.

Trong pgAdmin: chuột phải database **livingdocs** → **Restore** với file Custom, hoặc **Query Tool** → mở file SQL → chạy.

Tạo database trống trước khi import một dump đầy đủ vào tên khác:

```powershell
docker exec -it livingdocs-postgres psql -U LivingDocs -d postgres -c "CREATE DATABASE livingdocs_restore OWNER LivingDocs;"
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs_restore -v ON_ERROR_STOP=1 -f /tmp/livingdocs.sql
```

## 5. Kiểm tra sau khi import

```powershell
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -c "\dt"
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -c "SELECT COUNT(*) FROM doc_templates;"
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

Dòng `vector` phải có mặt. Nếu chưa có:

```powershell
docker exec -it livingdocs-postgres psql -U LivingDocs -d livingdocs -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## 6. Khi đổi máy hoặc volume cũ

`docker compose down` giữ volume `postgres_data`. `docker compose down -v` xóa dữ liệu. Lần tạo volume mới sẽ chạy lại script init và tạo extension `vector`.

Nếu volume đã được tạo bằng user hoặc tên database khác, Postgres không đọc lại `POSTGRES_USER` trong `.env`. Khi đó export dữ liệu cần giữ, rồi `docker compose down -v` và `docker compose up -d` để tạo cụm mới theo `.env`.
