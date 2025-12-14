// HealthPage.jsx - Health check status page
import { useState } from 'react';
import { getHealth } from '../apiClient';

function HealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHealth();
      setHealthData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Health Status</h2>

      <button
        onClick={handleRefresh}
        disabled={loading}
        aria-busy={loading}
        style={{
          padding: '0.75rem 1.5rem',
          background: loading ? '#ccc' : '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          marginBottom: '1.5rem'
        }}
      >
        {loading ? 'Loading...' : 'Refresh Health'}
      </button>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '1rem',
            background: '#fee',
            color: '#c33',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}
        >
          {error}
        </div>
      )}

      {healthData && (
        <div
          aria-live="polite"
          style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <h3 style={{ marginBottom: '1rem', color: '#0066cc' }}>Response:</h3>
          <pre style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9rem',
            lineHeight: '1.5'
          }}>
            {JSON.stringify(healthData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default HealthPage;

