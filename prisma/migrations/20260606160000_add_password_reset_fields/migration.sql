-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_change_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_reset_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_hash_key" ON "users"("password_reset_hash");
