import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { avatarUrl } from '../src/common/avatar';
import { AvatarController, ProfileDto, ProfileService } from '../src/profile/profile.module';
import { mockPrisma } from './helpers';

/** PNG tối thiểu có header IHDR với kích thước cho trước (đủ để imageInfo nhận dạng). */
function png(w: number, h: number) {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'hv1',
  name: 'Lan',
  email: 'hv1@test',
  phone: null,
  bio: '',
  birthday: null,
  avatarVersion: 0,
  ...over,
});

/** Chạy DTO qua ValidationPipe như ở main.ts. */
const validate = (body: unknown) =>
  new ValidationPipe({ whitelist: true, transform: true }).transform(body, { type: 'body', metatype: ProfileDto }) as Promise<ProfileDto>;

describe('Hồ sơ: kiểm tra dữ liệu', () => {
  it('chấp nhận dữ liệu hợp lệ, bỏ khoảng trắng, chuỗi rỗng thành xoá giá trị', async () => {
    await expect(validate({ name: '  Lan Anh  ', phone: '0912 345 678', bio: 'Thích Python', birthday: '2005-04-30' })).resolves.toMatchObject({
      name: 'Lan Anh',
      phone: '0912 345 678',
      birthday: '2005-04-30',
    });
    await expect(validate({ phone: '   ', birthday: '' })).resolves.toMatchObject({ phone: null, birthday: null });
  });

  it.each([
    ['tên quá ngắn', { name: 'A' }, 'Họ tên cần ít nhất 2 ký tự'],
    ['số điện thoại có chữ', { phone: '09abc12345' }, 'Số điện thoại không hợp lệ'],
    ['số điện thoại quá ngắn', { phone: '0912' }, 'Số điện thoại không hợp lệ'],
    ['giới thiệu quá dài', { bio: 'x'.repeat(501) }, 'Giới thiệu tối đa 500 ký tự'],
    ['ngày sinh sai định dạng', { birthday: '30/04/2005' }, 'Ngày sinh không hợp lệ'],
  ])('từ chối %s', async (_label, body, message) => {
    const err = await validate(body).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify(err.getResponse())).toContain(message);
  });

  it('không cho ngày sinh ở tương lai, trước 1900 hoặc ngày không tồn tại', async () => {
    const svc = new ProfileService(mockPrisma() as any);
    const now = new Date('2026-10-20T00:00:00Z');
    await expect(svc.update('hv1', { birthday: '2027-01-01' }, now)).rejects.toThrow('tương lai');
    await expect(svc.update('hv1', { birthday: '1899-12-31' }, now)).rejects.toThrow('trước năm 1900');
    await expect(svc.update('hv1', { birthday: '2005-02-30' }, now)).rejects.toThrow('Ngày sinh không hợp lệ');
  });

  it('lưu hồ sơ và trả ngày sinh dạng YYYY-MM-DD', async () => {
    const prisma = mockPrisma();
    prisma.user.update.mockImplementation(({ data }: any) => Promise.resolve(row({ ...data, birthday: data.birthday })));
    const p = await new ProfileService(prisma as any).update('hv1', { name: 'Lan Anh', phone: '0912345678', birthday: '2005-04-30' });
    expect(prisma.user.update.mock.calls[0][0].data.birthday).toEqual(new Date('2005-04-30T00:00:00Z'));
    expect(p).toMatchObject({ name: 'Lan Anh', phone: '0912345678', birthday: '2005-04-30', avatarUrl: null });
  });
});

describe('Ảnh đại diện', () => {
  it('nhận ảnh PNG, lưu và tăng phiên bản ảnh', async () => {
    const prisma = mockPrisma();
    prisma.user.update.mockResolvedValue({ id: 'hv1', avatarVersion: 2 });
    const r = await new ProfileService(prisma as any).setAvatar('hv1', png(512, 512));
    expect(prisma.userAvatar.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'hv1' }, create: expect.objectContaining({ contentType: 'image/png' }) }));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { avatarVersion: { increment: 1 } } }));
    expect(r).toEqual({ avatarUrl: '/api/users/hv1/avatar?v=2' });
  });

  it('từ chối file không phải ảnh và ảnh quá lớn', async () => {
    const svc = new ProfileService(mockPrisma() as any);
    await expect(svc.setAvatar('hv1', Buffer.from('<svg><script>alert(1)</script></svg>'))).rejects.toThrow('JPEG, PNG hoặc WebP');
    await expect(svc.setAvatar('hv1', png(4000, 3000))).rejects.toThrow('Ảnh quá lớn');
  });

  it('xoá ảnh đưa phiên bản về 0', async () => {
    const prisma = mockPrisma();
    await new ProfileService(prisma as any).removeAvatar('hv1');
    expect(prisma.userAvatar.deleteMany).toHaveBeenCalledWith({ where: { userId: 'hv1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'hv1' }, data: { avatarVersion: 0 } });
  });

  it('URL ảnh: chưa có ảnh thì null, có thì kèm phiên bản', () => {
    expect(avatarUrl({ id: 'u1', avatarVersion: 0 })).toBeNull();
    expect(avatarUrl({ id: 'u1', avatarVersion: 5 })).toBe('/api/users/u1/avatar?v=5');
  });

  it('trả ảnh với cache lâu khi có ?v=, cache ngắn khi không; chưa có ảnh thì 404', async () => {
    const prisma = mockPrisma();
    const ctl = new AvatarController(new ProfileService(prisma as any));
    const res = { set: jest.fn(), send: jest.fn() };
    prisma.userAvatar.findUnique.mockResolvedValue({ data: png(512, 512), contentType: 'image/png' });
    await ctl.avatar('hv1', '3', res as any);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=31536000, immutable' }));
    await ctl.avatar('hv1', undefined, res as any);
    expect(res.set).toHaveBeenLastCalledWith(expect.objectContaining({ 'Cache-Control': 'private, max-age=300' }));
    prisma.userAvatar.findUnique.mockResolvedValue(null);
    await expect(ctl.avatar('hv2', undefined, res as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
