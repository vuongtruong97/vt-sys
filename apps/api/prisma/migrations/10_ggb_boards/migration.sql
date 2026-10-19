-- Bảng GeoGebra của buổi học (Hocuspocus document ggb:<session_id>), tách khỏi whiteboards.
-- CreateTable
CREATE TABLE "ggb_boards" (
    "session_id" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ggb_boards_pkey" PRIMARY KEY ("session_id")
);

-- AddForeignKey
ALTER TABLE "ggb_boards" ADD CONSTRAINT "ggb_boards_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

