-- Phân quyền: vai trò lưu trong bảng roles, mỗi vai trò là một tập quyền.
-- Chuyển cột users.role (enum ADMIN/TEACHER/STUDENT) sang users.roleId trỏ tới ba vai trò hệ thống.

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[],
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- Quản trị viên luôn có mọi quyền (kiểm tra trong code theo key), nên danh sách để trống.
INSERT INTO "roles" ("id", "key", "name", "description", "permissions", "system") VALUES
  ('role_admin', 'admin', 'Quản trị viên', 'Chủ trang: mọi quyền, kể cả quyền thêm sau này.', ARRAY[]::TEXT[], true),
  ('role_teacher', 'teacher', 'Giáo viên', 'Tạo và dạy khoá học của mình, phòng họp, bài GeoGebra, ghi hình.',
    ARRAY['course.create', 'meeting.create', 'ggb.create', 'session.record'], true),
  ('role_student', 'student', 'Học viên', 'Vào các lớp được thêm vào, xem lại bản ghi và tài liệu.', ARRAY[]::TEXT[], true);

ALTER TABLE "users" ADD COLUMN "roleId" TEXT NOT NULL DEFAULT 'role_student';
UPDATE "users" SET "roleId" = CASE "role"
  WHEN 'ADMIN' THEN 'role_admin'
  WHEN 'TEACHER' THEN 'role_teacher'
  ELSE 'role_student'
END;
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";
