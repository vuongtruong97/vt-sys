export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Gọi API qua /api (Next chuyển tiếp sang máy chủ NestJS). */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    method: rest.method ?? (json !== undefined ? 'POST' : 'GET'),
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(res.status, msg || 'Có lỗi xảy ra, thử lại sau ít phút');
  }
  return data as T;
}

/** Tài khoản đang đăng nhập. Vai trò do quản trị viên tạo; kiểm tra quyền bằng can() trong lib/can.ts. */
export type Me = { id: string; name: string; email: string; avatarUrl: string | null; role: { id: string; key: string; name: string }; permissions: string[] };

export type ScheduleItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  kind: 'class' | 'meeting';
  /** null: meeting độc lập (chỉ hiện trong lịch của người tạo). */
  course: { id: string; title: string } | null;
  students: number;
  /** Mình là người dạy/chủ phòng của buổi này (nút Mở lớp, Điểm danh). */
  mine: boolean;
  /** Meeting của mình: khoá link mời vào thẳng (null nếu không phải chủ phòng hoặc meeting cũ). */
  inviteKey: string | null;
};
