-- Link mời trực tiếp của meeting: người có khoá vào luôn, không qua phòng chờ.
ALTER TABLE "sessions" ADD COLUMN "inviteKey" TEXT;
CREATE UNIQUE INDEX "sessions_inviteKey_key" ON "sessions"("inviteKey");
