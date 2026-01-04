const BasePlugin = require('../base-plugin');

/**
 * Restaurant Plugin
 * Handles restaurant/food ordering workflows
 * Extends BasePlugin with restaurant-specific features
 */
class RestaurantPlugin extends BasePlugin {
  constructor(tenant, db) {
    super(tenant, db);
    this.pluginType = 'restaurant';
  }

  /**
   * Handle incoming WhatsApp message
   * Implements the restaurant ordering workflow
   */
  async handleIncomingMessage(message, customerPhone) {
    const messageText = message.trim().toLowerCase();
    
    // Check rate limit
    if (!await this.canProcessMessage()) {
      return '⚠️ Monthly message limit reached. Please contact support to upgrade your plan.';
    }

    await this.incrementMessageCount();
    
    // Get current conversation state
    let state = await this.getConversationState(customerPhone);
    
    if (!state) {
      state = { current_step: 'idle', state_data: {} };
    }

    // Handle different conversation steps
    if (messageText === 'menu' || messageText === 'hi' || messageText === 'hello' || messageText === 'start') {
      // Show menu
      const menuMessage = await this.formatMenu();
      await this.updateConversationState(customerPhone, {
        current_step: 'viewing_menu',
        state_data: {}
      });
      return menuMessage;
    }
    
    else if (state.current_step === 'viewing_menu' || state.current_step === 'idle') {
      // Try to parse order items
      const items = await this.parseOrderItems(messageText);
      
      if (items && items.length > 0) {
        const total = items.reduce((sum, item) => sum + item.price, 0);
        
        await this.updateConversationState(customerPhone, {
          current_step: 'awaiting_address',
          state_data: { items, total }
        });
        
        return this.formatOrderSummary(items, total);
      } else {
        return '❌ I could not understand that order. Please use item numbers like: #01 #07\n\nType "menu" to see the menu again.';
      }
    }
    
    else if (state.current_step === 'awaiting_address') {
      // Process the order with delivery address
      const { items, total } = state.state_data;
      
      const deliveryType = messageText === 'pickup' || messageText === 'collection' ? 'pickup' : 'delivery';
      const address = deliveryType === 'pickup' ? 'Customer collection' : messageText;
      
      const order = await this.processOrder(items, {
        phone: customerPhone,
        address: address,
        deliveryType: deliveryType
      });
      
      // Clear conversation state
      await this.clearConversationState(customerPhone);
      
      // Log the order
      await this.logActivity('order.created', {
        order_id: order.id,
        customer_phone: customerPhone,
        total: total
      });
      
      return this.formatOrderConfirmation(order);
    }
    
    else if (messageText === 'orders' || messageText === 'my orders') {
      // Show customer's recent orders
      return await this.getCustomerOrders(customerPhone);
    }
    
    else if (messageText === 'help') {
      return this.getHelpMessage();
    }
    
    else {
      return 'Type "menu" to start ordering! 🍽️';
    }
  }

  /**
   * Format menu for restaurant
   * Groups items by category
   */
  async formatMenu() {
    const menuItems = await this.getMenuItems();
    const emoji = this.tenant.branding?.emoji || '🍽️';
    
    let message = `${emoji} *${this.tenant.business_name.toUpperCase()} - MENU* ${emoji}\n\n`;
    message += this.getBusinessInfo();
    message += '\n';
    
    // Group items by category
    const categories = {};
    menuItems.forEach(item => {
      if (item.available) {
        if (!categories[item.category]) {
          categories[item.category] = [];
        }
        categories[item.category].push(item);
      }
    });
    
    // Format each category
    for (const [category, items] of Object.entries(categories)) {
      message += `*${category.toUpperCase()}*\n`;
      items.forEach(item => {
        message += `#${item.item_code} - ${item.name} - R${item.price.toFixed(2)}\n`;
        if (item.description) {
          message += `   _${item.description}_\n`;
        }
      });
      message += '\n';
    }
    
    message += '💬 *To order, reply with item numbers*\n';
    message += 'Example: #01 #07 #12\n\n';
    message += '_We look forward to serving you!_ 😊';
    
    return message;
  }

  /**
   * Parse order items from customer message
   * Supports formats like: #01 #07, 01 07, #01, #07, etc.
   */
  async parseOrderItems(message) {
    // Match patterns like #01, #02A, etc.
    const itemPattern = /#?([A-Z0-9]+)/gi;
    const matches = message.matchAll(itemPattern);
    
    const items = [];
    const seenCodes = new Set();
    
    for (const match of matches) {
      const itemCode = match[1].toUpperCase();
      
      // Avoid duplicates
      if (seenCodes.has(itemCode)) continue;
      seenCodes.add(itemCode);
      
      const menuItem = await this.getMenuItem(itemCode);
      if (menuItem && menuItem.available) {
        items.push({
          item_id: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1
        });
      }
    }
    
    return items;
  }

  /**
   * Get customer's recent orders
   */
  async getCustomerOrders(customerPhone) {
    const orders = await this.db.getCustomerOrders(this.tenant.id, customerPhone);
    
    if (!orders || orders.length === 0) {
      return '📋 You have no previous orders.\n\nType "menu" to place your first order!';
    }
    
    let message = '📋 *YOUR RECENT ORDERS*\n\n';
    
    orders.slice(0, 5).forEach(order => {
      const date = new Date(order.created_at).toLocaleDateString();
      message += `*Order #${order.order_number}* - ${date}\n`;
      message += `Status: ${this.formatStatus(order.status)}\n`;
      message += `Total: R${order.total.toFixed(2)}\n`;
      message += '\n';
    });
    
    message += 'Type "menu" to place a new order!';
    
    return message;
  }

  /**
   * Format order status with emoji
   */
  formatStatus(status) {
    const statusMap = {
      pending: '⏳ Pending',
      confirmed: '✅ Confirmed',
      preparing: '👨‍🍳 Preparing',
      ready: '🎉 Ready',
      delivered: '✅ Delivered',
      cancelled: '❌ Cancelled'
    };
    return statusMap[status] || status;
  }

  /**
   * Get help message
   */
  getHelpMessage() {
    const emoji = this.tenant.branding?.emoji || '🍽️';
    
    return `${emoji} *${this.tenant.business_name} - HELP* ${emoji}\n\n` +
           '*Available Commands:*\n' +
           '• "menu" - View our menu\n' +
           '• "orders" - View your order history\n' +
           '• "help" - Show this help message\n\n' +
           '*How to Order:*\n' +
           '1. Type "menu" to see available items\n' +
           '2. Reply with item numbers (e.g., #01 #07)\n' +
           '3. Provide your delivery address\n' +
           '4. Confirm your order!\n\n' +
           `${this.getBusinessInfo()}\n` +
           'Type "menu" to get started! 😊';
  }

  /**
   * Get plugin capabilities (override)
   */
  getCapabilities() {
    return [
      ...super.getCapabilities(),
      'category_grouping',
      'order_history',
      'item_descriptions',
      'special_requests'
    ];
  }

  /**
   * Send notification (restaurant-specific override)
   */
  async sendNotification(orderId, status) {
    const order = await this.db.getOrder(orderId);
    const emoji = this.tenant.branding?.emoji || '🍽️';
    
    const statusMessages = {
      confirmed: `${emoji} *Order Confirmed!*\n\nYour order #${order.order_number} has been confirmed!\nEstimated ready time: 30-45 minutes`,
      preparing: `👨‍🍳 *Order in Progress*\n\nYour order #${order.order_number} is being prepared...`,
      ready: `🎉 *Order Ready!*\n\nYour order #${order.order_number} is ready for ${order.delivery_type}!\n\n` +
             (order.delivery_type === 'pickup' ? 'Please collect at:\n' + this.tenant.address : 'Our driver is on the way!'),
      delivered: `✅ *Order Delivered*\n\nThank you for choosing ${this.tenant.business_name}!\n\nWe hope you enjoyed your meal ${emoji}`,
      cancelled: `❌ *Order Cancelled*\n\nYour order #${order.order_number} has been cancelled.\n\nIf you have questions, please contact us.`
    };

    const message = statusMessages[status] || `Order #${order.order_number} status: ${status}`;
    
    return {
      to: order.customer_phone,
      message: message
    };
  }

  /**
   * Initialize restaurant plugin
   */
  async initialize() {
    await super.initialize();
    console.log(`Restaurant plugin loaded for ${this.tenant.business_name}`);
    
    // Load any restaurant-specific configurations
    if (this.config.special_hours) {
      console.log('  - Special hours configured');
    }
    
    if (this.config.delivery_radius) {
      console.log(`  - Delivery radius: ${this.config.delivery_radius}km`);
    }
  }
}

module.exports = RestaurantPlugin;
