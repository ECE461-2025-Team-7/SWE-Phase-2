// SearchPage.jsx - Combined search page with tabs for Query Search, Lookup by ID, and Regex Search
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { listArtifacts, getArtifact, searchArtifactsByRegex } from '../apiClient';

const typeOptions = ['model', 'dataset', 'code'];

// Tab button styling helper
const getTabStyle = (isActive) => ({
  padding: '0.75rem 1.5rem',
  background: isActive ? '#0066cc' : '#f0f0f0',
  color: isActive ? 'white' : '#333',
  border: 'none',
  borderRadius: '4px 4px 0 0',
  cursor: 'pointer',
  fontWeight: isActive ? 'bold' : 'normal',
  fontSize: '1rem',
  marginRight: '0.25rem'
});

// ---------- Query Search Tab ----------
function QueryRow({ index, query, onChange, onRemove, disableRemove }) {
  const updateField = (field, value) => {
    onChange(index, { ...query, [field]: value });
  };

  const toggleType = (type) => {
    const current = new Set(query.types || []);
    if (current.has(type)) current.delete(type); else current.add(type);
    updateField('types', Array.from(current));
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '0.75rem', marginBottom: '0.75rem', background: '#fff' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#555' }}>Name</label>
          <input
            type="text"
            value={query.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="artifact name or *"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#555' }}>Types (optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {typeOptions.map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={(query.types || []).includes(t)}
                  onChange={() => toggleType(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => updateField('name', '*')}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #999', background: '#f1f1f1', borderRadius: 4, cursor: 'pointer' }}
          >
            Wildcard
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disableRemove}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #c33', background: disableRemove ? '#eee' : '#fee', color: '#900', borderRadius: 4, cursor: disableRemove ? 'not-allowed' : 'pointer' }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function QuerySearchTab({ onViewArtifact }) {
  const [queries, setQueries] = useState([{ name: '' }]);
  const [results, setResults] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateQuery = (idx, updated) => {
    setQueries((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  };

  const addQuery = () => setQueries((prev) => [...prev, { name: '' }]);
  const removeQuery = (idx) => setQueries((prev) => prev.filter((_, i) => i !== idx));

  const executeSearch = async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const cleaned = queries.map((q) => ({
        name: q.name?.trim() || '',
        ...(q.types && q.types.length ? { types: q.types } : {}),
      })).filter((q) => q.name.length > 0);
      if (cleaned.length === 0) {
        setError('Please provide at least one query name.');
        setLoading(false);
        return;
      }
      const { data, nextOffset: headerOffset } = await listArtifacts(cleaned, offset);
      setResults(data || []);
      setNextOffset(headerOffset);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
      setNextOffset(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p style={{ marginTop: 0, color: '#666' }}>Use exact names or "*" wildcard; optionally filter by type.</p>

      <div style={{ marginBottom: '1rem' }}>
        {queries.map((q, idx) => (
          <QueryRow
            key={idx}
            index={idx}
            query={q}
            onChange={updateQuery}
            onRemove={removeQuery}
            disableRemove={queries.length === 1}
          />
        ))}
        <button
          type="button"
          onClick={addQuery}
          style={{ padding: '0.5rem 1rem', border: '1px dashed #777', background: '#fafafa', borderRadius: 4, cursor: 'pointer' }}
        >
          + Add Query
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => executeSearch(0)}
          disabled={loading}
          style={{ padding: '0.75rem 1.5rem', background: loading ? '#ccc' : '#0066cc', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        {nextOffset && (
          <button
            onClick={() => executeSearch(Number(nextOffset))}
            disabled={loading}
            style={{ padding: '0.6rem 1.2rem', background: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Next Page (offset {nextOffset})
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee', color: '#a00', borderRadius: 4, marginBottom: '1rem' }}>{error}</div>
      )}

      <ResultsTable results={results} loading={loading} onViewArtifact={onViewArtifact} />
    </div>
  );
}

// ---------- Lookup by ID Tab ----------
function LookupTab({ onViewArtifact }) {
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
      <p style={{ marginTop: 0, color: '#666' }}>Look up a specific artifact by its type and ID.</p>
      
      <form onSubmit={handleFetch} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 150px' }}>
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

          <div style={{ flex: '1 1 300px' }}>
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
              padding: '0.6rem 1.5rem',
              background: (loading || !artifactId) ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: (loading || !artifactId) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Fetching...' : 'Fetch'}
          </button>
        </div>
      </form>

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#0066cc' }}>Artifact Found</h3>
            <button
              onClick={() => onViewArtifact(result.metadata?.type || artifactType, result.metadata?.id || artifactId)}
              style={{
                padding: '0.5rem 1rem',
                background: '#0066cc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              View Details
            </button>
          </div>
          <pre style={{
            background: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            fontSize: '0.9rem',
            lineHeight: '1.5',
            margin: 0
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------- Regex Search Tab ----------
function RegexTab({ onViewArtifact }) {
  const [regex, setRegex] = useState('');
  const [results, setResults] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeSearch = async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const { data, nextOffset: headerOffset } = await searchArtifactsByRegex(regex, offset);
      setResults(data || []);
      setNextOffset(headerOffset);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
      setNextOffset(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p style={{ marginTop: 0, color: '#666' }}>Matches against artifact names. Use standard JavaScript regex syntax.</p>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          value={regex}
          onChange={(e) => setRegex(e.target.value)}
          placeholder="e.g., .*whisper.*"
          style={{ flex: '1 1 auto', padding: '0.6rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={() => executeSearch(0)}
          disabled={loading || !regex}
          style={{ padding: '0.7rem 1.4rem', background: loading || !regex ? '#ccc' : '#0066cc', color: '#fff', border: 'none', borderRadius: 4, cursor: loading || !regex ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        {nextOffset && (
          <button
            onClick={() => executeSearch(Number(nextOffset))}
            disabled={loading}
            style={{ padding: '0.6rem 1.2rem', background: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Next Page (offset {nextOffset})
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee', color: '#a00', borderRadius: 4, marginBottom: '1rem' }}>{error}</div>
      )}

      <ResultsTable results={results} loading={loading} onViewArtifact={onViewArtifact} />
    </div>
  );
}

// ---------- Shared Results Table Component ----------
function ResultsTable({ results, loading, onViewArtifact }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <h3 style={{ marginTop: 0, color: '#444' }}>Results</h3>
      {loading && <p style={{ color: '#666' }}>Loading…</p>}
      {!loading && results.length === 0 && <p style={{ color: '#666' }}>No results yet.</p>}
      {!loading && results.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f7f7' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>ID</th>
              <th style={{ textAlign: 'center', padding: '0.5rem', borderBottom: '1px solid #eee' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={`${r.type}:${r.id}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.5rem' }}>{r.name}</td>
                <td style={{ padding: '0.5rem' }}>{r.type}</td>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.id}</td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <button
                    onClick={() => onViewArtifact(r.type, r.id)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: '#0066cc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Main SearchPage Component ----------
function SearchPage() {
  const [activeTab, setActiveTab] = useState('query');
  const navigate = useNavigate();
  const location = useLocation();
  const [successMessage, setSuccessMessage] = useState(null);

  // Check for success message from navigation state (e.g., after deleting artifact)
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Clear the message from location state
      window.history.replaceState({}, document.title);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleViewArtifact = (type, id) => {
    navigate(`/artifact/${type}/${id}`);
  };

  return (
    <div>
      <h2 data-testid="search-heading" style={{ marginBottom: '1rem', color: '#333' }}>Search Artifacts</h2>

      {/* Success Message */}
      {successMessage && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span><strong>✓</strong> {successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#155724',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 0.5rem'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ marginBottom: 0 }}>
        <button
          onClick={() => setActiveTab('query')}
          style={getTabStyle(activeTab === 'query')}
        >
          Query Search
        </button>
        <button
          onClick={() => setActiveTab('lookup')}
          style={getTabStyle(activeTab === 'lookup')}
        >
          Lookup by ID
        </button>
        <button
          onClick={() => setActiveTab('regex')}
          style={getTabStyle(activeTab === 'regex')}
        >
          Regex Search
        </button>
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '0 8px 8px 8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid #eee',
        borderTop: '3px solid #0066cc'
      }}>
        {activeTab === 'query' && <QuerySearchTab onViewArtifact={handleViewArtifact} />}
        {activeTab === 'lookup' && <LookupTab onViewArtifact={handleViewArtifact} />}
        {activeTab === 'regex' && <RegexTab onViewArtifact={handleViewArtifact} />}
      </div>
    </div>
  );
}

export default SearchPage;
