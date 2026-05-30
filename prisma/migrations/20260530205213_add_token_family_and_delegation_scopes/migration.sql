/*
  Warnings:

  - The required column `token_family` was added to the `refresh_tokens` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "delegations" ADD COLUMN     "form_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workflow_definition_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "is_revoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "token_family" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "refresh_tokens_token_family_idx" ON "refresh_tokens"("token_family");
