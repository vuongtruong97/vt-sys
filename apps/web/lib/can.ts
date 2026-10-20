import type { Me } from './api';

/**
 * Mã quyền, khớp danh mục ở apps/api/src/auth/permissions.ts. Giao diện chỉ dùng để ẩn/hiện;
 * API luôn kiểm tra lại.
 */
export type Permission =
  | 'course.create'
  | 'meeting.create'
  | 'ggb.create'
  | 'session.record'
  | 'course.view_all'
  | 'course.manage_all'
  | 'stats.view'
  | 'user.manage'
  | 'role.manage'
  | 'site.manage';

/** Người dùng có ít nhất một trong các quyền. */
export function can(me: Me | null | undefined, ...perms: Permission[]) {
  return !!me && perms.some((p) => me.permissions.includes(p));
}

/** Thấy trang Quản lý lớp: dạy khoá của mình, hoặc xem/quản lý mọi khoá. */
export const canTeachArea = (me: Me | null | undefined) => can(me, 'course.create', 'course.view_all', 'course.manage_all');

/** Thấy trang Quản trị: có ít nhất một quyền quản trị. */
export const canAdminArea = (me: Me | null | undefined) => can(me, 'stats.view', 'user.manage', 'role.manage', 'course.manage_all', 'site.manage');
