variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "bot_instance_type" {
  description = "EC2 instance type for bot server (Free Tier eligible)"
  type        = string
  default     = "t2.micro" # Free Tier: 750 hours/month
}

variable "admin_instance_type" {
  description = "EC2 instance type for admin dashboard (Free Tier eligible)"
  type        = string
  default     = "t2.micro" # Free Tier: 750 hours/month
}

variable "waha_instance_type" {
  description = "EC2 instance type for Waha (Free Tier eligible)"
  type        = string
  default     = "t2.micro" # Free Tier: 750 hours/month (may need upgrade for multiple sessions)
}

variable "db_instance_class" {
  description = "RDS instance class (Free Tier eligible)"
  type        = string
  default     = "db.t2.micro" # Free Tier: 750 hours/month, 20GB storage
}

variable "enable_redis" {
  description = "Enable Redis cache (not Free Tier - set to false to save costs)"
  type        = bool
  default     = false # Disable for Free Tier, use in-memory caching
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type (only used if enable_redis = true)"
  type        = string
  default     = "cache.t2.micro" # Smallest available (not free)
}

variable "key_pair_name" {
  description = "Name of the SSH key pair to use for EC2 instances"
  type        = string
}

variable "ssh_cidr_block" {
  description = "CIDR block allowed to SSH into instances"
  type        = string
  default     = "0.0.0.0/0" # Restrict this in production!
}

variable "waha_api_key" {
  description = "API key for Waha authentication"
  type        = string
  sensitive   = true
}

variable "waha_dashboard_password" {
  description = "Password for Waha dashboard and Swagger UI"
  type        = string
  sensitive   = true
  default     = "WahaPlatform2024!"
}

variable "db_password" {
  description = "Password for RDS database"
  type        = string
  sensitive   = true
}

variable "enable_backups" {
  description = "Enable automated backups for RDS"
  type        = bool
  default     = true
}

variable "admin_email" {
  description = "Email for platform admin notifications"
  type        = string
  default     = ""
}
