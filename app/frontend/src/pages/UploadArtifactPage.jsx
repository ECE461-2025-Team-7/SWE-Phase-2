// UploadArtifactPage.jsx - Upload new artifacts
import { useState } from 'react';
import { createArtifact } from '../apiClient';

function UploadArtifactPage() {
  const [artifactType, setArtifactType] = useState('model');
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await createArtifact(artifactType, url);
      setResult(data);
      setUrl(''); // Clear form on success
    } catch (err) {
      setError(err.message || 'Failed to upload artifact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Upload Artifact</h2>
      
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <form onSubmit={handleUpload}>
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
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
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
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
              The URL will be rated by Python helper. Must meet minimum threshold.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !url}
            style={{
              padding: '0.75rem 1.5rem',
              background: (loading || !url) ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: (loading || !url) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Uploading...' : 'Upload Artifact'}
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
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <h3 style={{ marginBottom: '0.5rem' }}>✓ Artifact Created Successfully!</h3>
          <p style={{ margin: '0.5rem 0' }}>
            <strong>ID:</strong> {result.metadata?.id}
          </p>
          <p style={{ margin: '0.5rem 0' }}>
            <strong>Name:</strong> {result.metadata?.name}
          </p>
        </div>
      )}

      {result && (
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '1rem', color: '#0066cc' }}>Full Response:</h3>
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

export default UploadArtifactPage;
