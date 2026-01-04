const RestaurantPlugin = require('./plugins/restaurant/plugin');
const PharmacyPlugin = require('./plugins/pharmacy/plugin');
const RetailPlugin = require('./plugins/retail/plugin');

/**
 * Tenant Router
 * Routes incoming WhatsApp messages to the correct tenant's plugin
 */
class TenantRouter {
  constructor(db) {
    this.db = db;
    this.pluginCache = new Map(); // Cache loaded plugins
    this.tenantCache = new Map(); // Cache tenant data
    this.cacheTTL = 300000; // 5 minutes
  }

  /**
   * Route incoming message to correct tenant
   * @param {string} wahaSessionId - WhatsApp session ID from Waha
   * @param {string} customerPhone - Customer's phone number
   * @param {Object} message - Message object
   * @returns {Promise<Object>} - Response object with message and tenant info
   */
  async routeMessage(wahaSessionId, customerPhone, message) {
    try {
      // 1. Find tenant by Waha session ID
      const tenant = await this.getTenantBySession(wahaSessionId);
      
      if (!tenant) {
        console.error(`No tenant found for session: ${wahaSessionId}`);
        return {
          success: false,
          error: 'Tenant not found',
          message: 'This WhatsApp number is not configured. Please contact support.'
        };
      }

      // 2. Check if tenant is active
      if (tenant.status !== 'active' && tenant.status !== 'trial') {
        console.log(`Tenant ${tenant.business_name} is ${tenant.status}`);
        return {
          success: false,
          error: 'Tenant inactive',
          message: 'This service is currently unavailable. Please try again later.'
        };
      }

      // 3. Load appropriate plugin for tenant
      const plugin = await this.loadPlugin(tenant);

      // 4. Process message through plugin
      const responseMessage = await plugin.handleIncomingMessage(message, customerPhone);

      // 5. Log the interaction
      await this.logInteraction(tenant.id, customerPhone, message, responseMessage);

      return {
        success: true,
        tenant: {
          id: tenant.id,
          business_name: tenant.business_name,
          phone_number: tenant.phone_number
        },
        message: responseMessage
      };

    } catch (error) {
      console.error('Error routing message:', error);
      return {
        success: false,
        error: error.message,
        message: 'Sorry, something went wrong. Please try again later.'
      };
    }
  }

  /**
   * Get tenant by Waha session ID
   * Uses cache to reduce database queries
   */
  async getTenantBySession(wahaSessionId) {
    // Check cache first
    const cacheKey = `session:${wahaSessionId}`;
    if (this.tenantCache.has(cacheKey)) {
      const cached = this.tenantCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.tenant;
      }
    }

    // Fetch from database
    const tenant = await this.db.getTenantBySession(wahaSessionId);
    
    if (tenant) {
      // Cache the result
      this.tenantCache.set(cacheKey, {
        tenant: tenant,
        timestamp: Date.now()
      });
    }

    return tenant;
  }

  /**
   * Get tenant by phone number
   * Alternative routing method if session ID not available
   */
  async getTenantByPhone(phoneNumber) {
    const cacheKey = `phone:${phoneNumber}`;
    if (this.tenantCache.has(cacheKey)) {
      const cached = this.tenantCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.tenant;
      }
    }

    const tenant = await this.db.getTenantByPhone(phoneNumber);
    
    if (tenant) {
      this.tenantCache.set(cacheKey, {
        tenant: tenant,
        timestamp: Date.now()
      });
    }

    return tenant;
  }

  /**
   * Load appropriate plugin for tenant
   * Caches plugin instances for performance
   */
  async loadPlugin(tenant) {
    const cacheKey = `plugin:${tenant.id}`;

    // Check if plugin already loaded and cached
    if (this.pluginCache.has(cacheKey)) {
      const cached = this.pluginCache.get(cacheKey);
      
      // Update tenant data in plugin (in case settings changed)
      cached.plugin.tenant = tenant;
      
      return cached.plugin;
    }

    // Load appropriate plugin based on tenant type
    let PluginClass;
    
    switch (tenant.plugin_type) {
      case 'restaurant':
        PluginClass = RestaurantPlugin;
        break;
      case 'pharmacy':
        PluginClass = PharmacyPlugin;
        break;
      case 'retail':
        PluginClass = RetailPlugin;
        break;
      default:
        throw new Error(`Unknown plugin type: ${tenant.plugin_type}`);
    }

    // Instantiate plugin
    const plugin = new PluginClass(tenant, this.db);
    await plugin.initialize();

    // Cache the plugin
    this.pluginCache.set(cacheKey, {
      plugin: plugin,
      timestamp: Date.now()
    });

    console.log(`Loaded ${tenant.plugin_type} plugin for tenant: ${tenant.business_name}`);

    return plugin;
  }

  /**
   * Reload plugin (useful when tenant settings change)
   */
  async reloadPlugin(tenantId) {
    const cacheKey = `plugin:${tenantId}`;
    
    if (this.pluginCache.has(cacheKey)) {
      const cached = this.pluginCache.get(cacheKey);
      await cached.plugin.cleanup();
      this.pluginCache.delete(cacheKey);
    }

    // Also clear tenant cache
    this.clearTenantCache(tenantId);
    
    console.log(`Plugin reloaded for tenant: ${tenantId}`);
  }

  /**
   * Clear tenant from cache
   */
  clearTenantCache(tenantId) {
    // Remove all cache entries for this tenant
    for (const [key, value] of this.tenantCache.entries()) {
      if (value.tenant && value.tenant.id === tenantId) {
        this.tenantCache.delete(key);
      }
    }
  }

  /**
   * Log interaction for analytics
   */
  async logInteraction(tenantId, customerPhone, incomingMessage, outgoingMessage) {
    try {
      await this.db.logInteraction({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        incoming_message: incomingMessage,
        outgoing_message: outgoingMessage,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging interaction:', error);
      // Don't throw - logging failure shouldn't break message flow
    }
  }

  /**
   * Get all active tenants
   */
  async getActiveTenants() {
    return await this.db.getActiveTenants();
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId) {
    return await this.db.getTenantStats(tenantId);
  }

  /**
   * Handle webhook from tenant's integrated systems
   * Example: Order status update from POS system
   */
  async handleWebhook(tenantId, webhookData) {
    try {
      const tenant = await this.db.getTenant(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const plugin = await this.loadPlugin(tenant);

      // Let plugin handle the webhook
      if (plugin.handleWebhook) {
        return await plugin.handleWebhook(webhookData);
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Send notification to customer
   * Used by admin dashboard or automated systems
   */
  async sendNotification(tenantId, customerPhone, message) {
    try {
      const tenant = await this.db.getTenant(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // This will be sent through the messaging service
      return {
        tenant_id: tenantId,
        session_id: tenant.whatsapp_session_id,
        to: customerPhone,
        message: message
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Update order status and notify customer
   */
  async updateOrderStatus(tenantId, orderId, newStatus) {
    try {
      const tenant = await this.db.getTenant(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Update order in database
      await this.db.updateOrderStatus(orderId, newStatus);

      // Load plugin and get notification message
      const plugin = await this.loadPlugin(tenant);
      const notification = await plugin.sendNotification(orderId, newStatus);

      return notification;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  /**
   * Cleanup: Clear all caches
   */
  clearAllCaches() {
    this.pluginCache.clear();
    this.tenantCache.clear();
    console.log('All caches cleared');
  }

  /**
   * Cleanup: Unload all plugins
   */
  async cleanup() {
    for (const [key, cached] of this.pluginCache.entries()) {
      await cached.plugin.cleanup();
    }
    this.clearAllCaches();
    console.log('Tenant router cleanup complete');
  }

  /**
   * Get router statistics
   */
  getStats() {
    return {
      cached_plugins: this.pluginCache.size,
      cached_tenants: this.tenantCache.size,
      cache_ttl_ms: this.cacheTTL
    };
  }
}

module.exports = TenantRouter;
