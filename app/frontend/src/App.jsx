// App.jsx - Top-level layout and routing
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { initializeAuth, setToken as setApiToken, clearAuth } from './apiClient';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import HealthPage from './pages/HealthPage';
import ArtifactLookupPage from './pages/ArtifactLookupPage';
import UploadArtifactPage from './pages/UploadArtifactPage';
import ArtifactSearchPage from './pages/ArtifactSearchPage';
import ArtifactRegexSearchPage from './pages/ArtifactRegexSearchPage';
import UserManagementPage from './pages/UserManagementPage';
import HistoryPage from './pages/HistoryPage';

// Simple auth guard component
function RequireAuth({ auth, children }) {
  if (!auth.token) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#333' }}>Authentication Required</h2>
        <p>Please log in to access this page.</p>
        <Link to="/login" style={{ color: '#0066cc', textDecoration: 'underline' }}>
          Go to Login
        </Link>
      </div>
    );
  }
  return children;
}

// Admin-only guard component
function RequireAdmin({ auth, children }) {
  if (!auth.token) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#333' }}>Authentication Required</h2>
        <p>Please log in to access this page.</p>
        <Link to="/login" style={{ color: '#0066cc', textDecoration: 'underline' }}>
          Go to Login
        </Link>
      </div>
    );
  }
  if (!auth.isAdmin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#c33' }}>Access Denied</h2>
        <p>This page requires administrator privileges.</p>
        <Link to="/" style={{ color: '#0066cc', textDecoration: 'underline' }}>
          Go Home
        </Link>
      </div>
    );
  }
  return children;
}

function App() {
  const [auth, setAuth] = useState({
    token: null,
    name: null,
    isAdmin: false
  });

  // Initialize auth from localStorage on mount
  useEffect(() => {
    const stored = initializeAuth();
    if (stored.token) {
      setAuth({
        token: stored.token,
        name: stored.name,
        isAdmin: stored.isAdmin
      });
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = (authData) => {
    setAuth({
      token: authData.token,
      name: authData.name,
      isAdmin: authData.is_admin
    });
    setApiToken(authData.token);
  };

  // Handle logout
  const handleLogout = () => {
    clearAuth();
    setAuth({
      token: null,
      name: null,
      isAdmin: false
    });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar auth={auth} onLogout={handleLogout} />
      
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        <Routes>
          <Route 
            path="/login" 
            element={<LoginPage onLoginSuccess={handleLoginSuccess} />} 
          />
          
          <Route 
            path="/health" 
            element={
              <RequireAuth auth={auth}>
                <HealthPage />
              </RequireAuth>
            } 
          />
          
          <Route 
            path="/artifacts/lookup" 
            element={
              <RequireAuth auth={auth}>
                <ArtifactLookupPage />
              </RequireAuth>
            } 
          />
          
          <Route 
            path="/artifacts/upload" 
            element={
              <RequireAuth auth={auth}>
                <UploadArtifactPage />
              </RequireAuth>
            } 
          />

          <Route
            path="/artifacts/search"
            element={
              <RequireAuth auth={auth}>
                <ArtifactSearchPage />
              </RequireAuth>
            }
          />

          <Route
            path="/artifacts/search/regex"
            element={
              <RequireAuth auth={auth}>
                <ArtifactRegexSearchPage />
              </RequireAuth>
            }
          />

          <Route
            path="/users"
            element={
              <RequireAdmin auth={auth}>
                <UserManagementPage />
              </RequireAdmin>
            }
          />

          <Route
            path="/history"
            element={
              <RequireAdmin auth={auth}>
                <HistoryPage />
              </RequireAdmin>
            }
          />
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
