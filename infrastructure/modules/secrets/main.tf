resource "aws_secretsmanager_secret" "db" {
  name = "${var.name_prefix}/database-url"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = var.db_url
}

resource "aws_secretsmanager_secret" "jwt" {
  name = "${var.name_prefix}/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "api_keys" {
  name = "${var.name_prefix}/api-keys"
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    redis_host = var.redis_host
    redis_port = var.redis_port
  })
}
