// ArtifactLookupPage.jsx - Look up artifacts by type and ID
import { useState } from 'react';
import { getArtifact } from '../apiClient';

function ArtifactLookupPage() {
  const [artifactType, setArtifactType] = useState('model');
  const [artifactId, setArtifactId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await getArtifact(artifactType, artifactId);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch artifact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Artifact Lookup</h2>
      
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <form onSubmit={handleFetch}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>
              Artifact Type
            </label>
            <select
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="model">model</option>
              <option value="dataset">dataset</option>
              <option value="code">code</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#555' }}>
              Artifact ID
            </label>
            <input
              type="text"
              value={artifactId}
              onChange={(e) => setArtifactId(e.target.value)}
              placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !artifactId}
            style={{
              padding: '0.75rem 1.5rem',
              background: (loading || !artifactId) ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: (loading || !artifactId) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Fetching...' : 'Fetch Artifact'}
          </button>
        </form>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          background: '#fee',
          color: '#c33',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#0066cc' }}>Artifact Found:</h3>
          <pre style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9rem',
            lineHeight: '1.5'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ArtifactLookupPage;
