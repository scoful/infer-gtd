-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "feedbackAt" TIMESTAMP(3),
ADD COLUMN     "lessons" TEXT,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "reflection" TEXT;
