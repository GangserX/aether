# Aether Orchestrate - AWS Deployment Guide

## Prerequisites

### AWS Account Setup
1. Create an AWS account at https://aws.amazon.com
2. Create an IAM user with programmatic access
3. Attach the following policies:
   - AmazonECS_FullAccess
   - AmazonEC2ContainerRegistryFullAccess
   - AmazonRDSFullAccess
   - AmazonElastiCacheFullAccess
   - AmazonS3FullAccess
   - CloudFrontFullAccess
   - AmazonVPCFullAccess
   - SecretsManagerReadWrite
   - CloudWatchFullAccess

### Local Tools Required
- AWS CLI v2: `winget install Amazon.AWSCLI`
- Terraform: `choco install terraform`
- Docker Desktop: https://www.docker.com/products/docker-desktop

### Configure AWS CLI
```bash
aws configure
# Enter your Access Key ID
# Enter your Secret Access Key
# Region: eu-north-1
# Output format: json
```

## Terraform Setup

### 1. Initialize Terraform
```bash
cd aether-orchestrate/infrastructure
terraform init
```

### 2. Create Staging Environment
```bash
terraform plan -var-file="environments/staging/terraform.tfvars"
terraform apply -var-file="environments/staging/terraform.tfvars"
```

### 3. Create Production Environment
```bash
terraform plan -var-file="environments/production/terraform.tfvars"
terraform apply -var-file="environments/production/terraform.tfvars"
```

## CI/CD Configuration

### GitHub Secrets Required
Add these secrets to your GitHub repository:

| Secret Name | Description |
|-------------|-------------|
| AWS_ACCESS_KEY_ID | IAM user access key |
| AWS_SECRET_ACCESS_KEY | IAM user secret key |
| ECR_REGISTRY | Your ECR registry URL |
| S3_BUCKET | Frontend S3 bucket name |
| CF_DISTRIBUTION_ID | CloudFront distribution ID |

### Workflow Triggers
- Push to `main` branch triggers production deployment
- Push to `develop` branch triggers staging deployment
- Pull requests run tests only

## Manual Deployment

### Deploy Backend
```bash
./scripts/deploy-backend.sh staging
./scripts/deploy-backend.sh production
```

### Deploy Frontend
```bash
./scripts/deploy-frontend.sh staging
./scripts/deploy-frontend.sh production
```

### Rollback
```bash
./scripts/rollback.sh staging
./scripts/rollback.sh production
```

## Environment Variables

All sensitive environment variables are stored in AWS Secrets Manager.
See `.env.staging.example` and `.env.production.example` for required variables.

### Adding Secrets to AWS
```bash
aws secretsmanager create-secret \
  --name aether-staging/api-keys \
  --secret-string '{"OPENROUTER_API_KEY":"xxx","TAVILY_API_KEY":"xxx"}'
```

## Infrastructure Outputs

After `terraform apply`, you will get:
- `alb_dns_name` - Backend API endpoint
- `cloudfront_domain` - Frontend URL
- `ecr_repository_url` - Docker image registry
- `rds_endpoint` - Database connection string
- `redis_endpoint` - Redis connection string

## Costs Estimate (Staging)

| Service | Monthly Cost |
|---------|-------------|
| ECS Fargate (1 task) | ~$15 |
| RDS db.t3.micro | ~$15 |
| ElastiCache cache.t3.micro | ~$12 |
| ALB | ~$16 |
| NAT Gateway | ~$32 |
| S3 + CloudFront | ~$5 |
| **Total** | **~$95/month** |

## Troubleshooting

### ECS Task Not Starting
```bash
aws ecs describe-tasks --cluster aether-staging-cluster --tasks <task-id>
```

### View Container Logs
```bash
aws logs tail /ecs/aether-staging-backend --follow
```

### Database Connection Issues
Ensure security groups allow traffic from ECS to RDS on port 5432.
