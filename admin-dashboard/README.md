# WhatsApp Bot Platform - Admin Dashboard

Modern React admin dashboard for managing multi-tenant WhatsApp bot platform.

## 🚀 Features

- **Dashboard**: Real-time statistics and analytics
- **Business Management**: Add, edit, and manage tenant businesses
- **Order Management**: View and update order statuses
- **Menu Management**: Manage menu items for each business
- **Analytics**: Revenue and usage tracking
- **Responsive Design**: Works on desktop and mobile

## 🛠️ Tech Stack

- **React 18** - UI framework
- **Material-UI (MUI)** - Component library
- **React Router** - Navigation
- **Zustand** - State management
- **Recharts** - Charts and graphs
- **Axios** - API client
- **Vite** - Build tool
- **React Hot Toast** - Notifications

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- Bot API server running (port 4000)

### Setup

```bash
# Navigate to admin dashboard directory
cd admin-dashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your API URL
nano .env
```

### Environment Variables

```env
VITE_API_URL=http://your-bot-server-ip:4000
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

Dashboard will be available at: `http://localhost:3001`

### Build for Production

```bash
npm run build
```

Built files will be in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
admin-dashboard/
├── src/
│   ├── components/
│   │   └── Layout.jsx          # Main layout with sidebar
│   ├── pages/
│   │   ├── Dashboard.jsx       # Dashboard with stats
│   │   ├── Tenants.jsx         # Business management
│   │   ├── Orders.jsx          # Order management
│   │   ├── Login.jsx           # Login page
│   │   └── index.js            # Placeholder pages
│   ├── services/
│   │   └── api.js              # API service with axios
│   ├── store/
│   │   └── authStore.js        # Authentication state
│   ├── App.jsx                 # Main app component
│   └── main.jsx                # Entry point
├── package.json
├── vite.config.js
└── index.html
```

## 🔐 Authentication

Demo login is enabled by default. Replace with actual authentication:

1. Update `src/services/api.js` - uncomment `apiService.login()`
2. Update `src/pages/Login.jsx` - call API login endpoint
3. Implement backend authentication endpoint

## 📱 Pages Overview

### Dashboard
- Total businesses count
- Total orders count
- Revenue statistics
- Active customers
- Revenue trend chart
- Orders by day chart

### Businesses (Tenants)
- List all businesses
- Add new business
- Edit business details
- Delete business
- View business details
- Manage menu

### Orders
- View all orders
- Filter by status
- Update order status
- Send notifications to customers

### Menu Manager
- Add menu items
- Edit menu items
- Delete menu items
- Manage categories
- Set prices

### Analytics
- Revenue reports
- Order trends
- Customer analytics
- Usage statistics

## 🎨 Customization

### Theme

Edit `src/App.jsx` to customize Material-UI theme:

```javascript
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Change primary color
    },
    secondary: {
      main: '#dc004e', // Change secondary color
    },
  },
});
```

### Branding

Update in `src/components/Layout.jsx`:
- Logo
- App name
- Colors

## 🔌 API Integration

All API calls are in `src/services/api.js`. Available methods:

```javascript
// Tenants
apiService.getTenants()
apiService.createTenant(data)
apiService.updateTenant(id, data)
apiService.deleteTenant(id)

// Orders
apiService.getOrders(params)
apiService.updateOrderStatus(orderId, tenantId, status)

// Menu
apiService.getMenuItems(tenantId)
apiService.createMenuItem(tenantId, data)
apiService.updateMenuItem(tenantId, itemId, data)

// Analytics
apiService.getDashboardStats()
apiService.getTenantAnalytics(tenantId, params)
```

## 🚀 Deployment

### Option 1: Deploy with Terraform (Automated)

Already configured in `terraform/user-data-admin.sh` to:
1. Install Node.js
2. Clone repository
3. Install dependencies
4. Build application
5. Serve with nginx or node

### Option 2: Manual Deployment

```bash
# Build the application
npm run build

# Copy dist/ folder to your server
scp -r dist/* user@server:/var/www/admin-dashboard/

# Configure nginx to serve the files
# Or use a static hosting service (Vercel, Netlify, etc.)
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/admin-dashboard;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Adding New Features

### Add a New Page

1. Create page component in `src/pages/`:
```javascript
// src/pages/MyNewPage.jsx
export default function MyNewPage() {
  return <div>My New Page</div>;
}
```

2. Add route in `src/App.jsx`:
```javascript
<Route path="my-page" element={<MyNewPage />} />
```

3. Add menu item in `src/components/Layout.jsx`:
```javascript
{ text: 'My Page', icon: <MyIcon />, path: '/my-page' }
```

### Add API Endpoint

In `src/services/api.js`:
```javascript
myNewEndpoint: (params) => api.get('/api/my-endpoint', { params })
```

## 🐛 Troubleshooting

### API Connection Issues

```bash
# Check if bot server is running
curl http://localhost:4000/health

# Check CORS settings in bot server
# Ensure bot server allows requests from admin dashboard
```

### Build Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

### Authentication Issues

Check browser console and localStorage:
```javascript
// In browser console
localStorage.getItem('auth-storage')
```

## 📝 Development Guidelines

### Code Style
- Use functional components with hooks
- Use Material-UI components for consistency
- Follow existing naming conventions
- Add proper error handling

### State Management
- Use Zustand for global state
- Use React hooks for local state
- Keep API calls in service layer

### API Calls
- Always wrap in try-catch
- Show loading states
- Display toast notifications
- Handle errors gracefully

## 🔄 Updates & Maintenance

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install package-name@latest
```

### Security Updates

```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

## 📞 Support

For issues or questions:
1. Check the logs: Browser console
2. Review API responses: Network tab
3. Check bot server logs
4. Verify environment variables

## 🎯 Next Steps

Future enhancements to add:
- [ ] Real authentication system
- [ ] Email notifications
- [ ] Export reports (PDF/Excel)
- [ ] Bulk operations
- [ ] Advanced filtering
- [ ] Real-time updates (WebSockets)
- [ ] Mobile app version
- [ ] Multi-language support
- [ ] Dark mode
- [ ] User roles and permissions

## 📄 License

Part of the WhatsApp Bot Platform multi-tenant system.

---

**Built with ❤️ using React and Material-UI**
