import { GUARDS_METADATA } from '@nestjs/common/constants';
import { effectivePermissions } from '../src/auth/permissions';
import { DEFAULT_CONTENT, safeHref, sanitize } from '../src/site/site-content';
import { imageInfo, SiteAdminController, SiteController, SiteService } from '../src/site/site.module';
import { admin, mockPrisma, roles } from './helpers';

const ids = new Set(['img1', 'img2']);

// ----- ảnh mẫu tối thiểu (chỉ header) -----
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
function jpeg(w: number, h: number) {
  // SOI, APP0 (độ dài 16), SOF0 (độ dài 17): height, width
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.alloc(14)]);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(10)]);
}
function webpX(w: number, h: number) {
  const b = Buffer.alloc(34);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(26, 4);
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return b;
}

describe('Làm sạch nội dung trang', () => {
  it('rỗng hoặc rác: trả về nội dung mặc định', () => {
    expect(sanitize(undefined, ids)).toEqual(DEFAULT_CONTENT);
    expect(sanitize('abc', ids)).toEqual(DEFAULT_CONTENT);
  });

  it('bỏ trường lạ, cắt chuỗi dài, giới hạn số slide', () => {
    const c = sanitize(
      {
        hacker: true,
        brand: { name: 'x'.repeat(500), short: 'ABCDEFG', extra: 1 },
        home: { hero: { mode: 'slider', slides: Array.from({ length: 20 }, () => ({ title: 'A', imageAssetId: 'img1' })) } },
      },
      ids,
    );
    expect((c as any).hacker).toBeUndefined();
    expect((c.brand as any).extra).toBeUndefined();
    expect(c.brand.name).toHaveLength(60);
    expect(c.brand.short).toBe('ABCD');
    expect(c.home.hero.mode).toBe('slider');
    expect(c.home.hero.slides).toHaveLength(8);
    expect(c.home.hero.slides[0]).toMatchObject({ title: 'A', imageAssetId: 'img1', text: '' });
  });

  it('link nguy hiểm thành rỗng; link trong trang, https, mailto giữ nguyên', () => {
    expect(safeHref('javascript:alert(1)')).toBe('');
    expect(safeHref('data:text/html,<b>')).toBe('');
    expect(safeHref('//evil.com')).toBe('');
    expect(safeHref('http://khong-ma-hoa.vn')).toBe('');
    expect(safeHref('/register')).toBe('/register');
    expect(safeHref('https://zalo.me/123')).toBe('https://zalo.me/123');
    expect(safeHref('mailto:gv@truong.vn')).toBe('mailto:gv@truong.vn');
    const c = sanitize({ footer: { links: [{ label: 'X', href: 'javascript:alert(1)' }, { label: 'Zalo', href: 'https://zalo.me/1' }] } }, ids);
    // Link không an toàn bị bỏ khỏi chân trang.
    expect(c.footer.links).toEqual([{ label: 'Zalo', href: 'https://zalo.me/1' }]);
  });

  it('màu phải #rrggbb; ảnh phải có trong kho', () => {
    expect(sanitize({ brand: { primaryColor: '#1A73E8' } }, ids).brand.primaryColor).toBe('#1a73e8');
    expect(sanitize({ brand: { primaryColor: 'red;}body{display:none' } }, ids).brand.primaryColor).toBeNull();
    expect(sanitize({ brand: { logoAssetId: 'img2' } }, ids).brand.logoAssetId).toBe('img2');
    expect(sanitize({ brand: { logoAssetId: 'khong-co' } }, ids).brand.logoAssetId).toBeNull();
  });

  it('icon tính năng ngoài danh sách thì về icon mặc định; thời gian tự chuyển trong 0–30 giây', () => {
    const c = sanitize({ home: { features: { items: [{ icon: '<script>', title: 'A' }] }, hero: { autoplaySec: 999 } } }, ids);
    expect(c.home.features.items[0].icon).toBe('video');
    expect(c.home.hero.autoplaySec).toBe(30);
  });
});

describe('Nhận dạng ảnh tải lên', () => {
  it('đọc đúng loại và kích thước JPEG, PNG, WebP', () => {
    expect(imageInfo(png(640, 480))).toEqual({ type: 'image/png', width: 640, height: 480 });
    expect(imageInfo(jpeg(1920, 1080))).toEqual({ type: 'image/jpeg', width: 1920, height: 1080 });
    expect(imageInfo(webpX(800, 600))).toEqual({ type: 'image/webp', width: 800, height: 600 });
  });

  it('từ chối SVG và tệp đổi đuôi', () => {
    expect(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(imageInfo(Buffer.from('MZ\x90\x00 day la file exe'))).toBeNull();
    expect(imageInfo(Buffer.alloc(0))).toBeNull();
  });
});

describe('Bản nháp và xuất bản', () => {
  function setup() {
    const prisma = mockPrisma();
    const store = new Map<string, { data: unknown; updatedAt: Date }>();
    prisma.siteAsset.findMany.mockResolvedValue([{ id: 'img1' }]);
    prisma.siteContent.findUnique.mockImplementation(({ where }: any) => Promise.resolve(store.has(where.key) ? { key: where.key, ...store.get(where.key) } : null));
    prisma.siteContent.upsert.mockImplementation(({ where, create }: any) => {
      const v = { data: create.data, updatedAt: new Date() };
      store.set(where.key, v);
      return Promise.resolve({ key: where.key, ...v });
    });
    const svc = new SiteService(prisma as any);
    return { prisma, store, admin: new SiteAdminController(svc, prisma as any), pub: new SiteController(svc, prisma as any) };
  }

  it('chưa có gì: trang công khai dùng nội dung mặc định', async () => {
    const { pub } = setup();
    expect(await pub.get()).toEqual(DEFAULT_CONTENT);
  });

  it('lưu nháp không đổi trang công khai; xuất bản thì đổi', async () => {
    const { admin: ctl, pub } = setup();
    await ctl.saveDraft(admin, { content: { brand: { name: 'Trung tâm Toán Hay' } } });
    expect((await pub.get()).brand.name).toBe('Bảng Đen');
    expect((await ctl.get()).draft.brand.name).toBe('Trung tâm Toán Hay');
    await ctl.publish(admin);
    expect((await pub.get()).brand.name).toBe('Trung tâm Toán Hay');
  });

  it('bỏ nháp: nháp quay về bản đang xuất bản', async () => {
    const { admin: ctl } = setup();
    await ctl.saveDraft(admin, { content: { brand: { name: 'A' } } });
    await ctl.publish(admin);
    await ctl.saveDraft(admin, { content: { brand: { name: 'B' } } });
    const r = await ctl.discard(admin);
    expect(r.content.brand.name).toBe('A');
    expect((await ctl.get()).draft.brand.name).toBe('A');
  });

  it('dọn ảnh: chỉ xoá ảnh không bản nào dùng và đã cũ', async () => {
    const { admin: ctl, prisma } = setup();
    prisma.siteAsset.findMany.mockResolvedValue([{ id: 'img1' }, { id: 'img2' }]);
    await ctl.saveDraft(admin, { content: { brand: { logoAssetId: 'img1' } } });
    prisma.siteAsset.deleteMany.mockResolvedValue({ count: 1 });
    await ctl.cleanup();
    const where = prisma.siteAsset.deleteMany.mock.calls[0][0].where;
    expect(where.id.notIn).toEqual(['img1']);
    expect(where.createdAt.lt.getTime()).toBeLessThan(Date.now() - 23 * 3600_000);
  });
});

describe('Quyền', () => {
  it('trang quản trị nội dung cần quyền site.manage; quản trị viên có sẵn, giáo viên không', () => {
    expect(Reflect.getMetadata('need-permissions', SiteAdminController)).toEqual(['site.manage']);
    expect(effectivePermissions(roles.admin)).toContain('site.manage');
    expect(effectivePermissions(roles.teacher)).not.toContain('site.manage');
  });

  it('nội dung và ảnh công khai không cần đăng nhập', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SiteController)).toBeUndefined();
  });
});
