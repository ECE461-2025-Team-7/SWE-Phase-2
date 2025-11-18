// Navbar.jsx - Navigation bar with auth status
import { NavLink } from 'react-router-dom';

function Navbar({ auth, onLogout }) {
  const navLinkStyle = ({ isActive }) => ({
    padding: '0.5rem 1rem',
    textDecoration: 'none',
    color: isActive ? '#0066cc' : '#333',
    fontWeight: isActive ? 'bold' : 'normal',
    borderBottom: isActive ? '2px solid #0066cc' : 'none'
  });

  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 2rem',
      background: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', marginRight: '2rem', color: '#0066cc' }}>
          Artifact Registry
        </h1>
        <NavLink to="/login" style={navLinkStyle}>
          Login
        </NavLink>
        <NavLink to="/health" style={navLinkStyle}>
          Health
        </NavLink>
        <NavLink to="/artifacts/lookup" style={navLinkStyle}>
          Lookup
        </NavLink>
        <NavLink to="/artifacts/upload" style={navLinkStyle}>
          Upload
        </NavLink>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {auth.token ? (
          <>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>
              Logged in as <strong>{auth.name}</strong>
              {auth.isAdmin && <span style={{ color: '#0066cc' }}> (admin)</span>}
            </span>
            <button
              onClick={onLogout}
              style={{
                padding: '0.5rem 1rem',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <span style={{ color: '#999', fontSize: '0.9rem' }}>Not logged in</span>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
