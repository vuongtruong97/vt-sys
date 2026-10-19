-- Meeting độc lập: buổi không thuộc khoá học, chủ phòng lưu ở hostId.
ALTER TABLE "sessions" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "sessions" ADD COLUMN "hostId" TEXT;
CREATE INDEX "sessions_hostId_startsAt_idx" ON "sessions"("hostId", "startsAt");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
