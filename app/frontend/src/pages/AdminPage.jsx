// AdminPage.jsx - Admin-only page for user management and registry reset
import { useState, useEffect } from 'react';
import { listUsers, createUser, deleteUser, resetRegistry } from '../apiClient';

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

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

  const handleResetRegistry = async () => {
    if (resetConfirmText !== 'RESET') {
      setError('Please type RESET to confirm');
      return;
    }

    try {
      setResetting(true);
      setError(null);
      setSuccess(null);

      await resetRegistry();

      setSuccess('Registry has been reset successfully. All artifacts have been deleted.');
      setShowResetConfirm(false);
      setResetConfirmText('');
    } catch (err) {
      setError(err.message || 'Failed to reset registry');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>Admin Dashboard</h2>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Manage users and registry settings</p>

      {/* Messages */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#fee',
            color: '#c33',
            borderRadius: '4px'
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            color: '#155724',
            borderRadius: '4px'
          }}
        >
          <strong>✓</strong> {success}
        </div>
      )}

      {/* Reset Registry Section */}
      <div style={{
        background: '#fff5f5',
        border: '1px solid #feb2b2',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h3 style={{ color: '#c53030', marginTop: 0, marginBottom: '1rem', fontSize: '1.2rem' }}>
          ⚠️ Reset Registry
        </h3>
        <p style={{ color: '#742a2a', marginBottom: '1rem' }}>
          This will <strong>permanently delete all artifacts</strong> from the registry.
          This action cannot be undone.
        </p>
        <button
          onClick={() => setShowResetConfirm(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Reset Registry
        </button>
      </div>

      {/* Create User Form */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ color: '#0066cc', marginBottom: '1.5rem', fontSize: '1.2rem', marginTop: 0 }}>
          Create New User
        </h3>

        <form onSubmit={handleCreateUser}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="new-username"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}
            >
              Username
            </label>
            <input
              id="new-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              disabled={creating}
              autoComplete="off"
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
            <label
              htmlFor="new-password"
              style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}
            >
              Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter password"
              disabled={creating}
              autoComplete="new-password"
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
        <h3 style={{ color: '#0066cc', marginBottom: '1.5rem', fontSize: '1.2rem', marginTop: 0 }}>
          Existing Users ({users.length})
        </h3>

        {loading ? (
          <p style={{ color: '#666' }}>Loading users...</p>
        ) : users.length === 0 ? (
          <p style={{ color: '#666' }}>No users found</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              aria-label="User list"
              style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th scope="col" style={{ textAlign: 'left', padding: '0.75rem', color: '#555' }}>Username</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '0.75rem', color: '#555' }}>Role</th>
                  <th scope="col" style={{ textAlign: 'left', padding: '0.75rem', color: '#555' }}>Created</th>
                  <th scope="col" style={{ textAlign: 'center', padding: '0.75rem', color: '#555' }}>Actions</th>
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
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: '#595959' }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {user.name === 'ece30861defaultadminuser' ? (
                        <span style={{ color: '#767676', fontSize: '0.875rem' }}>
                          Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeleteUser(user.name)}
                          aria-label={`Delete user ${user.name}`}
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

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <h3 id="reset-dialog-title" style={{ marginTop: 0, color: '#dc3545' }}>⚠️ Confirm Registry Reset</h3>
            <p style={{ color: '#333' }}>
              You are about to <strong>permanently delete all artifacts</strong> from the registry.
            </p>
            <p style={{ color: '#595959', fontSize: '0.9rem' }}>
              This action <strong>cannot be undone</strong>. Type <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>RESET</code> below to confirm.
            </p>

            <label htmlFor="reset-confirm-input" className="sr-only">Type RESET to confirm</label>
            <input
              id="reset-confirm-input"
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              disabled={resetting}
              aria-describedby="reset-instructions"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #dc3545',
                borderRadius: '4px',
                fontSize: '1rem',
                marginBottom: '1rem'
              }}
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                disabled={resetting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f0f0f0',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: resetting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetRegistry}
                disabled={resetting || resetConfirmText !== 'RESET'}
                aria-busy={resetting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (resetting || resetConfirmText !== 'RESET') ? '#ccc' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (resetting || resetConfirmText !== 'RESET') ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {resetting ? 'Resetting...' : 'Reset Registry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
