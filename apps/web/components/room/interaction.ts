'use client';
import { useDataChannel } from '@livekit/components-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const decoder = new TextDecoder();

export type ChatMsg = { id: string; text: string; at: string; from: { id: string; name: string } };

export type Quiz = {
  id: string;
  question: string;
  options: string[];
  closed: boolean;
  /** Lựa chọn của chính mình (học viên). */
  mine?: number | null;
  /** Chỉ có khi là giáo viên hoặc câu hỏi đã đóng. */
  correct?: number | null;
  counts?: number[];
  total?: number;
};

function parse<T>(payload: Uint8Array): T | null {
  try {
    return JSON.parse(decoder.decode(payload)) as T;
  } catch {
    return null;
  }
}

/**
 * Tin nhắn của buổi học. Lịch sử tải từ API; tin mới API phát xuống phòng (chủ đề "chat"),
 * nên người vào muộn hay kết nối lại vẫn thấy đủ.
 */
export function useRoomChat(sessionId: string, visible: boolean) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);

  const add = useCallback((m: ChatMsg) => {
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
  }, []);

  useEffect(() => {
    api<ChatMsg[]>(`/sessions/${sessionId}/chat`)
      .then((old) => setMessages((cur) => [...old, ...cur.filter((m) => !old.some((o) => o.id === m.id))]))
      .catch(() => {});
  }, [sessionId]);

  useDataChannel('chat', (msg) => {
    const m = parse<ChatMsg>(msg.payload);
    if (!m) return;
    add(m);
    if (!visible) setUnread((n) => n + 1);
  });

  useEffect(() => {
    if (visible) setUnread(0);
  }, [visible]);

  const send = useCallback(
    async (text: string) => add(await api<ChatMsg>(`/sessions/${sessionId}/chat`, { json: { text } })),
    [sessionId, add],
  );

  return { messages, unread, send };
}

type QuizEvent =
  | { type: 'open'; quiz: Quiz }
  | { type: 'close'; quiz: Quiz }
  | { type: 'tally'; quizId: string; counts: number[]; total: number };

/** Câu hỏi nhanh: danh sách theo buổi, cập nhật trực tiếp qua chủ đề "quiz". */
export function useQuizzes(sessionId: string) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  /** Câu vừa đóng trong lúc đang ở trong phòng; học viên thấy kết quả của câu này. */
  const [justClosed, setJustClosed] = useState<string | null>(null);

  const upsert = useCallback((q: Partial<Quiz> & { id: string }) => {
    setQuizzes((list) => {
      const i = list.findIndex((x) => x.id === q.id);
      if (i < 0) return [...list, q as Quiz];
      const next = [...list];
      next[i] = { ...next[i], ...q };
      return next;
    });
  }, []);

  useEffect(() => {
    api<Quiz[]>(`/sessions/${sessionId}/quizzes`).then(setQuizzes).catch(() => {});
  }, [sessionId]);

  useDataChannel('quiz', (msg) => {
    const e = parse<QuizEvent>(msg.payload);
    if (!e) return;
    if (e.type === 'tally') upsert({ id: e.quizId, counts: e.counts, total: e.total });
    else if (e.type === 'open') {
      // Câu mới mở thì các câu trước coi như đã đóng.
      setQuizzes((list) => list.map((q) => (q.closed ? q : { ...q, closed: true })));
      upsert(e.quiz);
      setJustClosed(null);
    } else {
      upsert(e.quiz);
      setJustClosed(e.quiz.id);
    }
  });

  const create = useCallback(
    async (question: string, options: string[], correct: number | null) =>
      upsert(await api<Quiz>(`/sessions/${sessionId}/quizzes`, { json: { question, options, ...(correct != null ? { correct } : {}) } })),
    [sessionId, upsert],
  );
  const answer = useCallback(
    async (quizId: string, choice: number) => {
      await api(`/sessions/${sessionId}/quizzes/${quizId}/answer`, { json: { choice } });
      upsert({ id: quizId, mine: choice });
    },
    [sessionId, upsert],
  );
  const close = useCallback(
    async (quizId: string) => upsert(await api<Quiz>(`/sessions/${sessionId}/quizzes/${quizId}/close`, { method: 'POST' })),
    [sessionId, upsert],
  );

  const open = quizzes.find((q) => !q.closed) ?? null;
  return { quizzes, open, justClosed: quizzes.find((q) => q.id === justClosed) ?? null, create, answer, close };
}
