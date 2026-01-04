terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ============================================================================
# VPC AND NETWORKING
# ============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "whatsapp-bot-platform-vpc"
    Environment = var.environment
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "whatsapp-bot-platform-igw"
    Environment = var.environment
  }
}

resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name        = "whatsapp-bot-platform-public-1"
    Environment = var.environment
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name        = "whatsapp-bot-platform-public-2"
    Environment = var.environment
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "whatsapp-bot-platform-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# ============================================================================
# SECURITY GROUPS
# ============================================================================

# Bot Server Security Group
resource "aws_security_group" "bot_server" {
  name        = "whatsapp-bot-server-sg"
  description = "Security group for multi-tenant bot server"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP for bot API"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr_block]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "whatsapp-bot-server-sg"
    Environment = var.environment
  }
}

# Admin Dashboard Security Group
resource "aws_security_group" "admin_dashboard" {
  name        = "whatsapp-admin-dashboard-sg"
  description = "Security group for admin dashboard"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Admin Dashboard"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr_block]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "whatsapp-admin-dashboard-sg"
    Environment = var.environment
  }
}

# Waha Security Group
resource "aws_security_group" "waha" {
  name        = "whatsapp-waha-sg"
  description = "Security group for Waha container"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Waha API"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr_block]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "whatsapp-waha-sg"
    Environment = var.environment
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "whatsapp-rds-sg"
  description = "Security group for RDS database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from bot server"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.bot_server.id, aws_security_group.admin_dashboard.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "whatsapp-rds-sg"
    Environment = var.environment
  }
}

# Redis Security Group
resource "aws_security_group" "redis" {
  name        = "whatsapp-redis-sg"
  description = "Security group for Redis cache"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from bot server"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.bot_server.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "whatsapp-redis-sg"
    Environment = var.environment
  }
}

# ============================================================================
# IAM ROLES
# ============================================================================

resource "aws_iam_role" "ec2_role" {
  name = "whatsapp-bot-platform-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "whatsapp-bot-platform-ec2-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ec2_s3" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "whatsapp-bot-platform-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# ============================================================================
# EC2 INSTANCES
# ============================================================================

# Bot Server
resource "aws_instance" "bot_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.bot_instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.bot_server.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.key_pair_name

  user_data = templatefile("${path.module}/user-data-bot.sh", {
    waha_url     = "http://${aws_instance.waha.private_ip}:3000"
    waha_api_key = var.waha_api_key
    db_host      = aws_db_instance.main.address
    db_name      = aws_db_instance.main.db_name
    db_user      = aws_db_instance.main.username
    db_password  = var.db_password
    redis_host   = var.enable_redis ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : ""
  })

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = {
    Name        = "whatsapp-bot-server"
    Environment = var.environment
  }
}

# Admin Dashboard
resource "aws_instance" "admin_dashboard" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.admin_instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.admin_dashboard.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.key_pair_name

  user_data = templatefile("${path.module}/user-data-admin.sh", {
    bot_api_url = "http://${aws_instance.bot_server.private_ip}:4000"
    db_host     = aws_db_instance.main.address
    db_name     = aws_db_instance.main.db_name
    db_user     = aws_db_instance.main.username
    db_password = var.db_password
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name        = "whatsapp-admin-dashboard"
    Environment = var.environment
  }
}

# Waha Server
resource "aws_instance" "waha" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.waha_instance_type
  subnet_id              = aws_subnet.public_1.id
  vpc_security_group_ids = [aws_security_group.waha.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.key_pair_name

  user_data = templatefile("${path.module}/user-data-waha.sh", {
    waha_api_key            = var.waha_api_key
    waha_dashboard_password = var.waha_dashboard_password
  })

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
  }

  tags = {
    Name        = "whatsapp-waha-server"
    Environment = var.environment
  }
}

# ============================================================================
# RDS POSTGRESQL
# ============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "whatsapp-bot-platform-db-subnet"
  subnet_ids = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  tags = {
    Name        = "whatsapp-bot-platform-db-subnet"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  identifier              = "whatsapp-bot-platform-db"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.db_instance_class
  allocated_storage       = 20  # Free Tier: 20GB
  storage_type            = "gp2" # gp2 is Free Tier eligible
  db_name                 = "whatsappplatform"
  username                = "dbadmin"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = true
  publicly_accessible     = false
  backup_retention_period = var.enable_backups ? 7 : 0
  multi_az                = false # Free Tier is single-AZ only

  tags = {
    Name        = "whatsapp-bot-platform-db"
    Environment = var.environment
  }
}

# ============================================================================
# ELASTICACHE REDIS (OPTIONAL - NOT FREE TIER)
# ============================================================================

resource "aws_elasticache_subnet_group" "redis" {
  count      = var.enable_redis ? 1 : 0
  name       = "whatsapp-bot-platform-redis-subnet"
  subnet_ids = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  tags = {
    Name        = "whatsapp-bot-platform-redis-subnet"
    Environment = var.environment
  }
}

resource "aws_elasticache_cluster" "redis" {
  count                = var.enable_redis ? 1 : 0
  cluster_id           = "whatsapp-bot-redis"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis[0].name
  security_group_ids   = [aws_security_group.redis.id]

  tags = {
    Name        = "whatsapp-bot-platform-redis"
    Environment = var.environment
  }
}

# ============================================================================
# S3 BUCKET (for menu images, etc.)
# ============================================================================

resource "aws_s3_bucket" "media" {
  bucket = "whatsapp-bot-platform-media-${var.environment}"

  tags = {
    Name        = "whatsapp-bot-platform-media"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# ============================================================================
# DATA SOURCES
# ============================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
