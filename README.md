[Hướng dẫn Docker, Stripe, phpMyAdmin và Redis CLI](https://github.com/Anh-Tuan1412/BTL_DBMS_BE/blob/feat/real-data-booking-integration/LOCAL_DEMO.md)
# app cho phim · Frontend

Giao diện web của **app cho phim** — quản lý rạp phim, đặt vé và doanh thu. Xây bằng **Next.js (App Router) + React + TypeScript + Tailwind CSS v4**, kết nối backend NestJS.

---

## Công nghệ

| Hạng mục | Sử dụng |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Data fetching / cache | TanStack Query v5 |
| Ngôn ngữ | TypeScript 5 |
| Font | Be Vietnam Pro, Geist (Fontsource) |

---

## Yêu cầu

- **Node.js >= 20.9** (đã kiểm thử trên Node.js 24 LTS) và **npm >= 10**
- Backend đang chạy (mặc định tại `http://localhost:3000`)

> Chi tiết thư viện xem [`DEPENDENCIES.md`](./DEPENDENCIES.md) hoặc nguồn chính [`package.json`](./package.json).

---

## Cài đặt & chạy

```bash
# 1. Cài dependencies
npm ci

# 2. Tạo cấu hình nếu chưa có (xem mục Biến môi trường bên dưới)
test -f .env.local || cp .env.example .env.local

# 3. Chạy dev (http://localhost:3001)
npm run dev
```

### Scripts

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy server phát triển (hot reload) |
| `npm run build` | Build production |
| `npm run start` | Chạy bản đã build |
| `npm run lint` | Kiểm tra ESLint |

---

## Biến môi trường

Tạo file `.env.local` ở thư mục gốc repo `movie-fe`:

```env
# URL gốc của backend NestJS. Tiền tố NEXT_PUBLIC_ để client đọc được.
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Cấu trúc dự án

```
src/
├── app/                          # Next.js App Router
│   ├── globals.css               # CSS toàn cục
│   ├── layout.tsx                # Root layout (Providers, Header, Footer)
│   │
│   ├── (app)/                    # Route group cho trang công khai
│   │   ├── layout.tsx            # Layout cho nhóm app
│   │   ├── page.tsx              # Trang chủ
│   │   ├── landing.module.css    # CSS riêng trang chủ
│   │   ├── about/page.tsx        # Trang "Về chúng tôi"
│   │   └── profile/page.tsx      # Trang hổ trợ người dùng
│   │
│   └── (auth)/                   # Route group cho xác thực
│       ├── layout.tsx            # Layout cho auth
│       ├── login/page.tsx        # Trang đăng nhập
│       ├── register/page.tsx     # Trang đăng ký
│       └── forgot-password/      # Trang quên mật khẩu
│           └── page.tsx
│
├── components/                   # Thành phần React tái sử dụng
│   ├── AuthShell.tsx             # Layout bao cho trang auth
│   ├── EyeIcon.tsx               # Icon hiện/ẩn mật khẩu
│   ├── Footer.tsx                # Phần footer
│   ├── Header.tsx                # Phần header với navigation
│   ├── Logo.tsx                  # Logo & LogoMark
│   ├── Providers.tsx             # Provider TanStack Query & toast
│   ├── Reveal.tsx                # Animation reveal component
│   ├── ScrollToTop.tsx           # Button scroll lên đầu
│   ├── Toast.tsx                 # Toast notification system
│   └── icons.tsx                 # Icon SVG (FlameIcon, TargetIcon, etc.)
│
├── hooks/                        # Custom React hooks
│   ├── useAuth.ts                # Login, register, verify, reset password
│   └── useProfile.ts             # Fetch & update user profile
│
└── lib/
    └── api.ts                    # API calls (apiFetch, login, register, etc.)
```

### Mô tả chi tiết từng thư mục

#### `src/app`
- **Cấu trúc route**: Sử dụng Next.js App Router với **route groups** (`(auth)`, `(app)`)
- **(auth)**: Các trang xác thực (login, register, forgot password) — **không hiển thị header**
- **(app)**: Trang công khai (home, about, profile) — **có header & footer**
- **Root layout**: Quản lý Providers, font, metadata

#### `src/components`
- **AuthShell**: Layout chung cho trang login/register (tiêu đề, mô tả, footer)
- **Header**: Navigation top bar với user menu (logout, profile)
- **Footer**: Footer với links tổ chức, copyright
- **Toast**: Hệ thống thông báo (success, error) dùng Context

#### `src/hooks`
- **useAuth**: Wrapper TanStack Query cho login, register, verify email, reset password
- **useProfile**: Fetch profile người dùng hiện tại, cập nhật thông tin

#### `src/lib/api.ts`
- **apiFetch**: Wrapper `fetch()` tự thêm Authorization header; xóa phiên khi API trả 401 để người dùng đăng nhập lại
- **login/register/verifyEmail**: Các hàm xác thực
- **getProfile/updateProfile**: Quản lý người dùng
- **Token management**: `getAccessToken()`, `setTokens()`, `clearTokens()`

### Luồng dữ liệu (Data Flow)

```
User Action (form submit)
    ↓
Hook (useLogin, useRegister, etc.) — TanStack Query mutation
    ↓
API function (apiFetch, login, register)
    ↓
Backend NestJS API
    ↓
Response → Token lưu localStorage
    ↓
UI cập nhật (Toast, redirect, refetch)
```

### Convention & Best Practices

1. **Pages**: Sử dụng `"use client"` cho pages có form/state
2. **Components**: Chủ yếu server components, chỉ `"use client"` khi cần state/hooks
3. **Styling**: Tailwind CSS classes, CSS modules cho page-specific styles
4. **API Calls**: Luôn qua `@/lib/api.ts`, không gọi `fetch()` trực tiếp
5. **Error Handling**: Dùng `readApiError()` để parse lỗi API
6. **Auth State**: Lưu token localStorage, kiểm tra khi render components

### Environment Variables

| Biến | Mô tả | Mặc định |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3000` |


## Đồng bộ dữ liệu và kiểm thử tích hợp

Backend chạy cổng 3000, frontend mặc định cổng 3001. Chỉ cần `NEXT_PUBLIC_API_URL` trong `.env.local` (xem `.env.example`); mọi màn hình dùng cùng URL. Biến này được đóng vào bundle khi build nên cần build lại sau khi đổi. Không đưa khóa Stripe/email vào biến NEXT_PUBLIC_.

Trang chủ, danh sách/chi tiết phim và lịch chiếu lấy dữ liệu từ backend. Bộ lọc rạp/ngày/giá gọi API tìm kiếm. Mọi ID phim/suất chiếu trong luồng mặc định là ID MySQL; giữ ghế gọi Redis qua backend, booking và lịch sử vé dùng MySQL. Danh sách thể loại quản trị lấy từ DB. Chế độ xem thử chỉ bật rõ ràng tại `/movies?demo=1` và các liên kết có `demo=1`, không tạo booking/thanh toán thật. Khuyến mãi chưa có API được hiển thị là chưa có chương trình, không công bố mã giảm giá mẫu.

Trước khi kiểm thử, chạy seed backend để có suất chiếu tương lai và tài khoản phát triển. Seed không đặt lại mật khẩu tài khoản đã tồn tại. Cấu hình email/OTP và Stripe test theo `BTL_DBMS_BE/INTEGRATION.md`; frontend hiển thị rõ email đang dùng console trong môi trường phát triển và yêu cầu đăng nhập lại sau khi đổi mật khẩu.

Font được đóng kèm từ các gói Fontsource, không tải Google Fonts khi build. Các ảnh poster lấy từ dữ liệu backend; cần quyền mạng tới miền ảnh được sử dụng để xem ảnh đầy đủ.

```bash
npm run lint
npm run test:api
node scripts/test-api.mjs --live
npm run build
npm run start
```

Trong terminal khác, khi backend và frontend đã chạy:

```bash
npx playwright install chromium  # lần đầu, nếu chưa có browser
npm run test:e2e
# Hoặc dùng Chromium đã có trong môi trường Linux:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright kiểm tra catalog/API thật, bộ lọc, liên kết lịch chiếu, sơ đồ ghế, giữ/hủy ghế Redis, tách demo và API quản trị. Mặc định dùng hai tài khoản seed phát triển được mô tả ở backend; có thể đặt `E2E_CUSTOMER_EMAIL`, `E2E_CUSTOMER_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` qua môi trường kiểm thử. Đặt `E2E_BASE_URL` và `E2E_API_URL` nếu đổi cổng. Kiểm thử UI không thu tiền hoặc tạo booking thật; kiểm thử transaction/booking/thanh toán mô phỏng/hoàn tiền nằm ở backend. Stripe Checkout thực cần cấu hình và kiểm tra riêng.
