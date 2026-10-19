/** Dữ liệu giả cho mockup phòng học. Không gọi API. */

export type MockPerson = {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  mic: boolean;
  cam: boolean;
  hand?: boolean;
  speaking?: boolean;
  /** Ảnh giả lập khung camera; không có thì hiện avatar chữ cái đầu. */
  photo?: string;
  /** Màu nền avatar khi tắt camera. */
  tint: string;
};

export const ME_ID = 'p-me';

export const people: MockPerson[] = [
  { id: 'p-gv', name: 'Cô Linh', role: 'teacher', mic: true, cam: true, speaking: true, photo: '/ui/demo/avatar.jpg', tint: '#3b6e6f' },
  { id: ME_ID, name: 'Bạn (Lan Anh)', role: 'student', mic: false, cam: true, photo: '/ui/auth-hero.jpg', tint: '#6b5bb3' },
  { id: 'p-3', name: 'Quốc Bảo', role: 'student', mic: false, cam: false, hand: true, tint: '#b2643a' },
  { id: 'p-4', name: 'Hà My', role: 'student', mic: false, cam: true, photo: '/ui/demo/course-1.jpg', tint: '#3d6bb3' },
  { id: 'p-5', name: 'Đức Huy', role: 'student', mic: true, cam: false, tint: '#2f7a46' },
  { id: 'p-6', name: 'Thu Trang', role: 'student', mic: false, cam: true, photo: '/ui/demo/course-2.jpg', tint: '#a34a72' },
  { id: 'p-7', name: 'Minh Khoa', role: 'student', mic: false, cam: false, hand: true, tint: '#7a6a2f' },
  { id: 'p-8', name: 'Ngọc Ánh', role: 'student', mic: false, cam: false, tint: '#4a5aa3' },
  { id: 'p-9', name: 'Gia Hân', role: 'student', mic: false, cam: true, photo: '/ui/demo/course-3.jpg', tint: '#8a3f9b' },
  { id: 'p-10', name: 'Tuấn Kiệt', role: 'student', mic: false, cam: false, tint: '#3b7d8a' },
  { id: 'p-11', name: 'Bảo Ngọc', role: 'student', mic: false, cam: false, tint: '#9b4a3f' },
  { id: 'p-12', name: 'Phúc An', role: 'student', mic: false, cam: false, tint: '#566b2f' },
];

export const waiting = [
  { id: 'w-1', name: 'Thanh Tùng', email: 'tung.nt@gmail.com' },
  { id: 'w-2', name: 'Mai Phương', email: 'phuong.mai@gmail.com' },
];

export const messages = [
  { id: 'm-1', from: 'Cô Linh', teacher: true, at: '14:02', text: 'Chào cả lớp! Hôm nay mình học về hàm trong Python nhé.', pinned: true },
  { id: 'm-2', from: 'Hà My', at: '14:05', text: 'Cô ơi hàm có trả về nhiều giá trị được không ạ?' },
  { id: 'm-3', from: 'Cô Linh', teacher: true, at: '14:06', text: 'Được em, trả về tuple: return a, b. Lát nữa cô demo.' },
  { id: 'm-4', from: 'Quốc Bảo', at: '14:09', text: 'Em gửi link bài tập tuần trước ạ: bai-tap-5.py' },
  { id: 'm-5', from: 'Bạn (Lan Anh)', me: true, at: '14:11', text: 'Em nghe rõ rồi ạ 👍' },
];

export const quiz = {
  question: 'Hàm nào sau đây trả về độ dài của danh sách?',
  options: [
    { text: 'size(x)', votes: 1 },
    { text: 'len(x)', votes: 7, correct: true },
    { text: 'count(x)', votes: 2 },
    { text: 'length(x)', votes: 0 },
  ],
  answered: 10,
  total: 11,
};

export const groups = [
  { name: 'Nhóm 1', members: ['Quốc Bảo', 'Hà My', 'Đức Huy'] },
  { name: 'Nhóm 2', members: ['Thu Trang', 'Minh Khoa', 'Ngọc Ánh'] },
  { name: 'Nhóm 3', members: ['Gia Hân', 'Tuấn Kiệt', 'Bảo Ngọc', 'Phúc An'] },
];

export const files = [
  { name: 'Slide buổi 6 - Hàm.pdf', size: '2,4 MB', by: 'Cô Linh', kind: 'PDF' },
  { name: 'bai-tap-6.py', size: '3 KB', by: 'Cô Linh', kind: 'PY' },
  { name: 'Đề kiểm tra giữa kỳ.docx', size: '86 KB', by: 'Cô Linh', kind: 'DOC' },
];

export const session = { course: 'Python cơ bản', title: 'Buổi 6: Hàm', code: 'bd-10b1-f63c', time: '14:00 – 15:30' };
