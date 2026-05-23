// src/common/events/realtime.events.ts

export interface NotificationCreatedPayload {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  read: boolean;
  metadata?: any;
  createdAt: Date;
}

export interface JobProgressPayload {
  jobId: string;
  progress: number;
  userId: string;
}

export interface JobCompletedPayload {
  jobId: string;
  status: string;
  userId: string;
  filepath?: string;
  error?: string;
}
