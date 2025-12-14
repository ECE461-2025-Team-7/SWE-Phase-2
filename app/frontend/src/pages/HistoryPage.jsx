import React, { useState } from 'react';
import { getArtifactHistory, listArtifacts } from '../apiClient';

const HistoryPage = () => {
  const [artifactType, setArtifactType] = useState('model');
  const [artifactId, setArtifactId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchName, setSearchName] = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearchArtifacts = async () => {
    if (!searchName.trim()) {
      setError('Please enter an artifact name to search');
      return;
    }

    setSearchLoading(true);
    setError('');
    try {
      const { data } = await listArtifacts([{ name: searchName, types: [artifactType] }]);
      setArtifacts(data);
      if (data.length === 0) {
        setError('No artifacts found matching that name');
      }
    } catch (err) {
      setError(err.message || 'Failed to search artifacts');
      setArtifacts([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectArtifact = (artifact) => {
    setArtifactId(artifact.id);
    setArtifactType(artifact.type);
    setArtifacts([]);
    setSearchName('');
  };

  const handleFetchHistory = async () => {
    if (!artifactId.trim()) {
      setError('Please enter an artifact ID');
      return;
    }

    setLoading(true);
    setError('');
    setHistory([]);

    try {
      const response = await getArtifactHistory(artifactType, artifactId);
      // Backend returns {artifact, history, count}, we need the history array
      const historyData = response.history || response;
      setHistory(historyData);
      if (historyData.length === 0) {
        setError('No history found for this artifact');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatChanges = (changes) => {
    if (!changes || typeof changes !== 'object') return 'N/A';
    return JSON.stringify(changes, null, 2);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#333', marginBottom: '10px' }}>Artifact History Viewer</h1>
      <p style={{ color: '#595959', marginBottom: '30px' }}>
        View change logs and history for artifacts (Admin only)
      </p>

      {/* Search Section */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 id="search-section-heading" style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
          Search for Artifact
        </h2>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label htmlFor="search-name" className="sr-only">Artifact name</label>
            <input
              id="search-name"
              type="text"
              placeholder="Artifact name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              aria-label="Search by artifact name"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label htmlFor="search-type" className="sr-only">Artifact type</label>
            <select
              id="search-type"
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value)}
              aria-label="Filter by artifact type"
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="model">Model</option>
              <option value="dataset">Dataset</option>
              <option value="code">Code</option>
            </select>
          </div>

          <button
            onClick={handleSearchArtifacts}
            disabled={searchLoading}
            aria-busy={searchLoading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: searchLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {artifacts.length > 0 && (
          <div aria-live="polite" style={{ marginTop: '15px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#333' }}>
              Search Results:
            </h3>
            <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  role="listitem"
                  onClick={() => handleSelectArtifact(artifact)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectArtifact(artifact)}
                  tabIndex={0}
                  aria-label={`Select ${artifact.name}, type: ${artifact.type}`}
                  style={{
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                >
                  <div style={{ fontWeight: '600', color: '#333' }}>{artifact.name}</div>
                  <div style={{ fontSize: '12px', color: '#595959', marginTop: '4px' }}>
                    ID: {artifact.id} | Type: {artifact.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual ID Entry Section */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
          Or Enter Artifact ID Directly
        </h2>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="direct-type" className="sr-only">Artifact type</label>
            <select
              id="direct-type"
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value)}
              aria-label="Artifact type"
              style={{
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="model">Model</option>
              <option value="dataset">Dataset</option>
              <option value="code">Code</option>
            </select>
          </div>

          <div style={{ flex: '1', minWidth: '300px' }}>
            <label htmlFor="direct-id" className="sr-only">Artifact ID</label>
            <input
              id="direct-id"
              type="text"
              placeholder="Artifact ID (UUID)"
              value={artifactId}
              onChange={(e) => setArtifactId(e.target.value)}
              aria-label="Artifact ID (UUID format)"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          <button
            onClick={handleFetchHistory}
            disabled={loading}
            aria-busy={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Loading...' : 'View History'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '15px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            color: '#856404',
            marginBottom: '20px'
          }}
        >
          {error}
        </div>
      )}

      {/* History Display */}
      {history.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
            History ({history.length} entries)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {history.map((entry, index) => (
              <div
                key={index}
                style={{
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      backgroundColor: '#0066cc',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      marginRight: '10px'
                    }}>
                      {entry.action}
                    </span>
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      by <strong>{entry.user}</strong>
                    </span>
                  </div>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                <div style={{ fontSize: '14px', color: '#333' }}>
                  <div style={{ marginBottom: '5px' }}>
                    <strong>Artifact:</strong> {entry.artifact_type}/{entry.artifact_id}
                  </div>

                  {entry.changes && Object.keys(entry.changes).length > 0 && (
                    <div>
                      <strong>Changes:</strong>
                      <pre style={{
                        backgroundColor: '#fff',
                        padding: '10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        marginTop: '5px',
                        border: '1px solid #e0e0e0'
                      }}>
                        {formatChanges(entry.changes)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
