-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correct" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "quizzes_sessionId_createdAt_idx" ON "quizzes"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answers_quizId_userId_key" ON "quiz_answers"("quizId", "userId");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

