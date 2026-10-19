import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GgbController, GgbService, MAX_GGB_BASE64 } from '../src/geogebra/ggb.module';
import { classroom, mockPrisma, outsider, session, student, teacher } from './helpers';

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  title: 'Đường tròn',
  ownerId: teacher.id,
  sessionId: null,
  appName: 'classic',
  base64: 'UEsDBA==',
  thumbnailKey: null,
  version: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function setup(d = doc(), storageEnabled = false) {
  const prisma = mockPrisma();
  const room = classroom(prisma, session());
  prisma.ggbDocument.findUnique.mockResolvedValue(d);
  const storage = { enabled: storageEnabled, put: jest.fn(), remove: jest.fn(), downloadUrl: jest.fn().mockResolvedValue('https://s3/x.png') };
  const svc = new GgbService(prisma as any, room);
  return { prisma, storage, ctrl: new GgbController(prisma as any, svc, storage as any) };
}

const dtoErrors = async (method: keyof GgbController, body: object) => {
  const types = Reflect.getMetadata('design:paramtypes', GgbController.prototype, method) as any[];
  const Dto = types[types.length - 1];
  return validate(plainToInstance(Dto, body));
};

describe('Lưu bài GeoGebra', () => {
  it('đúng phiên bản: lưu và tăng version', async () => {
    const { ctrl, prisma } = setup();
    prisma.ggbDocument.updateMany.mockResolvedValue({ count: 1 });
    expect(await ctrl.save(teacher, 'g1', { base64: 'UEsDBB==', version: 3 })).toEqual({ version: 4 });
    expect(prisma.ggbDocument.updateMany).toHaveBeenCalledWith({
      where: { id: 'g1', ownerId: teacher.id, version: 3 },
      data: { base64: 'UEsDBB==', version: { increment: 1 } },
    });
  });

  it('phiên bản cũ (đã lưu ở tab khác): 409', async () => {
    const { ctrl, prisma } = setup();
    prisma.ggbDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctrl.save(teacher, 'g1', { base64: 'x', version: 2 })).rejects.toThrow('sửa ở nơi khác');
  });

  it('không phải chủ bài: báo không tìm thấy, không phải 409', async () => {
    const { ctrl, prisma } = setup();
    prisma.ggbDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctrl.save(student, 'g1', { base64: 'x', version: 3 })).rejects.toThrow('Không tìm thấy');
  });

  it('chặn bài quá 2 MB và version âm', async () => {
    expect(await dtoErrors('save', { base64: 'a'.repeat(MAX_GGB_BASE64 + 1), version: 0 })).not.toHaveLength(0);
    expect(await dtoErrors('save', { base64: 'a', version: -1 })).not.toHaveLength(0);
    expect(await dtoErrors('save', { base64: 'a', version: 0 })).toHaveLength(0);
  });
});

describe('Xem bài GeoGebra', () => {
  it('chủ bài xem được và sửa được', async () => {
    const { ctrl } = setup();
    expect(await ctrl.get(teacher, 'g1')).toMatchObject({ id: 'g1', base64: 'UEsDBA==', canEdit: true });
  });

  it('người khác không xem được bài riêng', async () => {
    const { ctrl } = setup();
    await expect(ctrl.get(outsider, 'g1')).rejects.toThrow('Không tìm thấy');
  });

  it('bài gắn buổi học: học viên của lớp xem được nhưng không sửa', async () => {
    const { ctrl } = setup(doc({ sessionId: 's1' }));
    expect(await ctrl.get(student, 'g1')).toMatchObject({ canEdit: false });
    await expect(ctrl.get(outsider, 'g1')).rejects.toThrow('Không tìm thấy');
  });

  it('danh sách không trả nội dung bài; có S3 thì kèm link ảnh thu nhỏ', async () => {
    const { ctrl, prisma } = setup(doc(), true);
    prisma.ggbDocument.findMany.mockResolvedValue([{ id: 'g1', title: 'A', thumbnailKey: 'ggb/g1.png' }]);
    const rows = await ctrl.list(teacher);
    expect(prisma.ggbDocument.findMany.mock.calls[0][0].select.base64).toBeUndefined();
    expect(rows).toEqual([{ id: 'g1', title: 'A', thumbnailUrl: 'https://s3/x.png' }]);
  });
});

describe('Ảnh thu nhỏ', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';

  it('không cấu hình S3 thì bỏ qua, không lỗi', async () => {
    const { ctrl, storage } = setup();
    await ctrl.thumbnail(teacher, 'g1', { png });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('có S3: lưu PNG và ghi khoá vào bài', async () => {
    const { ctrl, storage, prisma } = setup(doc(), true);
    await ctrl.thumbnail(teacher, 'g1', { png });
    expect(storage.put).toHaveBeenCalledWith('ggb/g1.png', expect.any(Buffer), 'image/png');
    expect(prisma.ggbDocument.update).toHaveBeenCalledWith({ where: { id: 'g1' }, data: { thumbnailKey: 'ggb/g1.png' } });
  });

  it('chỉ nhận PNG dạng data URL', async () => {
    expect(await dtoErrors('thumbnail', { png: 'data:image/svg+xml;base64,PHN2Zz4=' })).not.toHaveLength(0);
    expect(await dtoErrors('thumbnail', { png })).toHaveLength(0);
  });
});
