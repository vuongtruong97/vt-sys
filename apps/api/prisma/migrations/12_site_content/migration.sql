-- Nội dung trang công khai (bản nháp, bản đã xuất bản) và ảnh của trang, lưu trong Postgres.
-- CreateTable
CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "site_assets" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "site_assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_assets" ADD CONSTRAINT "site_assets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

