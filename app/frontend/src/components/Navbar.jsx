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
    <nav
      role="navigation"
      aria-label="Main navigation"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        background: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1rem'
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h1 data-testid="navbar-title" style={{ fontSize: '1.25rem', marginRight: '2rem', color: '#0066cc' }}>
          Artifact Registry
        </h1>

        {/* Health is always visible */}
        <NavLink
          to="/health"
          style={navLinkStyle}
          aria-current={({ isActive }) => isActive ? 'page' : undefined}
        >
          Health
        </NavLink>

        {/* These links only show when authenticated */}
        {auth.token && (
          <>
            <NavLink
              to="/search"
              style={navLinkStyle}
              aria-current={({ isActive }) => isActive ? 'page' : undefined}
            >
              Search
            </NavLink>
            <NavLink
              to="/upload"
              style={navLinkStyle}
              aria-current={({ isActive }) => isActive ? 'page' : undefined}
            >
              Upload
            </NavLink>
          </>
        )}

        {/* Admin link only for admins */}
        {auth.token && auth.isAdmin && (
          <>
            <NavLink
              to="/admin"
              style={navLinkStyle}
              aria-current={({ isActive }) => isActive ? 'page' : undefined}
            >
              Admin
            </NavLink>
            <NavLink
              to="/history"
              style={navLinkStyle}
              aria-current={({ isActive }) => isActive ? 'page' : undefined}
            >
              History
            </NavLink>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {auth.token ? (
          <>
            <span style={{ color: '#595959', fontSize: '0.9rem' }}>
              Logged in as <strong>{auth.name}</strong>
              {auth.isAdmin && <span style={{ color: '#0066cc' }}> (admin)</span>}
            </span>
            <button
              onClick={onLogout}
              aria-label="Log out of your account"
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
          <NavLink
            to="/login"
            style={{
              padding: '0.5rem 1rem',
              background: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            Login
          </NavLink>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
