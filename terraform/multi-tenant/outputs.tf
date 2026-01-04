output "bot_server_public_ip" {
  description = "Public IP of the bot server"
  value       = aws_instance.bot_server.public_ip
}

output "admin_dashboard_public_ip" {
  description = "Public IP of the admin dashboard"
  value       = aws_instance.admin_dashboard.public_ip
}

output "waha_public_ip" {
  description = "Public IP of the Waha server"
  value       = aws_instance.waha.public_ip
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  description = "Redis cache endpoint (if enabled)"
  value       = var.enable_redis ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : "Redis disabled (Free Tier mode)"
}

output "s3_bucket_name" {
  description = "S3 bucket for media storage"
  value       = aws_s3_bucket.media.bucket
}

output "admin_dashboard_url" {
  description = "Admin Dashboard URL"
  value       = "http://${aws_instance.admin_dashboard.public_ip}:3001"
}

output "waha_dashboard_url" {
  description = "Waha Dashboard URL"
  value       = "http://${aws_instance.waha.public_ip}:3000"
}

output "bot_api_url" {
  description = "Bot API URL (internal)"
  value       = "http://${aws_instance.bot_server.private_ip}:4000"
}

output "ssh_commands" {
  description = "SSH commands to connect to instances"
  value = {
    bot_server      = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_instance.bot_server.public_ip}"
    admin_dashboard = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_instance.admin_dashboard.public_ip}"
    waha            = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_instance.waha.public_ip}"
  }
}

output "platform_info" {
  description = "Platform deployment information"
  value = {
    environment        = var.environment
    region            = var.aws_region
    database_name     = aws_db_instance.main.db_name
    multi_az_enabled  = aws_db_instance.main.multi_az
    backups_enabled   = var.enable_backups
  }
}

output "quick_start_guide" {
  description = "Quick start commands"
  value = <<-EOT
    
    🎉 WhatsApp Bot Platform Deployed Successfully!
    
    1. Access Admin Dashboard:
       URL: http://${aws_instance.admin_dashboard.public_ip}:3001
    
    2. Access Waha Dashboard:
       URL: http://${aws_instance.waha.public_ip}:3000
       Username: admin
       Password: ${var.waha_dashboard_password}
    
    3. Check Bot Server Status:
       ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_instance.bot_server.public_ip}
       sudo systemctl status whatsapp-bot
    
    4. View Bot Logs:
       ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_instance.bot_server.public_ip}
       sudo journalctl -u whatsapp-bot -f
    
    5. Initialize Database:
       The schema will be auto-applied on first run.
       Manual: psql -h ${aws_db_instance.main.address} -U dbadmin -d ${aws_db_instance.main.db_name}
    
    6. Add First Tenant:
       Use the Admin Dashboard or API to create your first business tenant.
    
    📖 Full documentation: /multi-tenant/ARCHITECTURE.md
  EOT
  sensitive = true
}
