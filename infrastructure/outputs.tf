output "vpc_id" {
  value = module.vpc.vpc_id
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "alb_dns_name" {
  value = module.alb.dns_name
}

output "cloudfront_domain" {
  value = module.s3_cloudfront.cloudfront_domain
}

output "cloudfront_distribution_id" {
  value = module.s3_cloudfront.distribution_id
}

output "s3_bucket_name" {
  value = module.s3_cloudfront.bucket_name
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = module.elasticache.endpoint
  sensitive = true
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecs_service_name" {
  value = module.ecs.service_name
}
