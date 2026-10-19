/**
 * Danh mục quyền. Vai trò (bảng roles) là một tập các mã dưới đây; quản trị viên tick chọn ở /admin.
 * Thêm quyền mới: thêm vào PERMISSIONS, kiểm tra bằng @Need(...) hoặc can(...). Vai trò key "admin"
 * tự có mọi quyền, kể cả quyền thêm sau này.
 */
export const PERMISSIONS = [
  { code: 'course.create', group: 'Dạy học', label: 'Tạo và dạy khoá học của mình', hint: 'Khoá học, buổi học, học viên, tài liệu, mở lớp' },
  { code: 'meeting.create', group: 'Dạy học', label: 'Tạo phòng họp nhanh', hint: 'Phòng họp không gắn với khoá học' },
  { code: 'ggb.create', group: 'Dạy học', label: 'Tạo bài GeoGebra', hint: 'Bài vẽ GeoGebra, dùng trong phòng học' },
  { code: 'session.record', group: 'Dạy học', label: 'Ghi hình, phát trực tiếp', hint: 'Trong buổi học mình dạy' },
  { code: 'course.view_all', group: 'Khoá học toàn hệ thống', label: 'Xem mọi khoá học', hint: 'Buổi học, học viên, điểm danh, bản ghi của mọi giáo viên' },
  { code: 'course.manage_all', group: 'Khoá học toàn hệ thống', label: 'Quản lý mọi khoá học', hint: 'Sửa khoá, mở lớp thay, điều khiển phòng học, chuyển khoá cho giáo viên khác' },
  { code: 'stats.view', group: 'Quản trị', label: 'Xem thống kê hệ thống', hint: 'Số người dùng, khoá học, buổi học' },
  { code: 'user.manage', group: 'Quản trị', label: 'Quản lý tài khoản', hint: 'Xem danh sách tài khoản, đổi vai trò người dùng' },
  { code: 'role.manage', group: 'Quản trị', label: 'Quản lý vai trò', hint: 'Tạo, sửa, xoá vai trò và quyền của vai trò' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['code'];
export const PERMISSION_CODES: readonly string[] = PERMISSIONS.map((p) => p.code);
export const ALL_PERMISSIONS = PERMISSION_CODES as Permission[];

/** Id và key của ba vai trò hệ thống (tạo trong migration 11_roles). */
export const SYSTEM_ROLES = {
  admin: { id: 'role_admin', key: 'admin' },
  teacher: { id: 'role_teacher', key: 'teacher' },
  student: { id: 'role_student', key: 'student' },
} as const;

export const permissionLabel = (code: string) => PERMISSIONS.find((p) => p.code === code)?.label ?? code;

/** Quyền thực tế của một vai trò: admin có tất cả, vai trò khác chỉ giữ các mã còn trong danh mục. */
export function effectivePermissions(role: { key: string; permissions: string[] }): Permission[] {
  if (role.key === SYSTEM_ROLES.admin.key) return [...ALL_PERMISSIONS];
  return role.permissions.filter((p): p is Permission => PERMISSION_CODES.includes(p));
}

export function can(user: { permissions: readonly string[] } | null | undefined, p: Permission) {
  return !!user && user.permissions.includes(p);
}
