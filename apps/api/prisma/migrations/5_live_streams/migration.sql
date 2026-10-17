-- CreateTable
CREATE TABLE "live_streams" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "egressId" TEXT NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'STARTING',
    "public" BOOLEAN NOT NULL DEFAULT false,
    "prefix" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "live_streams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_sessionId_key" ON "live_streams"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "live_streams_egressId_key" ON "live_streams"("egressId");

-- AddForeignKey
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

