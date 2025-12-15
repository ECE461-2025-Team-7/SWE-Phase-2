// HealthPage.jsx - Health check status page
import { useEffect, useState } from 'react';
import { getHealth } from '../apiClient';

function HealthPage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [responseTime, setResponseTime] = useState(null);

  const formatTimestamp = (value) => {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString();
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    const startedAt = performance.now();

    try {
      const data = await getHealth();
      setHealthData(data);
      setLastChecked(new Date());
      setResponseTime(Math.round(performance.now() - startedAt));
    } catch (err) {
      setError(err.message || 'Failed to fetch health status');
      setHealthData(null);
      setResponseTime(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
    const intervalId = setInterval(() => {
      handleRefresh();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

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

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Last Checked</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
            {formatTimestamp(lastChecked)}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Response Time</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
            {responseTime !== null ? `${responseTime} ms` : '—'}
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>API Status</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: healthData?.ok ? '#2e7d32' : '#c33' }}>
            {healthData ? (healthData.ok ? 'Healthy' : 'Unavailable') : 'Not checked yet'}
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div style={{ fontSize: '0.85rem', color: '#999', fontStyle: 'italic', marginBottom: '1rem' }}>
        Auto-refreshing every 30 seconds
      </div>

      {/* Response Data (if available) */}
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
