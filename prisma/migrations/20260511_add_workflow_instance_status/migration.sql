-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "workflow_instances" ADD COLUMN "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'ACTIVE';
