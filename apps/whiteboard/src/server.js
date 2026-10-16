// Máy chủ đồng bộ bảng trắng: mỗi buổi học là một tài liệu Yjs tên "session:<id>".
// Trạng thái được lưu vào bảng whiteboards trong Postgres (bảng do Prisma của API tạo).
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
const sessionIdOf = (documentName) => documentName.replace(/^session:/, '');

const server = Server.configure({
  port: PORT,
  name: 'bangden-whiteboard',
  // Gom các thay đổi liên tiếp, ghi xuống DB tối đa 2 giây một lần.
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate({ token, documentName }) {
    let payload;
    try {
      payload = jwt.verify(token, WHITEBOARD_SECRET);
    } catch {
      throw new Error('Token bảng trắng không hợp lệ');
    }
    if (payload.doc !== documentName) throw new Error('Token không dành cho bảng trắng này');
    return { userId: payload.sub, name: payload.name, role: payload.role };
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const { rows } = await pool.query('SELECT state FROM whiteboards WHERE session_id = $1', [
          sessionIdOf(documentName),
        ]);
        return rows[0]?.state ?? null;
      },
      store: async ({ documentName, state }) => {
        await pool.query(
          `INSERT INTO whiteboards (session_id, state, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (session_id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
          [sessionIdOf(documentName), state],
        );
      },
    }),
  ],
});

server.listen().then(() => console.log(`Máy chủ bảng trắng chạy ở cổng ${PORT}`));
