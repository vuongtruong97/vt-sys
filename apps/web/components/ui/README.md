# components/ui

Bộ components tái sử dụng. Giao diện theo Figma **Online Learning Landing Page (Community)** ("Skilline"): nền trắng, cam `#F48C06` cho nút chính, navy `#2F327D` cho tiêu đề, xanh ngọc `#23BDEE` làm màu phụ, thẻ bo 20px với bóng mềm, chỉ có chế độ sáng.
https://www.figma.com/design/23s40efxYZw10qoAKxjN5L/Online-Learning-Landing-Page--Community-

Bố cục các khối (thẻ khoá học, hộp giá, đánh giá…) ban đầu tách từ Figma **E-Learning Site (Community)**; tên vai trò màu `--md-*` giữ từ thời dùng Material 3:
https://www.figma.com/design/afEnwWVWapxKrTuaFF4brt/E-Learning-Site--Community-

Xem mọi component tại `/ui` (chạy `npm run dev`; trên production chỉ quản trị viên mở được).

```tsx
import { Button, CourseCard, Input, Tabs } from '@/components/ui';
```

CSS (`tokens.css`, `ui.css`) đã nạp một lần trong `app/layout.tsx`, không cần import ở từng trang.

**Mockup phòng học** kiểu Google Meet (19 màn hình, dữ liệu giả, không kết nối LiveKit) nằm riêng ở `components/meet-mock`, xem tại `/ui/meeting`.

## Nguyên tắc

- Style chỉ dùng biến `--ui-*` trong `tokens.css`. Class đều có tiền tố `ui-` nên không đụng `globals.css`.
- Component nhận `className` và thuộc tính HTML gốc; phần tử form dùng `forwardRef`.
- Chữ hiển thị mặc định bằng tiếng Việt. Thông báo lỗi nói rõ chuyện gì xảy ra.
- Phòng học (`components/room/*`) dùng `components/meet/meet.css`, cùng token `--md-*`.

## Màu và chữ

`tokens.css` có hai lớp biến:

- `--md-*`: vai trò màu (`--md-primary` cam, `--md-secondary` navy, `--md-tertiary` xanh ngọc, `--md-surface-container-low` nền thẻ…). Màu chủ đạo chọn ở `/admin/site` ghi đè `--md-primary` và nền nhạt đi kèm (`lib/siteTheme.ts`).
- `--ui-*`: tên mà components dùng, trỏ vào `--md-*` (`--ui-primary`, `--ui-heading` navy cho tiêu đề, `--ui-text-body` `#696984`, `--ui-hero-bg` nền kem đầu trang chủ, `--ui-deco-*` màu trang trí của Figma). Component chỉ dùng `--ui-*`.

| Thành phần | Theo Figma Skilline |
| --- | --- |
| Chữ | tiêu đề, nút: Be Vietnam Pro nét 600–700; đoạn văn: Nunito Sans |
| Nút | bo tròn hẳn; `primary` nền cam chữ trắng, `light` nền trắng bóng mềm (nút "Login"), `outline` viền cam |
| Thẻ | nền trắng, góc 20, bóng `0 10px 60px rgba(38,45,118,.08)` |
| Ô nhập | góc 12, cao 52, viền navy khi focus |
| Tabs | `boxed`: chữ navy, gạch cam; `segmented`: nền kem, mục chọn nền cam |
| Thanh điều hướng | cao 76, mục đang mở gạch cam; trang chủ cùng nền kem với hero |
| Chân trang | nền navy `#252641`, chữ `#B2B3CF` |

Phòng học (`components/meet/meet.css`): khu video luôn tối (navy `#1B1C33`, điểm nhấn cam sáng `#FFB45C`); bảng bên, phòng chờ, hộp thoại dùng `--md-*` của trang. Màu bảng phấn giữ nguyên vì là nội dung.

## Khác với Figma (có chủ ý)

| Figma | Ở đây | Lý do |
| --- | --- | --- |
| Font Poppins | Be Vietnam Pro | Poppins không có dấu tiếng Việt (Google Fonts không có bộ `vietnamese`); Be Vietnam Pro cùng kiểu hình học |
| Link, nút chữ, tab màu cam | navy (`--ui-primary-text`) | chữ cam cỡ nhỏ trên nền trắng chỉ đạt 2,4:1; nút nền cam chữ trắng giữ như Figma |
| Logo "Skilline" | chữ viết tắt trong hình thoi xanh ngọc + tên trang | đổi được ở `/admin/site` |
| Thẻ nổi "250k Assisted Student", "User Experience Class" | số buổi học, số học viên, buổi học sắp tới lấy từ dữ liệu thật | |
| Khối "What is Skilline", "Our Features", "Testimonial", "News", đăng ký bản tin | không có | app chưa có nội dung tương ứng |
| Chữ tiếng Anh | tiếng Việt | quy ước dự án |

Bộ E-Learning chỉ có 6 component gốc (icon mạng xã hội); các component dưới đây được tách từ phần lặp lại trên 18 màn hình.

## Components

| Component | Figma node | Dùng khi |
| --- | --- | --- |
| `Button` `variant: primary · outline · ghost · light · glass`, `size: sm · md · lg`, `square`, `block`, `loading` | 28:169, 136:347, 39:268 | nút bấm. `light` nền trắng trên nền kem, `glass` viền theo màu nền |
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
| `CtaBanner` | 54:554 | khối kêu gọi nền kem, hai vòng tròn trang trí |
| `Logo` `tone: dark · light`, `href`, `image` | Skilline 4:2 | chữ viết tắt trong hình thoi xanh ngọc (bản `light` trên nền navy là viền); có `image` thì hiện ảnh logo |
| `Footer` `links`, `onSubscribe` | Skilline 173:6 | chân trang nền navy, đăng ký bản tin (khi có `onSubscribe`) |
| `Modal` `open`, `onClose`, `title`, `footer` | (không có trong Figma) | hộp thoại: Esc, bấm ra ngoài, giữ focus, trả focus |
| `Pagination` `page`, `total`, `onChange` | (mũi tên theo 47:339) | phân trang có số |
| `EmptyState` | (không có trong Figma) | danh sách trống |
| `Navbar` `links`, `user`, `onLogout`, `guestActions` | 47:248 (thanh trên trang Course) | thanh điều hướng; màn hẹp gom vào nút menu. Trong app dùng qua `components/Nav.tsx` |
| `Page` `narrow`, `PageHeader` `title`, `description`, `back`, `actions`, `Section` | | khung trang, tiêu đề trang, khối có tiêu đề |
| `Alert` `tone: error · success · info` | | thông báo trong trang (lỗi đọc ngay bằng `role="alert"`) |
| `Muted` | | chữ phụ màu xám |
| `Table` `caption` | (không có trong Figma) | bảng bo góc, cuộn ngang trong khung trên màn hẹp |
| `ClassroomMockup` | (Landing 10:358, phần hình bên phải) | hình phòng học dựng bằng HTML/CSS (bảng phấn, dải video, thanh điều khiển); ẩn khỏi trình đọc màn hình. Trang chủ không còn dùng, giữ cho trang `/ui` |
| `FeatureIcon` `name: video · screen · board · quiz · groups · record` | | icon nét cho thẻ tính năng (`CategoryCard` trong `.ui-features`) |
| `Steps` `items: {title, text}[]` | | các bước đánh số nối bằng đường kẻ; màn hẹp xếp dọc |
| `TeacherIntro` `name`, `title`, `bio`, `highlights`, `photo`, `eyebrow` | Skilline 112:4 | giới thiệu giáo viên: chữ trái, ảnh phải với hai khối màu ở góc; không có ảnh thì dùng ảnh lớp học minh hoạ |
| `Hero` `slide`, `actions`, `trust`, `decor` | Skilline 173:9 | đầu trang chủ một màn: nền kem, mép dưới cong, chữ trái, ảnh phải (mặc định ảnh học viên tách nền) |
| `HeroSlider` `slides`, `autoplaySec`, `actions`, `trust`, `decor` | | như `Hero` nhưng nhiều slide: tự chuyển, dừng khi rê chuột hoặc focus, nút tạm dừng, phím mũi tên |
| `HeroCard` `icon`, `color`, `title`, `text`, `place`; `HeroClassCard`; `HeroChip` | Skilline 22:4, 32:0, 38:2 | thẻ kính nổi trên ảnh đầu trang (truyền vào `decor`) |
| `Faq` `items: {q, a}[]` | | câu hỏi thường gặp, dùng `details/summary` nên mở/đóng được bằng bàn phím |
| `Switch` | | công tắc bật/tắt (`role="switch"`) |
| `Stat` | Landing "15K+ Students" | số liệu lớn kèm nhãn; nhiều cái đặt trong `div.ui-stats` |
| `List`, `ListRow` `lead`, `title`, `meta`, `actions`, `highlight` | (từ thẻ Figma) | dòng danh sách dạng thẻ: lịch học, buổi học, bản ghi, tài liệu |

Class bố cục dùng trực tiếp: `ui-cols` (2 cột, tự xuống 1 cột), `ui-grid-cards` (lưới thẻ), `ui-stats`, `ui-actions` (hàng nút), `ui-form` / `ui-form-row` (form và hàng ô nhập), `ui-landing` (bọc trang chủ: thanh điều hướng nền kem), `ui-page--landing` (khoảng cách rộng giữa các khối), `ui-auth` (trang đăng nhập/đăng ký theo Figma Login 28:131).

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

Ảnh từ Figma Skilline ở `public/ui/skilline/` (JPEG, đã cắt và thu nhỏ): `hero-student.jpg` (ảnh học viên tách nền đặt trên nền kem `#FFF2E1`, node 20:6), `classroom.jpg` (node 62:6); quản trị viên thay bằng ảnh slide và ảnh giáo viên ở `/admin/site`. Tải từ Figma E-Learning vào `public/ui/`: `stars-5.svg` (node 52:231), `logo-mark.svg` (47:268), `eye-off.svg` (28:157, icon "invisible"). Ảnh mẫu cho trang `/ui` ở `public/ui/demo/` (đã thu nhỏ còn 800px); không dùng trong app.
