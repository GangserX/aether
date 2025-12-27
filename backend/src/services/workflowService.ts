// ===========================================
// AETHER WORKFLOW ENGINE - Workflow Service
// CRUD operations for workflows
// ===========================================

import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '../types/workflow.types';
import { webhookService } from './webhookService';
import { schedulerService } from './schedulerService';

interface StoredWorkflow extends WorkflowDefinition {
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  mode: string;
  startedAt?: Date;
  finishedAt?: Date;
  input?: any;
  output?: any;
  error?: string;
  nodeResults?: any[];
}

class WorkflowService {
  private workflows: Map<string, StoredWorkflow> = new Map();
  private executions: Map<string, ExecutionRecord> = new Map();

  constructor() {
    logger.info('Workflow service initialized');
  }

  /**
   * Create a new workflow
   */
  create(
    userId: string,
    data: {
      id?: string; // Allow passing an ID from frontend
      name: string;
      description?: string;
      nodes?: WorkflowNode[];
      edges?: WorkflowEdge[];
      settings?: WorkflowDefinition['settings'];
    }
  ): StoredWorkflow {
    // Use provided ID or generate new one
    const id = data.id || `wf_${uuid()}`;
    const now = new Date();
    
    // Update node configs to use the correct workflow ID in webhook paths
    const nodes = (data.nodes || []).map(node => {
      if (node.config?.path && node.config.path.includes('/webhook/')) {
        // Replace any incorrect workflow ID in the path with the actual ID
        return {
          ...node,
          config: {
            ...node.config,
            path: `/webhook/${id}/trigger`
          }
        };
      }
      return node;
    });

    const workflow: StoredWorkflow = {
      id,
      name: data.name,
      description: data.description,
      nodes,
      edges: data.edges || [],
      settings: data.settings,
      userId,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(id, workflow);
    
    // Register with other services
    webhookService.registerWorkflow(workflow);
    schedulerService.registerWorkflow(workflow);

    logger.info(`Workflow created: ${id}`, { name: data.name, userId });
    return workflow;
  }

  /**
   * Get a workflow by ID
   */
  get(workflowId: string, userId?: string): StoredWorkflow | null {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) return null;
    if (userId && workflow.userId !== userId) return null;
    
    return workflow;
  }

  /**
   * Update a workflow
   */
  update(
    workflowId: string,
    userId: string,
    data: Partial<{
      name: string;
      description: string;
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      settings: WorkflowDefinition['settings'];
      isActive: boolean;
    }>
  ): StoredWorkflow | null {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow || workflow.userId !== userId) return null;

    const updated: StoredWorkflow = {
      ...workflow,
      ...data,
      updatedAt: new Date(),
    };

    this.workflows.set(workflowId, updated);

    // Re-register with services
    webhookService.registerWorkflow(updated);
    schedulerService.registerWorkflow(updated);

    logger.info(`Workflow updated: ${workflowId}`);
    return updated;
  }

  /**
   * Delete a workflow
   */
  delete(workflowId: string, userId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow || workflow.userId !== userId) return false;

    // Clean up associated resources
    const webhooks = webhookService.listByWorkflow(workflowId);
    for (const wh of webhooks) {
      webhookService.delete(wh.id);
    }

    this.workflows.delete(workflowId);
    logger.info(`Workflow deleted: ${workflowId}`);
    return true;
  }

  /**
   * List workflows for a user
   */
  list(userId: string): StoredWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.userId === userId);
  }

  /**
   * Duplicate a workflow
   */
  duplicate(workflowId: string, userId: string): StoredWorkflow | null {
    const original = this.get(workflowId, userId);
    if (!original) return null;

    return this.create(userId, {
      name: `${original.name} (Copy)`,
      description: original.description,
      nodes: original.nodes.map(n => ({ ...n, id: `${n.id}_copy` })),
      edges: original.edges.map(e => ({
        ...e,
        id: `${e.id}_copy`,
        source: `${e.source}_copy`,
        target: `${e.target}_copy`,
      })),
      settings: original.settings,
    });
  }

  /**
   * Export workflow as JSON
   */
  export(workflowId: string, userId: string): object | null {
    const workflow = this.get(workflowId, userId);
    if (!workflow) return null;

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflow: {
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes,
        edges: workflow.edges,
        settings: workflow.settings,
      },
    };
  }

  /**
   * Import workflow from JSON
   */
  import(userId: string, data: any): StoredWorkflow | null {
    if (!data.workflow) return null;

    return this.create(userId, {
      name: data.workflow.name || 'Imported Workflow',
      description: data.workflow.description,
      nodes: data.workflow.nodes || [],
      edges: data.workflow.edges || [],
      settings: data.workflow.settings,
    });
  }

  /**
   * Record an execution
   */
  recordExecution(data: ExecutionRecord): void {
    this.executions.set(data.id, data);
    logger.debug(`Execution recorded: ${data.id}`, { workflowId: data.workflowId, status: data.status });
  }

  /**
   * Update execution record
   */
  updateExecution(executionId: string, updates: Partial<ExecutionRecord>): void {
    const existing = this.executions.get(executionId);
    if (existing) {
      this.executions.set(executionId, { ...existing, ...updates });
    }
  }

  /**
   * Get execution history for a workflow
   */
  getExecutions(workflowId: string, limit: number = 50): ExecutionRecord[] {
    return Array.from(this.executions.values())
      .filter(e => e.workflowId === workflowId)
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0))
      .slice(0, limit);
  }

  /**
   * Get a single execution
   */
  getExecution(executionId: string): ExecutionRecord | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get execution statistics
   */
  getStats(userId: string): {
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
  } {
    const userWorkflows = this.list(userId);
    const workflowIds = new Set(userWorkflows.map(w => w.id));
    const userExecutions = Array.from(this.executions.values()).filter(e => workflowIds.has(e.workflowId));

    return {
      totalWorkflows: userWorkflows.length,
      activeWorkflows: userWorkflows.filter(w => w.isActive).length,
      totalExecutions: userExecutions.length,
      successfulExecutions: userExecutions.filter(e => e.status === 'success').length,
      failedExecutions: userExecutions.filter(e => e.status === 'failed').length,
    };
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
