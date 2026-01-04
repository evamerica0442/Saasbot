-- Multi-Tenant WhatsApp Bot Platform - Database Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    business_email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    whatsapp_session_id VARCHAR(100) UNIQUE,
    
    -- Business details
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(2) DEFAULT 'ZA',
    timezone VARCHAR(50) DEFAULT 'Africa/Johannesburg',
    
    -- Plugin configuration
    plugin_type VARCHAR(50) NOT NULL, -- 'restaurant', 'pharmacy', 'retail', 'custom'
    plugin_config JSONB DEFAULT '{}',
    
    -- Status and subscription
    status VARCHAR(20) DEFAULT 'trial', -- 'trial', 'active', 'suspended', 'cancelled'
    subscription_tier VARCHAR(20) DEFAULT 'free', -- 'free', 'basic', 'premium', 'enterprise'
    trial_ends_at TIMESTAMP,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}', -- { logo, colors, emoji }
    
    -- Limits
    monthly_message_limit INTEGER DEFAULT 100,
    monthly_message_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP,
    
    -- Indexes
    CONSTRAINT valid_plugin_type CHECK (plugin_type IN ('restaurant', 'pharmacy', 'retail', 'custom')),
    CONSTRAINT valid_status CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    CONSTRAINT valid_tier CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise'))
);

CREATE INDEX idx_tenants_phone ON tenants(phone_number);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_session ON tenants(whatsapp_session_id);

-- ============================================================================
-- MENU ITEMS TABLE
-- ============================================================================
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Item details
    item_code VARCHAR(20) NOT NULL, -- e.g., '01', '02A', 'P001'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    
    -- Availability
    available BOOLEAN DEFAULT true,
    stock_quantity INTEGER,
    
    -- Media
    image_url VARCHAR(500),
    
    -- Metadata
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Custom fields per plugin
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(tenant_id, item_code)
);

CREATE INDEX idx_menu_items_tenant ON menu_items(tenant_id);
CREATE INDEX idx_menu_items_category ON menu_items(tenant_id, category);
CREATE INDEX idx_menu_items_available ON menu_items(tenant_id, available);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number SERIAL,
    
    -- Customer information
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255),
    
    -- Order details
    items JSONB NOT NULL, -- Array of { item_id, name, price, quantity }
    total DECIMAL(10,2) NOT NULL,
    
    -- Delivery/Pickup
    delivery_type VARCHAR(20) DEFAULT 'delivery', -- 'delivery', 'pickup'
    delivery_address TEXT,
    delivery_notes TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_ready_time TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_order_status CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
    CONSTRAINT valid_delivery_type CHECK (delivery_type IN ('delivery', 'pickup'))
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_customer ON orders(tenant_id, customer_phone);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_created ON orders(tenant_id, created_at DESC);

-- ============================================================================
-- CONVERSATION STATE TABLE
-- ============================================================================
CREATE TABLE conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    
    -- State data
    current_step VARCHAR(50) NOT NULL, -- 'idle', 'viewing_menu', 'awaiting_address', etc.
    state_data JSONB DEFAULT '{}', -- { items: [], total: 0, etc. }
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Auto-expire after 30 minutes
    
    -- Constraints
    UNIQUE(tenant_id, customer_phone)
);

CREATE INDEX idx_conversation_tenant_customer ON conversation_state(tenant_id, customer_phone);
CREATE INDEX idx_conversation_expires ON conversation_state(expires_at);

-- ============================================================================
-- USAGE LOGS TABLE
-- ============================================================================
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Usage metrics
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    
    -- API usage
    api_calls INTEGER DEFAULT 0,
    
    -- Cost calculation
    calculated_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_usage_tenant_date ON usage_logs(tenant_id, date DESC);

-- ============================================================================
-- ADMIN USERS TABLE
-- ============================================================================
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- User details
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    
    -- Role and permissions
    role VARCHAR(20) DEFAULT 'owner', -- 'owner', 'admin', 'staff'
    permissions JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'staff'))
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_tenant ON admin_users(tenant_id);

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Webhook details
    url VARCHAR(500) NOT NULL,
    event_types TEXT[] NOT NULL, -- ['order.created', 'order.updated', etc.]
    secret VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Statistics
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- 'order.created', 'menu.updated', 'settings.changed'
    entity_type VARCHAR(50), -- 'order', 'menu_item', 'tenant'
    entity_id UUID,
    
    -- Details
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_state_updated_at BEFORE UPDATE ON conversation_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reset monthly message count on 1st of each month
CREATE OR REPLACE FUNCTION reset_monthly_message_count()
RETURNS void AS $$
BEGIN
    UPDATE tenants 
    SET monthly_message_count = 0
    WHERE EXTRACT(DAY FROM CURRENT_TIMESTAMP) = 1;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired conversation states
CREATE OR REPLACE FUNCTION cleanup_expired_conversations()
RETURNS void AS $$
BEGIN
    DELETE FROM conversation_state
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Daily statistics per tenant
CREATE VIEW daily_tenant_stats AS
SELECT 
    t.id as tenant_id,
    t.business_name,
    DATE(o.created_at) as date,
    COUNT(o.id) as order_count,
    SUM(o.total) as revenue,
    AVG(o.total) as avg_order_value,
    COUNT(DISTINCT o.customer_phone) as unique_customers
FROM tenants t
LEFT JOIN orders o ON t.id = o.tenant_id
GROUP BY t.id, t.business_name, DATE(o.created_at);

-- Popular menu items per tenant
CREATE VIEW popular_menu_items AS
SELECT 
    mi.tenant_id,
    mi.id as menu_item_id,
    mi.name,
    mi.category,
    COUNT(*) as times_ordered,
    SUM((item->>'quantity')::INTEGER) as total_quantity
FROM menu_items mi
JOIN orders o ON mi.tenant_id = o.tenant_id,
     jsonb_array_elements(o.items) as item
WHERE (item->>'item_id')::UUID = mi.id
GROUP BY mi.tenant_id, mi.id, mi.name, mi.category
ORDER BY times_ordered DESC;

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Insert sample tenant
INSERT INTO tenants (
    business_name,
    business_email,
    phone_number,
    plugin_type,
    address,
    city,
    subscription_tier,
    status
) VALUES (
    'Victoria Fisheries',
    'info@victoriafisheries.co.za',
    '27722560877',
    'restaurant',
    '3 Ryke Street, Grabouw',
    'Grabouw',
    'premium',
    'active'
);

-- Get the tenant ID
DO $$
DECLARE
    tenant_uuid UUID;
BEGIN
    SELECT id INTO tenant_uuid FROM tenants WHERE business_email = 'info@victoriafisheries.co.za';
    
    -- Insert sample menu items
    INSERT INTO menu_items (tenant_id, item_code, name, price, category) VALUES
    (tenant_uuid, '01', 'Mini Chips', 25.00, 'Chips'),
    (tenant_uuid, '02', 'Small Chips', 35.00, 'Chips'),
    (tenant_uuid, '03', 'Medium Chips', 55.00, 'Chips'),
    (tenant_uuid, '07', '1 Piece Snoek', 40.00, 'Snoek'),
    (tenant_uuid, '17', 'Calamari (200g)', 75.00, 'Calamari');
END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Create application user
CREATE USER bot_app WITH PASSWORD 'change_this_password';
GRANT CONNECT ON DATABASE postgres TO bot_app;
GRANT USAGE ON SCHEMA public TO bot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bot_app;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Add any additional indexes for common queries
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_tenant_status_created ON orders(tenant_id, status, created_at DESC);

-- Full-text search on menu items (optional)
CREATE INDEX idx_menu_items_search ON menu_items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================================
-- COMPLETED
-- ============================================================================
-- This schema supports:
-- ✅ Multiple tenants with isolation
-- ✅ Flexible plugin system
-- ✅ Order management
-- ✅ Menu/catalog management
-- ✅ Conversation state tracking
-- ✅ Usage and billing tracking
-- ✅ Admin user management
-- ✅ Webhook integrations
-- ✅ Audit logging
-- ✅ Analytics views
