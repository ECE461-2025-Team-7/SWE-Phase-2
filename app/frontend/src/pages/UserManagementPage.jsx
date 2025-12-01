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
      <h1 style={{ color: '#d4af37', marginBottom: '0.5rem' }}>User Management</h1>
      <p style={{ color: '#999', marginBottom: '2rem' }}>Create and manage system users</p>

      {/* Messages */}
      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#3d1f1f',
          border: '1px solid #661c1c',
          borderRadius: '4px',
          color: '#ff6b6b'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#1f3d2c',
          border: '1px solid #2d5a3f',
          borderRadius: '4px',
          color: '#5cdb95'
        }}>
          {success}
        </div>
      )}

      {/* Create User Form */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: '1px solid #333'
      }}>
        <h2 style={{ color: '#d4af37', marginBottom: '1.5rem', fontSize: '1.3rem' }}>
          Create New User
        </h2>
        
        <form onSubmit={handleCreateUser}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>
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
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>
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
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', color: '#ccc', cursor: 'pointer' }}>
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
              padding: '0.75rem 2rem',
              backgroundColor: creating ? '#555' : '#d4af37',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: creating ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (!creating) e.target.style.backgroundColor = '#b8941f';
            }}
            onMouseOut={(e) => {
              if (!creating) e.target.style.backgroundColor = '#d4af37';
            }}
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>

      {/* User List */}
      <div style={{
        backgroundColor: '#1a1a1a',
        padding: '2rem',
        borderRadius: '8px',
        border: '1px solid #333'
      }}>
        <h2 style={{ color: '#d4af37', marginBottom: '1.5rem', fontSize: '1.3rem' }}>
          Existing Users ({users.length})
        </h2>

        {loading ? (
          <p style={{ color: '#999' }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ color: '#999' }}>No users found</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              color: '#ccc'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #444' }}>
                  <th style={{ textAlign: 'left', padding: '1rem', color: '#d4af37' }}>Username</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: '#d4af37' }}>Role</th>
                  <th style={{ textAlign: 'left', padding: '1rem', color: '#d4af37' }}>Created</th>
                  <th style={{ textAlign: 'center', padding: '1rem', color: '#d4af37' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.name} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '1rem' }}>{user.name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        backgroundColor: user.is_admin ? '#d4af37' : '#444',
                        color: user.is_admin ? '#000' : '#ccc',
                        fontSize: '0.875rem',
                        fontWeight: user.is_admin ? 'bold' : 'normal'
                      }}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {user.name === 'ece30861defaultadminuser' ? (
                        <span style={{ color: '#666', fontSize: '0.875rem' }}>
                          Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeleteUser(user.name)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#661c1c',
                            color: '#ff6b6b',
                            border: '1px solid #ff6b6b',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.target.style.backgroundColor = '#8a2424';
                          }}
                          onMouseOut={(e) => {
                            e.target.style.backgroundColor = '#661c1c';
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
