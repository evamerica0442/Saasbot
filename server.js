const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const TenantRouter = require('./tenant-router');
const Database = require('./database');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Configuration
const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '';
const PORT = process.env.PORT || 4000;

// Initialize database and router
const db = new Database();
const tenantRouter = new TenantRouter(db);

/**
 * Send WhatsApp message via Waha
 */
async function sendWhatsAppMessage(sessionId, to, text) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_API_KEY
    };
    
    await axios.post(WAHA_URL + '/api/sendText', {
      session: sessionId,
      chatId: to,
      text: text
    }, { headers });
    
    console.log('Message sent to ' + to + ' via session ' + sessionId);
  } catch (error) {
    console.error('Error sending message:', error.message);
    throw error;
  }
}

/**
 * Main webhook endpoint - receives messages from Waha
 */
app.post('/webhook', async (req, res) => {
  try {
    const { event, payload, session } = req.body;
    
    // Only process text messages
    if (event !== 'message' || !payload || !payload.body) {
      return res.sendStatus(200);
    }

    const sessionId = session || payload.session;
    const customerPhone = payload.from;
    const messageText = payload.body;

    console.log('Received message from ' + customerPhone + ' via session ' + sessionId);
    console.log('Message: ' + messageText);

    // Route message to appropriate tenant
    const result = await tenantRouter.routeMessage(sessionId, customerPhone, messageText);

    if (!result.success) {
      console.error('Routing failed:', result.error);
      // Still send error message to customer
      if (result.message) {
        await sendWhatsAppMessage(sessionId, customerPhone, result.message);
      }
      return res.sendStatus(200);
    }

    // Send response back to customer
    await sendWhatsAppMessage(sessionId, customerPhone, result.message);

    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.sendStatus(500);
  }
});

/**
 * API: Send notification to customer
 * Used by admin dashboard
 */
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { tenant_id, customer_phone, message } = req.body;

    if (!tenant_id || !customer_phone || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notification = await tenantRouter.sendNotification(tenant_id, customer_phone, message);
    
    await sendWhatsAppMessage(notification.session_id, notification.to, notification.message);

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Update order status
 * Automatically sends notification to customer
 */
app.post('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { tenant_id, status } = req.body;

    if (!tenant_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notification = await tenantRouter.updateOrderStatus(tenant_id, orderId, status);
    
    await sendWhatsAppMessage(notification.session_id, notification.to, notification.message);

    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Get tenant statistics
 */
app.get('/api/tenants/:tenantId/stats', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const stats = await tenantRouter.getTenantStats(tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Get all active tenants
 */
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await tenantRouter.getActiveTenants();
    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Reload plugin for tenant
 * Used when tenant settings are updated
 */
app.post('/api/tenants/:tenantId/reload', async (req, res) => {
  try {
    const { tenantId } = req.params;
    await tenantRouter.reloadPlugin(tenantId);
    res.json({ success: true, message: 'Plugin reloaded' });
  } catch (error) {
    console.error('Error reloading plugin:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Handle external webhook
 * Example: POS system sends order updates
 */
app.post('/api/webhooks/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const webhookData = req.body;

    const result = await tenantRouter.handleWebhook(tenantId, webhookData);
    res.json(result);
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  const stats = tenantRouter.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    router_stats: stats
  });
});

/**
 * System stats endpoint
 */
app.get('/api/system/stats', (req, res) => {
  const stats = tenantRouter.getStats();
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    router: stats
  });
});

/**
 * Clear caches endpoint (admin only)
 */
app.post('/api/system/clear-cache', (req, res) => {
  tenantRouter.clearAllCaches();
  res.json({ success: true, message: 'Caches cleared' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start server
async function start() {
  try {
    // Initialize database connection
    await db.initialize();
    console.log('✅ Database connected');

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 Multi-Tenant WhatsApp Bot Platform');
      console.log('📱 Waha URL: ' + WAHA_URL);
      console.log('🔧 Bot Server Port: ' + PORT);
      console.log('📞 Webhook endpoint: http://0.0.0.0:' + PORT + '/webhook');
      console.log('✅ Server ready to handle messages');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await tenantRouter.cleanup();
      await db.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
start();
