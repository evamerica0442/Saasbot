# Multi-Tenant WhatsApp Bot Platform - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- AWS Account with credentials configured
- Terraform installed (1.0+)
- SSH key pair created in AWS
- Domain name (optional, for production)

### Estimated Costs

**MVP / Development:**
- Bot Server (t3.medium): $30/month
- Admin Dashboard (t3.small): $15/month
- Waha (t3.large): $60/month
- RDS PostgreSQL (db.t3.small): $30/month
- Redis (cache.t3.micro): $15/month
- **Total: ~$150/month** (handles 10-50 tenants)

**Production (50-200 tenants):**
- Larger instances + Multi-AZ + Backups: **~$400/month**

**Revenue Potential:**
- 50 tenants × $29/month = **$1,450/month**
- **Net profit: ~$1,300/month** after infrastructure costs

## Step-by-Step Deployment

### Phase 1: Infrastructure Setup

#### 1. Clone and Prepare

```bash
cd multi-tenant/terraform
cp terraform.tfvars.example terraform.tfvars
```

#### 2. Configure Variables

Edit `terraform.tfvars`:

```hcl
aws_region          = "us-east-1"
environment         = "production"
key_pair_name       = "your-key-pair-name"
ssh_cidr_block      = "YOUR_IP/32"  # Your IP only
waha_api_key        = "GenerateAStrongRandomKey123"
waha_dashboard_password = "StrongPassword456!"
db_password         = "DatabasePassword789!"
enable_backups      = true
admin_email         = "admin@yourdomain.com"
```

#### 3. Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review plan
terraform plan

# Deploy (takes 10-15 minutes)
terraform apply

# Save outputs
terraform output > deployment-info.txt
```

### Phase 2: Database Setup

#### 1. Connect to Database

```bash
# Get database endpoint from outputs
DB_HOST=$(terraform output -raw database_endpoint | cut -d: -f1)

# Connect
PGPASSWORD='your-db-password' psql -h $DB_HOST -U dbadmin -d whatsappplatform
```

#### 2. Apply Schema

```bash
# Copy schema to bot server
scp -i ~/.ssh/your-key.pem ../database/schema.sql ubuntu@<BOT_SERVER_IP>:~

# SSH into bot server
ssh -i ~/.ssh/your-key.pem ubuntu@<BOT_SERVER_IP>

# Apply schema
PGPASSWORD='your-db-password' psql -h <DB_HOST> -U dbadmin -d whatsappplatform -f schema.sql
```

### Phase 3: Connect WhatsApp Sessions

#### 1. Access Waha Dashboard

```
URL: http://<WAHA_PUBLIC_IP>:3000
Username: admin
Password: (from terraform.tfvars)
```

#### 2. Create Sessions

For each business tenant you want to onboard:
1. Click "Add Session"
2. Session name: `tenant-{business-name}` (e.g., `tenant-victoria-fisheries`)
3. Scan QR code with WhatsApp Business app
4. Wait for "WORKING" status

### Phase 4: Create First Tenant

#### Via Admin Dashboard UI (coming soon)

OR

#### Via Direct Database Insert

```sql
-- Insert tenant
INSERT INTO tenants (
    business_name,
    business_email,
    phone_number,
    whatsapp_session_id,
    plugin_type,
    address,
    city,
    subscription_tier,
    status
) VALUES (
    'Victoria Fisheries',
    'info@victoriafisheries.co.za',
    '27722560877',
    'tenant-victoria-fisheries',  -- Match Waha session name
    'restaurant',
    '3 Ryke Street, Grabouw',
    'Grabouw',
    'premium',
    'active'
);

-- Get the tenant ID
SELECT id FROM tenants WHERE business_email = 'info@victoriafisheries.co.za';

-- Insert menu items (using tenant ID from above)
INSERT INTO menu_items (tenant_id, item_code, name, price, category) VALUES
('<TENANT_ID>', '01', 'Mini Chips', 25.00, 'Chips'),
('<TENANT_ID>', '02', 'Small Chips', 35.00, 'Chips'),
('<TENANT_ID>', '07', '1 Piece Snoek', 40.00, 'Snoek'),
('<TENANT_ID>', '17', 'Calamari (200g)', 75.00, 'Calamari');
```

### Phase 5: Configure Webhook

The webhook should auto-configure, but verify:

```bash
# Check webhook
curl -H "X-Api-Key: YOUR_WAHA_KEY" http://<WAHA_IP>:3000/api/webhooks

# If not configured, add manually
curl -X POST http://<WAHA_IP>:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_WAHA_KEY" \
  -d '{
    "url": "http://<BOT_PRIVATE_IP>:4000/webhook",
    "events": ["message"],
    "session": "tenant-victoria-fisheries"
  }'
```

### Phase 6: Test the System

#### 1. Send Test Message

From a customer phone, send WhatsApp message to the business number:
```
menu
```

Expected response: Full menu display

#### 2. Place Test Order

```
#01 #07
```

Expected response: Order summary

```
123 Test Street
```

Expected response: Order confirmation

#### 3. Check Logs

```bash
# Bot server logs
ssh ubuntu@<BOT_IP>
sudo journalctl -u whatsapp-bot -f

# Check database
psql -h <DB_HOST> -U dbadmin -d whatsappplatform -c "SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;"
```

## Architecture Details

### Component Responsibilities

**Bot Server (Port 4000)**
- Receives webhooks from Waha
- Routes messages to correct tenant
- Loads appropriate plugin
- Processes orders
- Manages conversation state

**Admin Dashboard (Port 3001)**
- Business management UI
- Menu/catalog editor
- Order monitoring
- Analytics
- User management

**Waha (Port 3000)**
- WhatsApp API gateway
- Multiple session management
- QR code generation
- Message sending/receiving

**PostgreSQL**
- Multi-tenant data storage
- Orders, menus, tenants
- Audit logs

**Redis**
- Conversation state caching
- Rate limiting
- Session management

## Operations

### Adding a New Tenant

#### Method 1: Via Admin Dashboard
1. Login to dashboard
2. Click "Add Business"
3. Fill in business details
4. Select plugin type
5. Upload menu
6. Connect WhatsApp

#### Method 2: Via API
```bash
curl -X POST http://<BOT_IP>:4000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "New Restaurant",
    "business_email": "contact@newrestaurant.com",
    "phone_number": "27821234567",
    "plugin_type": "restaurant",
    "address": "123 Main St",
    "city": "Cape Town"
  }'
```

### Monitoring

#### Check System Health
```bash
curl http://<BOT_IP>:4000/health
```

#### View Statistics
```bash
curl http://<BOT_IP>:4000/api/system/stats
```

#### Tenant-Specific Stats
```bash
curl http://<BOT_IP>:4000/api/tenants/<TENANT_ID>/stats
```

### Scaling

#### When to Scale Up

Scale when:
- CPU usage consistently > 70%
- Memory usage > 80%
- Response times > 2 seconds
- Database connections maxed out

#### Vertical Scaling (Easier)
```hcl
# In terraform.tfvars
bot_instance_type = "t3.large"   # from t3.medium
waha_instance_type = "t3.xlarge" # from t3.large
db_instance_class = "db.t3.medium" # from db.t3.small
```

Then:
```bash
terraform apply
```

#### Horizontal Scaling (More complex)
- Add Auto Scaling Groups
- Add Application Load Balancer
- Multiple bot servers
- Read replicas for database

### Backup and Recovery

#### Automated Backups
If `enable_backups = true`, RDS takes daily snapshots (7-day retention).

#### Manual Backup
```bash
aws rds create-db-snapshot \
  --db-instance-identifier whatsapp-bot-platform-db \
  --db-snapshot-identifier manual-backup-$(date +%Y%m%d)
```

#### Restore from Backup
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier whatsapp-bot-platform-db-restored \
  --db-snapshot-identifier manual-backup-YYYYMMDD
```

### Security

#### Restrict SSH Access
```hcl
# In terraform.tfvars
ssh_cidr_block = "YOUR_IP/32"
```

#### Enable SSL/TLS
1. Get SSL certificate (Let's Encrypt or ACM)
2. Add Load Balancer
3. Configure HTTPS

#### Rotate Passwords
```bash
# Database password
aws rds modify-db-instance \
  --db-instance-identifier whatsapp-bot-platform-db \
  --master-user-password 'new-password' \
  --apply-immediately

# Update .env on bot server
ssh ubuntu@<BOT_IP>
sudo nano /opt/whatsapp-bot/src/.env
sudo systemctl restart whatsapp-bot
```

## Troubleshooting

### Bot Not Receiving Messages

**Check:**
1. Waha webhook configured
2. WhatsApp session is active
3. Bot service is running
4. Firewall allows port 4000

```bash
# Check webhook
curl -H "X-Api-Key: KEY" http://<WAHA_IP>:3000/api/webhooks

# Check bot service
ssh ubuntu@<BOT_IP>
sudo systemctl status whatsapp-bot

# Check logs
sudo journalctl -u whatsapp-bot -f
```

### Database Connection Errors

**Check:**
1. Security group allows connection
2. Credentials are correct
3. Database is running

```bash
# Test connection
PGPASSWORD='password' psql -h <DB_HOST> -U dbadmin -d whatsappplatform -c "SELECT 1"
```

### High CPU/Memory Usage

**Solutions:**
1. Increase instance size
2. Add caching (Redis)
3. Optimize database queries
4. Add read replicas

### Tenant Plugin Not Loading

**Check:**
1. Plugin type is correct in database
2. Plugin file exists
3. No JavaScript errors

```bash
# Check logs for plugin errors
sudo journalctl -u whatsapp-bot | grep -i plugin
```

## Maintenance

### Weekly Tasks
- [ ] Review error logs
- [ ] Check disk space
- [ ] Monitor costs
- [ ] Review usage stats

### Monthly Tasks
- [ ] Apply security updates
- [ ] Review and rotate credentials
- [ ] Analyze performance metrics
- [ ] Backup database manually

### Quarterly Tasks
- [ ] Review and optimize costs
- [ ] Plan capacity scaling
- [ ] Update dependencies
- [ ] Disaster recovery drill

## Support and Next Steps

### Enhancements to Add
1. Admin Dashboard UI (React)
2. Billing integration (Stripe)
3. Email notifications
4. SMS fallback
5. Mobile app
6. API documentation
7. Webhook builder
8. Analytics dashboard
9. A/B testing
10. Multi-language support

### Getting Help
- Review logs in CloudWatch
- Check `ARCHITECTURE.md` for details
- Review database schema in `schema.sql`
- Check plugin code for business logic

## Success Checklist

- [ ] Infrastructure deployed successfully
- [ ] Database schema applied
- [ ] At least one tenant created
- [ ] WhatsApp session connected
- [ ] Webhook configured
- [ ] Test order completed
- [ ] Logs show no errors
- [ ] Monitoring configured
- [ ] Backups enabled
- [ ] Security hardened

**Congratulations! Your multi-tenant WhatsApp bot platform is live! 🎉**
