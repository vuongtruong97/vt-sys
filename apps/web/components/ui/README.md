# components/ui

Bộ components tái sử dụng, dựng từ Figma **E-Learning Site (Community)**:
https://www.figma.com/design/afEnwWVWapxKrTuaFF4brt/E-Learning-Site--Community-

Xem mọi component tại `/ui` (chạy `npm run dev`; trên production chỉ quản trị viên mở được).

```tsx
import { Button, CourseCard, Input, Tabs } from '@/components/ui';
```

CSS (`tokens.css`, `ui.css`) đã nạp một lần trong `app/layout.tsx`, không cần import ở từng trang.

## Nguyên tắc

- Style chỉ dùng biến `--ui-*` trong `tokens.css`. Class đều có tiền tố `ui-` nên không đụng `globals.css`.
- Component nhận `className` và thuộc tính HTML gốc; phần tử form dùng `forwardRef`.
- Chữ hiển thị mặc định bằng tiếng Việt. Thông báo lỗi nói rõ chuyện gì xảy ra.
- Không dùng cho phòng học (`components/room/*`, giao diện tối riêng).

## Khác với Figma (có chủ ý)

| Figma | Ở đây | Lý do | Muốn đúng Figma |
| --- | --- | --- | --- |
| Font Poppins | Be Vietnam Pro | Poppins không có bộ chữ tiếng Việt (ạ, ấ, ở… hiện bằng font khác) | đổi `--ui-font` |
| Teal `#49BBBD` cho nút chữ trắng, giá, liên kết | `#328182` (`--ui-primary-strong`) | `#49BBBD` với chữ trắng chỉ đạt 2,3:1, WCAG AA cần 4,5:1. Teal gốc vẫn dùng cho thanh tiến độ, viền, nền nhạt | `--ui-primary-strong: #49bbbd` |
| Placeholder `#ACACAC` | `#767676` | 2,3:1 → 4,5:1 | `--ui-placeholder` |
| Nhãn giảm giá `#EE645B` | `#C3524B` | 3,2:1 → 4,5:1 | `--ui-danger-strong` |
| Icon Font Awesome (đồng hồ, ô vuông) | SVG vẽ lại trong `internal.tsx` | không nạp cả bộ font icon | |
| Chữ "Lorem ipsum", tiếng Anh | tiếng Việt | quy ước dự án | |
| Logo "TOTC" | "BĐ" + "Bảng Đen" | TOTC là thương hiệu mẫu của file Figma | `Logo text`, `name` |
| Nền hero teal `#49BBBD`, chữ "Studying" cam | nền `--ui-primary-strong`, gạch chân cam hạ thấp | chữ trắng trên teal gốc 2,3:1; chữ cam trên teal không đọc được; gạch chân sát chữ đè dấu nặng tiếng Việt | |
| Lớp phủ ảnh trang Login ("Rectangle 78") | chuyển màu tối bằng CSS | Figma xuất ra SVG rỗng | |
| "Remember me", "Forgot Password?" | không có | app chưa có hai tính năng này | |

Không có chế độ tối: Figma chỉ có giao diện sáng, nên `globals.css` đã bỏ khối `prefers-color-scheme: dark` cho các trang. Phòng học vẫn tối (nhóm biến `--room*`).

Figma chỉ có 6 component gốc (icon mạng xã hội); các component dưới đây được tách từ phần lặp lại trên 18 màn hình.

## Token (`tokens.css`)

Màu `--ui-primary`, `--ui-primary-strong`, `--ui-navy` (`#252641`, tiêu đề và footer), `--ui-text-body` (`#696984`), `--ui-section` (nền xanh nhạt), `--ui-star` (`#FDB022`); bo góc `--ui-radius-md` 20px (thẻ), `--ui-radius-sm` 12px (tab), `--ui-radius-pill` (nút, ô nhập); bóng `--ui-shadow-card` `0 18.83px 47.08px rgba(47,50,125,.1)`; chiều cao `--ui-control-md` 49px, `--ui-input-h` 54px, `--ui-control-lg` 60px.

## Components

| Component | Figma node | Dùng khi |
| --- | --- | --- |
| `Button` `variant: primary · outline · ghost · light · glass`, `size: sm · md · lg`, `square`, `block`, `loading` | 28:169, 136:347, 39:268 | nút bấm. `light`/`glass` cho nền teal |
| `ButtonLink` | | liên kết trông như nút (`next/link`) |
| `IconButton` `label` bắt buộc, `tone: solid · soft` | 47:339 | nút chỉ có icon |
| `CarouselNav` | 47:339 | cặp nút trước/sau của dải khoá học |
| `Input` `label`, `hint`, `error`, `hideLabel`, `tone="dark"`; `type="password"` có nút hiện/ẩn | 28:148, 28:152 | ô nhập |
| `Textarea`, `Select` (`options`, `placeholder`) | | cùng kiểu với `Input` |
| `Checkbox` | 28:165 | "Ghi nhớ đăng nhập" |
| `Tabs` `variant: boxed · segmented`, `label`, `items`, `value`/`onChange` | 49:259, 28:141 | tab nội dung; thanh chuyển Đăng nhập/Đăng ký. Mũi tên, Home, End |
| `Badge` `variant: category · soft · discount` | 54:457 | nhãn danh mục, nhãn "50%" |
| `Meta` | 54:464 | thông tin phụ có icon đồng hồ ("3 tháng") |
| `Avatar`, `Person` | 54:454 | ảnh tròn (không có ảnh thì chữ cái đầu); avatar kèm tên |
| `Card` `padded`, `tone: surface · section` | 54:443 | khung thẻ chung |
| `CourseCard` | 54:439 | thẻ khoá học: ảnh, danh mục, thời lượng, mô tả, giáo viên, giá (hoặc `footerExtra`). Có `href` thì cả thẻ là liên kết |
| `CourseProgressCard` `done`, `total` | 47:287 | thẻ "đang học" có tiến độ |
| `CategoryCard` `icon`, `color: {fg, bg}` | 54:297 | thẻ danh mục |
| `Price` | 54:452 | giá cũ gạch ngang + giá mới |
| `PriceBox` | 49:242 | hộp mua khoá học (giá, hạn, nút, các mục) |
| `Progress` `value`, `max`, `label` | 47:305 | thanh tiến độ 8px |
| `Stars`, `Rating` | 52:231 | sao (cắt theo điểm lẻ), sao + điểm + số lượt |
| `RatingSummary` `average`, `counts[5]` | 52:226 | hộp tổng hợp đánh giá |
| `Review` | 52:300 | một nhận xét |
| `SectionHeader` `title`, `actionHref` | 54:435 | tiêu đề khối + "Xem tất cả" |
| `CtaBanner` | 54:554 | khối kêu gọi nền xanh than |
| `Logo` `tone: dark · light`, `href` | 47:266 | logo TOTC (khung thoi từ Figma) |
| `Footer` `links`, `onSubscribe` | 47:262 | footer nền xanh than, đăng ký bản tin |
| `Modal` `open`, `onClose`, `title`, `footer` | (không có trong Figma) | hộp thoại: Esc, bấm ra ngoài, giữ focus, trả focus |
| `Pagination` `page`, `total`, `onChange` | (mũi tên theo 47:339) | phân trang có số |
| `EmptyState` | (không có trong Figma) | danh sách trống |
| `Navbar` `links`, `user`, `onLogout`, `guestActions` | 47:248 (thanh trên trang Course) | thanh điều hướng; màn hẹp gom vào nút menu. Trong app dùng qua `components/Nav.tsx` |
| `Page` `narrow`, `PageHeader` `title`, `description`, `back`, `actions`, `Section` | | khung trang, tiêu đề trang, khối có tiêu đề |
| `Alert` `tone: error · success · info` | | thông báo trong trang (lỗi đọc ngay bằng `role="alert"`) |
| `Muted` | | chữ phụ màu xám |
| `Table` `caption` | (không có trong Figma) | bảng bo góc, cuộn ngang trong khung trên màn hẹp |
| `Switch` | | công tắc bật/tắt (`role="switch"`) |
| `Stat` | Landing "15K+ Students" | số liệu lớn kèm nhãn; nhiều cái đặt trong `div.ui-stats` |
| `List`, `ListRow` `lead`, `title`, `meta`, `actions`, `highlight` | (từ thẻ Figma) | dòng danh sách dạng thẻ: lịch học, buổi học, bản ghi, tài liệu |

Class bố cục dùng trực tiếp: `ui-cols` (2 cột, tự xuống 1 cột), `ui-grid-cards` (lưới thẻ), `ui-stats`, `ui-actions` (hàng nút), `ui-form` / `ui-form-row` (form và hàng ô nhập), `ui-hero` (phần mở đầu trang chủ), `ui-auth` (trang đăng nhập/đăng ký theo Figma Login 28:131).

## Ví dụ

```tsx
<CourseCard
  title="Python cơ bản"
  href={`/courses/${id}`}
  image={course.cover}
  category="Lập trình"
  duration="10 buổi"
  description={course.description}
  teacher={{ name: course.teacher.name, avatar: course.teacher.avatar }}
  oldPrice="1.500.000 ₫"
  price="1.200.000 ₫"
/>

<Input label="Mật khẩu" type="password" autoComplete="current-password" error={errors.password} />

<Tabs
  variant="segmented"
  label="Đăng nhập hoặc đăng ký"
  value={mode}
  onChange={setMode}
  items={[{ id: 'login', label: 'Đăng nhập' }, { id: 'register', label: 'Đăng ký' }]}
/>
```

## Asset

Tải từ Figma vào `public/ui/`: `stars-5.svg` (node 52:231), `logo-mark.svg` (47:268), `eye-off.svg` (28:157, icon "invisible"). Ảnh mẫu cho trang `/ui` ở `public/ui/demo/` (đã thu nhỏ còn 800px); không dùng trong app.
