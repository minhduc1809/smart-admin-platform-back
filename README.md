# Smart Admin Platform — Backend

API server cho nền tảng SaaS đa tenant quản lý **biểu mẫu động**, **quy trình phê duyệt** và **theo dõi đơn nộp**.

Xây dựng với **NestJS 11** · **TypeScript 5.7** · **PostgreSQL (Prisma)** · **Redis (BullMQ)** · **Socket.io** · **Keycloak SSO**.

---

## Tính năng chính

| Module | Mô tả |
|--------|-------|
| **Auth** | JWT + Keycloak SSO, Token Rotation với Token Family, phát hiện tái sử dụng refresh token (tự thu hồi toàn bộ phiên), tra cứu token O(1) qua `jti` |
| **Form** | Biểu mẫu động theo JSON Schema — 4 loại trường (text/number/date/select), ValidationEngine với rule regex/min/max/minLength/afterField, phòng chống ReDoS (`safe-regex2`) |
| **Submission** | Vòng đời đơn nộp: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/RETURNED/CANCELLED, chuỗi phiên bản nộp lại (revision chain), recall/withdraw |
| **Workflow** | Máy trạng thái (FSM) config-driven: duyệt tuần tự, song song (PARALLEL_JOIN), bỏ phiếu theo ngưỡng (VOTING), SLA + tự động leo thang, chạy trong Prisma Transaction chống race condition |
| **Delegation** | Ủy quyền phê duyệt theo phạm vi (form/workflow/khoảng thời gian), logic "acting-as" dùng vai trò người ủy quyền |
| **Notification** | Thông báo realtime qua Socket.io (Redis adapter), đếm chưa đọc, đánh dấu đã đọc |
| **Dashboard** | API analytics: thống kê tổng quan, xu hướng theo ngày, top biểu mẫu, SLA metrics (tỷ lệ tuân thủ, thời gian duyệt trung bình) |
| **File** | Upload Cloudinary (avatar 400×400 face-crop, export xlsx), kiểm tra Magic Bytes chống giả mạo MIME, hàng đợi export BullMQ |
| **Cron** | Quét vi phạm SLA (30 phút/lần, tính giờ làm việc), dọn token/export hết hạn, nhắc nhở duyệt đơn quá 24h |
| **Audit Log** | Nhật ký bất biến CREATE/UPDATE/DELETE/APPROVE/REJECT kèm giá trị cũ/mới và IP |

## Kiến trúc bảo mật

Mọi request đi qua chuỗi 3 guard toàn cục theo thứ tự:

```
JwtAuthGuard  →  KeycloakSyncGuard  →  RolesGuard
(xác thực JWT)   (đồng bộ user SSO)    (kiểm tra @Roles)
```

- **Multi-tenancy**: mọi truy vấn Prisma được scope theo `tenantId` (ClsModule — request-scoped context)
- **Vai trò**: `ADMIN` · `MANAGER` · `HR` · `USER`
- **Rate limiting**: 60 req/phút toàn cục, 30 req/phút cho login/refresh
- **Validation**: Global pipe `whitelist + transform`, response bọc envelope chuẩn (TransformInterceptor), lỗi dịch i18n (`lang` query / `x-lang` header)

## Cấu trúc thư mục

```
src/
├── common/              # Decorators, guards, filters, interceptors, utils dùng chung
├── modules/
│   ├── auth/            # Login, Refresh, Logout + strategies (JWT, Keycloak)
│   ├── user/            # CRUD users, profile, roles, permissions
│   ├── form/            # CRUD form + ValidationEngine
│   ├── submission/      # Submit, Recall, Withdraw, Resubmit
│   ├── workflow/        # WorkflowEngine (FSM), definition/action services
│   ├── delegation/      # Ủy quyền phê duyệt
│   ├── file/            # Upload, Cloudinary, export processor (BullMQ)
│   ├── notification/    # API thông báo
│   ├── realtime/        # Socket.io gateway + Redis adapter
│   ├── dashboard/       # Analytics APIs
│   ├── audit-log/       # Nhật ký audit
│   ├── api-key/         # API key cho bên thứ ba
│   └── cron/            # Tác vụ định kỳ
└── prisma/              # PrismaService
```

## Yêu cầu môi trường

- Node.js ≥ 20
- PostgreSQL ≥ 14
- Redis ≥ 7
- (Tuỳ chọn) Keycloak — cho SSO; có thể dùng JWT local thuần

## Cài đặt & Chạy

### 1. Cài dependencies

```bash
npm install
```

### 2. Cấu hình môi trường

```bash
cp .env.example .env
```

Các biến quan trọng trong `.env`:

| Biến | Mô tả | Mặc định |
|------|-------|----------|
| `PORT` | Cổng API server | `3000` |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL | `postgresql://postgres:password@localhost:5432/smart_admin_db` |
| `REDIS_HOST` / `REDIS_PORT` | Kết nối Redis (BullMQ + Socket.io adapter) | `localhost:6379` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Khóa ký token (bắt buộc đổi ở production) | — |
| `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | TTL token | `15m` / `7d` |
| `KEYCLOAK_URL` / `KEYCLOAK_REALM` / `KEYCLOAK_CLIENT_ID` | Cấu hình SSO | — |
| `CLOUDINARY_*` | Lưu trữ avatar/export trên cloud | — |
| `FRONTEND_URL` | Origin frontend cho CORS | `http://localhost:8000` |

### 3. Khởi tạo database

```bash
npx prisma migrate dev      # Chạy migrations
npx prisma generate         # Sinh Prisma Client
npx prisma db seed          # Seed admin mặc định (admin@example.com / 123456)
```

**Seed dữ liệu demo đầy đủ** (công ty 150 nhân sự, 8 biểu mẫu, 7 quy trình, ~180 đơn nộp trải 15 ngày):

```bash
npx ts-node prisma/seed-company-data.ts
```

> ⚠️ Script này **xoá toàn bộ dữ liệu cũ** của tenant `default` trước khi tạo mới.
> Mật khẩu mọi tài khoản demo: `Test@12345` — tài khoản chính: `admin@techvision.vn` (ADMIN).

### 4. Chạy server

```bash
npm run start:dev           # Dev với watch mode → http://localhost:3000
npm run build               # Build production → ./dist
npm run start:prod          # Chạy bản build
```

Swagger docs: **http://localhost:3000/api**

## Chạy bằng Docker

```bash
docker compose up -d
```

Stack đầy đủ gồm: Backend (3000) · PostgreSQL 16 (5432) · Redis 7 (6800) · Keycloak (8080, auto-import realm) · PgAdmin (5050).

Container backend tự động chạy `prisma migrate deploy` và tạo admin mặc định khi khởi động.

## Kiểm thử

```bash
npm run test                # Unit tests
npm run test:watch          # Watch mode
npm run test:cov            # Coverage
npm run test:e2e            # Integration tests (cần database thật)
```

## Quy ước code

- **Prettier**: single quotes, trailing commas — `npm run format`
- **ESLint**: typescript-eslint v9 — `npm run lint` (auto-fix)
- Mỗi module theo chuẩn NestJS: `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/`
- Sửa đổi schema → `npx prisma migrate dev` + `npx prisma generate`

## Tài liệu API chi tiết

Xem thư mục `frontend/docs/` — tài liệu từng nhóm API: `AUTH_API.md`, `FORM_API.md`, `SUBMISSION_API.md`, `WORKFLOW_API.md`, `DASHBOARD_API.md`, `NOTIFICATION_API.md`, `REALTIME_API.md`, `FILE_API.md`, `USER_API.md`, `API_KEY_API.md`.
