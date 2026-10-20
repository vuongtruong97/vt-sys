-- Hồ sơ người dùng: số điện thoại, giới thiệu, ngày sinh, ảnh đại diện (lưu trong Postgres).
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "bio" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "birthday" DATE;
ALTER TABLE "users" ADD COLUMN "avatarVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "user_avatars" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
