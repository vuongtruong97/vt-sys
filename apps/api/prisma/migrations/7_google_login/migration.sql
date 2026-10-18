-- Đăng nhập bằng Google: tài khoản tạo qua Google chưa có mật khẩu.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
