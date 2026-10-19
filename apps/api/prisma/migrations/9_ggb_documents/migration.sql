-- Bài GeoGebra: chuỗi getBase64() của applet, ảnh thu nhỏ trên S3 (tuỳ chọn).
-- CreateTable
CREATE TABLE "ggb_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "appName" TEXT NOT NULL DEFAULT 'classic',
    "base64" TEXT NOT NULL DEFAULT '',
    "thumbnailKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ggb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ggb_documents_ownerId_updatedAt_idx" ON "ggb_documents"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ggb_documents" ADD CONSTRAINT "ggb_documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ggb_documents" ADD CONSTRAINT "ggb_documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

