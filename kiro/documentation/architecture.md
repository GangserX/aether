# System Architecture

## Overview
Aether Orchestrate is a full-stack AI orchestration platform with a React frontend, Node.js backend, and Gemini AI integration.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vite)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   React 19   │──│   ReactFlow  │──│  Zustand Store  │  │
│  │  TypeScript  │  │  (DAG Builder)│  │ (State Mgmt)    │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                  │                    │           │
│         └──────────────────┴────────────────────┘           │
│                           │                                 │
│                      Axios HTTP                             │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Gateway (Express)                │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │  Security  │──│   Routes    │──│  Agent Registry  │    │
│  │ Middleware │  │  (API/REST) │  │  Proxy Service   │    │
│  └────────────┘  └─────────────┘  └──────────────────┘    │
│         │               │                    │              │
│    Helmet/CORS    Rate Limiting         Validation         │
└─────────┼───────────────┼────────────────────┼─────────────┘
          │               │                    │
          ▼               ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │    Redis     │  │  Gemini API      │
│  (Prisma)    │  │  (Caching)   │  │  gemini-3-flash  │
└──────────────┘  └──────────────┘  └──────────────────┘
```

## Technology Layers

### Presentation Layer
- **Framework**: React 19 with TypeScript
- **Routing**: Client-side routing
- **State**: Zustand for global state, React Query for server state
- **Styling**: Tailwind CSS (Cherry/Cream theme)

### Application Layer
- **API Gateway**: Express.js with TypeScript
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Zod schemas, express-validator
- **Authentication**: JWT tokens, bcrypt hashing

### Data Layer
- **Primary DB**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session and query caching
- **Queue**: BullMQ for async job processing

### AI Layer
- **Provider**: Google Gemini AI
- **Model**: gemini-3-flash-preview (free tier)
- **SDK**: @google/genai

## Key Design Patterns

### Frontend
- **Component Pattern**: Functional components with hooks
- **State Management**: Global store (Zustand) + Server cache (React Query)
- **Flow Builder**: DAG using ReactFlow library

### Backend
- **Middleware Chain**: Security → Validation → Business Logic → Response
- **Service Layer**: Separated business logic from routes
- **Repository Pattern**: Prisma models abstracted through services

## Security Architecture
- Rate limiting per IP
- CORS with whitelist
- Helmet security headers
- Input validation (Zod + express-validator)
- JWT for authentication
- Environment-based secrets

## Deployment Architecture
- **Frontend**: Static hosting (Vite build)
- **Backend**: Node.js server
- **Database**: Managed PostgreSQL
- **Cache**: Managed Redis
- **Future**: Edge deployment on Cloudflare Workers
