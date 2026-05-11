import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkflowEngine {

  async initiate(
    tx: Prisma.TransactionClient,
    submissionId: string,
    workflowConfig: any,
  ) {
    console.log(`[WorkflowEngine Stub] Initiating workflow for submission ${submissionId}`);
    return true;
  }
}
