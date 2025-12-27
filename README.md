# Aether Orchestrate

A visual workflow automation platform with built-in AI agents. Build powerful automations with drag-and-drop nodes, webhook triggers, and free AI models.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)

## 🚀 Features

- **Visual Workflow Builder** - Drag & drop interface for creating automation workflows
- **AI Agent Nodes** - Integrate AI models (Gemini, Mimo) with custom system prompts
- **Webhook Triggers** - Automatic webhook endpoints for every workflow
- **Real-time Execution** - Synchronous webhook responses with AI results
- **Free AI Models** - Uses OpenRouter with free model options
- **Node-based Architecture** - Trigger, Agent, Condition, Output nodes
- **Live Updates** - Real-time node execution status and results
- **Zero Cost** - Completely free to run and use

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

---

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/aether-orchestrate.git
cd aether-orchestrate
```

### 2. Install Dependencies

#### Frontend
```bash
cd aether-orchestrate
npm install
```

#### Backend
```bash
cd backend
npm install
```

---

## ⚙️ Configuration

### Required API Keys

The platform uses OpenRouter for AI model access. An API key is already configured, but you can use your own:

1. Get a free API key from [OpenRouter](https://openrouter.ai/)
2. Update the key in `backend/src/engine/nodeHandlers.ts`:

```typescript
const OPENROUTER_API_KEY = 'your-api-key-here';
```

### Supported AI Models

The following free models are pre-configured:
- `gemini-2.5-flash` → Google Gemini 2.0 Flash (Free)
- `gemini-3-pro-preview` → Google Gemini 2.0 Flash (Free)
- `mimo-v2-flash` → Xiaomi Mimo V2 Flash (Free)

---

## 🚦 Running the Application

### Start Backend Server (Terminal 1)
```bash
cd backend
npx tsx src/server.ts
```

Backend will run on **http://localhost:8080**

### Start Frontend (Terminal 2)
```bash
cd aether-orchestrate
npm run dev
```

Frontend will run on **http://localhost:3000** (or port shown in terminal)

---

## � Project Structure

```
aether-orchestrate/
├── aether-orchestrate/          # Frontend application
│   ├── components/              # React components
│   │   ├── Auth.tsx            # Authentication UI
│   │   ├── Builder.tsx         # Workflow builder (main canvas)
│   │   ├── Deployments.tsx     # Deployment management
│   │   ├── Landing.tsx         # Landing page
│   │   ├── Layout.tsx          # App layout wrapper
│   │   └── Profile.tsx         # User profile
│   ├── services/               
│   │   └── geminiService.ts    # AI service integration
│   ├── App.tsx                 # Main app component
│   ├── index.tsx               # Entry point
│   ├── types.ts                # TypeScript type definitions
│   ├── package.json
│   └── vite.config.ts          # Vite configuration
│
├── backend/                     # Backend server
│   ├── src/
│   │   ├── server.ts           # Express server & API routes
│   │   ├── config/
│   │   │   └── env.ts          # Environment configuration
│   │   ├── engine/
│   │   │   ├── executionEngine.ts   # Workflow execution engine
│   │   │   └── nodeHandlers.ts      # Node type handlers
│   │   ├── middleware/
│   │   │   └── security.ts     # Security middleware
│   │   ├── services/
│   │   │   ├── agentRegistry.ts     # Agent service registry
│   │   │   ├── proxy.ts             # Proxy service
│   │   │   └── webhookService.ts    # Webhook management
│   │   ├── types/
│   │   │   └── workflow.types.ts    # Type definitions
│   │   └── utils/
│   │       ├── encryption.ts   # Encryption utilities
│   │       └── logger.ts       # Logging service
│   └── package.json
│
├── README.md                    # This file
└── metadata.json               # Project metadata
```

---

## 🎯 Usage Guide

### 1. Creating Your First Workflow

1. **Open the app** at http://localhost:3000
2. **Add a Trigger node** - Click "Add Node" → Select "Trigger"
3. **Add an AI Agent node** - Click "Add Node" → Select "Agent"
4. **Connect the nodes** - Drag from Trigger's output to Agent's input
5. **Configure the Agent**:
   - Set a **System Prompt** (e.g., "You are a helpful assistant")
   - Choose an **AI Model** (e.g., Gemini 2.5 Flash)
6. **Deploy** - Click the "Deploy" button
7. **Copy the webhook URL** shown in the deployment dialog

### 2. Testing Your Workflow

Use PowerShell or curl to test the webhook:

```powershell
# PowerShell
$result = Invoke-RestMethod -Uri "http://localhost:8080/webhook/wf_YOUR_ID/trigger" -Method POST -ContentType "application/json" -Body '{"question": "What is the capital of India?"}'
$result.response.answer
```

```bash
# Curl (Linux/Mac)
curl -X POST http://localhost:8080/webhook/wf_YOUR_ID/trigger \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the capital of India?"}'
```

### 3. Understanding the Response

```json
{
  "success": true,
  "executionId": "uuid-here",
  "response": {
    "answer": "The capital of India is New Delhi.",
    "aiResponse": "The capital of India is New Delhi.",
    "agent": "Your Agent Name",
    "model": "google/gemini-2.0-flash-exp:free"
  }
}
```

---

## 🔌 API Endpoints

### Workflows

- **POST** `/api/v1/workflows` - Create a new workflow
- **PUT** `/api/v1/workflows/:id` - Update a workflow
- **GET** `/api/v1/workflows/:id` - Get workflow details
- **DELETE** `/api/v1/workflows/:id` - Delete a workflow

### Webhooks

- **POST** `/api/v1/webhooks` - Register a webhook
- **ALL** `/webhook/:workflowId/trigger` - Execute workflow via webhook

---

## 🔧 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=8080
NODE_ENV=development

# OpenRouter API
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Security
JWT_SECRET=your-jwt-secret-here
```

---

## 🎨 Available Node Types

### Trigger Nodes
- **TRIGGER** - Webhook trigger for external events
- **TRIGGER_WEBHOOK** - HTTP webhook listener

### Action Nodes
- **AGENT** - AI agent with configurable model & system prompt
- **ACTION_AI_CHAT** - AI chat completion
- **ACTION_AI_SUMMARIZE** - AI text summarization
- **ACTION_HTTP** - HTTP request

### Output Nodes
- **OUTPUT** - Display results
- **ACTION_RESPOND** - Custom webhook response

---

## 🐛 Troubleshooting

### Backend Won't Start

**Error: `Module not found`**
```bash
cd backend
npm install
```

**Error: `Port 8080 already in use`**
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Webhook Returns 404

**Solution:** Re-deploy the workflow from the frontend. Webhooks are stored in-memory and reset when the backend restarts.

### AI Agent Not Responding

1. Check the OpenRouter API key is valid
2. Check backend console for error logs
3. Verify the model name is correctly configured

---

## 🗺️ Roadmap

- [ ] Database persistence
- [ ] User authentication
- [ ] Scheduled workflows (cron)
- [ ] More AI models
- [ ] Email/Slack integrations
- [ ] Workflow templates
- [ ] Analytics dashboard

---

## 📄 License

MIT License - 2025

---

**Built with ❤️ for the future of AI automation**
