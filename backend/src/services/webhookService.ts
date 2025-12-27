// ===========================================
// AETHER WORKFLOW ENGINE - Webhook Service
// HTTP webhook handling and registration
// ===========================================

import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';
import { encryption } from '../utils/encryption';
import { WorkflowDefinition, WebhookPayload } from '../types/workflow.types';
import { executeWorkflow } from '../engine/executionEngine';

interface RegisteredWebhook {
  id: string;
  path: string;
  workflowId: string;
  method: string;
  isActive: boolean;
  responseMode: 'onReceived' | 'onCompleted'; // Async vs Sync
  authType: 'none' | 'basic' | 'header' | 'jwt';
  authConfig?: {
    username?: string;
    passwordHash?: string;
    headerName?: string;
    headerValueHash?: string;
    jwtSecret?: string;
  };
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount: number;
}

class WebhookService {
  private webhooks: Map<string, RegisteredWebhook> = new Map();
  private pathIndex: Map<string, string> = new Map(); // path -> webhookId
  private workflowStore: Map<string, WorkflowDefinition> = new Map();

  constructor() {
    logger.info('Webhook service initialized');
  }

  /**
   * Register a workflow for the service to access
   * Also auto-registers any webhook trigger nodes found in the workflow
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflowStore.set(workflow.id, workflow);
    
    // Auto-register webhook triggers found in the workflow
    // Support multiple trigger type names for compatibility (cast to string to handle enums)
    const webhookNodes = workflow.nodes.filter(n => {
      const nodeType = String(n.type).toUpperCase();
      return (
        nodeType === 'TRIGGER_WEBHOOK' || 
        nodeType === 'TRIGGER' || 
        nodeType.includes('WEBHOOK') ||
        n.config?.model === 'webhook-trigger' ||
        (n.name && n.name.toLowerCase().includes('webhook'))
      );
    });
    
    // If no explicit webhook nodes, register the workflow itself as a webhook target
    if (webhookNodes.length === 0 && workflow.nodes.length > 0) {
      // Register a default webhook for this workflow - use ANY method for flexibility
      const defaultPath = `/webhook/${workflow.id}/trigger`;
      try {
        const existingId = this.pathIndex.get(defaultPath);
        if (!existingId) {
          this.register(workflow.id, {
            path: defaultPath,
            method: 'ANY',
            responseMode: 'onCompleted',
            authType: 'none'
          });
          logger.info(`Auto-registered default webhook for workflow ${workflow.id}: ${defaultPath}`);
        }
      } catch (e: any) {
        logger.warn(`Failed to register default webhook for workflow ${workflow.id}: ${e.message}`);
      }
      return;
    }
    
    for (const node of webhookNodes) {
      // Use configured path or default to workflow ID
      const path = node.config?.path || `/webhook/${workflow.id}/trigger`;
      // Default to ANY to accept all HTTP methods (GET, POST, PUT, etc.)
      const method = node.config?.method || node.config?.httpMethod || 'ANY';
      const responseMode = node.config?.responseMode || 'onCompleted';
      
      try {
        // Check if already registered to avoid duplicates
        const existingId = this.pathIndex.get(path);
        if (existingId) {
          const existing = this.webhooks.get(existingId);
          if (existing && existing.workflowId === workflow.id) {
            // Update existing webhook
            existing.method = method.toUpperCase();
            existing.responseMode = responseMode;
            existing.isActive = true;
            logger.info(`Updated webhook for workflow ${workflow.id}: ${path}`);
            continue;
          }
        }

        this.register(workflow.id, {
          path,
          method,
          responseMode,
          authType: node.config?.authentication || node.config?.authType || 'none',
          authConfig: node.config?.authConfig
        });
        logger.info(`Auto-registered webhook for workflow ${workflow.id}: ${path}`);
      } catch (e: any) {
        logger.warn(`Failed to auto-register webhook for workflow ${workflow.id}: ${e.message}`);
      }
    }
  }

  /**
   * Register a new webhook endpoint
   */
  register(
    workflowId: string,
    options: {
      path?: string;
      method?: string;
      responseMode?: 'onReceived' | 'onCompleted';
      authType?: RegisteredWebhook['authType'];
      authConfig?: {
        username?: string;
        password?: string;
        headerName?: string;
        headerValue?: string;
        jwtSecret?: string;
      };
    } = {}
  ): RegisteredWebhook {
    const id = `wh_${uuid()}`;
    const path = options.path || `/webhook/${id}`;

    // Check if path already exists
    if (this.pathIndex.has(path)) {
      throw new Error(`Webhook path already exists: ${path}`);
    }

    const webhook: RegisteredWebhook = {
      id,
      path,
      workflowId,
      method: options.method?.toUpperCase() || 'ANY',
      isActive: true,
      responseMode: options.responseMode || 'onCompleted',
      authType: options.authType || 'none',
      createdAt: new Date(),
      triggerCount: 0,
    };

    // Hash auth credentials
    if (options.authConfig) {
      webhook.authConfig = {};
      if (options.authConfig.username) {
        webhook.authConfig.username = options.authConfig.username;
        webhook.authConfig.passwordHash = encryption.hash(options.authConfig.password || '');
      }
      if (options.authConfig.headerName) {
        webhook.authConfig.headerName = options.authConfig.headerName;
        webhook.authConfig.headerValueHash = encryption.hash(options.authConfig.headerValue || '');
      }
      if (options.authConfig.jwtSecret) {
        webhook.authConfig.jwtSecret = options.authConfig.jwtSecret;
      }
    }

    this.webhooks.set(id, webhook);
    this.pathIndex.set(path, id);

    logger.info(`Registered webhook: ${path}`, { webhookId: id, workflowId });
    return webhook;
  }

  /**
   * Handle incoming webhook request
   */
  async handleRequest(payload: WebhookPayload): Promise<{
    success: boolean;
    executionId?: string;
    response?: any;
    error?: string;
  }> {
    const { path, method, headers, body } = payload;

    // Find matching webhook
    const webhookId = this.pathIndex.get(path);
    if (!webhookId) {
      logger.warn(`Webhook not found: ${path}`);
      return { success: false, error: 'Webhook not found' };
    }

    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return { success: false, error: 'Webhook configuration error' };
    }

    // Check if active
    if (!webhook.isActive) {
      return { success: false, error: 'Webhook is disabled' };
    }

    // Verify method
    if (webhook.method !== 'ANY' && webhook.method !== method.toUpperCase()) {
      return { success: false, error: `Method not allowed. Expected ${webhook.method}` };
    }

    // Authenticate
    const authResult = this.authenticate(webhook, headers);
    if (!authResult.success) {
      logger.warn(`Webhook auth failed: ${path}`, { reason: authResult.error });
      return { success: false, error: 'Authentication failed' };
    }

    // Get workflow
    const workflow = this.workflowStore.get(webhook.workflowId);
    if (!workflow) {
      logger.error(`Workflow not found for webhook: ${webhook.workflowId}`);
      return { success: false, error: 'Workflow not found' };
    }

    // Update stats
    webhook.lastTriggeredAt = new Date();
    webhook.triggerCount++;

    logger.info(`Webhook triggered: ${path}`, { webhookId, workflowId: webhook.workflowId });

    // Execute workflow
    try {
      const result = await executeWorkflow(
        workflow,
        {
          webhook: {
            path,
            method,
            headers,
            query: payload.query,
            body,
            timestamp: payload.timestamp,
          },
          body,
          query: payload.query,
        },
        undefined,
        'webhook'
      );

      return {
        success: true,
        executionId: result.executionId,
        response: result.output,
      };
    } catch (error: any) {
      logger.error(`Webhook execution failed: ${path}`, { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Authenticate webhook request
   */
  private authenticate(
    webhook: RegisteredWebhook,
    headers: Record<string, string>
  ): { success: boolean; error?: string } {
    switch (webhook.authType) {
      case 'none':
        return { success: true };

      case 'basic': {
        const authHeader = headers['authorization'] || headers['Authorization'];
        if (!authHeader?.startsWith('Basic ')) {
          return { success: false, error: 'Missing Basic auth' };
        }
        
        const base64 = authHeader.substring(6);
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');
        
        if (username !== webhook.authConfig?.username) {
          return { success: false, error: 'Invalid username' };
        }
        
        if (encryption.hash(password) !== webhook.authConfig?.passwordHash) {
          return { success: false, error: 'Invalid password' };
        }
        
        return { success: true };
      }

      case 'header': {
        const headerName = webhook.authConfig?.headerName || 'X-Webhook-Secret';
        const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
        
        if (!headerValue) {
          return { success: false, error: `Missing header: ${headerName}` };
        }
        
        if (encryption.hash(headerValue) !== webhook.authConfig?.headerValueHash) {
          return { success: false, error: 'Invalid header value' };
        }
        
        return { success: true };
      }

      case 'jwt':
        // Simplified JWT check - in production use jsonwebtoken
        const token = headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return { success: false, error: 'Missing JWT token' };
        }
        // Would verify JWT here
        return { success: true };

      default:
        return { success: true };
    }
  }

  /**
   * Get webhook by ID
   */
  get(webhookId: string): RegisteredWebhook | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Get webhook by path
   */
  getByPath(path: string): RegisteredWebhook | undefined {
    const id = this.pathIndex.get(path);
    return id ? this.webhooks.get(id) : undefined;
  }

  /**
   * List all webhooks for a workflow
   */
  listByWorkflow(workflowId: string): RegisteredWebhook[] {
    return Array.from(this.webhooks.values()).filter(w => w.workflowId === workflowId);
  }

  /**
   * Toggle webhook active state
   */
  toggle(webhookId: string): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;
    
    webhook.isActive = !webhook.isActive;
    logger.info(`Webhook ${webhook.isActive ? 'enabled' : 'disabled'}: ${webhookId}`);
    return true;
  }

  /**
   * Delete a webhook
   */
  delete(webhookId: string): boolean {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;

    this.pathIndex.delete(webhook.path);
    this.webhooks.delete(webhookId);
    
    logger.info(`Deleted webhook: ${webhookId}`);
    return true;
  }

  /**
   * Get all registered paths
   */
  getAllPaths(): string[] {
    return Array.from(this.pathIndex.keys());
  }
}

export const webhookService = new WebhookService();
export default webhookService;
