# API Reference

## Base URL
```
Development: http://localhost:8080
Production: https://api.aether.systems
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Agent Registry

#### GET /api/agents
List all available agent templates

**Response**:
```json
{
  "agents": [
    {
      "id": "agent_dev_001",
      "name": "Senior Developer",
      "role": "Code generation and review",
      "model": "gemini-3-flash-preview"
    }
  ]
}
```

---

### Workflows

#### POST /api/workflows
Create a new workflow

**Request**:
```json
{
  "name": "Invoice Processing",
  "nodes": [...],
  "edges": [...],
  "metadata": {}
}
```

**Response**:
```json
{
  "workflowId": "wf_123456",
  "status": "created"
}
```

#### GET /api/workflows/:id
Get workflow details

#### PUT /api/workflows/:id
Update workflow

#### DELETE /api/workflows/:id
Delete workflow

---

### Execution

#### POST /api/workflows/:id/execute
Execute a workflow

**Request**:
```json
{
  "input": {
    "message": "Process this invoice",
    "imageUrl": "https://example.com/invoice.png"
  }
}
```

**Response**:
```json
{
  "executionId": "exec_xyz123",
  "status": "processing",
  "startedAt": "2025-12-28T10:30:00Z"
}
```

#### GET /api/executions/:id
Get execution status and results

---

### Webhooks

#### POST /webhook/:workflowId/trigger
Trigger workflow via webhook

**Request**:
```json
{
  "imageUrl": "https://example.com/invoice.png",
  "message": "Extract data"
}
```

**Response**:
```json
{
  "executionId": "exec_abc789",
  "status": "processing"
}
```

---

## Error Codes

| Code | Meaning |
|------|--------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limits
- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1000 requests/hour
- **Enterprise**: Custom limits
