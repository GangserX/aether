#!/bin/bash
set -e

# Deploy Backend to ECS
# Usage: ./deploy-backend.sh <environment> [image-tag]

ENVIRONMENT=${1:-staging}
IMAGE_TAG=${2:-latest}

echo "Deploying backend to $ENVIRONMENT with tag $IMAGE_TAG"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-eu-north-1}
ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
ECR_REPOSITORY="aether-$ENVIRONMENT-backend"

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push image
echo "Building Docker image..."
docker build -t $ECR_REPOSITORY:$IMAGE_TAG -f backend/Dockerfile backend/

echo "Tagging image..."
docker tag $ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

echo "Pushing to ECR..."
docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

# Update ECS service
echo "Updating ECS service..."
aws ecs update-service \
  --cluster aether-$ENVIRONMENT-cluster \
  --service aether-$ENVIRONMENT-backend \
  --force-new-deployment \
  --region $AWS_REGION

echo "Waiting for deployment to complete..."
aws ecs wait services-stable \
  --cluster aether-$ENVIRONMENT-cluster \
  --services aether-$ENVIRONMENT-backend \
  --region $AWS_REGION

echo "Backend deployment complete!"
