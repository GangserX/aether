# Aether Orchestrate - Operations Runbook

## Common Operations

### Scaling ECS Service

**Scale Up:**
```bash
aws ecs update-service \
  --cluster aether-staging-cluster \
  --service aether-staging-backend \
  --desired-count 3
```

**Scale Down:**
```bash
aws ecs update-service \
  --cluster aether-staging-cluster \
  --service aether-staging-backend \
  --desired-count 1
```

### Force New Deployment
```bash
aws ecs update-service \
  --cluster aether-staging-cluster \
  --service aether-staging-backend \
  --force-new-deployment
```

### Rollback to Previous Version
```bash
./scripts/rollback.sh staging
```

## Database Operations

### Connect to RDS
```bash
# Get endpoint from Terraform output
psql -h <rds-endpoint> -U aether_admin -d aether_db
```

### Run Migrations
```bash
# SSH into ECS task or run locally with DATABASE_URL set
npx prisma migrate deploy
```

### Create Database Backup
```bash
aws rds create-db-snapshot \
  --db-instance-identifier aether-staging-db \
  --db-snapshot-identifier aether-staging-backup-$(date +%Y%m%d)
```

## Monitoring

### View CloudWatch Logs
```bash
# Backend logs
aws logs tail /ecs/aether-staging-backend --follow

# X-Ray logs
aws logs tail /ecs/aether-staging-xray --follow
```

### Check ECS Service Status
```bash
aws ecs describe-services \
  --cluster aether-staging-cluster \
  --services aether-staging-backend
```

### View Running Tasks
```bash
aws ecs list-tasks \
  --cluster aether-staging-cluster \
  --service-name aether-staging-backend
```

## Alerting

### CloudWatch Alarms
Alarms are configured for:
- CPU utilization > 80%
- Memory utilization > 80%
- 5xx error rate > 5%
- Response time > 2s

### SNS Notifications
Alerts are sent to the SNS topic: `aether-staging-alerts`

Subscribe to alerts:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-north-1:ACCOUNT_ID:aether-staging-alerts \
  --protocol email \
  --notification-endpoint your@email.com
```

## Troubleshooting

### Task Failing to Start

1. Check task stopped reason:
```bash
aws ecs describe-tasks \
  --cluster aether-staging-cluster \
  --tasks <task-arn> \
  --query 'tasks[0].stoppedReason'
```

2. Check container logs:
```bash
aws logs get-log-events \
  --log-group-name /ecs/aether-staging-backend \
  --log-stream-name <stream-name>
```

### Database Connection Issues

1. Verify security group allows ECS -> RDS:
```bash
aws ec2 describe-security-groups \
  --group-ids <rds-security-group-id>
```

2. Test connectivity from ECS task:
```bash
# Exec into running container
aws ecs execute-command \
  --cluster aether-staging-cluster \
  --task <task-id> \
  --container backend \
  --interactive \
  --command "/bin/sh"
```

### High Memory Usage

1. Check current memory:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ClusterName,Value=aether-staging-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

2. Scale up if needed or increase task memory in Terraform.

### SSL Certificate Issues

1. Check certificate status:
```bash
aws acm describe-certificate \
  --certificate-arn <certificate-arn>
```

2. Ensure domain validation is complete.

## Emergency Procedures

### Complete Service Outage

1. Check AWS Health Dashboard
2. Verify all ECS tasks are running
3. Check RDS and ElastiCache status
4. Review CloudWatch logs for errors
5. Rollback if recent deployment caused issue

### Security Incident

1. Rotate all secrets in Secrets Manager
2. Rotate database password
3. Invalidate all JWT tokens
4. Review CloudTrail logs
5. Update security groups if needed
