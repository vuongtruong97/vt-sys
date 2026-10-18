-- Thu hồi phiên đăng nhập: JWT mang tokenVersion, tăng giá trị này thì mọi cookie cũ hết hiệu lực.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
