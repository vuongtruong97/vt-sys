'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from '@/components/Nav';
import { hrefError, ImageField, ListEditor, TextList } from '@/components/siteAdmin/fields';
import { Alert, Button, Input, Muted, Page, PageHeader, Select, Switch, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { can } from '@/lib/can';
import { fmtDay, fmtTime } from '@/lib/format';
import { FEATURE_ICONS, SiteContent } from '@/lib/siteTypes';
import { useMe } from '@/lib/useMe';

type AdminSite = { draft: SiteContent; published: SiteContent; draftUpdatedAt: string | null; publishedAt: string | null };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SECTIONS = [
  { id: 'brand', label: 'Thương hiệu' },
  { id: 'hero', label: 'Slider đầu trang' },
  { id: 'blocks', label: 'Các khối trang chủ' },
  { id: 'teacher', label: 'Giáo viên' },
  { id: 'faq', label: 'Câu hỏi thường gặp' },
  { id: 'footer', label: 'Chân trang & SEO' },
  { id: 'auth', label: 'Đăng nhập, đăng ký' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const ICON_LABELS: Record<(typeof FEATURE_ICONS)[number], string> = {
  video: 'Video',
  screen: 'Chia sẻ màn hình',
  board: 'Bảng trắng',
  quiz: 'Câu hỏi',
  groups: 'Nhóm',
  record: 'Ghi hình',
};

const BLOCKS: { key: keyof SiteContent['home']['show']; label: string }[] = [
  { key: 'stats', label: 'Số liệu (khoá học, buổi học, học viên)' },
  { key: 'features', label: 'Tính năng' },
  { key: 'courses', label: 'Khoá học đang mở' },
  { key: 'steps', label: 'Các bước tham gia' },
  { key: 'teacher', label: 'Giới thiệu giáo viên' },
  { key: 'faq', label: 'Câu hỏi thường gặp' },
  { key: 'cta', label: 'Banner cuối trang' },
];

/** Sửa nội dung trang công khai: tự lưu bản nháp, xem trước, xuất bản. */
export default function SiteAdminPage() {
  const me = useMe({ redirect: true });
  const [data, setData] = useState<AdminSite | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [section, setSection] = useState<SectionId>('brand');
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef<SiteContent | null>(null);
  const allowed = can(me, 'site.manage');

  const load = useCallback(
    () =>
      api<AdminSite>('/admin/site')
        .then((r) => {
          setData(r);
          setDraft(r.draft);
        })
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    if (me && allowed) load();
  }, [me, allowed, load]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const content = latest.current;
    if (!content) return;
    latest.current = null;
    setSave('saving');
    try {
      const r = await api<{ draftUpdatedAt: string }>('/admin/site/draft', { method: 'PUT', json: { content } });
      setData((d) => (d ? { ...d, draftUpdatedAt: r.draftUpdatedAt } : d));
      setSave(latest.current ? 'saving' : 'saved');
    } catch (e) {
      setSave('error');
      setError((e as Error).message);
    }
  }, []);

  /** Sửa nháp tại chỗ rồi tự lưu sau 1 giây không gõ. */
  const edit = (fn: (d: SiteContent) => void) => {
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      latest.current = next;
      return next;
    });
    setSave('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1000);
  };

  // Rời trang khi còn thay đổi chưa lưu thì trình duyệt hỏi lại.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (latest.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setError('');
    setMsg('');
    setBusy(true);
    try {
      await flush();
      await fn();
      await load();
      setMsg(ok);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (me && !allowed) {
    return (
      <>
        <Nav me={me} />
        <Page narrow>
          <Alert tone="error">Bạn chưa có quyền Quản lý nội dung trang web. Liên hệ quản trị viên để được cấp quyền.</Alert>
        </Page>
      </>
    );
  }

  const d = draft;
  const changed = !!data && !!d && JSON.stringify(d) !== JSON.stringify(data.published);
  const saveLabel = save === 'saving' ? 'Đang lưu nháp…' : save === 'saved' ? 'Đã lưu nháp' : save === 'error' ? 'Chưa lưu được' : '';

  return (
    <>
      <Nav me={me} />
      <Page>
        <PageHeader
          back={{ href: '/admin', label: 'Quản trị' }}
          title="Nội dung trang web"
          description={
            data?.publishedAt
              ? `Xuất bản lần cuối ${fmtTime(data.publishedAt)} ${fmtDay(data.publishedAt)}. Sửa ở đây là sửa bản nháp; người xem chỉ thấy thay đổi sau khi Xuất bản.`
              : 'Chưa xuất bản lần nào: trang đang dùng nội dung mặc định. Sửa ở đây là sửa bản nháp.'
          }
          actions={
            <>
              <span className="sa-save" role="status">{saveLabel}</span>
              <a className="ui-btn ui-btn--outline ui-btn--md" href="/?preview=1" target="_blank" rel="noopener">Xem trước</a>
              <Button
                variant="ghost"
                disabled={busy || !changed}
                onClick={() => window.confirm('Bỏ mọi thay đổi trong bản nháp, quay về bản đang xuất bản?') && act(() => api('/admin/site/discard', { method: 'POST' }), 'Đã bỏ nháp')}
              >
                Bỏ nháp
              </Button>
              <Button disabled={busy || !changed} loading={busy} onClick={() => act(() => api('/admin/site/publish', { method: 'POST' }), 'Đã xuất bản. Trang chủ cập nhật trong khoảng 30 giây.')}>
                Xuất bản
              </Button>
            </>
          }
        />
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        {!d && !error && <Muted>Đang tải…</Muted>}

        {d && (
          <div className="sa-layout">
            <nav className="sa-nav" aria-label="Mục nội dung">
              {SECTIONS.map((s) => (
                <button key={s.id} type="button" className="sa-nav__item" aria-current={section === s.id || undefined} onClick={() => setSection(s.id)}>
                  {s.label}
                </button>
              ))}
            </nav>

            <div className="sa-panel ui-card ui-card--pad">
              {section === 'brand' && (
                <div className="ui-form">
                  <div className="ui-form-row">
                    <Input label="Tên trang" value={d.brand.name} maxLength={60} onChange={(e) => edit((x) => (x.brand.name = e.target.value))} />
                    <Input label="Chữ viết tắt (trong logo)" value={d.brand.short} maxLength={4} hint="2–4 ký tự, hiện khi chưa có ảnh logo" onChange={(e) => edit((x) => (x.brand.short = e.target.value))} />
                  </div>
                  <div className="sa-color">
                    <Switch
                      checked={!!d.brand.primaryColor}
                      label="Dùng màu chủ đạo riêng"
                      onChange={(on) => edit((x) => (x.brand.primaryColor = on ? x.brand.primaryColor ?? '#1a73e8' : null))}
                    />
                    {d.brand.primaryColor && (
                      <label className="sa-color__pick">
                        <input type="color" value={d.brand.primaryColor} onChange={(e) => edit((x) => (x.brand.primaryColor = e.target.value))} />
                        <span>{d.brand.primaryColor} · bảng màu sáng và tối được sinh tự động theo Material 3</span>
                      </label>
                    )}
                  </div>
                  <div className="ui-form-row">
                    <ImageField label="Logo" kind="square" value={d.brand.logoAssetId} onChange={(id) => edit((x) => (x.brand.logoAssetId = id))} />
                    <ImageField label="Favicon" kind="favicon" value={d.brand.faviconAssetId} onChange={(id) => edit((x) => (x.brand.faviconAssetId = id))} />
                  </div>
                  <div className="ui-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        act(async () => {
                          const r = await api<{ deleted: number }>('/admin/site/assets/cleanup', { method: 'POST' });
                          setMsg(`Đã xoá ${r.deleted} ảnh không dùng.`);
                        }, 'Đã dọn ảnh không dùng')
                      }
                    >
                      Dọn ảnh không dùng
                    </Button>
                    <span className="ui-muted ui-muted--sm">Xoá ảnh đã tải lên quá 1 ngày mà bản nháp và bản đã xuất bản đều không dùng.</span>
                  </div>
                </div>
              )}

              {section === 'hero' && (
                <div className="ui-form">
                  <div className="ui-form-row">
                    <Select
                      label="Kiểu đầu trang"
                      value={d.home.hero.mode}
                      options={[
                        { value: 'slider', label: 'Slider ảnh' },
                        { value: 'illustration', label: 'Hình minh hoạ lớp học (dùng chữ của slide 1)' },
                      ]}
                      onChange={(e) => edit((x) => (x.home.hero.mode = e.target.value as 'slider' | 'illustration'))}
                    />
                    <Input
                      label="Tự chuyển slide sau (giây)"
                      type="number"
                      min={0}
                      max={30}
                      hint="0 là không tự chuyển"
                      value={String(d.home.hero.autoplaySec)}
                      onChange={(e) => edit((x) => (x.home.hero.autoplaySec = Math.max(0, Math.min(30, Number(e.target.value) || 0))))}
                    />
                  </div>
                  <ListEditor
                    items={d.home.hero.slides}
                    max={8}
                    addLabel="Thêm slide"
                    itemLabel={(i) => `Slide ${i + 1}`}
                    create={() => ({ imageAssetId: null, accent: '', title: 'Tiêu đề slide', text: '', buttonLabel: '', buttonHref: '' })}
                    onChange={(v) => edit((x) => (x.home.hero.slides = v))}
                    render={(s, set) => (
                      <div className="ui-form">
                        <ImageField label="Ảnh nền" kind="wide" value={s.imageAssetId} onChange={(id) => set({ ...s, imageAssetId: id })} />
                        <div className="ui-form-row">
                          <Input label="Chữ nhấn (gạch chân)" value={s.accent} maxLength={80} onChange={(e) => set({ ...s, accent: e.target.value })} />
                          <Input label="Tiêu đề" value={s.title} maxLength={140} onChange={(e) => set({ ...s, title: e.target.value })} />
                        </div>
                        <Textarea label="Mô tả" value={s.text} maxLength={400} rows={2} onChange={(e) => set({ ...s, text: e.target.value })} />
                        <div className="ui-form-row">
                          <Input label="Nút riêng: chữ" value={s.buttonLabel} maxLength={40} hint="Bỏ trống thì hiện nút Đăng ký/Đăng nhập" onChange={(e) => set({ ...s, buttonLabel: e.target.value })} />
                          <Input label="Nút riêng: link" value={s.buttonHref} placeholder="/register hoặc https://…" error={hrefError(s.buttonHref)} onChange={(e) => set({ ...s, buttonHref: e.target.value })} />
                        </div>
                      </div>
                    )}
                  />
                  <TextList label="Dòng ✓ dưới nút" items={d.home.hero.trust} max={6} onChange={(v) => edit((x) => (x.home.hero.trust = v))} />
                </div>
              )}

              {section === 'blocks' && (
                <div className="ui-form">
                  <fieldset className="sa-group">
                    <legend>Hiện các khối</legend>
                    {BLOCKS.map((b) => (
                      <Switch key={b.key} checked={d.home.show[b.key]} label={b.label} onChange={(v) => edit((x) => (x.home.show[b.key] = v))} />
                    ))}
                  </fieldset>
                  <fieldset className="sa-group">
                    <legend>Tính năng</legend>
                    <Input label="Tiêu đề" value={d.home.features.title} onChange={(e) => edit((x) => (x.home.features.title = e.target.value))} />
                    <Textarea label="Mô tả" rows={2} value={d.home.features.text} onChange={(e) => edit((x) => (x.home.features.text = e.target.value))} />
                    <ListEditor
                      items={d.home.features.items}
                      max={12}
                      addLabel="Thêm tính năng"
                      itemLabel={(i) => `Tính năng ${i + 1}`}
                      create={() => ({ icon: 'video' as const, title: '', text: '' })}
                      onChange={(v) => edit((x) => (x.home.features.items = v))}
                      render={(f, set) => (
                        <div className="ui-form">
                          <div className="ui-form-row">
                            <Select label="Icon" value={f.icon} options={FEATURE_ICONS.map((i) => ({ value: i, label: ICON_LABELS[i] }))} onChange={(e) => set({ ...f, icon: e.target.value as typeof f.icon })} />
                            <Input label="Tên" value={f.title} maxLength={80} onChange={(e) => set({ ...f, title: e.target.value })} />
                          </div>
                          <Textarea label="Mô tả" rows={2} value={f.text} maxLength={300} onChange={(e) => set({ ...f, text: e.target.value })} />
                        </div>
                      )}
                    />
                  </fieldset>
                  <fieldset className="sa-group">
                    <legend>Khoá học đang mở</legend>
                    <Input label="Tiêu đề" value={d.home.courses.title} onChange={(e) => edit((x) => (x.home.courses.title = e.target.value))} />
                    <Textarea label="Mô tả" rows={2} value={d.home.courses.text} onChange={(e) => edit((x) => (x.home.courses.text = e.target.value))} />
                  </fieldset>
                  <fieldset className="sa-group">
                    <legend>Các bước tham gia</legend>
                    <Input label="Tiêu đề" value={d.home.steps.title} onChange={(e) => edit((x) => (x.home.steps.title = e.target.value))} />
                    <ListEditor
                      items={d.home.steps.items}
                      max={6}
                      addLabel="Thêm bước"
                      itemLabel={(i) => `Bước ${i + 1}`}
                      create={() => ({ title: '', text: '' })}
                      onChange={(v) => edit((x) => (x.home.steps.items = v))}
                      render={(s, set) => (
                        <div className="ui-form">
                          <Input label="Tên bước" value={s.title} maxLength={80} onChange={(e) => set({ ...s, title: e.target.value })} />
                          <Textarea label="Mô tả" rows={2} value={s.text} maxLength={300} onChange={(e) => set({ ...s, text: e.target.value })} />
                        </div>
                      )}
                    />
                  </fieldset>
                  <fieldset className="sa-group">
                    <legend>Banner cuối trang</legend>
                    <Input label="Tiêu đề" value={d.home.cta.title} onChange={(e) => edit((x) => (x.home.cta.title = e.target.value))} />
                    <Textarea label="Mô tả" rows={2} value={d.home.cta.text} onChange={(e) => edit((x) => (x.home.cta.text = e.target.value))} />
                    <div className="ui-form-row">
                      <Input label="Nút: chữ" value={d.home.cta.buttonLabel} onChange={(e) => edit((x) => (x.home.cta.buttonLabel = e.target.value))} />
                      <Input label="Nút: link" value={d.home.cta.buttonHref} error={hrefError(d.home.cta.buttonHref)} onChange={(e) => edit((x) => (x.home.cta.buttonHref = e.target.value))} />
                    </div>
                  </fieldset>
                </div>
              )}

              {section === 'teacher' && (
                <div className="ui-form">
                  <div className="ui-form-row">
                    <Input label="Tên giáo viên" value={d.home.teacher.name} hint="Bỏ trống thì lấy tên giáo viên của khoá học công khai đầu tiên" onChange={(e) => edit((x) => (x.home.teacher.name = e.target.value))} />
                    <Input label="Chức danh" value={d.home.teacher.title} onChange={(e) => edit((x) => (x.home.teacher.title = e.target.value))} />
                  </div>
                  <ImageField label="Ảnh giáo viên" kind="square" value={d.home.teacher.photoAssetId} onChange={(id) => edit((x) => (x.home.teacher.photoAssetId = id))} />
                  <Textarea label="Giới thiệu" rows={5} maxLength={1500} value={d.home.teacher.bio} onChange={(e) => edit((x) => (x.home.teacher.bio = e.target.value))} />
                  <TextList label="Điểm nổi bật" items={d.home.teacher.highlights} max={8} onChange={(v) => edit((x) => (x.home.teacher.highlights = v))} />
                </div>
              )}

              {section === 'faq' && (
                <div className="ui-form">
                  <Input label="Tiêu đề" value={d.home.faq.title} onChange={(e) => edit((x) => (x.home.faq.title = e.target.value))} />
                  <Textarea label="Mô tả" rows={2} value={d.home.faq.text} onChange={(e) => edit((x) => (x.home.faq.text = e.target.value))} />
                  <ListEditor
                    items={d.home.faq.items}
                    max={30}
                    addLabel="Thêm câu hỏi"
                    itemLabel={(i) => `Câu hỏi ${i + 1}`}
                    create={() => ({ q: '', a: '' })}
                    onChange={(v) => edit((x) => (x.home.faq.items = v))}
                    render={(f, set) => (
                      <div className="ui-form">
                        <Input label="Câu hỏi" value={f.q} maxLength={200} onChange={(e) => set({ ...f, q: e.target.value })} />
                        <Textarea label="Trả lời" rows={3} value={f.a} maxLength={1500} onChange={(e) => set({ ...f, a: e.target.value })} />
                      </div>
                    )}
                  />
                </div>
              )}

              {section === 'footer' && (
                <div className="ui-form">
                  <fieldset className="sa-group">
                    <legend>Chân trang</legend>
                    <div className="ui-form-row">
                      <Input label="Khẩu hiệu" value={d.footer.tagline} onChange={(e) => edit((x) => (x.footer.tagline = e.target.value))} />
                      <Input label="Dòng bản quyền" value={d.footer.copyright} placeholder={`© ${new Date().getFullYear()} ${d.brand.name}`} hint="Bỏ trống thì tự ghi năm và tên trang" onChange={(e) => edit((x) => (x.footer.copyright = e.target.value))} />
                    </div>
                    <ListEditor
                      items={d.footer.links}
                      max={10}
                      addLabel="Thêm link"
                      itemLabel={(i) => `Link ${i + 1}`}
                      create={() => ({ label: '', href: '' })}
                      onChange={(v) => edit((x) => (x.footer.links = v))}
                      render={(l, set) => (
                        <div className="ui-form-row">
                          <Input label="Chữ" value={l.label} maxLength={40} onChange={(e) => set({ ...l, label: e.target.value })} />
                          <Input label="Link" value={l.href} placeholder="/schedule, https://zalo.me/…" error={hrefError(l.href)} onChange={(e) => set({ ...l, href: e.target.value })} />
                        </div>
                      )}
                    />
                    <Muted small>Link "Đăng nhập" (hoặc "Tài khoản" khi đã đăng nhập) luôn được thêm cuối chân trang.</Muted>
                  </fieldset>
                  <fieldset className="sa-group">
                    <legend>SEO và chia sẻ</legend>
                    <Input label="Tiêu đề trang (thẻ title)" value={d.seo.title} maxLength={120} onChange={(e) => edit((x) => (x.seo.title = e.target.value))} />
                    <Textarea label="Mô tả (hiện trên Google, khi chia sẻ link)" rows={2} maxLength={300} value={d.seo.description} onChange={(e) => edit((x) => (x.seo.description = e.target.value))} />
                    <ImageField label="Ảnh chia sẻ mạng xã hội" kind="og" value={d.seo.ogImageAssetId} onChange={(id) => edit((x) => (x.seo.ogImageAssetId = id))} />
                  </fieldset>
                </div>
              )}

              {section === 'auth' && (
                <div className="ui-form">
                  <ImageField label="Ảnh bên trái trang đăng nhập/đăng ký" kind="wide" value={d.auth.imageAssetId} onChange={(id) => edit((x) => (x.auth.imageAssetId = id))} />
                  <div className="ui-form-row">
                    <Input label="Chú thích trên ảnh" value={d.auth.captionTitle} onChange={(e) => edit((x) => (x.auth.captionTitle = e.target.value))} />
                    <Input label="Dòng phụ trên ảnh" value={d.auth.captionText} onChange={(e) => edit((x) => (x.auth.captionText = e.target.value))} />
                  </div>
                  <div className="ui-form-row">
                    <Input label="Lời chào trang đăng nhập" value={d.auth.loginWelcome} onChange={(e) => edit((x) => (x.auth.loginWelcome = e.target.value))} />
                    <Input label="Lời chào trang đăng ký" value={d.auth.registerWelcome} onChange={(e) => edit((x) => (x.auth.registerWelcome = e.target.value))} />
                  </div>
                  <Textarea label="Giới thiệu trang đăng nhập" rows={2} value={d.auth.loginLead} onChange={(e) => edit((x) => (x.auth.loginLead = e.target.value))} />
                  <Textarea label="Giới thiệu trang đăng ký" rows={2} value={d.auth.registerLead} onChange={(e) => edit((x) => (x.auth.registerLead = e.target.value))} />
                </div>
              )}
            </div>
          </div>
        )}
      </Page>
    </>
  );
}
