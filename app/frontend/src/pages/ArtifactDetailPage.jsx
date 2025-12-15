// ArtifactDetailPage.jsx - View artifact details with admin delete functionality
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtifact, deleteArtifact } from '../apiClient';

function ArtifactDetailPage({ auth }) {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [artifact, setArtifact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchArtifact();
  }, [type, id]);

  const fetchArtifact = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArtifact(type, id);
      setArtifact(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch artifact');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteArtifact(type, id);
      navigate('/search', { state: { message: `Artifact "${artifact?.metadata?.name || id}" deleted successfully` } });
    } catch (err) {
      setError(err.message || 'Failed to delete artifact');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>Loading artifact...</p>
      </div>
    );
  }

  if (error && !artifact) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          padding: '1rem',
          background: '#fee',
          color: '#c33',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={() => navigate('/search')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ← Back to Search
        </button>
      </div>
    );
  }

  const metadata = artifact?.metadata || {};
  const metrics = artifact?.metrics || {};

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header with back button and delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/search')}
          style={{
            padding: '0.5rem 1rem',
            background: '#f0f0f0',
            color: '#333',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          ← Back to Search
        </button>
        
        {auth.isAdmin && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '0.5rem 1rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Delete Artifact
          </button>
        )}
      </div>

      {/* Error message for delete failure */}
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

      {/* Main artifact info */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            background: type === 'model' ? '#0066cc' : type === 'dataset' ? '#28a745' : '#6f42c1',
            color: 'white',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}>
            {type}
          </span>
          <h2 style={{ margin: 0, color: '#333' }}>{metadata.name || 'Unknown'}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <InfoField label="ID" value={metadata.id} mono />
          <InfoField label="Version" value={metadata.version} />
          <InfoField label="Uploaded By" value={metadata.uploaded_by} />
          <InfoField label="Created" value={metadata.created_at ? new Date(metadata.created_at).toLocaleString() : 'N/A'} />
        </div>

        {metadata.url && (
          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', color: '#666', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Source URL</label>
            <a 
              href={metadata.url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#0066cc', wordBreak: 'break-all' }}
            >
              {metadata.url}
            </a>
          </div>
        )}
      </div>

      {/* Metrics section */}
      {Object.keys(metrics).length > 0 && (
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#0066cc' }}>Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {Object.entries(metrics).map(([key, value]) => (
              <MetricCard key={key} label={formatMetricLabel(key)} value={value} />
            ))}
          </div>
        </div>
      )}

      {/* Full JSON data */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#0066cc' }}>Raw Data</h3>
        <pre style={{
          background: '#f8f9fa',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.85rem',
          lineHeight: '1.5',
          margin: 0
        }}>
          {JSON.stringify(artifact, null, 2)}
        </pre>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
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
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>Confirm Delete</h3>
            <p style={{ color: '#333' }}>
              Are you sure you want to delete the artifact <strong>"{metadata.name}"</strong>?
            </p>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f0f0f0',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: deleting ? '#ccc' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for info fields
function InfoField({ label, value, mono }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#666', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
        {label}
      </label>
      <span style={{
        color: '#333',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontSize: mono ? '0.9rem' : '1rem'
      }}>
        {value || 'N/A'}
      </span>
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ label, value }) {
  const displayValue = typeof value === 'number' 
    ? (value % 1 === 0 ? value : value.toFixed(2))
    : value;

  return (
    <div style={{
      background: '#f8f9fa',
      padding: '1rem',
      borderRadius: '6px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0066cc' }}>
        {displayValue}
      </div>
      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  );
}

// Helper function to format metric labels
function formatMetricLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export default ArtifactDetailPage;
