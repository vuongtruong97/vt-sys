'use client';
import { ReactNode, useState } from 'react';
import { Nav } from '@/components/Nav';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  CarouselNav,
  CategoryCard,
  Checkbox,
  CourseCard,
  CourseProgressCard,
  CtaBanner,
  EmptyState,
  Footer,
  Input,
  Logo,
  Meta,
  Modal,
  Pagination,
  Person,
  PriceBox,
  Progress,
  Rating,
  RatingSummary,
  Review,
  SectionHeader,
  Select,
  Stars,
  Tabs,
  Textarea,
} from '@/components/ui';
import { useMe } from '@/lib/useMe';

const teacher = { name: 'Lina', avatar: '/ui/demo/avatar.jpg' };
const desc = 'Nền tảng điện toán đám mây từ cơ bản tới thiết kế hệ thống, kèm bài tập thực hành sau mỗi buổi.';

/** Một mục trên trang mẫu: tiêu đề, node Figma tương ứng, nội dung. */
function Demo({ title, node, children }: { title: string; node?: string; children: ReactNode }) {
  return (
    <section className="ui-demo">
      <h2 className="ui-demo__title">
        {title}
        {node && <span className="ui-demo__node">Figma {node}</span>}
      </h2>
      <div className="ui-demo__body">{children}</div>
    </section>
  );
}

/**
 * Trang xem mẫu bộ components (components/ui), giao diện theo Figma Skilline. Bố cục gốc lấy từ Figma
 * "E-Learning Site (Community)" (số node bên cạnh tiêu đề). Chỉ mở khi chạy dev hoặc với tài khoản quản trị.
 */
export default function UiPage() {
  const me = useMe();
  const [modal, setModal] = useState(false);
  const [page, setPage] = useState(3);
  const [slide, setSlide] = useState(0);

  const allowed = process.env.NODE_ENV !== 'production' || me?.role.key === 'admin';
  if (!allowed) {
    return (
      <>
        <Nav me={me} />
        <main className="container page">
          <p className="muted">{me === undefined ? 'Đang tải…' : 'Trang mẫu components chỉ dành cho quản trị viên.'}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav me={me} />
      <main className="ui-demo-page">
        <header className="ui-demo">
          <h1 className="ui-section-head__title" style={{ fontSize: 36 }}>Bộ components</h1>
          <p className="ui-course__desc" style={{ WebkitLineClamp: 'unset' }}>
            Giao diện theo Figma Skilline (cam, navy, xanh ngọc; chỉ chế độ sáng). Mã nguồn ở <code>apps/web/components/ui</code>, hướng dẫn trong README.md cùng thư mục.
          </p>
          <ButtonLink href="/ui/meeting" variant="outline" size="sm">Mockup phòng học kiểu Google Meet →</ButtonLink>
        </header>

        <Demo title="Nút" node="28:169, 136:347, 39:268">
          <div className="ui-demo__row">
            <Button>Đăng nhập</Button>
            <Button variant="outline">Xem chi tiết</Button>
            <Button variant="ghost">Huỷ</Button>
            <Button loading>Đang lưu</Button>
            <Button disabled>Không bấm được</Button>
            <ButtonLink href="/schedule" variant="outline" size="sm">Liên kết dạng nút</ButtonLink>
          </div>
          <div className="ui-demo__row">
            <Button size="sm">Nhỏ</Button>
            <Button size="md">Vừa</Button>
            <Button size="lg">Lớn</Button>
            <Button square size="lg" style={{ minWidth: 260 }}>Mua ngay</Button>
          </div>
          <div className="ui-demo__row ui-demo__teal">
            <Button variant="light" size="lg">Đăng nhập</Button>
            <Button variant="glass" size="lg">Đăng ký</Button>
          </div>
          <div className="ui-demo__row">
            <CarouselNav onPrev={() => setSlide((s) => s - 1)} onNext={() => setSlide((s) => s + 1)} canPrev={slide > 0} />
            <span className="ui-meta">Trang trượt: {slide + 1}</span>
          </div>
        </Demo>

        <Demo title="Ô nhập" node="28:139">
          <div className="ui-demo__grid2">
            <Input label="Tên đăng nhập" placeholder="Nhập tên đăng nhập" autoComplete="username" />
            <Input label="Mật khẩu" type="password" placeholder="Nhập mật khẩu" autoComplete="current-password" />
            <Input label="Email" type="email" placeholder="ban@gmail.com" error="Email không hợp lệ" defaultValue="ban@" />
            <Input label="Số điện thoại" placeholder="09xx xxx xxx" hint="Dùng để giáo viên liên hệ khi cần" />
            <Select
              label="Danh mục"
              placeholder="Chọn danh mục"
              defaultValue=""
              options={[
                { value: 'design', label: 'Thiết kế' },
                { value: 'dev', label: 'Lập trình' },
                { value: 'business', label: 'Kinh doanh' },
              ]}
            />
            <Input label="Không sửa được" defaultValue="Đã khoá" disabled />
          </div>
          <Textarea label="Ghi chú cho giáo viên" placeholder="Bạn muốn học gì trong buổi tới?" />
          <div className="ui-demo__row" style={{ justifyContent: 'space-between' }}>
            <Checkbox label="Ghi nhớ đăng nhập" defaultChecked />
            <a className="ui-link" href="#" style={{ fontSize: 12 }}>Quên mật khẩu?</a>
          </div>
        </Demo>

        <Demo title="Tab" node="28:141, 49:259">
          <Tabs
            variant="segmented"
            label="Đăng nhập hoặc đăng ký"
            items={[
              { id: 'login', label: 'Đăng nhập' },
              { id: 'register', label: 'Đăng ký' },
            ]}
          />
          <Tabs
            label="Thông tin khoá học"
            items={[
              { id: 'overview', label: 'Tổng quan', content: <p className="ui-course__desc">Giới thiệu khoá học, mục tiêu và đối tượng phù hợp.</p> },
              { id: 'lessons', label: 'Bài học', content: <p className="ui-course__desc">12 bài, mỗi bài 90 phút.</p> },
              { id: 'teacher', label: 'Giáo viên', content: <Person name={teacher.name} src={teacher.avatar} /> },
              { id: 'reviews', label: 'Đánh giá', content: <Rating value={4.5} count={128} /> },
            ]}
          />
        </Demo>

        <Demo title="Nhãn, avatar, tiến độ, sao" node="54:457, 47:305, 52:231">
          <div className="ui-demo__row">
            <Badge variant="category">Thiết kế</Badge>
            <Meta>3 tháng</Meta>
            <Badge>Mới</Badge>
            <Badge variant="discount">50%</Badge>
          </div>
          <div className="ui-demo__row">
            <Avatar name="Lina" src={teacher.avatar} size={70} />
            <Avatar name="Nguyễn An" size={44} />
            <Avatar name="Trần Bình" size={32} />
            <Person name={teacher.name} src={teacher.avatar} />
          </div>
          <Progress value={5} max={7} label="Tiến độ mẫu" />
          <div className="ui-demo__row">
            <Stars value={5} />
            <Stars value={3.5} />
            <Rating value={4.2} count={1520} />
          </div>
        </Demo>

        <Demo title="Thẻ khoá học" node="54:439, 47:287">
          <SectionHeader title="Gợi ý cho bạn" actionHref="/schedule" />
          <div className="ui-demo__cards">
            <CourseCard
              title="Kiến trúc sư giải pháp AWS"
              href="/ui"
              image="/ui/demo/course-1.jpg"
              category="Thiết kế"
              duration="3 tháng"
              description={desc}
              teacher={teacher}
              oldPrice="$100"
              price="$80"
            />
            <CourseCard
              title="Python cơ bản cho người mới"
              image="/ui/demo/course-2.jpg"
              category="Lập trình"
              duration="10 buổi"
              description={desc}
              teacher={{ name: 'Nguyễn An' }}
              price="1.200.000 ₫"
            />
            <CourseCard title="Khoá học chưa có ảnh" category="Kinh doanh" description={desc} teacher={teacher} footerExtra={<Badge>Miễn phí</Badge>} />
          </div>
          <div className="ui-demo__cards">
            <CourseProgressCard title="Kiến trúc sư giải pháp AWS" image="/ui/demo/course-1.jpg" teacher={teacher} done={5} total={7} href="/ui" />
            <CourseProgressCard title="Lập trình web với React" image="/ui/demo/course-2.jpg" teacher={teacher} done={2} total={12} />
            <CourseProgressCard title="Phân tích dữ liệu" image="/ui/demo/course-3.jpg" teacher={teacher} done={7} total={7} />
          </div>
        </Demo>

        <Demo title="Thẻ danh mục" node="54:297">
          <div className="ui-demo__cards">
            <CategoryCard title="Thiết kế" description={desc} icon={<span style={{ fontSize: 32 }}>✎</span>} color={{ fg: 'var(--md-on-primary-container)', bg: 'var(--md-primary-container)' }} />
            <CategoryCard title="Nhiếp ảnh" description={desc} icon={<span style={{ fontSize: 32 }}>📷</span>} color={{ fg: 'var(--md-on-tertiary-container)', bg: 'var(--md-tertiary-container)' }} />
            <CategoryCard title="Kinh doanh" description={desc} icon={<span style={{ fontSize: 32 }}>💼</span>} color={{ fg: 'var(--md-on-secondary-container)', bg: 'var(--md-secondary-container)' }} />
          </div>
        </Demo>

        <Demo title="Đánh giá" node="52:226, 52:300">
          <RatingSummary average={4} counts={[80, 30, 10, 4, 2]} />
          <Review author="Lina" avatar={teacher.avatar} rating={5} time="3 tháng trước">
            Lớp mở từ năm ngoái, giáo viên giảng dễ hiểu, bài tập sát thực tế và luôn có người hỗ trợ khi mình bị kẹt.
          </Review>
        </Demo>

        <Demo title="Hộp mua khoá học" node="49:242">
          <div style={{ maxWidth: 500 }}>
            <PriceBox
              image="/ui/demo/course-3.jpg"
              price="$49.65"
              oldPrice="$99.99"
              discount="Giảm 50%"
              deadline="Còn 11 giờ với giá này"
              action={<Button square block size="lg">Mua ngay</Button>}
              sections={[
                { title: 'Khoá học gồm', content: <p className="ui-course__desc">Hoàn tiền nếu không hài lòng · Học trên mọi thiết bị · Chứng nhận hoàn thành · 32 bài học</p> },
                { title: 'Học nhóm từ 5 người', content: <p className="ui-course__desc" style={{ fontSize: 14 }}>Liên hệ để nhận giá riêng cho nhóm.</p> },
              ]}
            />
          </div>
        </Demo>

        <Demo title="Phân trang, hộp thoại, trạng thái trống">
          <Pagination page={page} total={12} onChange={setPage} />
          <div className="ui-demo__row">
            <Button onClick={() => setModal(true)}>Mở hộp thoại</Button>
          </div>
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title="Rời khoá học?"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModal(false)}>Ở lại</Button>
                <Button onClick={() => setModal(false)}>Rời khoá học</Button>
              </>
            }
          >
            Bạn sẽ không vào được các buổi học tiếp theo. Bản ghi và tài liệu đã xem vẫn giữ trong 30 ngày.
          </Modal>
          <EmptyState title="Chưa có khoá học nào" icon={<span style={{ fontSize: 30 }}>📚</span>} action={<ButtonLink href="/schedule" size="sm">Xem lịch học</ButtonLink>}>
            Khi giáo viên thêm bạn vào khoá học, khoá học sẽ hiện ở đây.
          </EmptyState>
        </Demo>

        <Demo title="Kêu gọi, logo" node="54:554, 47:266">
          <CtaBanner title="Học trực tuyến cùng giáo viên, ở bất cứ đâu." action={<Button>Bắt đầu học ngay</Button>}>
            Lớp video trực tiếp, bảng trắng chung, bản ghi xem lại sau mỗi buổi.
          </CtaBanner>
          <div className="ui-demo__row">
            <Logo />
            <Logo size={48} name="Bảng Đen" />
          </div>
        </Demo>
      </main>
      <Footer
        tagline="Lớp học trực tuyến"
        links={[
          { label: 'Lịch học', href: '/schedule' },
          { label: 'Chính sách bảo mật', href: '/ui#privacy' },
          { label: 'Điều khoản', href: '/ui#terms' },
        ]}
        onSubscribe={async () => {
          await new Promise((r) => setTimeout(r, 600));
        }}
      />
    </>
  );
}
