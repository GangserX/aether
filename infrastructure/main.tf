terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = merge(var.tags, {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    })
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

module "vpc" {
  source             = "./modules/vpc"
  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "security" {
  source      = "./modules/security"
  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
}

module "ecr" {
  source      = "./modules/ecr"
  name_prefix = local.name_prefix
}
module "rds" {
  source            = "./modules/rds"
  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security.rds_security_group_id
  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  db_name           = var.db_name
  db_username       = var.db_username
  db_password       = random_password.db_password.result
}

module "elasticache" {
  source            = "./modules/elasticache"
  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security.redis_security_group_id
  node_type         = var.redis_node_type
  num_cache_nodes   = var.redis_num_cache_nodes
}

module "alb" {
  source            = "./modules/alb"
  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.public_subnet_ids
  security_group_id = module.security.alb_security_group_id
  certificate_arn   = var.certificate_arn
}

module "secrets" {
  source      = "./modules/secrets"
  name_prefix = local.name_prefix
  db_url      = "postgresql://${var.db_username}:${random_password.db_password.result}@${module.rds.endpoint}/${var.db_name}"
  jwt_secret  = random_password.jwt_secret.result
  redis_host  = module.elasticache.endpoint
  redis_port  = module.elasticache.port
}
module "ecs" {
  source             = "./modules/ecs"
  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_id  = module.security.backend_security_group_id
  target_group_arn   = module.alb.target_group_arn
  ecr_repository_url = module.ecr.repository_url
  cpu                = var.backend_cpu
  memory             = var.backend_memory
  desired_count      = var.backend_desired_count
  secrets_arn        = module.secrets.secrets_arn
  db_secret_arn      = module.secrets.db_secret_arn
  jwt_secret_arn     = module.secrets.jwt_secret_arn
}

module "s3_cloudfront" {
  source          = "./modules/s3-cloudfront"
  name_prefix     = local.name_prefix
  domain_name     = var.domain_name
  certificate_arn = var.certificate_arn
}

module "monitoring" {
  source           = "./modules/monitoring"
  name_prefix      = local.name_prefix
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  alb_arn_suffix   = module.alb.alb_arn_suffix
}

module "autoscaling" {
  source           = "./modules/autoscaling"
  name_prefix      = local.name_prefix
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  min_capacity     = var.backend_min_count
  max_capacity     = var.backend_max_count
}
