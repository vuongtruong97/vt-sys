-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "breakoutActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakoutEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "breakout_groups" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "members" TEXT[],

    CONSTRAINT "breakout_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "breakout_groups_sessionId_index_key" ON "breakout_groups"("sessionId", "index");

-- AddForeignKey
ALTER TABLE "breakout_groups" ADD CONSTRAINT "breakout_groups_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

