// UserManagementPage.jsx - Admin-only user management interface
import { useState, useEffect } from 'react';
import { listUsers, createUser, deleteUser } from '../apiClient';

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listUsers();
      setUsers(response.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!newUsername || !newPassword) {
      setError('Username and password are required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);

      await createUser(newUsername, newPassword, isAdmin);
      
      setSuccess(`User "${newUsername}" created successfully`);
      setNewUsername('');
      setNewPassword('');
      setIsAdmin(false);
      
      // Refresh user list
      await fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      await deleteUser(username);
      
      setSuccess(`User "${username}" deleted successfully`);
      
      // Refresh user list
      await fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>User Management</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Create and manage system users</p>

      {/* Messages */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#fee',
          color: '#c33',
          borderRadius: '4px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          borderRadius: '4px'
        }}>
          <strong>✓</strong> {success}
        </div>
      )}

      {/* Create User Form */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#0066cc', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
          Create New User
        </h3>
        
        <form onSubmit={handleCreateUser}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>
              Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              disabled={creating}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>
              Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter password"
              disabled={creating}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: '#555', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                disabled={creating}
                style={{ marginRight: '0.5rem' }}
              />
              Administrator privileges
            </label>
          </div>

          <button
            type="submit"
            disabled={creating}
            style={{
              padding: '0.75rem 1.5rem',
              background: creating ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: creating ? 'not-allowed' : 'pointer'
            }}
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>

      {/* User List */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#0066cc', marginBottom: '1.5rem', fontSize: '1.2rem' }}>
          Existing Users ({users.length})
        </h3>

        {loading ? (
          <p style={{ color: '#666' }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ color: '#666' }}>No users found</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#555' }}>Username</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#555' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#555' }}>Created</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#555' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.name} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '0.75rem', color: '#333' }}>{user.name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        backgroundColor: user.is_admin ? '#0066cc' : '#6c757d',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: user.is_admin ? 'bold' : 'normal'
                      }}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {user.name === 'ece30861defaultadminuser' ? (
                        <span style={{ color: '#999', fontSize: '0.875rem' }}>
                          Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeleteUser(user.name)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagementPage;
