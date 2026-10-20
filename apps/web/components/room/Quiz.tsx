'use client';
import { FormEvent, useState } from 'react';
import { Icon } from '@/components/meet/icons';
import type { Quiz } from './interaction';

type Quizzes = {
  quizzes: Quiz[];
  open: Quiz | null;
  justClosed: Quiz | null;
  create: (question: string, options: string[], correct: number | null) => Promise<void>;
  answer: (quizId: string, choice: number) => Promise<void>;
  close: (quizId: string) => Promise<void>;
};

const LETTERS = 'ABCDEF';

/** Thanh kết quả của một câu hỏi. */
function Results({ q }: { q: Quiz }) {
  const total = q.total ?? 0;
  return (
    <div className="quiz-res">
      {q.options.map((o, i) => {
        const n = q.counts?.[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const right = q.correct === i;
        return (
          <div key={i} className={`quiz-bar${right ? ' right' : ''}${q.mine === i ? ' mine' : ''}`}>
            <div className="fill" style={{ width: `${pct}%` }} />
            <span className="lbl">
              {LETTERS[i]}. {o}
              {right && <Icon name="check" size={16} style={{ verticalAlign: '-0.2em', marginLeft: 4 }} />}
            </span>
            <span className="num">{n} · {pct}%</span>
          </div>
        );
      })}
      <small>{total} người đã trả lời</small>
    </div>
  );
}

/** Tab "Câu hỏi" của giáo viên: tạo câu mới, xem kết quả trực tiếp, đóng câu đang mở. */
export function QuizPanel({ quiz, say }: { quiz: Quizzes; say: (m: string) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correct, setCorrect] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const filled = options.map((o) => o.trim());
    if (!question.trim()) return say('Chưa nhập câu hỏi');
    if (filled.filter(Boolean).length < 2) return say('Cần ít nhất 2 lựa chọn có nội dung');
    if (filled.some((o) => !o)) return say('Có lựa chọn đang trống, điền hoặc xoá bớt');
    setBusy(true);
    try {
      await quiz.create(question.trim(), filled, correct);
      setQuestion('');
      setOptions(['', '']);
      setCorrect(null);
      say('Đã gửi câu hỏi cho cả lớp');
    } catch (err) {
      say((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const past = [...quiz.quizzes].reverse();

  return (
    <div className="side-body">
      <form className="quiz-form" onSubmit={submit}>
        <div className="grp">Câu hỏi mới</div>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ví dụ: Kết quả của 2 ** 3 là bao nhiêu?" maxLength={300} rows={2} />
        {options.map((o, i) => (
          <div key={i} className="quiz-opt">
            <label title="Đánh dấu là đáp án đúng">
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
              {LETTERS[i]}
            </label>
            <input
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Lựa chọn ${LETTERS[i]}`}
              maxLength={120}
            />
            {options.length > 2 && (
              <button
                type="button"
                className="mini"
                aria-label={`Xoá lựa chọn ${LETTERS[i]}`}
                onClick={() => {
                  setOptions(options.filter((_, j) => j !== i));
                  setCorrect(correct === i ? null : correct != null && correct > i ? correct - 1 : correct);
                }}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        ))}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {options.length < 6 && (
            <button type="button" className="mini" onClick={() => setOptions([...options, ''])}>+ Thêm lựa chọn</button>
          )}
          {correct != null && (
            <button type="button" className="mini" onClick={() => setCorrect(null)}>Bỏ đáp án đúng (thăm dò ý kiến)</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="mini pri" disabled={busy}>Gửi cho lớp</button>
        </div>
        <small style={{ color: 'var(--on-room-muted)' }}>
          {correct == null ? 'Chưa chọn đáp án đúng: câu hỏi sẽ là thăm dò ý kiến.' : `Đáp án đúng: ${LETTERS[correct]}. Học viên chỉ thấy khi bạn đóng câu hỏi.`}
        </small>
      </form>

      {past.length > 0 && <div className="grp">Đã hỏi trong buổi ({past.length})</div>}
      {past.map((q) => (
        <div key={q.id} className="quiz-item">
          <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
            <b style={{ flex: 1, fontSize: 14 }}>{q.question}</b>
            {q.closed ? (
              <small style={{ color: 'var(--on-room-muted)' }}>Đã đóng</small>
            ) : (
              <button className="mini pri" onClick={() => quiz.close(q.id).then(() => say('Đã đóng câu hỏi, cả lớp thấy kết quả')).catch((e) => say(e.message))}>
                Đóng và công bố
              </button>
            )}
          </div>
          <Results q={q} />
        </div>
      ))}
    </div>
  );
}

/**
 * Thẻ nổi cho học viên: hiện câu hỏi đang mở, hoặc kết quả câu vừa đóng.
 * Học viên được đổi lựa chọn cho tới khi giáo viên đóng câu hỏi.
 */
export function QuizCard({ quiz, say }: { quiz: Quizzes; say: (m: string) => void }) {
  const [hidden, setHidden] = useState<string | null>(null);
  // Câu đang mở, hoặc kết quả câu vừa đóng; câu đóng từ trước khi vào phòng thì không hiện lại.
  const latest = quiz.open ?? quiz.justClosed;
  if (!latest || hidden === latest.id) return null;

  return (
    <div className="quiz-card" role="dialog" aria-label="Câu hỏi nhanh">
      <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="grp">{latest.closed ? 'Kết quả câu hỏi' : 'Câu hỏi nhanh'}</div>
          <b>{latest.question}</b>
        </div>
        <button className="mini" aria-label="Ẩn" onClick={() => setHidden(latest.id)}><Icon name="close" size={16} /></button>
      </div>
      {latest.closed ? (
        <>
          <Results q={latest} />
          {latest.correct != null && latest.mine != null && (
            <div className="quiz-verdict">{latest.mine === latest.correct ? <><Icon name="party" size={18} style={{ verticalAlign: '-0.25em', marginRight: 6 }} />Bạn trả lời đúng</> : `Đáp án đúng là ${LETTERS[latest.correct]}`}</div>
          )}
        </>
      ) : (
        <div className="quiz-choices">
          {latest.options.map((o, i) => (
            <button
              key={i}
              className={`quiz-choice${latest.mine === i ? ' on' : ''}`}
              aria-pressed={latest.mine === i}
              onClick={() => quiz.answer(latest.id, i).catch((e) => say(e.message))}
            >
              <b>{LETTERS[i]}</b> {o}
            </button>
          ))}
          <small>{latest.mine == null ? 'Chọn một đáp án.' : 'Đã gửi. Bạn vẫn đổi được cho tới khi giáo viên đóng câu hỏi.'}</small>
        </div>
      )}
    </div>
  );
}
