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

export type Me = { id: string; name: string; email: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' };

export type ScheduleItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  course: { id: string; title: string };
  students: number;
};
