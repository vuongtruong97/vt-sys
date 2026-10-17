import type { Participant } from 'livekit-client';

export type RoomMeta = { board: boolean; allowStudentShare: boolean; recording?: boolean };
export type Panel = 'chat' | 'people' | 'quiz' | 'files' | 'groups' | null;

/** Vai trò lấy từ metadata trong token do API cấp. */
export const roleOf = (p: Participant): 'teacher' | 'student' => {
  try {
    return JSON.parse(p.metadata || '{}').role === 'teacher' ? 'teacher' : 'student';
  } catch {
    return 'student';
  }
};

export const handUp = (p: Participant) => p.attributes?.hand === '1';

/** Phòng nhóm đang ở khi chia nhóm (trả về từ POST /sessions/:id/join). */
export type GroupInfo = { index: number; name: string; count: number; endsAt: string | null };
