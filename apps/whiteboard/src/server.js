// Máy chủ đồng bộ bảng của phòng học (Hocuspocus + Yjs). Hai loại tài liệu:
// - "session:<id>": bảng phấn, cả lớp cùng viết; lưu ở bảng whiteboards.
// - "ggb:<id>": bảng GeoGebra, chỉ giáo viên ghi, học viên chỉ xem; lưu ở bảng ggb_boards.
// Hai bảng đều do Prisma của API tạo.
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { WHITEBOARD_SECRET, DATABASE_URL } = process.env;
const PORT = Number(process.env.PORT ?? 1234);
if (!WHITEBOARD_SECRET || !DATABASE_URL) {
  console.error('Thiếu WHITEBOARD_SECRET hoặc DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

/** Bảng lưu và mã buổi học theo tên tài liệu. Tên lạ thì null (từ chối). */
function storeOf(documentName) {
  const m = /^(session|ggb):(.+)$/.exec(documentName);
  if (!m) return null;
  return { table: m[1] === 'ggb' ? 'ggb_boards' : 'whiteboards', sessionId: m[2], kind: m[1] };
}

const server = Server.configure({
  port: PORT,
  name: 'bangden-whiteboard',
  // Gom các thay đổi liên tiếp, ghi xuống DB tối đa 2 giây một lần.
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate({ token, documentName, connection }) {
    let payload;
    try {
      payload = jwt.verify(token, WHITEBOARD_SECRET);
    } catch {
      throw new Error('Token bảng trắng không hợp lệ');
    }
    if (payload.doc !== documentName || !storeOf(documentName)) throw new Error('Token không dành cho bảng trắng này');
    // Bảng GeoGebra: chỉ giáo viên (chủ phòng) được ghi; chặn ở máy chủ, không chỉ ở giao diện.
    if (storeOf(documentName).kind === 'ggb' && payload.role !== 'teacher') connection.readOnly = true;
    return { userId: payload.sub, name: payload.name, role: payload.role };
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const s = storeOf(documentName);
        if (!s) return null;
        const { rows } = await pool.query(`SELECT state FROM ${s.table} WHERE session_id = $1`, [s.sessionId]);
        return rows[0]?.state ?? null;
      },
      store: async ({ documentName, state }) => {
        const s = storeOf(documentName);
        if (!s) return;
        await pool.query(
          `INSERT INTO ${s.table} (session_id, state, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (session_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
          [s.sessionId, state],
        );
      },
    }),
  ],
});

server.listen().then(() => console.log(`Máy chủ bảng trắng chạy ở cổng ${PORT}`));
