// ===========================================
// AETHER - Email Service
// Send emails via Gmail SMTP
// ===========================================

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Create reusable transporter
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('Email: SMTP credentials not configured');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: pass.replace(/\s/g, ''), // Remove spaces from app password
    },
  });
};

export const emailService = {
  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    const transporter = createTransporter();
    
    if (!transporter) {
      return { success: false, error: 'Email service not configured. Set SMTP_USER and SMTP_PASS in .env' };
    }

    const fromAddress = options.from || process.env.SMTP_USER;

    try {
      const info = await transporter.sendMail({
        from: `"Aether Workflow" <${fromAddress}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      console.log(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };

    } catch (error: any) {
      console.error('Email send failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send a simple text email
   */
  async sendText(to: string, subject: string, text: string): Promise<EmailResult> {
    return this.send({ to, subject, text });
  },

  /**
   * Send an HTML email
   */
  async sendHtml(to: string, subject: string, html: string): Promise<EmailResult> {
    return this.send({ to, subject, html, text: html.replace(/<[^>]*>/g, '') });
  },

  /**
   * Send a workflow notification email
   */
  async sendWorkflowNotification(
    to: string,
    workflowName: string,
    status: 'success' | 'failure' | 'warning',
    details: string
  ): Promise<EmailResult> {
    const statusEmoji = status === 'success' ? '✅' : status === 'failure' ? '❌' : '⚠️';
    const statusColor = status === 'success' ? '#22c55e' : status === 'failure' ? '#ef4444' : '#f59e0b';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #D90429, #8B0000); padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .status { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-bottom: 20px; }
          .details { background: #0a0a0a; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 14px; white-space: pre-wrap; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ Aether Workflow</h1>
          </div>
          <div class="content">
            <h2>${statusEmoji} Workflow: ${workflowName}</h2>
            <div class="status" style="background: ${statusColor}20; color: ${statusColor};">
              Status: ${status.toUpperCase()}
            </div>
            <h3>Details:</h3>
            <div class="details">${details}</div>
          </div>
          <div class="footer">
            Sent by Aether Workflow Automation<br>
            ${new Date().toLocaleString()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to,
      subject: `${statusEmoji} Workflow "${workflowName}" - ${status.toUpperCase()}`,
      html,
    });
  },

  /**
   * Test email configuration
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const transporter = createTransporter();
    
    if (!transporter) {
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      await transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export default emailService;
