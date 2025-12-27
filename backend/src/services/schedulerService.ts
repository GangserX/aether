// ===========================================
// AETHER WORKFLOW ENGINE - Scheduler Service
// Cron-based workflow scheduling
// ===========================================

import * as cron from 'node-cron';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { WorkflowDefinition } from '../types/workflow.types';
import { executeWorkflow } from '../engine/executionEngine';

interface ScheduledJob {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  task: ReturnType<typeof cron.schedule>;
}

class SchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();
  private workflowStore: Map<string, WorkflowDefinition> = new Map();

  constructor() {
    logger.info('Scheduler service initialized');
  }

  /**
   * Register a workflow for the scheduler to access
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflowStore.set(workflow.id, workflow);
  }

  /**
   * Schedule a workflow to run on a cron schedule
   */
  schedule(
    workflowId: string,
    cronExpression: string,
    timezone: string = 'UTC'
  ): string {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const jobId = `schedule_${uuid()}`;

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeScheduledWorkflow(jobId);
      },
      {
        timezone,
      }
    );

    const job: ScheduledJob = {
      id: jobId,
      workflowId,
      cronExpression,
      timezone,
      isActive: true,
      task,
    };

    // Calculate next run time
    job.nextRunAt = this.getNextRunTime(cronExpression);

    this.jobs.set(jobId, job);

    logger.info(`Scheduled workflow: ${workflowId}`, {
      jobId,
      cronExpression,
      timezone,
      nextRun: job.nextRunAt,
    });

    return jobId;
  }

  /**
   * Execute a scheduled workflow
   */
  private async executeScheduledWorkflow(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !job.isActive) return;

    const workflow = this.workflowStore.get(job.workflowId);
    if (!workflow) {
      logger.error(`Scheduled workflow not found: ${job.workflowId}`);
      return;
    }

    logger.info(`Executing scheduled workflow: ${job.workflowId}`, { jobId });

    try {
      const result = await executeWorkflow(
        workflow,
        { scheduledTime: new Date().toISOString() },
        undefined,
        'schedule'
      );

      job.lastRunAt = new Date();
      job.nextRunAt = this.getNextRunTime(job.cronExpression);

      logger.info(`Scheduled workflow completed: ${job.workflowId}`, {
        jobId,
        status: result.status,
        executionId: result.executionId,
      });
    } catch (error: any) {
      logger.error(`Scheduled workflow failed: ${job.workflowId}`, {
        jobId,
        error: error.message,
      });
    }
  }

  /**
   * Stop a scheduled job
   */
  stop(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.task.stop();
    job.isActive = false;

    logger.info(`Stopped scheduled job: ${jobId}`);
    return true;
  }

  /**
   * Resume a stopped job
   */
  resume(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.task.start();
    job.isActive = true;
    job.nextRunAt = this.getNextRunTime(job.cronExpression);

    logger.info(`Resumed scheduled job: ${jobId}`);
    return true;
  }

  /**
   * Remove a scheduled job
   */
  remove(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.task.stop();
    this.jobs.delete(jobId);

    logger.info(`Removed scheduled job: ${jobId}`);
    return true;
  }

  /**
   * List all scheduled jobs
   */
  list(): Array<{
    id: string;
    workflowId: string;
    cronExpression: string;
    timezone: string;
    isActive: boolean;
    lastRunAt?: Date;
    nextRunAt?: Date;
  }> {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      workflowId: job.workflowId,
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      isActive: job.isActive,
      lastRunAt: job.lastRunAt,
      nextRunAt: job.nextRunAt,
    }));
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string): Date {
    // Simple implementation - in production use a proper cron parser
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    // For simplicity, return a rough estimate
    // In production, use a library like cron-parser
    const nextRun = new Date(now.getTime() + 60000); // Next minute
    return nextRun;
  }

  /**
   * Validate a cron expression
   */
  validateCron(expression: string): boolean {
    return cron.validate(expression);
  }

  /**
   * Parse cron to human-readable format
   */
  describeCron(expression: string): string {
    const parts = expression.split(' ');
    if (parts.length !== 5) return 'Invalid cron expression';

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Simple descriptions for common patterns
    if (expression === '* * * * *') return 'Every minute';
    if (expression === '0 * * * *') return 'Every hour';
    if (expression === '0 0 * * *') return 'Every day at midnight';
    if (expression === '0 0 * * 0') return 'Every Sunday at midnight';
    if (expression === '0 9 * * 1-5') return 'Every weekday at 9:00 AM';
    
    return `At ${minute} ${hour} on day ${dayOfMonth} of ${month}, weekday ${dayOfWeek}`;
  }
}

export const schedulerService = new SchedulerService();
export default schedulerService;
