import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export default function Tenants() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    business_email: '',
    phone_number: '',
    address: '',
    city: '',
    plugin_type: 'restaurant',
    subscription_tier: 'basic',
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const response = await apiService.getTenants();
      setTenants(response.data);
    } catch (error) {
      toast.error('Failed to load businesses');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      business_name: '',
      business_email: '',
      phone_number: '',
      address: '',
      city: '',
      plugin_type: 'restaurant',
      subscription_tier: 'basic',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    try {
      await apiService.createTenant(formData);
      toast.success('Business created successfully!');
      handleCloseDialog();
      loadTenants();
    } catch (error) {
      toast.error('Failed to create business');
      console.error(error);
    }
  };

  const handleDelete = async (tenantId) => {
    if (window.confirm('Are you sure you want to delete this business?')) {
      try {
        await apiService.deleteTenant(tenantId);
        toast.success('Business deleted successfully!');
        loadTenants();
      } catch (error) {
        toast.error('Failed to delete business');
        console.error(error);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trial':
        return 'info';
      case 'suspended':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Businesses
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Add Business
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Business Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>City</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>{tenant.business_name}</TableCell>
                <TableCell>{tenant.business_email}</TableCell>
                <TableCell>{tenant.phone_number}</TableCell>
                <TableCell>
                  <Chip label={tenant.plugin_type} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={tenant.subscription_tier} size="small" color="primary" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={tenant.status} 
                    size="small" 
                    color={getStatusColor(tenant.status)} 
                  />
                </TableCell>
                <TableCell>{tenant.city}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => navigate('/tenants/' + tenant.id)}
                    title="View Details"
                  >
                    <ViewIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => navigate('/menu/' + tenant.id)}
                    title="Manage Menu"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(tenant.id)}
                    title="Delete"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="textSecondary">
                    No businesses found. Add your first business to get started!
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Business Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Business</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Business Name"
              name="business_name"
              value={formData.business_name}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label="Email"
              name="business_email"
              type="email"
              value={formData.business_email}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label="Phone Number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleInputChange}
              fullWidth
              required
              placeholder="27821234567"
            />
            <TextField
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="City"
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="Business Type"
              name="plugin_type"
              value={formData.plugin_type}
              onChange={handleInputChange}
              select
              fullWidth
              required
            >
              <MenuItem value="restaurant">Restaurant</MenuItem>
              <MenuItem value="pharmacy">Pharmacy</MenuItem>
              <MenuItem value="retail">Retail</MenuItem>
            </TextField>
            <TextField
              label="Subscription Tier"
              name="subscription_tier"
              value={formData.subscription_tier}
              onChange={handleInputChange}
              select
              fullWidth
              required
            >
              <MenuItem value="free">Free</MenuItem>
              <MenuItem value="basic">Basic (R499/month)</MenuItem>
              <MenuItem value="premium">Premium (R1299/month)</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Create Business
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
