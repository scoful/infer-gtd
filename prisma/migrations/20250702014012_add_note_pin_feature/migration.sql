-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Note_isPinned_idx" ON "Note"("isPinned");

-- CreateIndex
CREATE INDEX "Note_isPinned_updatedAt_idx" ON "Note"("isPinned", "updatedAt");
