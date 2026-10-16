import type { Participant } from 'livekit-client';

export type RoomMeta = { board: boolean; allowStudentShare: boolean };
export type Panel = 'chat' | 'people' | 'quiz' | null;

/** Vai trò lấy từ metadata trong token do API cấp. */
export const roleOf = (p: Participant): 'teacher' | 'student' => {
  try {
    return JSON.parse(p.metadata || '{}').role === 'teacher' ? 'teacher' : 'student';
  } catch {
    return 'student';
  }
};

export const handUp = (p: Participant) => p.attributes?.hand === '1';
