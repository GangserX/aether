variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "alb_arn" {
  description = "ARN of the ALB to associate with WAF"
  type        = string
}
