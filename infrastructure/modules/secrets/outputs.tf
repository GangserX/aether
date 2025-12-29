output "secrets_arn" { value = aws_secretsmanager_secret.api_keys.arn }
output "db_secret_arn" { value = aws_secretsmanager_secret.db.arn }
output "jwt_secret_arn" { value = aws_secretsmanager_secret.jwt.arn }
