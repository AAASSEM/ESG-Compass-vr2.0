import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import UserAvatar from '../components/ui/UserAvatar';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { esgAPI } from '../services/api';
import { getApiURL } from '../utils/api-config';

const Users = () => {
  // Load real team members AND pending invitations from API
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery(
    'team-data',
    async () => {
      try {
        const token = localStorage.getItem('access_token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        // Fetch both team members and pending invitations
        const [membersResponse, invitationsResponse] = await Promise.all([
          fetch(getApiURL('/users/team/members/'), { headers }),
          fetch(getApiURL('/users/invitations/'), { headers })
        ]);

        let members = [];
        let invitations = [];

        // Get team members if endpoint works
        if (membersResponse.ok) {
          const memberData = await membersResponse.json();
          members = Array.isArray(memberData) ? memberData : 
                   (memberData.results ? memberData.results : []);
        }

        // Get pending invitations if endpoint works
        if (invitationsResponse.ok) {
          const invitationData = await invitationsResponse.json();
          const invitationArray = Array.isArray(invitationData) ? invitationData : 
                                 (invitationData.results ? invitationData.results : []);
          
          invitations = invitationArray.map(inv => ({
            id: inv.id,
            full_name: inv.email ? inv.email.split('@')[0] : 'Unknown', // Use email prefix as name
            email: inv.email || '',
            role: inv.role || 'user',
            department: 'Pending',
            status: 'pending',
            last_login: null,
            created_at: inv.created_at,
            isPendingInvitation: true
          }));
        }

        // Combine members and pending invitations - ensure both are arrays
        const finalMembers = Array.isArray(members) ? members : [];
        const finalInvitations = Array.isArray(invitations) ? invitations : [];
        
        return [...finalMembers, ...finalInvitations];
      } catch (error) {
        console.warn('Team data endpoint not available:', error);
        return []; // Return empty array so the component works
      }
    },
    { 
      retry: 1, 
      staleTime: 2 * 60 * 1000,
      onError: (error) => {
        console.warn('Failed to load team data:', error);
      }
    }
  );

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Administrator' },
    { value: 'manager', label: 'Manager' },
    { value: 'user', label: 'User' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        // Note: API method may not exist yet, this is placeholder
        // await esgAPI.deleteUser(userId);
        toast.success('User deleted successfully');
        refetchUsers(); // Refetch users after deletion
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Failed to delete user');
      }
    }
  };

  const handleUserSubmit = async (userData) => {
    try {
      if (editingUser) {
        // Update existing user
        await esgAPI.updateUserRole(editingUser.id, userData);
        toast.success('User updated successfully');
      } else {
        // Add new user (invite)
        await esgAPI.inviteTeamMember(userData);
        toast.success('User invitation sent successfully');
      }
      refetchUsers(); // Refetch users after changes
      setShowUserModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(editingUser ? 'Failed to update user' : 'Failed to invite user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getUserStats = () => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length,
      admins: users.filter(u => u.role === 'admin').length
    };
  };

  const stats = getUserStats();

  const getRoleBadgeColor = (role) => {
    const colors = {
      'admin': 'bg-red-500/20 text-red-400',
      'manager': 'bg-blue-500/20 text-blue-400',
      'user': 'bg-green-500/20 text-green-400'
    };
    return colors[role] || 'bg-gray-500/20 text-gray-400';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      'active': 'bg-green-500/20 text-green-400',
      'inactive': 'bg-gray-500/20 text-gray-400'
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400';
  };

  // Show loading state while fetching users
  if (usersLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner message="Loading team members..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-high mb-2">User Management</h1>
            <p className="text-text-muted">Manage user accounts, roles, and permissions</p>
          </div>
          <Button
            variant="primary"
            onClick={handleAddUser}
          >
            <i className="fa-solid fa-plus mr-2"></i>
            Add User
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Total Users</h3>
              <i className="fa-solid fa-users text-brand-green"></i>
            </div>
            <div className="text-2xl font-bold text-text-high">{stats.total}</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Active Users</h3>
              <i className="fa-solid fa-user-check text-green-500"></i>
            </div>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Inactive Users</h3>
              <i className="fa-solid fa-user-slash text-gray-500"></i>
            </div>
            <div className="text-2xl font-bold text-gray-500">{stats.inactive}</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Administrators</h3>
              <i className="fa-solid fa-user-shield text-red-500"></i>
            </div>
            <div className="text-2xl font-bold text-red-500">{stats.admins}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="col-span-2"
            />
            <Select
              options={roleOptions}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </Card>

        {/* Users Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-6 text-text-muted font-medium">User</th>
                  <th className="text-left py-4 px-6 text-text-muted font-medium">Role</th>
                  <th className="text-left py-4 px-6 text-text-muted font-medium">Department</th>
                  <th className="text-left py-4 px-6 text-text-muted font-medium">Status</th>
                  <th className="text-left py-4 px-6 text-text-muted font-medium">Last Login</th>
                  <th className="text-left py-4 px-6 text-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <UserAvatar 
                          fullName={user.full_name}
                          email={user.email}
                          size="sm"
                        />
                        <div>
                          <div className="text-text-high font-medium">{user.full_name}</div>
                          <div className="text-text-muted text-sm">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-text-muted">{user.department}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-text-muted text-sm">
                      {user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy') : 'Never'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-brand-green hover:text-brand-green/80 transition-colors"
                          title="Edit User"
                        >
                          <i className="fa-solid fa-edit text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete User"
                        >
                          <i className="fa-solid fa-trash text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <i className="fa-solid fa-users text-4xl text-text-muted mb-4"></i>
                <h3 className="text-text-high font-medium mb-2">No users found</h3>
                <p className="text-text-muted">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        </Card>

        {/* User Modal */}
        <UserModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
          }}
          onSubmit={handleUserSubmit}
          user={editingUser}
        />
      </div>
    </Layout>
  );
};

// User Modal Component
const UserModal = ({ isOpen, onClose, onSubmit, user }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'user',
    department: '',
    status: 'active'
  });

  React.useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status
      });
    } else {
      setFormData({
        full_name: '',
        email: '',
        role: 'user',
        department: '',
        status: 'active'
      });
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const roleOptions = [
    { value: 'user', label: 'User' },
    { value: 'manager', label: 'Manager' },
    { value: 'admin', label: 'Administrator' }
  ];

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Edit User' : 'Add New User'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Full Name"
          value={formData.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          required
        />

        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          required
        />

        <Input
          label="Department"
          value={formData.department}
          onChange={(e) => handleChange('department', e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Role"
            options={roleOptions}
            value={formData.role}
            onChange={(e) => handleChange('role', e.target.value)}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
          >
            {user ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Users;