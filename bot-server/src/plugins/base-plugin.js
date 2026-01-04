// Base Plugin Class
// All business type plugins must extend this class

class BasePlugin {
  constructor(tenant, db) {
    this.tenant = tenant;
    this.db = db;
    this.pluginType = tenant.plugin_type;
    this.config = tenant.plugin_config || {};
  }

  /**
   * Handle incoming WhatsApp message
   * @param {Object} message - The message object
   * @param {string} customerPhone - Customer's phone number
   * @returns {Promise<string>} - Response message to send back
   */
  async handleIncomingMessage(message, customerPhone) {
    throw new Error('handleIncomingMessage must be implemented by plugin');
  }

  /**
   * Format and return the menu/catalog
   * @returns {Promise<string>} - Formatted menu message
   */
  async formatMenu() {
    throw new Error('formatMenu must be implemented by plugin');
  }

  /**
   * Parse order items from customer message
   * @param {string} message - Customer's message
   * @returns {Promise<Array>} - Array of ordered items
   */
  async parseOrderItems(message) {
    throw new Error('parseOrderItems must be implemented by plugin');
  }

  /**
   * Process and create an order
   * @param {Array} items - Array of order items
   * @param {Object} customerInfo - Customer information
   * @returns {Promise<Object>} - Created order object
   */
  async processOrder(items, customerInfo) {
    const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    
    const order = await this.db.createOrder({
      tenant_id: this.tenant.id,
      customer_phone: customerInfo.phone,
      customer_name: customerInfo.name,
      items: items,
      total: total,
      delivery_address: customerInfo.address,
      delivery_type: customerInfo.deliveryType || 'delivery',
      status: 'pending'
    });

    // Track usage
    await this.db.incrementUsage(this.tenant.id, 'order');

    return order;
  }

  /**
   * Format order summary for confirmation
   * @param {Array} items - Order items
   * @param {number} total - Total amount
   * @returns {string} - Formatted summary message
   */
  formatOrderSummary(items, total) {
    let summary = '📋 *ORDER SUMMARY*\n\n';
    
    items.forEach(item => {
      const qty = item.quantity || 1;
      const itemTotal = item.price * qty;
      summary += `• ${item.name}`;
      if (qty > 1) summary += ` (x${qty})`;
      summary += ` - R${itemTotal.toFixed(2)}\n`;
    });
    
    summary += `\n*TOTAL: R${total.toFixed(2)}*\n\n`;
    summary += '📍 Please reply with your delivery address or "pickup" if collecting in-store.';
    
    return summary;
  }

  /**
   * Format order confirmation message
   * @param {Object} order - Order object
   * @returns {string} - Confirmation message
   */
  formatOrderConfirmation(order) {
    const emoji = this.tenant.branding?.emoji || '✅';
    
    let message = `${emoji} *ORDER CONFIRMED!*\n\n`;
    message += `Order #${order.order_number}\n\n`;
    message += '📋 Items:\n';
    
    order.items.forEach(item => {
      const qty = item.quantity || 1;
      message += `• ${item.name}`;
      if (qty > 1) message += ` (x${qty})`;
      message += '\n';
    });
    
    message += `\n💰 Total: R${order.total.toFixed(2)}\n`;
    message += `📍 ${order.delivery_address}\n\n`;
    message += '⏱️ Your order will be ready in 30-45 minutes.\n';
    message += '💳 Payment on delivery/collection.\n\n';
    message += `Thank you for choosing ${this.tenant.business_name}! ${emoji}`;
    
    return message;
  }

  /**
   * Send notification (to be overridden if custom logic needed)
   * @param {string} orderId - Order ID
   * @param {string} status - New status
   */
  async sendNotification(orderId, status) {
    // Default implementation - can be overridden
    const order = await this.db.getOrder(orderId);
    
    const statusMessages = {
      confirmed: '✅ Your order has been confirmed!',
      preparing: '👨‍🍳 Your order is being prepared...',
      ready: '🎉 Your order is ready for pickup/delivery!',
      delivered: '✅ Order delivered! Thank you!',
      cancelled: '❌ Your order has been cancelled.'
    };

    const message = statusMessages[status] || `Order status: ${status}`;
    
    // This will be sent via the messaging system
    return {
      to: order.customer_phone,
      message: message
    };
  }

  /**
   * Get conversation state for a customer
   * @param {string} customerPhone - Customer's phone number
   * @returns {Promise<Object>} - Current conversation state
   */
  async getConversationState(customerPhone) {
    return await this.db.getConversationState(this.tenant.id, customerPhone);
  }

  /**
   * Update conversation state
   * @param {string} customerPhone - Customer's phone number
   * @param {Object} state - State data to save
   */
  async updateConversationState(customerPhone, state) {
    return await this.db.updateConversationState(this.tenant.id, customerPhone, state);
  }

  /**
   * Clear conversation state
   * @param {string} customerPhone - Customer's phone number
   */
  async clearConversationState(customerPhone) {
    return await this.db.clearConversationState(this.tenant.id, customerPhone);
  }

  /**
   * Get menu items from database
   * @returns {Promise<Array>} - Array of menu items
   */
  async getMenuItems() {
    return await this.db.getMenuItems(this.tenant.id);
  }

  /**
   * Find menu item by code
   * @param {string} itemCode - Item code (e.g., '01', 'P001')
   * @returns {Promise<Object>} - Menu item object
   */
  async getMenuItem(itemCode) {
    return await this.db.getMenuItem(this.tenant.id, itemCode);
  }

  /**
   * Validate if tenant can process more messages (rate limiting)
   * @returns {Promise<boolean>} - True if can process, false if limit reached
   */
  async canProcessMessage() {
    const usage = await this.db.getTenantUsage(this.tenant.id);
    
    if (this.tenant.monthly_message_count >= this.tenant.monthly_message_limit) {
      return false;
    }
    
    return true;
  }

  /**
   * Increment message count for tenant
   */
  async incrementMessageCount() {
    await this.db.incrementMessageCount(this.tenant.id);
  }

  /**
   * Get business information formatted for messages
   * @returns {string} - Formatted business info
   */
  getBusinessInfo() {
    let info = `📍 ${this.tenant.business_name}\n`;
    if (this.tenant.address) info += `${this.tenant.address}\n`;
    if (this.tenant.phone_number) info += `📞 ${this.tenant.phone_number}\n`;
    return info;
  }

  /**
   * Log activity for analytics
   * @param {string} action - Action performed
   * @param {Object} data - Additional data
   */
  async logActivity(action, data = {}) {
    await this.db.logActivity({
      tenant_id: this.tenant.id,
      action: action,
      data: data
    });
  }

  /**
   * Get plugin metadata
   * @returns {Object} - Plugin information
   */
  getMetadata() {
    return {
      type: this.pluginType,
      version: '1.0.0',
      capabilities: this.getCapabilities()
    };
  }

  /**
   * Get plugin capabilities
   * @returns {Array<string>} - List of capabilities
   */
  getCapabilities() {
    return [
      'menu_display',
      'order_processing',
      'order_tracking',
      'notifications'
    ];
  }

  /**
   * Validate plugin configuration
   * @returns {boolean} - True if valid
   */
  validateConfig() {
    // Override in specific plugins if needed
    return true;
  }

  /**
   * Initialize plugin (called when plugin is loaded)
   */
  async initialize() {
    // Override in specific plugins if needed
    console.log(`Plugin ${this.pluginType} initialized for tenant ${this.tenant.business_name}`);
  }

  /**
   * Cleanup (called when plugin is unloaded)
   */
  async cleanup() {
    // Override in specific plugins if needed
  }
}

module.exports = BasePlugin;
