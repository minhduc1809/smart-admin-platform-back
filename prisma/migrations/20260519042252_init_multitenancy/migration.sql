/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,key]` on the table `settings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,email]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,keycloak_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
*/

-- CreateTable (must come first so FK references work)
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- Seed a default tenant for existing rows
INSERT INTO "tenants" ("id", "name", "domain", "is_active", "updated_at")
VALUES ('default', 'Default Tenant', NULL, true, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_model" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" JSONB,
    "expires_at" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "settings_key_key";

-- DropIndex
DROP INDEX "users_email_key";

-- DropIndex
DROP INDEX "users_keycloak_id_key";

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable: add tenant_id with default for existing rows, then drop default
ALTER TABLE "file_records" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "file_records" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "forms" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "forms" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "job_records" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "job_records" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "notifications" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "refresh_tokens" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "refresh_tokens" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "settings" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "settings" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "submissions" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "submissions" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "workflow_definitions" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "workflow_definitions" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "workflow_histories" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "workflow_histories" ALTER COLUMN "tenant_id" DROP DEFAULT;

ALTER TABLE "workflow_instances" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "workflow_instances" ALTER COLUMN "tenant_id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_model_target_id_idx" ON "audit_logs"("target_model", "target_id");

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

-- CreateIndex
CREATE INDEX "file_records_tenant_id_idx" ON "file_records"("tenant_id");

-- CreateIndex
CREATE INDEX "forms_tenant_id_idx" ON "forms"("tenant_id");

-- CreateIndex
CREATE INDEX "job_records_tenant_id_idx" ON "job_records"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenant_id_idx" ON "refresh_tokens"("tenant_id");

-- CreateIndex
CREATE INDEX "settings_tenant_id_idx" ON "settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_tenant_id_key_key" ON "settings"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "submissions_tenant_id_idx" ON "submissions"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_username_key" ON "users"("tenant_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_keycloak_id_key" ON "users"("tenant_id", "keycloak_id");

-- CreateIndex
CREATE INDEX "workflow_definitions_tenant_id_idx" ON "workflow_definitions"("tenant_id");

-- CreateIndex
CREATE INDEX "workflow_histories_tenant_id_idx" ON "workflow_histories"("tenant_id");

-- CreateIndex
CREATE INDEX "workflow_instances_tenant_id_idx" ON "workflow_instances"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_histories" ADD CONSTRAINT "workflow_histories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_records" ADD CONSTRAINT "file_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_records" ADD CONSTRAINT "job_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
