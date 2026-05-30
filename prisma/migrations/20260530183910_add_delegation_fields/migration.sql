-- AlterTable
ALTER TABLE "workflow_histories" ADD COLUMN     "delegated_for_id" TEXT;

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delegations_tenant_id_idx" ON "delegations"("tenant_id");

-- CreateIndex
CREATE INDEX "delegations_from_user_id_idx" ON "delegations"("from_user_id");

-- CreateIndex
CREATE INDEX "delegations_to_user_id_idx" ON "delegations"("to_user_id");

-- CreateIndex
CREATE INDEX "workflow_histories_delegated_for_id_idx" ON "workflow_histories"("delegated_for_id");

-- AddForeignKey
ALTER TABLE "workflow_histories" ADD CONSTRAINT "workflow_histories_delegated_for_id_fkey" FOREIGN KEY ("delegated_for_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
