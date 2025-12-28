# Webhook Trigger Prototype

## Concept
Enable workflows to be triggered via HTTP webhooks for external integrations.

## Implementation Notes

### Endpoint Structure
```
POST /webhook/{workflowId}/trigger
```

### Payload Format
```json
{
  "imageUrl": "https://example.com/invoice.png",
  "message": "Extract all text and numbers from this invoice"
}
```

### Response
```json
{
  "executionId": "exec_xyz123",
  "status": "processing",
  "workflowId": "wf_1766903327754"
}
```

## Testing
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8080/webhook/wf_1766903327754/trigger" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"imageUrl": "https://www.invoicesimple.com/wp-content/uploads/2018/06/Sample-Invoice-printable.png", "message": "Extract all text and numbers from this invoice"}'
```

## Status
✅ POC Successful - Ready for integration

## Next Steps
- Add webhook authentication (API keys)
- Implement async execution tracking
- Add webhook logs and retry logic
- Support custom response templates
