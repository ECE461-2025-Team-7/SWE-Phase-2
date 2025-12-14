// HealthPage.jsx - Health check status page with auto-refresh
import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100';

function HealthPage() {
  const [status, setStatus] = useState(null); // 'reachable' | 'unreachable'
  const [healthData, setHealthData] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const checkHealth = async () => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.ok) {
        const data = await response.json();
        setStatus('reachable');
        setHealthData(data);
        setResponseTime(duration);
        setLastChecked(new Date());
      } else {
        setStatus('unreachable');
        setHealthData(null);
        setResponseTime(duration);
        setLastChecked(new Date());
      }
    } catch (err) {
      const endTime = Date.now();
      setStatus('unreachable');
      setHealthData(null);
      setResponseTime(endTime - startTime);
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Check on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      checkHealth();
    }, 30000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTimestamp = (date) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.5rem', color: '#333' }}>Service Health</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Monitor the status of the backend API service
      </p>

      {/* Status Card */}
      <div
        role="region"
        aria-label="Health status"
        style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#333', fontSize: '1.2rem' }}>Current Status</h2>
          <button
            onClick={checkHealth}
            disabled={loading}
            aria-busy={loading}
            style={{
              padding: '0.5rem 1rem',
              background: loading ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            {loading ? 'Checking...' : 'Check Again'}
          </button>
        </div>

        {/* Status Badge */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            background: status === 'reachable' ? '#d4edda' : status === 'unreachable' ? '#f8d7da' : '#f0f0f0',
            color: status === 'reachable' ? '#155724' : status === 'unreachable' ? '#721c24' : '#666',
            border: `2px solid ${status === 'reachable' ? '#c3e6cb' : status === 'unreachable' ? '#f5c6cb' : '#ddd'}`
          }}
        >
          {loading && !status && '⏳ Checking...'}
          {status === 'reachable' && '✓ Service Reachable'}
          {status === 'unreachable' && '✗ Service Unreachable'}
        </div>

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
        </div>

        {/* Auto-refresh indicator */}
        <div style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
          Auto-refreshing every 30 seconds
        </div>
      </div>

      {/* Response Data (if available) */}
      {healthData && (
        <div
          style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#0066cc', fontSize: '1.1rem' }}>
            Response Data
          </h2>
          <pre style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {JSON.stringify(healthData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default HealthPage;

