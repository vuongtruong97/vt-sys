-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('STARTING', 'RECORDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "egressId" TEXT NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'STARTING',
    "key" TEXT NOT NULL,
    "durationSec" INTEGER,
    "sizeBytes" BIGINT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recordings_egressId_key" ON "recordings"("egressId");

-- CreateIndex
CREATE INDEX "recordings_sessionId_idx" ON "recordings"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "materials_key_key" ON "materials"("key");

-- CreateIndex
CREATE INDEX "materials_courseId_idx" ON "materials"("courseId");

-- CreateIndex
CREATE INDEX "materials_sessionId_idx" ON "materials"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_sessionId_userId_kind_startsAt_key" ON "reminders"("sessionId", "userId", "kind", "startsAt");

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

