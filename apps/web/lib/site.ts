/**
 * Nội dung tĩnh của trang chủ. Sửa trực tiếp ở đây, không cần đụng vào giao diện.
 * Phần giới thiệu giáo viên đang là nội dung mẫu: thay bằng thông tin thật trước khi dạy.
 */

export const teacher = {
  /** Bỏ trống thì lấy tên giáo viên của khoá học công khai đầu tiên. */
  name: '',
  title: 'Giáo viên lập trình',
  /** Đường dẫn ảnh trong public/, ví dụ '/ui/teacher.jpg'. Bỏ trống thì hiện chữ cái đầu của tên. */
  photo: '',
  bio:
    'Dạy lập trình cho người mới bắt đầu, tập trung vào hiểu bản chất và tự viết được chương trình nhỏ sau mỗi buổi. Lớp học nhỏ để thầy kịp xem bài và trả lời từng bạn.',
  highlights: ['Lớp nhỏ, tối đa 30 học viên', 'Mỗi buổi có bài tập và chữa bài trực tiếp', 'Bản ghi và tài liệu xem lại sau buổi học'],
};

export const faq: { q: string; a: string }[] = [
  {
    q: 'Tôi cần cài đặt gì để vào lớp?',
    a: 'Không cần cài gì. Lớp học chạy ngay trên trình duyệt Chrome, Edge, Safari hoặc Firefox bản mới. Nên dùng tai nghe để không bị vọng tiếng.',
  },
  {
    q: 'Học bằng điện thoại được không?',
    a: 'Được. Mở trang web bằng trình duyệt trên điện thoại, cho phép dùng camera và micro khi được hỏi. Màn hình lớn hơn sẽ dễ xem bảng trắng và màn hình chia sẻ hơn.',
  },
  {
    q: 'Khi nào tôi vào được lớp?',
    a: 'Nút "Vào lớp" trong Lịch học mở từ 10 phút trước giờ học. Nếu giáo viên mở lớp sớm hơn, bạn vào được ngay.',
  },
  {
    q: 'Làm sao để tham gia một khoá học?',
    a: 'Tạo tài khoản học viên, rồi gửi email đăng ký cho giáo viên để được thêm vào khoá. Nếu bạn vào lớp khi chưa có trong danh sách, giáo viên sẽ thấy yêu cầu và duyệt cho bạn vào.',
  },
  {
    q: 'Lỡ buổi học thì xem lại ở đâu?',
    a: 'Trong Lịch học, mỗi buổi đã học có nút "Xem lại": mở bản ghi hình (nếu giáo viên ghi lại) và tài liệu của buổi đó.',
  },
  {
    q: 'Tôi quên mật khẩu thì sao?',
    a: 'Nếu email tài khoản là email Google, bấm "Đăng nhập bằng Google" để vào mà không cần mật khẩu. Nếu không, liên hệ giáo viên để được hỗ trợ.',
  },
];
