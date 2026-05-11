-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "SubmissionStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "parent_submission_id" TEXT,
ADD COLUMN     "revision_number" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "submissions_parent_submission_id_idx" ON "submissions"("parent_submission_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_parent_submission_id_fkey" FOREIGN KEY ("parent_submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
