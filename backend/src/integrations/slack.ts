// ===========================================
// AETHER - Slack Integration Service
// Send messages to Slack channels
// ===========================================

import axios from 'axios';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

interface SlackMessage {
  channel: string;  // Channel ID or name (e.g., #general or C1234567890)
  text: string;
  blocks?: any[];   // Optional rich formatting blocks
}

interface SlackResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

export const slackService = {
  /**
   * Send a message to a Slack channel
   */
  async sendMessage(options: SlackMessage): Promise<SlackResponse> {
    if (!SLACK_BOT_TOKEN) {
      console.warn('Slack: No bot token configured');
      return { ok: false, error: 'Slack bot token not configured' };
    }

    try {
      const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: options.channel,
          text: options.text,
          blocks: options.blocks,
        },
        {
          headers: {
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ok) {
        console.log(`Slack: Message sent to ${options.channel}`);
        return {
          ok: true,
          channel: response.data.channel,
          ts: response.data.ts,
        };
      } else {
        console.error('Slack API error:', response.data.error);
        return { ok: false, error: response.data.error };
      }
    } catch (error: any) {
      console.error('Slack request failed:', error.message);
      return { ok: false, error: error.message };
    }
  },

  /**
   * Send a rich formatted message with blocks
   */
  async sendRichMessage(
    channel: string,
    title: string,
    message: string,
    color: 'good' | 'warning' | 'danger' = 'good'
  ): Promise<SlackResponse> {
    const colorMap = {
      good: '#36a64f',
      warning: '#ffcc00',
      danger: '#ff0000',
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📤 Sent from *Aether Workflow* at ${new Date().toLocaleString()}`,
          },
        ],
      },
    ];

    return this.sendMessage({ channel, text: title, blocks });
  },

  /**
   * List available channels
   */
  async listChannels(): Promise<{ ok: boolean; channels?: any[]; error?: string }> {
    if (!SLACK_BOT_TOKEN) {
      return { ok: false, error: 'Slack bot token not configured' };
    }

    try {
      const response = await axios.get(
        'https://slack.com/api/conversations.list',
        {
          headers: {
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          },
          params: {
            types: 'public_channel,private_channel',
            limit: 100,
          },
        }
      );

      if (response.data.ok) {
        return {
          ok: true,
          channels: response.data.channels.map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            isPrivate: ch.is_private,
          })),
        };
      } else {
        return { ok: false, error: response.data.error };
      }
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  },

  /**
   * Check if Slack is configured and working
   */
  async testConnection(): Promise<{ ok: boolean; team?: string; error?: string }> {
    if (!SLACK_BOT_TOKEN) {
      return { ok: false, error: 'Slack bot token not configured' };
    }

    try {
      const response = await axios.get(
        'https://slack.com/api/auth.test',
        {
          headers: {
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          },
        }
      );

      if (response.data.ok) {
        return { ok: true, team: response.data.team };
      } else {
        return { ok: false, error: response.data.error };
      }
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  },
};

export default slackService;
