import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { WebinarController } from '../src/classroom/webinar.module';
import { classroom, mockPrisma, session, student, teacher } from './helpers';

const stream = (over: Record<string, unknown> = {}) => ({
  id: 'ls1',
  sessionId: 's1',
  egressId: 'EG_L',
  status: 'RECORDING',
  public: false,
  prefix: 'live/s1/123',
  ...over,
});

function setup(liveStream: unknown = stream()) {
  const prisma = mockPrisma() as any;
  prisma.liveStream = { findUnique: jest.fn().mockResolvedValue(liveStream) };
  const storage = { get: jest.fn().mockResolvedValue({ body: Readable.from(['#EXTM3U']), contentType: 'application/x-mpegURL', length: 7 }) };
  const live = { start: jest.fn().mockResolvedValue(stream({ status: 'STARTING' })), stop: jest.fn() };
  const room = classroom(prisma);
  return { storage, live, ctl: new WebinarController(prisma, storage as any, room, live as any) };
}

/** Request giả: không có cookie là người xem chưa đăng nhập. */
const anon = { headers: {}, cookies: {} } as any;
const res = () => {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => (headers[k] = v), write: jest.fn(), end: jest.fn(), on: jest.fn(), once: jest.fn(), emit: jest.fn() } as any;
};

describe('Webinar', () => {
  it('không đọc được file ngoài thư mục luồng', async () => {
    const { ctl, storage } = setup(stream({ public: true }));
    for (const bad of ['../../materials/x.pdf', 'a/b.ts', 'live.m3u8.exe', '.env']) {
      await expect(ctl.file(anon, res(), 's1', bad)).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('luồng riêng tư: người chưa đăng nhập không xem được', async () => {
    const { ctl } = setup();
    await expect(ctl.file(anon, res(), 's1', 'live.m3u8')).rejects.toBeInstanceOf(ForbiddenException);
    expect((await ctl.info(anon, 's1')).canWatch).toBe(false);
  });

  it('luồng công khai: ai cũng xem được, playlist trực tiếp cache ngắn', async () => {
    const { ctl, storage } = setup(stream({ public: true }));
    const r = res();
    await ctl.file(anon, r, 's1', 'live.m3u8');
    expect(storage.get).toHaveBeenCalledWith('live/s1/123/live.m3u8');
    expect(r.headers['Cache-Control']).toBe('public, max-age=2');
    expect(r.headers['Content-Type']).toBe('application/vnd.apple.mpegurl');
  });

  it('đoạn video cache lâu dài', async () => {
    const { ctl } = setup(stream({ public: true }));
    const r = res();
    await ctl.file(anon, r, 's1', 'seg_00012.ts');
    expect(r.headers['Cache-Control']).toBe('public, max-age=86400, immutable');
  });

  it('phát xong: trang xem dùng playlist đầy đủ để xem lại', async () => {
    const { ctl } = setup(stream({ public: true, status: 'READY' }));
    expect((await ctl.info(anon, 's1')).playlist).toBe('/api/live/s1/index.m3u8');
  });

  it('chỉ giáo viên bắt đầu phát, và chỉ khi lớp đang diễn ra', async () => {
    const { ctl, live } = setup();
    await expect(ctl.start(student, 's1', {})).rejects.toThrow('Chỉ giáo viên');
    await ctl.start(teacher, 's1', { public: true });
    expect(live.start).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), true);
  });
});
