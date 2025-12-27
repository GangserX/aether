// ===========================================
// AETHER WORKFLOW ENGINE - Node Handler Registry
// All node type handlers
// ===========================================

import { WorkflowNode, ExecutionContext, NodeHandler, NodeType } from '../types/workflow.types';
import axios from 'axios';
import nodemailer from 'nodemailer';

// Simple console logger to avoid circular dependencies
const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
  debug: (msg: string, meta?: any) => console.log(`[DEBUG] ${msg}`, meta || ''),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
};

// Inline credential service (simplified for node handlers)
const credentialStore = new Map<string, any>();
const credentialService = {
  async getDecrypted(credentialId: string, userId: string): Promise<Record<string, any> | null> {
    return credentialStore.get(credentialId) || null;
  }
};

// OpenRouter API config
const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'xiaomi/mimo-v2-flash:free';

// Inline AI service for node handlers using OpenRouter
const aiService = {
  async chat(options: { prompt: string; systemPrompt?: string; model?: string; temperature?: number }): Promise<string> {
    try {
      const messages: any[] = [];
      
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      
      messages.push({ role: 'user', content: options.prompt });

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: OPENROUTER_MODEL,
          messages: messages
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.choices?.[0]?.message?.content || 'No response';
    } catch (error: any) {
      logger.error('AI service error:', error.message);
      return `AI Error: ${error.message}`;
    }
  }
};

class NodeHandlerRegistry {
  private handlers: Map<NodeType | string, NodeHandler> = new Map();

  register(type: NodeType | string, handler: NodeHandler): void {
    this.handlers.set(type, handler);
  }

  getHandler(type: NodeType | string): NodeHandler | undefined {
    return this.handlers.get(type);
  }

  listHandlers(): string[] {
    return Array.from(this.handlers.keys()) as string[];
  }
}

export const nodeHandlerRegistry = new NodeHandlerRegistry();

// ===========================================
// FRONTEND COMPATIBILITY - AGENT NODE
// ===========================================

// AGENT node handler - used by frontend for AI agent nodes
nodeHandlerRegistry.register('AGENT', async (node, input, context) => {
  const { model = 'gemini-2.5-flash', systemPrompt, category } = node.config;
  
  // Get user input from webhook body or previous node
  const userMessage = input?.body?.message || input?.body?.question || input?.body?.input || 
                      input?.message || input?.question || input?.input || 
                      (typeof input?.body === 'string' ? input.body : null) ||
                      (typeof input === 'string' ? input : JSON.stringify(input));
  
  logger.info(`[AGENT] Executing with model: ${model}`, { 
    nodeId: node.id, 
    systemPrompt: systemPrompt?.substring(0, 100),
    userMessage: userMessage?.substring(0, 100)
  });
  
  // Map model names to OpenRouter model IDs
  const MODEL_MAP: Record<string, string> = {
    'gemini-2.5-flash': 'google/gemini-2.0-flash-exp:free',
    'gemini-3-pro-preview': 'google/gemini-2.0-flash-exp:free',
    'mimo-v2-flash': 'xiaomi/mimo-v2-flash:free',
  };
  const actualModel = MODEL_MAP[model] || OPENROUTER_MODEL;
  
  try {
    const messages: any[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: userMessage });

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: actualModel,
        messages: messages
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const aiResponse = response.data.choices?.[0]?.message?.content || 'No response';
    
    logger.info(`[AGENT] Response received`, { 
      nodeId: node.id, 
      responseLength: aiResponse.length 
    });
    
    return {
      ...input,
      response: aiResponse,
      aiResponse: aiResponse,
      answer: aiResponse,
      agent: node.name,
      model: actualModel
    };
  } catch (error: any) {
    logger.error(`[AGENT] AI call failed:`, error.message);
    return {
      ...input,
      error: error.message,
      response: `AI Error: ${error.message}`
    };
  }
});

// TRIGGER node handler - alias for TRIGGER_WEBHOOK
nodeHandlerRegistry.register('TRIGGER', async (node, input, context) => {
  // Pass through webhook data
  return input || {};
});

// ===========================================
// TRIGGER NODES
// ===========================================

// Manual Trigger - Simply passes input through
nodeHandlerRegistry.register(NodeType.TRIGGER_MANUAL, async (node, input, context) => {
  logger.info(`Manual trigger activated: ${node.name}`);
  return input || { triggered: true, timestamp: new Date().toISOString() };
});

// Webhook Trigger - Already triggered by the webhook endpoint
// Passes through webhook payload data including body, query, headers
nodeHandlerRegistry.register(NodeType.TRIGGER_WEBHOOK, async (node, input, context) => {
  logger.info(`Webhook trigger processing: ${node.name}`);
  
  // Webhook input structure from server
  const webhookData = context.input?.webhook || input?.webhook || {};
  
  return {
    body: webhookData.body || input?.body || input,
    query: webhookData.query || input?.query || {},
    headers: webhookData.headers || input?.headers || {},
    method: webhookData.method || 'POST',
    path: webhookData.path || node.config.path || '',
    timestamp: webhookData.timestamp || new Date().toISOString(),
    // Pass through raw input as well
    _raw: input
  };
});

// Schedule Trigger - Already triggered by scheduler
nodeHandlerRegistry.register(NodeType.TRIGGER_SCHEDULE, async (node, input, context) => {
  logger.info(`Schedule trigger activated: ${node.name}`);
  return {
    triggered: true,
    scheduledTime: new Date().toISOString(),
    cronExpression: node.config.cronExpression,
    ...input,
  };
});

// ===========================================
// HTTP / API NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_HTTP, async (node, input, context) => {
  const { url, method = 'GET', headers = {}, body } = node.config;

  if (!url) {
    throw new Error('HTTP node requires a URL');
  }

  // Interpolate variables in URL
  const resolvedUrl = interpolateString(url, input);
  const resolvedBody = body ? interpolateObject(body, input) : undefined;

  logger.debug(`HTTP Request: ${method} ${resolvedUrl}`);

  try {
    const response = await axios({
      method,
      url: resolvedUrl,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      data: resolvedBody,
      timeout: 30000,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
    };
  } catch (error: any) {
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        error: error.message,
        data: error.response.data,
      };
    }
    throw error;
  }
});

// ===========================================
// EMAIL NODE
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_EMAIL, async (node, input, context) => {
  const { to, cc, bcc, subject, htmlBody, textBody, credentialId } = node.config;

  if (!to || !subject) {
    throw new Error('Email node requires "to" and "subject"');
  }

  // Get SMTP credentials
  let smtpConfig: any = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  if (credentialId) {
    const creds = await credentialService.getDecrypted(credentialId, context.userId || '');
    if (creds) {
      smtpConfig = {
        host: creds.host,
        port: creds.port,
        secure: creds.secure || false,
        auth: {
          user: creds.user,
          pass: creds.password,
        },
      };
    }
  }

  const transporter = nodemailer.createTransport(smtpConfig);

  const resolvedSubject = interpolateString(subject, input);
  const resolvedHtml = htmlBody ? interpolateString(htmlBody, input) : undefined;
  const resolvedText = textBody ? interpolateString(textBody, input) : JSON.stringify(input, null, 2);

  const mailOptions = {
    from: smtpConfig.auth.user,
    to: Array.isArray(to) ? to.join(', ') : to,
    cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
    subject: resolvedSubject,
    html: resolvedHtml,
    text: resolvedText,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}`);
    return {
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
    };
  } catch (error: any) {
    logger.error(`Email failed: ${error.message}`);
    throw error;
  }
});

// ===========================================
// CODE EXECUTION NODE
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_CODE, async (node, input, context) => {
  const { code, language = 'javascript' } = node.config;

  if (!code) {
    throw new Error('Code node requires code to execute');
  }

  if (language !== 'javascript') {
    throw new Error('Only JavaScript is supported in this version');
  }

  try {
    // Create a sandboxed function
    // In production, use vm2 or isolated-vm for proper sandboxing
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('input', 'context', `
      const $ = input;
      const $input = input;
      const $context = context;
      ${code}
    `);

    const result = await fn(input, {
      variables: context.variables,
      executionId: context.executionId,
    });

    return result ?? input;
  } catch (error: any) {
    logger.error(`Code execution failed: ${error.message}`);
    throw new Error(`Code execution error: ${error.message}`);
  }
});

// ===========================================
// DATA TRANSFORMATION NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_SET, async (node, input, context) => {
  const { fields = {} } = node.config;

  const result = { ...input };
  
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      result[key] = interpolateString(value, input);
    } else {
      result[key] = value;
    }
  }

  return result;
});

nodeHandlerRegistry.register(NodeType.ACTION_FILTER, async (node, input, context) => {
  const { conditions = [] } = node.config;

  if (!Array.isArray(input)) {
    // Single item - check conditions
    for (const cond of conditions) {
      if (!evaluateCondition(input, cond)) {
        return null; // Filter out
      }
    }
    return input;
  }

  // Array - filter items
  return input.filter((item: any) => {
    for (const cond of conditions) {
      if (!evaluateCondition(item, cond)) {
        return false;
      }
    }
    return true;
  });
});

nodeHandlerRegistry.register(NodeType.ACTION_MERGE, async (node, input, context) => {
  // Input is already merged by the engine when multiple edges connect
  return input;
});

nodeHandlerRegistry.register(NodeType.ACTION_SPLIT, async (node, input, context) => {
  const { itemsPath } = node.config;

  if (itemsPath) {
    const items = getNestedValue(input, itemsPath);
    if (Array.isArray(items)) {
      return items;
    }
  }

  if (Array.isArray(input)) {
    return input;
  }

  return [input];
});

// ===========================================
// CONTROL FLOW NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_SWITCH, async (node, input, context) => {
  const { conditions = [] } = node.config;

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    if (evaluateCondition(input, cond)) {
      return {
        ...input,
        _switchOutput: cond.output ?? i,
        _matchedCondition: i,
      };
    }
  }

  // Default output
  return {
    ...input,
    _switchOutput: 'default',
    _matchedCondition: -1,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_LOOP, async (node, input, context) => {
  const { itemsPath, batchSize = 1 } = node.config;

  let items = input;
  if (itemsPath) {
    items = getNestedValue(input, itemsPath);
  }

  if (!Array.isArray(items)) {
    items = [items];
  }

  // Return items for downstream processing
  return {
    items,
    batchSize,
    totalItems: items.length,
    batches: Math.ceil(items.length / batchSize),
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_WAIT, async (node, input, context) => {
  const { duration = 1, unit = 'seconds' } = node.config;

  const multipliers: Record<string, number> = {
    seconds: 1000,
    minutes: 60000,
    hours: 3600000,
    days: 86400000,
  };

  const ms = duration * (multipliers[unit] || 1000);
  
  logger.debug(`Waiting for ${duration} ${unit}`);
  await new Promise(resolve => setTimeout(resolve, ms));
  
  return {
    ...input,
    _waitedFor: { duration, unit },
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_RESPOND, async (node, input, context) => {
  // For webhook responses - allows custom HTTP response for sync webhooks
  const statusCode = node.config.statusCode || 200;
  const headers = node.config.headers || { 'Content-Type': 'application/json' };
  
  // Determine response body
  let body = node.config.body;
  if (!body) {
    // Use input as body if not explicitly set
    body = input;
  } else if (typeof body === 'string') {
    // Interpolate variables in body string
    body = interpolateString(body, input);
  }
  
  logger.info(`ACTION_RESPOND: Returning status ${statusCode}`);
  
  return {
    _isCustomResponse: true, // Flag for server to recognize this
    statusCode,
    headers,
    body,
    response: body // Alias for compatibility
  };
});

// ===========================================
// AI NODES
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_AI_CHAT, async (node, input, context) => {
  const { prompt, systemPrompt, model = 'gemini-2.5-flash', temperature = 0.7 } = node.config;

  const resolvedPrompt = interpolateString(prompt || JSON.stringify(input), input);

  const response = await aiService.chat({
    prompt: resolvedPrompt,
    systemPrompt: systemPrompt,
    model,
    temperature,
  });

  return {
    ...input,
    aiResponse: response,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_AI_SUMMARIZE, async (node, input, context) => {
  const { model = 'gemini-2.5-flash' } = node.config;
  
  const textToSummarize = typeof input === 'string' 
    ? input 
    : input.text || JSON.stringify(input);

  const response = await aiService.chat({
    prompt: `Please summarize the following content concisely:\n\n${textToSummarize}`,
    systemPrompt: 'You are a helpful assistant that creates clear, concise summaries.',
    model,
  });

  return {
    original: input,
    summary: response,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_AI_CLASSIFY, async (node, input, context) => {
  const { categories, model = 'gemini-2.5-flash' } = node.config;
  
  const textToClassify = typeof input === 'string' 
    ? input 
    : input.text || JSON.stringify(input);

  const categoryList = Array.isArray(categories) 
    ? categories.join(', ') 
    : 'positive, negative, neutral';

  const response = await aiService.chat({
    prompt: `Classify the following text into one of these categories: ${categoryList}\n\nText: ${textToClassify}\n\nRespond with just the category name.`,
    systemPrompt: 'You are a classification assistant. Respond only with the category name.',
    model,
    temperature: 0.1,
  });

  return {
    input: textToClassify,
    category: response.trim(),
    categories: categories,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_AI_TRANSFORM, async (node, input, context) => {
  const { prompt, model = 'gemini-2.5-flash' } = node.config;
  
  const resolvedPrompt = interpolateString(prompt || 'Transform this data', input);

  const response = await aiService.chat({
    prompt: `${resolvedPrompt}\n\nInput data:\n${JSON.stringify(input, null, 2)}`,
    systemPrompt: 'You are a data transformation assistant. Output valid JSON when possible.',
    model,
  });

  // Try to parse as JSON
  try {
    return JSON.parse(response);
  } catch {
    return {
      transformed: response,
      original: input,
    };
  }
});

// ===========================================
// INTEGRATION NODES (Stubs - require credentials)
// ===========================================

nodeHandlerRegistry.register(NodeType.ACTION_SLACK, async (node, input, context) => {
  const { channel, message, credentialId } = node.config;

  // Stub implementation - would use Slack SDK with OAuth token
  logger.info(`[STUB] Slack message to ${channel}: ${message}`);
  
  return {
    success: true,
    stub: true,
    channel,
    message: interpolateString(message || '', input),
    timestamp: new Date().toISOString(),
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_DISCORD, async (node, input, context) => {
  const { channel, message, webhookUrl } = node.config;

  if (webhookUrl) {
    const resolvedMessage = interpolateString(message || JSON.stringify(input), input);
    
    await axios.post(webhookUrl, {
      content: resolvedMessage,
    });

    return { success: true, message: resolvedMessage };
  }

  logger.info(`[STUB] Discord message: ${message}`);
  return { success: true, stub: true };
});

nodeHandlerRegistry.register(NodeType.ACTION_DATABASE, async (node, input, context) => {
  const { operation, table, query, values, credentialId } = node.config;

  // Stub implementation - would use pg/mysql2/prisma
  logger.info(`[STUB] Database ${operation} on ${table}`);
  
  return {
    success: true,
    stub: true,
    operation,
    table,
    query,
    values,
  };
});

nodeHandlerRegistry.register(NodeType.ACTION_GOOGLE_SHEETS, async (node, input, context) => {
  const { spreadsheetId, sheetName, operation, range, values, credentialId } = node.config;

  // Stub implementation - would use Google Sheets API
  logger.info(`[STUB] Google Sheets ${operation} on ${spreadsheetId}`);
  
  return {
    success: true,
    stub: true,
    spreadsheetId,
    sheetName,
    operation,
  };
});

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function interpolateString(template: string, data: any): string {
  if (!template) return '';
  
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

function interpolateObject(obj: any, data: any): any {
  if (typeof obj === 'string') {
    return interpolateString(obj, data);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateObject(item, data));
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, data);
    }
    return result;
  }
  return obj;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function evaluateCondition(data: any, condition: { field: string; operator: string; value: any }): boolean {
  const { field, operator, value } = condition;
  const fieldValue = getNestedValue(data, field);

  switch (operator) {
    case 'eq':
    case 'equals':
      return fieldValue === value;
    case 'neq':
    case 'notEquals':
      return fieldValue !== value;
    case 'gt':
      return fieldValue > value;
    case 'gte':
      return fieldValue >= value;
    case 'lt':
      return fieldValue < value;
    case 'lte':
      return fieldValue <= value;
    case 'contains':
      return String(fieldValue).includes(String(value));
    case 'notContains':
      return !String(fieldValue).includes(String(value));
    case 'regex':
      return new RegExp(value).test(String(fieldValue));
    case 'isEmpty':
      return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'isNotEmpty':
      return !!fieldValue && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'exists':
      return fieldValue !== undefined;
    case 'notExists':
      return fieldValue === undefined;
    default:
      return true;
  }
}
