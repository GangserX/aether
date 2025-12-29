#!/bin/bash
set -e

# Rollback ECS service to previous task definition
# Usage: ./rollback.sh <environment>

ENVIRONMENT=${1:-staging}

echo "Rolling back $ENVIRONMENT backend..."

AWS_REGION=${AWS_REGION:-eu-north-1}
CLUSTER="aether-$ENVIRONMENT-cluster"
SERVICE="aether-$ENVIRONMENT-backend"

# Get current task definition
CURRENT_TASK_DEF=$(aws ecs describe-services \
  --cluster $CLUSTER \
  --services $SERVICE \
  --query "services[0].taskDefinition" \
  --output text \
  --region $AWS_REGION)

echo "Current task definition: $CURRENT_TASK_DEF"

# Get task definition family
TASK_FAMILY=$(echo $CURRENT_TASK_DEF | sed 's/:.*$//' | sed 's/.*\///')

# Get previous revision
CURRENT_REVISION=$(echo $CURRENT_TASK_DEF | sed 's/.*://')
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))

if [ $PREVIOUS_REVISION -lt 1 ]; then
  echo "Error: No previous revision to rollback to"
  exit 1
fi

PREVIOUS_TASK_DEF="$TASK_FAMILY:$PREVIOUS_REVISION"
echo "Rolling back to: $PREVIOUS_TASK_DEF"

# Update service with previous task definition
aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --task-definition $PREVIOUS_TASK_DEF \
  --region $AWS_REGION

echo "Waiting for rollback to complete..."
aws ecs wait services-stable \
  --cluster $CLUSTER \
  --services $SERVICE \
  --region $AWS_REGION

echo "Rollback complete!"
