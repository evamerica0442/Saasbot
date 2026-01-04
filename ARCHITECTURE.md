# Multi-Tenant WhatsApp Bot SaaS Platform
## Architecture Overview

## Platform Vision

A scalable SaaS platform that allows multiple businesses to run WhatsApp ordering bots with:
- Self-service business onboarding
- Plugin system for different business types (restaurants, pharmacies, retail, etc.)
- Centralized management dashboard
- Usage tracking and billing
- Per-tenant customization

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     AWS Infrastructure                           │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Admin      │    │   Bot        │    │   Waha       │     │
│  │   Dashboard  │◄───┤   Server     │◄───┤   Container  │     │
│  │   (React)    │    │   (Node.js)  │    │   (Docker)   │     │
│  │   Port: 3001 │    │   Port: 4000 │    │   Port: 3000 │     │
│  └──────┬───────┘    └──────┬───────┘    └──────────────┘     │
│         │                   │                                   │
│         │                   │                                   │
│         └───────────────────┴───────────────┐                  │
│                                             │                  │
│                                    ┌────────▼────────┐         │
│                                    │   PostgreSQL    │         │
│                                    │   Multi-tenant  │         │
│                                    │   Database      │         │
│                                    └─────────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Redis Cache                            │  │
│  │  (Sessions, Rate Limiting, Conversation State)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tenants Table
```sql
tenants (
  id UUID PRIMARY KEY,
  business_name VARCHAR(255),
  phone_number VARCHAR(20) UNIQUE,
  whatsapp_session_id VARCHAR(100),
  plugin_type VARCHAR(50), -- 'restaurant', 'pharmacy', 'retail'
  status VARCHAR(20), -- 'active', 'suspended', 'trial'
  settings JSONB,
  created_at TIMESTAMP,
  subscription_tier VARCHAR(20) -- 'free', 'basic', 'premium'
)
```

### Orders Table
```sql
orders (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  customer_phone VARCHAR(20),
  items JSONB,
  total DECIMAL(10,2),
  delivery_address TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP
)
```

### Menu Items Table
```sql
menu_items (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  item_id VARCHAR(10),
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  category VARCHAR(50),
  available BOOLEAN DEFAULT true,
  image_url VARCHAR(500)
)
```

### Usage Tracking
```sql
usage_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  message_count INTEGER,
  date DATE,
  cost DECIMAL(10,2)
)
```

## Plugin System Architecture

### Plugin Structure
```
plugins/
├── restaurant/
│   ├── plugin.js           # Main plugin logic
│   ├── workflow.js         # Order flow
│   ├── menu-handler.js     # Menu formatting
│   └── config.json         # Plugin metadata
├── pharmacy/
│   ├── plugin.js
│   ├── workflow.js
│   ├── prescription-handler.js
│   └── config.json
└── retail/
    ├── plugin.js
    ├── workflow.js
    ├── catalog-handler.js
    └── config.json
```

### Plugin Interface
```javascript
class BasePlugin {
  constructor(tenant) {
    this.tenant = tenant;
  }
  
  async handleIncomingMessage(message, customerPhone) {
    // Override in plugin
  }
  
  async formatMenu() {
    // Override in plugin
  }
  
  async processOrder(items, customerInfo) {
    // Override in plugin
  }
  
  async sendNotification(orderId, status) {
    // Override in plugin
  }
}
```

## Application Flow

### Business Onboarding
1. Business owner visits admin dashboard
2. Signs up with email/business info
3. Selects business type (restaurant/pharmacy/retail)
4. Gets assigned a WhatsApp session
5. Scans QR code to connect WhatsApp
6. Uploads menu/catalog
7. Bot goes live!

### Customer Order Flow
1. Customer messages WhatsApp number
2. Bot identifies tenant by phone number
3. Loads tenant plugin and configuration
4. Executes plugin workflow
5. Processes order
6. Saves to database with tenant_id
7. Sends notifications

### Admin Dashboard Features
- Business management (CRUD)
- Menu/catalog editor
- Order monitoring
- Analytics & reports
- Usage & billing
- WhatsApp session management
- Plugin configuration

## Deployment Strategy

### Infrastructure Components (Terraform)

1. **Networking**
   - VPC with public/private subnets
   - Security groups
   - Load balancer (for admin dashboard)

2. **Compute**
   - Admin Dashboard EC2 (t3.small)
   - Bot Server EC2 (t3.medium - scales with tenants)
   - Waha EC2 (t3.large - handles multiple sessions)

3. **Database**
   - RDS PostgreSQL (db.t3.small)
   - Automated backups
   - Multi-AZ for production

4. **Cache**
   - ElastiCache Redis (cache.t3.micro)

5. **Storage**
   - S3 for menu images
   - CloudFront for CDN (optional)

### Scaling Strategy

**Phase 1: Single Server (0-50 tenants)**
- Current architecture
- Vertical scaling (larger instances)

**Phase 2: Horizontal Scaling (50-500 tenants)**
- Auto Scaling Groups
- Application Load Balancer
- Multiple Waha instances

**Phase 3: Microservices (500+ tenants)**
- Separate services per function
- Kubernetes (EKS)
- Message queues (SQS)

## Security & Isolation

### Tenant Isolation
- Row-level security in PostgreSQL
- API key per tenant
- Rate limiting per tenant
- Separate WhatsApp sessions

### Data Protection
- Encryption at rest (RDS)
- Encryption in transit (TLS/SSL)
- Regular backups
- GDPR compliance

## Monetization Model

### Subscription Tiers

**Free Tier** ($0/month)
- 1 WhatsApp number
- 100 messages/month
- Basic menu (20 items)
- Email support

**Basic Tier** ($29/month)
- 1 WhatsApp number
- 1,000 messages/month
- Unlimited menu items
- Basic analytics
- Priority support

**Premium Tier** ($99/month)
- Multiple WhatsApp numbers
- 10,000 messages/month
- Advanced analytics
- Custom branding
- API access
- Dedicated support

**Enterprise** (Custom pricing)
- Unlimited everything
- White-label option
- Custom plugins
- SLA guarantee

## Tech Stack

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **ORM:** Prisma or TypeORM

### Admin Dashboard
- **Framework:** React 18
- **UI Library:** Material-UI or Tailwind
- **State Management:** Redux or Context API
- **API Client:** Axios

### Infrastructure
- **IaC:** Terraform
- **Container:** Docker
- **CI/CD:** GitHub Actions
- **Monitoring:** CloudWatch

### WhatsApp Integration
- **API:** Waha (WhatsApp HTTP API)
- **Sessions:** Multi-session support
- **Media:** S3 for images/documents

## Development Roadmap

### Phase 1: MVP (Week 1-2)
- [ ] Multi-tenant database schema
- [ ] Tenant routing logic
- [ ] Restaurant plugin (base functionality)
- [ ] Basic admin dashboard
- [ ] Terraform infrastructure

### Phase 2: Core Features (Week 3-4)
- [ ] User authentication
- [ ] Menu management UI
- [ ] Order monitoring
- [ ] Usage tracking
- [ ] Pharmacy plugin

### Phase 3: Scale & Polish (Week 5-6)
- [ ] Billing integration (Stripe)
- [ ] Analytics dashboard
- [ ] Email notifications
- [ ] Retail plugin
- [ ] API documentation

### Phase 4: Advanced (Week 7-8)
- [ ] Custom plugin builder
- [ ] Webhook integrations
- [ ] Mobile app (React Native)
- [ ] White-label option
- [ ] Multi-language support

## Cost Estimation

### Development Costs (One-time)
- Architecture & Design: $2,000
- Backend Development: $8,000
- Admin Dashboard: $6,000
- Testing & QA: $2,000
- **Total: ~$18,000**

### Infrastructure Costs (Monthly)

**MVP Stage (0-10 tenants):**
- Admin EC2 (t3.small): $15
- Bot EC2 (t3.medium): $30
- Waha EC2 (t3.large): $60
- RDS (db.t3.small): $30
- Redis (cache.t3.micro): $15
- S3 & Bandwidth: $10
- **Total: ~$160/month**

**Growth Stage (50 tenants):**
- Load Balancer: $20
- Larger instances: $200
- RDS (db.t3.medium): $60
- Redis (cache.t3.small): $30
- S3 & Bandwidth: $50
- **Total: ~$360/month**

### Revenue Projections

**Conservative (Year 1):**
- 10 Free users (trial)
- 30 Basic users ($29) = $870/month
- 10 Premium users ($99) = $990/month
- **Total: ~$1,860/month = $22,320/year**

**Net Profit Year 1:** $22,320 - ($360 × 12) = **$18,000**

**Optimistic (Year 2):**
- 100 Basic users = $2,900/month
- 30 Premium users = $2,970/month
- 5 Enterprise users ($500) = $2,500/month
- **Total: ~$8,370/month = $100,440/year**

## Next Steps

1. **Review architecture** - Confirm approach
2. **Create Terraform configs** - Multi-tenant infrastructure
3. **Build database schema** - Multi-tenant tables
4. **Develop bot server** - Tenant routing + plugins
5. **Create admin dashboard** - Business management
6. **Deploy & test** - End-to-end testing
7. **Launch MVP** - First customers!

## Files to Create

1. `terraform/multi-tenant/main.tf` - Infrastructure
2. `bot-server/src/tenant-router.js` - Tenant routing
3. `bot-server/src/plugins/base-plugin.js` - Plugin interface
4. `bot-server/src/plugins/restaurant/plugin.js` - Restaurant plugin
5. `admin-dashboard/src/` - React application
6. `database/migrations/` - Database schema
7. `docs/API.md` - API documentation

Ready to start building? 🚀
