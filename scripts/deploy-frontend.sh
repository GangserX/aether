#!/bin/bash
set -e

# Deploy Frontend to S3/CloudFront
# Usage: ./deploy-frontend.sh <environment>

ENVIRONMENT=${1:-staging}

echo "Deploying frontend to $ENVIRONMENT"

AWS_REGION=${AWS_REGION:-eu-north-1}
S3_BUCKET="aether-$ENVIRONMENT-frontend"

# Build frontend
echo "Building frontend..."
npm run build

# Sync to S3
echo "Syncing to S3..."
aws s3 sync dist/ s3://$S3_BUCKET/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --region $AWS_REGION

# Update index.html with no-cache
aws s3 cp dist/index.html s3://$S3_BUCKET/index.html \
  --cache-control "no-cache, no-store, must-revalidate" \
  --region $AWS_REGION

# Get CloudFront distribution ID
CF_DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?DomainName=='$S3_BUCKET.s3.amazonaws.com']].Id" \
  --output text \
  --region $AWS_REGION)

if [ -n "$CF_DISTRIBUTION_ID" ]; then
  echo "Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id $CF_DISTRIBUTION_ID \
    --paths "/*" \
    --region $AWS_REGION
fi

echo "Frontend deployment complete!"
